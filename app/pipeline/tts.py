import asyncio
import os
import shutil
import subprocess
from pathlib import Path

import edge_tts

from app import config


def _find_binary(name: str) -> str | None:
    # 1. Check system PATH
    found = shutil.which(name)
    if found:
        return found

    # 2. Check known Winget Links path
    winget_link = Path.home() / f"AppData/Local/Microsoft/WinGet/Links/{name}.exe"
    if winget_link.exists():
        return str(winget_link)

    # 3. Search common Winget Package dirs
    winget_pkgs = Path.home() / "AppData/Local/Microsoft/WinGet/Packages"
    if winget_pkgs.exists():
        for match in winget_pkgs.glob(f"**/{name}.exe"):
            if match.is_file():
                return str(match)

    # 4. Check Chocolatey / Scoop / Program Files
    common_paths = [
        Path(f"C:/ProgramData/chocolatey/bin/{name}.exe"),
        Path.home() / f"scoop/shims/{name}.exe",
        Path(f"C:/ffmpeg/bin/{name}.exe"),
    ]
    for p in common_paths:
        if p.exists():
            return str(p)

    return None


def get_audio_duration(path: Path) -> float:
    ffprobe_bin = _find_binary("ffprobe")
    if ffprobe_bin:
        try:
            cmd = [
                ffprobe_bin,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            val = float(res.stdout.strip())
            if val > 0:
                return val
        except Exception:
            pass

    # Fallback duration estimate from MP3 bitrate (~48kbps or 64kbps for edge-tts)
    try:
        size_bytes = path.stat().st_size
        # edge-tts default audio bitrate is approx 48kbps (6000 bytes/sec)
        return max(1.5, size_bytes / 6000.0)
    except Exception:
        return 3.0


async def synthesize(turns: list[dict], job_dir: Path) -> Path:
    """Generate one mp3 per turn, then concat into a single final.mp3 via ffmpeg or stream concat."""
    audio_dir = job_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    turn_paths = []
    current_time = 0.0
    for i, turn in enumerate(turns, start=1):
        voice = config.VOICES[turn["speaker"]]
        path = audio_dir / f"turn_{i:03d}.mp3"
        await edge_tts.Communicate(turn["text"], voice).save(str(path))
        turn_paths.append(path)

        # Measure duration and set start/end timestamps
        duration = await asyncio.to_thread(get_audio_duration, path)
        turn["start_time"] = current_time
        turn["duration"] = duration
        turn["end_time"] = current_time + duration
        current_time += duration

    final_path = job_dir / "final.mp3"
    ffmpeg_bin = _find_binary("ffmpeg")

    if ffmpeg_bin:
        try:
            list_file = audio_dir / "concat_list.txt"
            list_file.write_text(
                "\n".join(f"file '{p.name}'" for p in turn_paths), encoding="utf-8"
            )
            await asyncio.to_thread(
                subprocess.run,
                [
                    ffmpeg_bin,
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(list_file),
                    "-c",
                    "copy",
                    str(final_path),
                ],
                cwd=audio_dir,
                capture_output=True,
                check=True,
            )
            return final_path
        except Exception as e:
            print(f"[Warning] ffmpeg concat failed: {e}. Falling back to binary stream concat.")

    # Seamless fallback: concatenate raw MP3 audio frames directly
    with open(final_path, "wb") as outfile:
        for p in turn_paths:
            with open(p, "rb") as infile:
                outfile.write(infile.read())

    return final_path
