import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import config, jobs
from app.pipeline.orchestrator import retry_stage, run_pipeline

app = FastAPI(title="AI Classroom Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoCacheStaticFiles(StaticFiles):
    """Never let the browser cache index.html/app.js/style.css during development."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store"
        return response


# Mount legacy frontend if folder exists
if (Path("frontend")).exists():
    app.mount("/app", NoCacheStaticFiles(directory="frontend", html=True), name="frontend")


class LessonRequest(BaseModel):
    topic: str


@app.post("/lessons")
async def create_lesson(req: LessonRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    job_id = jobs.create_job(topic)
    asyncio.create_task(run_pipeline(job_id, topic))
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    result = dict(job)
    if job["status"] == "done":
        result["slides_json_url"] = f"/jobs/{job_id}/slides.json"
        result["slides_html_url"] = f"/jobs/{job_id}/slides.html"
        result["transcript_url"] = f"/jobs/{job_id}/transcript.json"
        result["audio_url"] = f"/jobs/{job_id}/audio/final.mp3"
    return result


@app.post("/jobs/{job_id}/retry/{stage}")
async def retry_job_stage(job_id: str, stage: str):
    allowed_stages = {"outline", "slides", "transcript", "tts"}
    if stage not in allowed_stages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage '{stage}'. Must be one of {list(allowed_stages)}",
        )

    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    job_dir = config.STORAGE_DIR / job_id
    if stage == "slides":
        if not (job_dir / "outline.json").exists():
            raise HTTPException(
                status_code=409,
                detail="Prerequisite outline.json does not exist. Cannot retry slides.",
            )
    elif stage == "transcript":
        if not (job_dir / "outline.json").exists() or not (job_dir / "slides.json").exists():
            raise HTTPException(
                status_code=409,
                detail="Prerequisite outline.json or slides.json does not exist. Cannot retry transcript.",
            )
    elif stage == "tts":
        if not (job_dir / "transcript.json").exists():
            raise HTTPException(
                status_code=409,
                detail="Prerequisite transcript.json does not exist. Cannot retry tts.",
            )

    asyncio.create_task(retry_stage(job_id, stage))
    return {"job_id": job_id, "stage": stage, "status": "retrying"}


@app.get("/jobs/{job_id}/slides.html")
async def get_slides_html(job_id: str):
    path = config.STORAGE_DIR / job_id / "slides.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail="slides.html not found")
    return FileResponse(path, media_type="text/html")


@app.get("/jobs/{job_id}/slides.json")
async def get_slides_json(job_id: str):
    path = config.STORAGE_DIR / job_id / "slides.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="slides.json not found")
    return FileResponse(path, media_type="application/json")


@app.get("/jobs/{job_id}/transcript.json")
async def get_transcript(job_id: str):
    path = config.STORAGE_DIR / job_id / "transcript.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="transcript.json not found")
    return FileResponse(path, media_type="application/json")


@app.get("/jobs/{job_id}/audio/{filename}")
async def get_audio(job_id: str, filename: str):
    path = config.STORAGE_DIR / job_id / "audio" / filename
    if filename == "final.mp3":
        path = config.STORAGE_DIR / job_id / "final.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(path, media_type="audio/mpeg")
