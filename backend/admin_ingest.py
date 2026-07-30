"""Isolated admin-portal bridge for publishing textbook content."""

from __future__ import annotations

import asyncio
import io
import os
import shutil
import tempfile
import threading
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from jose import JWTError, jwt

from services.vector_store import ingest_documents


router = APIRouter(prefix="/api/admin", tags=["admin-ingestion"])

BASE_DIR = Path(__file__).resolve().parent
DOCUMENTS_DIR = BASE_DIR / "documents_unicode"
IMAGES_DIR = BASE_DIR / "images"
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_EXPANDED_BYTES = 250 * 1024 * 1024
MAX_ARCHIVE_FILES = 2_000
ALLOWED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
_ingestion_lock = threading.Lock()


def _require_admin(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing administrator token")

    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Backend SECRET_KEY is not configured")

    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1],
            secret_key,
            algorithms=["HS256"],
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired administrator token") from exc

    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return payload


def _safe_archive_name(raw_name: str) -> PurePosixPath:
    normalized = raw_name.replace(chr(92), "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Unsafe archive path: {raw_name}")
    return path


def _publish_archive(archive_bytes: bytes) -> dict:
    with _ingestion_lock:
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            members = [member for member in archive.infolist() if not member.is_dir()]
            if len(members) > MAX_ARCHIVE_FILES:
                raise ValueError("Archive contains too many files")
            if sum(member.file_size for member in members) > MAX_EXPANDED_BYTES:
                raise ValueError("Expanded archive exceeds the 250 MB limit")

            staging_root = Path(tempfile.mkdtemp(prefix="admin_ingest_"))
            staged_documents = staging_root / "documents"
            staged_images = staging_root / "images"
            staged_documents.mkdir()
            staged_images.mkdir()

            text_count = 0
            image_count = 0
            try:
                for member in members:
                    archive_path = _safe_archive_name(member.filename)
                    suffix = archive_path.suffix.lower()
                    data = archive.read(member)

                    if suffix == ".txt":
                        data.decode("utf-8")
                        (staged_documents / archive_path.name).write_bytes(data)
                        text_count += 1
                    elif suffix in ALLOWED_IMAGE_SUFFIXES:
                        (staged_images / archive_path.name).write_bytes(data)
                        image_count += 1

                if text_count == 0:
                    raise ValueError("Archive does not contain any UTF-8 .txt topic files")

                DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
                IMAGES_DIR.mkdir(parents=True, exist_ok=True)

                for source in staged_documents.iterdir():
                    shutil.copy2(source, DOCUMENTS_DIR / source.name)
                for source in staged_images.iterdir():
                    shutil.copy2(source, IMAGES_DIR / source.name)

                vector_store = ingest_documents(str(DOCUMENTS_DIR))
                if vector_store is None:
                    raise RuntimeError("Backend vector ingestion failed")

                return {
                    "status": "published",
                    "text_files": text_count,
                    "image_files": image_count,
                }
            finally:
                shutil.rmtree(staging_root, ignore_errors=True)


@router.post("/ingest")
async def ingest_admin_archive(
    archive: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    admin = _require_admin(authorization)

    if not archive.filename or Path(archive.filename).suffix.lower() != ".zip":
        raise HTTPException(status_code=400, detail="A finalized .zip archive is required")

    archive_bytes = await archive.read(MAX_ARCHIVE_BYTES + 1)
    if len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise HTTPException(status_code=413, detail="Archive exceeds the 100 MB limit")

    try:
        result = await asyncio.to_thread(_publish_archive, archive_bytes)
    except (ValueError, UnicodeDecodeError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Content publication failed: {exc}") from exc

    return {**result, "published_by": admin.get("email", "admin")}
