from __future__ import annotations

import glob
import json
import os
import shutil
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv

load_dotenv()

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile, Header, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, EmailStr
import logging

from app.pipeline import LESSON_01_SPEC, PDFPipeline, BlockItem
from app.vector_store import ingest_text_content, get_vector_store, CHROMA_PATH
from app.retriever import get_relevant_context
import chromadb
from app.database import (
    main_collection,
    ensure_indexes, log_activity
)
from app.auth import hash_password, verify_password, create_jwt_token, decode_jwt_token

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Sinhala Textbook Admin Portal")
pipeline = PDFPipeline()
_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()


class BuildTextRequest(BaseModel):
    job_id: str
    selected_images: list[str]
    subject: str = "Science11"
    lesson: str = "Lesson1"


class TopicData(BaseModel):
    title: str
    content: str


class FinalizeRequest(BaseModel):
    job_id: str
    topics: list[TopicData]
    subject: str = "Science11"
    lesson: str = "Lesson1"


@app.on_event("startup")
def startup_event():
    # Clean up old temp dirs
    temp_dir = tempfile.gettempdir()
    for path in glob.glob(os.path.join(temp_dir, "sinhala_job_*")):
        try:
            shutil.rmtree(path)
            logger.info(f"Cleaned up old job directory: {path}")
        except Exception as e:
            logger.warning(f"Failed to clean up {path}: {e}")
    # Ensure DB indexes
    try:
        ensure_indexes()
    except Exception as e:
        logger.warning(f"Could not ensure DB indexes (DB may be offline): {e}")


# ──────────────────── Helper: JWT Auth Guard ────────────────────
def get_current_admin(authorization: str = Header(None)) -> dict:
    """Extract and validate the JWT from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    payload = decode_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ──────────────────── Auth Routes ────────────────────
class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/signup")
def signup(req: SignupRequest):
    existing = main_collection.find_one({"type": "admin", "email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    main_collection.insert_one({
        "type": "admin",
        "first_name": req.first_name,
        "last_name": req.last_name,
        "email": req.email,
        "password": hash_password(req.password),
        "role": "admin",
        "created_at": datetime.now(timezone.utc),
    })
    log_activity("signup", req.email, f"Admin account created for {req.first_name} {req.last_name}")
    return {"message": "Account created successfully. You can now sign in."}


@app.post("/auth/login")
def login(req: LoginRequest):
    user = main_collection.find_one({"type": "admin", "email": req.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    token = create_jwt_token(user["email"], user.get("role", "admin"), name)
    log_activity("login", req.email, "Admin logged in")
    return {"token": token, "role": user.get("role", "admin"), "name": name}


# ──────────────────── Admin Dashboard API ────────────────────
@app.get("/api/admin/dashboard")
def admin_dashboard(authorization: str = Header(None)):
    admin = get_current_admin(authorization)
    try:
        teacher_count = main_collection.count_documents({"type": "teacher"})
    except Exception:
        teacher_count = 0
    try:
        lesson_count = main_collection.count_documents({"type": "lesson"})
    except Exception:
        lesson_count = 0
    try:
        store = get_vector_store()
        vdb_chunks = store._collection.count()
    except Exception:
        vdb_chunks = 0
    try:
        subject_count = main_collection.count_documents({"type": "subject"})
    except Exception:
        subject_count = 0

    return {
        "name": admin.get("name", "Admin"),
        "teacher_count": teacher_count,
        "lesson_count": lesson_count,
        "subject_count": subject_count,
        "vdb_chunks": vdb_chunks,
    }


@app.get("/api/admin/subjects")
def list_subjects(authorization: str = Header(None)):
    get_current_admin(authorization)
    subjects = list(main_collection.find({"type": "subject"}, {"_id": 0}))
    return {"subjects": subjects}


# ──────────────────── Teacher Management ────────────────────
class AddTeacherRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    contact_number: str
    address: str
    password: str
    nic_number: str


@app.post("/api/admin/teachers")
def add_teacher(req: AddTeacherRequest, authorization: str = Header(None)):
    admin = get_current_admin(authorization)
    existing = main_collection.find_one({"type": "teacher", "$or": [{"email": req.email}, {"nic_number": req.nic_number}]})
    if existing:
        raise HTTPException(status_code=400, detail="A teacher with this email or NIC already exists")

    main_collection.insert_one({
        "type": "teacher",
        "first_name": req.first_name,
        "last_name": req.last_name,
        "email": req.email,
        "contact_number": req.contact_number,
        "address": req.address,
        "password": hash_password(req.password),
        "nic_number": req.nic_number,
        "added_by": admin.get("email", "unknown"),
        "created_at": datetime.now(timezone.utc),
    })
    log_activity("add_teacher", admin.get("email", ""), f"Added teacher: {req.first_name} {req.last_name}")
    return {"message": f"Teacher {req.first_name} {req.last_name} added successfully"}


@app.get("/api/admin/teachers")
def list_teachers(authorization: str = Header(None)):
    get_current_admin(authorization)
    teachers = list(main_collection.find({"type": "teacher"}, {"_id": 0, "password": 0}))
    return {"teachers": teachers}


# ──────────────────── Lesson Recording ────────────────────
class RecordLessonRequest(BaseModel):
    subject_name: str
    lesson_name: str
    topics: list[str]
    source_filename: str
    chunk_count: int = 0


@app.post("/api/admin/lessons")
def record_lesson(req: RecordLessonRequest, authorization: str = Header(None)):
    admin = get_current_admin(authorization)

    # Upsert the subject
    main_collection.update_one(
        {"type": "subject", "name": req.subject_name},
        {
            "$setOnInsert": {"type": "subject", "name": req.subject_name, "created_at": datetime.now(timezone.utc)},
            "$addToSet": {"lessons": req.lesson_name}
        },
        upsert=True
    )

    # Insert the lesson record
    main_collection.insert_one({
        "type": "lesson",
        "subject_name": req.subject_name,
        "lesson_name": req.lesson_name,
        "topics": req.topics,
        "source_filename": req.source_filename,
        "chunk_count": req.chunk_count,
        "added_by": admin.get("email", "unknown"),
        "created_at": datetime.now(timezone.utc),
    })

    log_activity("add_lesson", admin.get("email", ""), f"Added lesson '{req.lesson_name}' to subject '{req.subject_name}'")
    return {"message": f"Lesson '{req.lesson_name}' recorded for '{req.subject_name}'"}


# ──────────────────── Activity Logs ────────────────────
@app.get("/api/admin/logs")
def get_logs(authorization: str = Header(None), limit: int = 50):
    get_current_admin(authorization)
    logs = list(
        main_collection.find({"type": "activity_log"}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    # Convert datetime to string for JSON serialization
    for log in logs:
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    return {"logs": logs}


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    html_path = Path(__file__).parent / "index.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "<h1>UI not found</h1>"


@app.post("/api/extract")
async def extract_pdf(
    background_tasks: BackgroundTasks, file: UploadFile = File(...)
) -> JSONResponse:
    if file.content_type not in {
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    job_id = str(uuid.uuid4())
    job_dir = Path(tempfile.mkdtemp(prefix=f"sinhala_job_{job_id}_"))
    pdf_path = job_dir / file.filename
    contents = await file.read()
    pdf_path.write_bytes(contents)

    with _jobs_lock:
        _jobs[job_id] = {
            "status": "extracting",
            "progress": 10,
            "message": "Starting extraction...",
            "job_dir": job_dir,
            "pdf_path": pdf_path,
            "extracted_images": [],
            "text_files": [],
            "image_files": [],
            "archive_path": None,
            "error": None,
            "text_previews": {},
        }

    logger.info(f"[{job_id}] Queued extraction job")
    background_tasks.add_task(_run_extract_job, job_id)
    return JSONResponse({"job_id": job_id})


@app.post("/api/build_text")
def build_text(
    req: BuildTextRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    job_id = req.job_id
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] not in ("extracted", "failed"):
            raise HTTPException(
                status_code=400, detail="Job not ready for building text"
            )

        job["status"] = "building_text"
        job["progress"] = 30
        job["message"] = "Building text topics..."
        job["selected_images"] = req.selected_images
        job["subject"] = req.subject
        job["lesson"] = req.lesson

    logger.info(
        f"[{job_id}] Queued build_text job with {len(req.selected_images)} selected images"
    )
    background_tasks.add_task(_run_build_text_job, job_id)
    return JSONResponse({"job_id": job_id})


@app.post("/api/finalize")
def finalize_pdf(
    req: FinalizeRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    job_id = req.job_id
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Session expired. Please restart the extraction.")
        if job["status"] not in ("text_ready", "failed", "completed"):
            raise HTTPException(
                status_code=400, detail="Job not ready for finalization"
            )

        job["status"] = "finalizing"
        job["progress"] = 80
        job["message"] = "Zipping files..."
        job["topics_data"] = [t.model_dump() for t in req.topics]
        job["subject"] = req.subject
        job["lesson"] = req.lesson


    logger.info(f"[{job_id}] Queued finalize job")
    background_tasks.add_task(_run_finalize_job, job_id)
    return JSONResponse({"job_id": job_id})


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> JSONResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        payload = {
            "job_id": job_id,
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "extracted_images": job.get("extracted_images", []),
            "text_files": [{"name": path.name} for path in job["text_files"]],
            "image_files": [{"name": path.name} for path in job["image_files"]],
            "archive_path": job["archive_path"].name if job["archive_path"] else None,
            "error": job["error"],
            "topics": job.get("topics", []),
            "final_images_mapping": job.get("final_images_mapping", {}),
        }
    return JSONResponse(payload)


@app.get("/jobs/{job_id}/image/{image_name}")
def get_job_image(job_id: str, image_name: str) -> FileResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        image_path = job["job_dir"] / "images" / image_name
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(image_path)


@app.post("/api/jobs/{job_id}/upload_image")
async def upload_job_image(job_id: str, file: UploadFile = File(...)) -> JSONResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] not in ("extracted", "failed"):
            raise HTTPException(status_code=400, detail="Cannot upload image at this stage")
        
        images_dir = job["job_dir"] / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        # Generate a unique name for manual uploads to avoid conflicts
        ext = Path(file.filename).suffix if file.filename else ".png"
        if not ext:
            ext = ".png"
        new_filename = f"manual_upload_{uuid.uuid4().hex[:8]}{ext}"
        image_path = images_dir / new_filename
        
    contents = await file.read()
    image_path.write_bytes(contents)
    
    with _jobs_lock:
        job["extracted_images"].append(new_filename)
        
    return JSONResponse({"image_name": new_filename})


class VectorDBIngestRequest(BaseModel):
    job_id: str
    filename: str
    topic_index: int

@app.post("/api/vectordb/ingest")
def ingest_vector_db(req: VectorDBIngestRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    job_id = req.job_id
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        topics_data = job.get("topics_data", [])
        if not topics_data:
            topics_data = [t.model_dump() for t in job.get("topics", [])] if job.get("topics") else []
            
        if not topics_data or req.topic_index >= len(topics_data):
            raise HTTPException(status_code=400, detail="Invalid topic index or no topics available.")
            
        topic = topics_data[req.topic_index]
        full_content = f"{topic['title']}\n\n{topic['content']}"
    
    # Run ingestion in background
    def run_ingest(content: str, filename: str):
        try:
            logger.info(f"[{job_id}] Starting Vector DB ingestion for {filename}")
            ingest_text_content(content, filename)
            logger.info(f"[{job_id}] Vector DB ingestion complete")
        except Exception as e:
            logger.error(f"[{job_id}] Vector DB ingestion failed: {e}")

    background_tasks.add_task(run_ingest, full_content, req.filename)
    return JSONResponse({"message": "Ingestion started in background", "job_id": job_id})


@app.get("/api/vectordb/status")
def vectordb_status() -> JSONResponse:
    try:
        store = get_vector_store()
        count = store._collection.count()
        return JSONResponse({"status": "active", "chunks": count})
    except Exception as e:
        return JSONResponse({"status": "inactive", "chunks": 0, "error": str(e)})

@app.delete("/api/admin/vectordb/clear")
def clear_vectordb(authorization: str = Header(None)):
    admin = get_current_admin(authorization)
    try:
        # if os.getenv("ENVIRONMENT") == "production":
        #     client = chromadb.HttpClient(
        #         host=os.getenv("CHROMA_HOST", "206.189.152.26"),
        #         port=os.getenv("CHROMA_PORT", "8000")
        #     )
        # else:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
            
        client.delete_collection("sinhala_education")
        log_activity("clear_db", admin.get("email", ""), "Cleared the vector database")
        return {"message": "Vector database cleared successfully!"}
    except Exception as e:
        # Collection might not exist
        return {"message": f"Cleared or already empty. ({str(e)})"}

class VectorDBRetrieveRequest(BaseModel):
    subject: str
    lesson: str
    topic: str
    use_vector_ranking: bool = True

@app.post("/api/vectordb/retrieve")
def vectordb_retrieve(req: VectorDBRetrieveRequest) -> JSONResponse:
    try:
        context = get_relevant_context(
            subject=req.subject,
            lesson=req.lesson,
            topic=req.topic,
            k=6,
            use_vector_ranking=req.use_vector_ranking
        )
        return JSONResponse({"context": context})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/download/{job_id}/{kind}/{filename}")
def download(job_id: str, kind: str, filename: str) -> FileResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if kind == "archive":
            archive_path = job["archive_path"]
            if not archive_path or not archive_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")
            return FileResponse(
                archive_path, filename=archive_path.name, media_type="application/zip"
            )
        if kind == "txt":
            files = job["text_files"]
        elif kind == "images":
            files = job["image_files"]
        else:
            raise HTTPException(status_code=404, detail="Unsupported file type")
        import unicodedata
        for path in files:
            if unicodedata.normalize('NFC', path.name) == unicodedata.normalize('NFC', filename):
                return FileResponse(path, filename=path.name)
    raise HTTPException(status_code=404, detail="File not found")


def _run_extract_job(job_id: str) -> None:
    logger.info(f"[{job_id}] Started _run_extract_job background task")
    with _jobs_lock:
        job = _jobs[job_id]
        pdf_path = job["pdf_path"]
        job_dir = job["job_dir"]
        job["message"] = "Extracting contents from PDF..."
    try:
        blocks, image_files = pipeline.extract_phase(pdf_path, job_dir)
        logger.info(
            f"[{job_id}] Extracted {len(blocks)} blocks and {len(image_files)} images"
        )
        # Save blocks to a temporary file
        blocks_data = [block.to_dict() for block in blocks]
        blocks_path = job_dir / "blocks.json"
        blocks_path.write_text(
            json.dumps(blocks_data, ensure_ascii=False), encoding="utf-8"
        )

        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "extracted"
            job["message"] = f"Extraction complete. Found {len(image_files)} images."
            job["progress"] = 100
            job["extracted_images"] = [path.name for path in image_files]
        logger.info(f"[{job_id}] Extraction complete")
    except Exception as exc:  # pragma: no cover
        logger.error(f"[{job_id}] Extraction failed: {exc}")
        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Extraction failed"
            job["progress"] = 100
            job["error"] = str(exc)


def _run_build_text_job(job_id: str) -> None:
    logger.info(f"[{job_id}] Started _run_build_text_job background task")
    with _jobs_lock:
        job = _jobs[job_id]
        job_dir = job["job_dir"]
        selected_images = job["selected_images"]
        subject = job["subject"]
    try:
        blocks_path = job_dir / "blocks.json"
        blocks_data = json.loads(blocks_path.read_text(encoding="utf-8"))
        blocks = [BlockItem.from_dict(d) for d in blocks_data]

        logger.info(f"[{job_id}] Running build text phase")
        topics_result = pipeline.build_text_phase(
            blocks, job_dir, selected_images, subject, lesson_spec=None
        )

        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "text_ready"
            job["message"] = "Text generated successfully."
            job["progress"] = 60
            job["topics"] = topics_result["topics"]
            job["lesson_name"] = topics_result["lesson_name"]
            job["final_images_mapping"] = topics_result["final_images_mapping"]
        logger.info(f"[{job_id}] Build text complete")
    except Exception as exc:  # pragma: no cover
        logger.error(f"[{job_id}] Build text failed: {exc}")
        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Build text failed"
            job["progress"] = 100
            job["error"] = str(exc)


def _run_finalize_job(job_id: str) -> None:
    logger.info(f"[{job_id}] Started _run_finalize_job background task")
    with _jobs_lock:
        job = _jobs[job_id]
        job_dir = job["job_dir"]
        topics_data = job["topics_data"]
        subject = job["subject"]
        lesson_name = job.get("lesson_name", "lesson")
    try:
        logger.info(f"[{job_id}] Running finalize zip phase")
        result = pipeline.finalize_zip_phase(
            topics_data, job_dir, lesson_name, subject, lesson_spec=None
        )

        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "completed"
            job["message"] = f"Processed {len(result.text_files)} lesson files"
            job["progress"] = 100
            job["text_files"] = result.text_files
            job["image_files"] = result.image_files
            job["archive_path"] = result.archive_path

        # Record to dashboard database
        try:
            main_collection.update_one(
                {"type": "subject", "name": subject},
                {
                    "$setOnInsert": {"type": "subject", "name": subject, "created_at": datetime.now(timezone.utc)},
                    "$addToSet": {"lessons": lesson_name}
                },
                upsert=True
            )
            main_collection.insert_one({
                "type": "lesson",
                "subject_name": subject,
                "lesson_name": lesson_name,
                "topics": [t.get("title") for t in topics_data],
                "source_filename": job.get("pdf_path").name if job.get("pdf_path") else "unknown.pdf",
                "chunk_count": 0,
                "added_by": "pipeline",
                "created_at": datetime.now(timezone.utc),
            })
            log_activity("add_lesson", "pipeline", f"Auto-recorded lesson '{lesson_name}' to subject '{subject}'")
        except Exception as db_exc:
            logger.error(f"[{job_id}] Failed to auto-record lesson to db: {db_exc}")

        logger.info(f"[{job_id}] Finalization complete")
    except Exception as exc:  # pragma: no cover
        logger.error(f"[{job_id}] Finalization failed: {exc}")
        with _jobs_lock:
            job = _jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Finalization failed"
            job["progress"] = 100
            job["error"] = str(exc)


@app.get("/api/jobs/{job_id}/download_images")
def download_images(job_id: str) -> FileResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Session expired. Please restart the extraction.")
        
        images_dir = job["job_dir"] / "images"
        if not images_dir.exists() or not any(images_dir.iterdir()):
            raise HTTPException(status_code=404, detail="No images to download")
            
        zip_path = job["job_dir"] / f"images_{job_id}.zip"
        shutil.make_archive(str(zip_path.with_suffix('')), 'zip', root_dir=images_dir, base_dir=".")
        
        return FileResponse(zip_path, filename="images.zip")


@app.get("/api/jobs/{job_id}/download_zip")
def download_zip(job_id: str) -> FileResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Session expired. Please restart the extraction.")
        archive_path = job.get("archive_path")
        if not archive_path or not archive_path.exists():
            raise HTTPException(status_code=404, detail="Archive not found. Please finalize first.")
        return FileResponse(archive_path, filename=archive_path.name, media_type="application/zip")


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
