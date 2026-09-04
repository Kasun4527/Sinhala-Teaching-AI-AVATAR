"""Page type detection for Sinhala textbook PDFs.

Classifies each page as Unicode Sinhala, legacy-font encoded, scanned,
or mixed content so the extraction pipeline can choose the right method.
"""
from __future__ import annotations

import logging
from enum import Enum
from dataclasses import dataclass

import fitz

logger = logging.getLogger("uvicorn.error")

# Sinhala Unicode range: U+0D80 – U+0DFF
_SINHALA_RANGE = range(0x0D80, 0x0DFF + 1)

# Common legacy Sinhala font name prefixes (case-insensitive, stripped)
_LEGACY_PREFIXES = ("fm", "dinalternate", "kaputadotcom", "malithi", "nirmala")


class PageType(Enum):
    """Classification of a PDF page's text-extraction method."""
    UNICODE_SINHALA = "unicode"       # Direct text-layer extraction
    LEGACY_FONT = "legacy"            # Font-map conversion needed
    SCANNED = "scanned"               # OCR required (stub)
    MIXED = "mixed"                   # Text extraction + OCR reconciliation
    EMPTY = "empty"                   # No usable content


@dataclass(slots=True)
class PageAnalysis:
    """Result of analyzing a single PDF page."""
    page_number: int
    page_type: PageType
    sinhala_unicode_pct: float
    legacy_font_pct: float
    text_char_count: int
    has_images: bool
    font_names: list[str]
    confidence: float


def _normalize_font(name: str) -> str:
    """Lowercase and strip non-alphanumeric chars for font matching."""
    import re
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _is_legacy_font(font_name: str) -> bool:
    """Check if a font name looks like a legacy Sinhala font."""
    norm = _normalize_font(font_name)
    return any(norm.startswith(prefix) for prefix in _LEGACY_PREFIXES)


def _count_sinhala_unicode(text: str) -> int:
    """Count characters in the Sinhala Unicode block."""
    return sum(1 for ch in text if ord(ch) in _SINHALA_RANGE)


def _count_latin_like(text: str) -> int:
    """Count Latin-range characters (potential legacy-font encoded text)."""
    return sum(1 for ch in text if 0x0041 <= ord(ch) <= 0x024F)


def detect_page_type(page: fitz.Page, page_number: int = 0) -> PageAnalysis:
    """Analyze a single PDF page and classify its type.
    
    Detection logic:
    1. Extract embedded text and font info.
    2. Calculate percentage of Sinhala Unicode characters.
    3. Check for legacy-font encoded text (Latin chars from FM-type fonts).
    4. Check text-to-image area ratio.
    5. Decide extraction method.
    """
    text_dict = page.get_text("dict", sort=True)
    blocks = text_dict.get("blocks", [])
    
    all_text = ""
    font_names: set[str] = set()
    legacy_char_count = 0
    unicode_char_count = 0
    total_text_chars = 0
    has_text_blocks = False
    
    for block in blocks:
        if block.get("type") != 0:  # Not a text block
            continue
        has_text_blocks = True
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                span_text = str(span.get("text", ""))
                span_font = str(span.get("font", ""))
                all_text += span_text
                
                if span_font:
                    font_names.add(span_font)
                
                if _is_legacy_font(span_font):
                    legacy_char_count += len(span_text.strip())
                else:
                    unicode_char_count += _count_sinhala_unicode(span_text)
    
    total_text_chars = len(all_text.strip())
    
    # Check for images on this page
    image_info = page.get_image_info()
    has_images = len(image_info) > 0
    
    # Calculate percentages
    sinhala_pct = (unicode_char_count / total_text_chars * 100) if total_text_chars > 0 else 0.0
    legacy_pct = (legacy_char_count / total_text_chars * 100) if total_text_chars > 0 else 0.0
    
    # Decision logic
    if total_text_chars < 10:
        if has_images:
            page_type = PageType.SCANNED
            confidence = 0.6
        else:
            page_type = PageType.EMPTY
            confidence = 0.9
    elif legacy_pct > 40:
        if sinhala_pct > 10:
            page_type = PageType.MIXED
            confidence = 0.7
        else:
            page_type = PageType.LEGACY_FONT
            confidence = 0.85
    elif sinhala_pct > 15:
        page_type = PageType.UNICODE_SINHALA
        confidence = 0.9
    elif has_text_blocks and total_text_chars > 50:
        # Has text but not much Sinhala — likely legacy font
        latin_count = _count_latin_like(all_text)
        if latin_count > total_text_chars * 0.3:
            page_type = PageType.LEGACY_FONT
            confidence = 0.7
        else:
            page_type = PageType.UNICODE_SINHALA
            confidence = 0.6
    elif has_images and not has_text_blocks:
        page_type = PageType.SCANNED
        confidence = 0.5
    else:
        page_type = PageType.UNICODE_SINHALA
        confidence = 0.5
    
    return PageAnalysis(
        page_number=page_number,
        page_type=page_type,
        sinhala_unicode_pct=round(sinhala_pct, 1),
        legacy_font_pct=round(legacy_pct, 1),
        text_char_count=total_text_chars,
        has_images=has_images,
        font_names=sorted(font_names),
        confidence=round(confidence, 2),
    )


def detect_document_pages(pdf_path: str) -> list[PageAnalysis]:
    """Analyze all pages in a PDF document and return per-page classifications."""
    doc = fitz.open(pdf_path)
    results = []
    for i in range(doc.page_count):
        page = doc.load_page(i)
        analysis = detect_page_type(page, page_number=i + 1)
        results.append(analysis)
        if analysis.page_type == PageType.SCANNED:
            logger.warning(
                f"Page {i + 1}: Detected as SCANNED — OCR not yet implemented, "
                f"text extraction may be incomplete."
            )
    doc.close()
    return results
