import asyncio
import json
from pathlib import Path

from app import config, jobs
from app.pipeline.outline import build_outline
from app.pipeline.renderer import render_slides
from app.pipeline.slides import build_slides
from app.pipeline.transcript import build_transcript
from app.pipeline.tts import synthesize


async def run_pipeline(job_id: str, topic: str) -> None:
    job_dir = config.STORAGE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        jobs.update_job(job_id, status="outline", error_message=None)
        outline = await build_outline(topic)
        (job_dir / "outline.json").write_text(json.dumps(outline, indent=2), encoding="utf-8")

        jobs.update_job(job_id, status="slides_and_transcript")
        slides = await build_slides(outline)
        transcript = await build_transcript(outline, slides)
        (job_dir / "slides.json").write_text(json.dumps(slides, indent=2), encoding="utf-8")
        (job_dir / "slides.html").write_text(render_slides(slides), encoding="utf-8")

        jobs.update_job(job_id, status="tts")
        await synthesize(transcript["turns"], job_dir)
        (job_dir / "transcript.json").write_text(json.dumps(transcript, indent=2), encoding="utf-8")

        jobs.update_job(job_id, status="done")
    except Exception as e:
        jobs.update_job(job_id, status="error", error_message=str(e))


async def retry_stage(job_id: str, stage: str) -> None:
    job_dir = config.STORAGE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    job = jobs.get_job(job_id)
    topic = job["topic"] if job else "Lesson"

    try:
        if stage == "outline":
            await run_pipeline(job_id, topic)

        elif stage == "slides":
            outline_file = job_dir / "outline.json"
            if not outline_file.exists():
                raise FileNotFoundError("outline.json missing")
            jobs.update_job(job_id, status="slides_and_transcript", error_message=None)
            outline = json.loads(outline_file.read_text(encoding="utf-8"))
            slides = await build_slides(outline)
            (job_dir / "slides.json").write_text(json.dumps(slides, indent=2), encoding="utf-8")
            (job_dir / "slides.html").write_text(render_slides(slides), encoding="utf-8")
            jobs.update_job(job_id, status="done")

        elif stage == "transcript":
            outline_file = job_dir / "outline.json"
            slides_file = job_dir / "slides.json"
            if not outline_file.exists() or not slides_file.exists():
                raise FileNotFoundError("outline.json or slides.json missing")
            jobs.update_job(job_id, status="slides_and_transcript", error_message=None)
            outline = json.loads(outline_file.read_text(encoding="utf-8"))
            slides = json.loads(slides_file.read_text(encoding="utf-8"))
            transcript = await build_transcript(outline, slides)
            (job_dir / "transcript.json").write_text(json.dumps(transcript, indent=2), encoding="utf-8")

            jobs.update_job(job_id, status="tts")
            await synthesize(transcript["turns"], job_dir)
            jobs.update_job(job_id, status="done")

        elif stage == "tts":
            transcript_file = job_dir / "transcript.json"
            if not transcript_file.exists():
                raise FileNotFoundError("transcript.json missing")
            jobs.update_job(job_id, status="tts", error_message=None)
            transcript = json.loads(transcript_file.read_text(encoding="utf-8"))
            await synthesize(transcript["turns"], job_dir)
            # Re-write transcript in case timestamps were updated
            (job_dir / "transcript.json").write_text(json.dumps(transcript, indent=2), encoding="utf-8")
            jobs.update_job(job_id, status="done")

    except Exception as e:
        jobs.update_job(job_id, status="error", error_message=str(e))
