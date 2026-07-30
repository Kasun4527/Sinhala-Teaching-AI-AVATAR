from __future__ import annotations

from pathlib import Path

import fitz

from app.pipeline import LESSON_01_SPEC, PDFPipeline


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
    page.insert_text((72, 160), "A second body paragraph follows.", fontsize=12, fontname="helv")
    page.insert_image(fitz.Rect(72, 210, 132, 270), filename=str(image_path))
    document.save(pdf_path)
    document.close()


def test_pipeline_extracts_blocks_and_images(tmp_path: Path) -> None:
    pdf_path = tmp_path / "sample.pdf"
    build_sample_pdf(pdf_path)

    pipeline = PDFPipeline()
    font_samples = pipeline.inspect_fonts(pdf_path)
    blocks = pipeline.extract_blocks(pdf_path)
    images = pipeline.extract_and_save_images(pdf_path, tmp_path / "images")
    selected_images = [img.name for img in images]
    topics_data = pipeline.build_text_phase(blocks, tmp_path / "output", selected_images, lesson_spec=None)
    result = pipeline.finalize_zip_phase(
        topics_data["topics"],
        tmp_path / "output",
        lesson_spec=None,
    )

    assert font_samples[0].scanned is False
    assert any("helv" in font.lower() for font in font_samples[0].font_names)
    assert any(block.kind == "text" for block in blocks)
    assert any(block.kind == "image" for block in blocks)
    assert len(images) == 1
    assert topics_data
    assert "[image:" in topics_data[0]["content"]
    assert len(result.text_files) >= 1
    assert result.archive_path.exists()
