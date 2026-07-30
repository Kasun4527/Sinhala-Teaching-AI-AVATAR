from __future__ import annotations

from pathlib import Path

import fitz
from fastapi.testclient import TestClient

import app.main as main

app = main.app


def build_sample_pdf(pdf_path: Path) -> None:
    image_doc = fitz.open()
    image_page = image_doc.new_page(width=1, height=1)
    image_path = pdf_path.with_suffix(".png")
    image_page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).save(image_path)
    image_doc.close()

    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((72, 90), "SCIENCE 11", fontsize=20, fontname="helv")
    page.insert_text((72, 130), "This is the first paragraph.", fontsize=12, fontname="helv")
    page.insert_image(fitz.Rect(72, 210, 132, 270), filename=str(image_path))
    document.save(pdf_path)
    document.close()


def test_upload_process_and_download(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(main, "get_current_admin", lambda authorization=None: {
        "email": "admin@example.com",
        "role": "admin",
    })
    client = TestClient(app)
    pdf_path = tmp_path / "sample.pdf"
    build_sample_pdf(pdf_path)

    with pdf_path.open("rb") as handle:
        response = client.post("/api/extract", files={"file": (pdf_path.name, handle, "application/pdf")})
    assert response.status_code == 200
    job_id = response.json()["job_id"]

    for _ in range(20):
        status = client.get(f"/jobs/{job_id}").json()
        if status["status"] in ("extracted", "failed"):
            break
    assert status["status"] == "extracted"
    
    response = client.post("/api/build_text", json={"job_id": job_id, "selected_images": status["extracted_images"]})
    assert response.status_code == 200

    for _ in range(20):
        status = client.get(f"/jobs/{job_id}").json()
        if status["status"] == "text_ready":
            break
    assert status["status"] == "text_ready"

    response = client.post("/api/finalize", json={"job_id": job_id, "topics": status["topics"]})
    assert response.status_code == 200

    for _ in range(20):
        status = client.get(f"/jobs/{job_id}").json()
        if status["status"] == "completed":
            break
    assert status["status"] == "completed"
    assert len(status["text_files"]) >= 1

    txt_name = status["text_files"][0]["name"]
    download = client.get(f"/download/{job_id}/txt/{txt_name}")
    assert download.status_code == 200
    assert "SCIENCE" in download.text
