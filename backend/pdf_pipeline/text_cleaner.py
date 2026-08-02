"""Multi-stage text cleaner for Sinhala textbook extraction.

Runs after topic detection and before final export. Each stage is a
pure function that transforms text and optionally produces flags for
human review. Stages run sequentially — output of one feeds the next.

Stages:
  1. Basic preprocessing (line endings, control chars, whitespace)
  2. Sinhala Unicode normalization (NFC, invisible chars, known errors)
  3. Line classification (HEADING, BULLET, PARAGRAPH, NOISE, etc.)
  4. Noise removal (page numbers, repeated headers, image filenames)
  5. Paragraph reconstruction (join continuation lines)
  6. Sentence boundary repair (split joined sentences)
  7. Missing-space correction (pattern + vocabulary segmentation)
  8. Bullet list reconstruction (contextual detection)
  9. Heading consistency (blank-line formatting)
  10. Duplicate removal (exact + near-duplicate flagging)
  11. Terminology validation (glossary-based corruption detection)
  12. Structural validation (declared-count, incomplete-ending)
  13. Confidence scoring (per-line scoring)
"""
from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from difflib import SequenceMatcher

logger = logging.getLogger("uvicorn.error")


# ─────────────────────── Data Classes ───────────────────────

class LineType(Enum):
    HEADING = "HEADING"
    SUBHEADING = "SUBHEADING"
    PARAGRAPH = "PARAGRAPH"
    BULLET = "BULLET"
    ACTIVITY_HEADING = "ACTIVITY_HEADING"
    INSTRUCTION = "INSTRUCTION"
    FIGURE_PLACEHOLDER = "FIGURE_PLACEHOLDER"
    DIAGRAM_LABEL = "DIAGRAM_LABEL"
    CAPTION = "CAPTION"
    HEADER = "HEADER"
    FOOTER = "FOOTER"
    PAGE_NUMBER = "PAGE_NUMBER"
    NOISE = "NOISE"
    TABLE_CONTENT = "TABLE_CONTENT"
    UNKNOWN = "UNKNOWN"


@dataclass(slots=True)
class CleaningFlag:
    """A flag raised by the cleaner for human review."""
    line_number: int
    flag_type: str
    message: str
    confidence: float = 1.0
    original_text: str = ""
    suggested_text: str | None = None


@dataclass(slots=True)
class ClassifiedLine:
    """A line of text with its classification."""
    text: str
    line_type: LineType
    confidence: float = 1.0
    original_line_number: int = 0


@dataclass(slots=True)
class CleaningStats:
    """Statistics from the cleaning run."""
    lines_processed: int = 0
    corrections_applied: int = 0
    paragraphs_joined: int = 0
    sentences_split: int = 0
    spaces_inserted: int = 0
    bullets_reconstructed: int = 0
    duplicates_removed: int = 0
    noise_lines_removed: int = 0
    terminology_flags: int = 0
    structure_flags: int = 0


@dataclass(slots=True)
class CleaningResult:
    """Full result from cleaning a topic's text."""
    cleaned_text: str
    flags: list[CleaningFlag] = field(default_factory=list)
    stats: CleaningStats = field(default_factory=CleaningStats)


# ─────────────────────── Configuration ───────────────────────

class TextCleanerConfig:
    """Configuration for the text cleaner, loaded from data files."""

    def __init__(
        self,
        corrections_path: Path | None = None,
        glossary_dir: Path | None = None,
        flag_uncertain: bool = True,
        min_confidence: float = 0.7,
        near_duplicate_threshold: float = 0.90,
    ):
        self.flag_uncertain = flag_uncertain
        self.min_confidence = min_confidence
        self.near_duplicate_threshold = near_duplicate_threshold

        # Load corrections dictionary
        self.corrections: dict[str, str] = {}
        self.regex_corrections: list[dict] = []
        if corrections_path and corrections_path.exists():
            try:
                data = json.loads(corrections_path.read_text(encoding="utf-8"))
                self.corrections = data.get("corrections", {})
                self.regex_corrections = data.get("regex_corrections", [])
                logger.info(f"Loaded {len(self.corrections)} corrections from {corrections_path}")
            except Exception as e:
                logger.warning(f"Failed to load corrections from {corrections_path}: {e}")

        # Load glossaries
        self.glossary_terms: set[str] = set()
        if glossary_dir and glossary_dir.exists():
            for glossary_file in glossary_dir.glob("*.json"):
                try:
                    data = json.loads(glossary_file.read_text(encoding="utf-8"))
                    terms = data.get("terms", [])
                    self.glossary_terms.update(terms)
                    logger.info(f"Loaded {len(terms)} terms from {glossary_file.name}")
                except Exception as e:
                    logger.warning(f"Failed to load glossary {glossary_file}: {e}")


# ─────────────────────── Sinhala Helpers ───────────────────────

# Sinhala Unicode range
_SINHALA_RE = re.compile(r"[\u0D80-\u0DFF]")

# Sinhala count words for structural validation
_SINHALA_COUNT_WORDS = {
    "එකක්": 1, "දෙකක්": 2, "තුනක්": 3, "හතරක්": 4, "පහක්": 5,
    "හයක්": 6, "හතක්": 7, "අටක්": 8, "නවයක්": 9, "දහයක්": 10,
    "තුනකි": 3, "හතරකි": 4, "පහකි": 5,
    "දෙකකි": 2, "එකකි": 1,
}

# Sinhala list-introduction words
_LIST_INTRO_WORDS = {"වර්ග", "ලක්ෂණ", "කෘත්ය", "පහත දැක්වේ", "පහත", "කාණ්ඩ", "ආකාර"}

# Bullet marker normalization map
_BULLET_CHARS = {"●", "▪", "■", "◆", "◦", "►", "²", "»"}


def _has_sinhala(text: str) -> bool:
    """Check if text contains any Sinhala characters."""
    return bool(_SINHALA_RE.search(text))


def _normalize_for_comparison(text: str) -> str:
    """Normalize text for duplicate comparison."""
    t = text.lower().strip()
    t = re.sub(r"[^\w\s\u0D80-\u0DFF]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t


# ─────────────────────── Stage 1: Basic Preprocessing ───────────────────────

def preprocess_text(text: str) -> str:
    """Stage 1: Basic text preprocessing.
    
    - Convert all line endings to \\n
    - Remove null characters and control characters
    - Remove excessive spaces
    - Remove trailing spaces per line
    - Replace 3+ blank lines with 1 blank line
    - Normalize tabs to spaces
    - Normalize bullet symbols
    - Normalize quotation marks
    """
    if not text:
        return text

    # Convert line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove null characters and control characters (keep \n and \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Normalize tabs to spaces
    text = text.replace("\t", "    ")

    # Process line by line
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        # Remove excessive internal spaces (but preserve leading indent)
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]
        stripped = re.sub(r"  +", " ", stripped)
        # Remove trailing spaces
        stripped = stripped.rstrip()
        cleaned_lines.append(indent + stripped)

    text = "\n".join(cleaned_lines)

    # Replace 3+ blank lines with 1 blank line
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Normalize bullet symbols
    for bullet in _BULLET_CHARS:
        text = text.replace(bullet, "•")

    # Normalize various bullet patterns
    text = re.sub(r"^\s*(?:••|--)\s*", "• ", text, flags=re.MULTILINE)

    # Normalize quotation marks
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")

    return text


# ─────────────────────── Stage 2: Sinhala Unicode Normalization ───────────────────────

def normalize_sinhala_unicode(text: str, config: TextCleanerConfig) -> tuple[str, int]:
    """Stage 2: Sinhala Unicode normalization.
    
    Returns (normalized_text, correction_count).
    
    - Apply Unicode NFC normalization
    - Remove invisible characters (ZWS, NBSP, BOM, soft hyphens)
    - Apply known-error dictionary corrections
    - Apply regex-based corrections
    """
    if not text:
        return text, 0

    correction_count = 0

    # NFC normalization
    text = unicodedata.normalize("NFC", text)

    # Remove invisible characters
    invisible_chars = {
        "\u200b": "",    # Zero-width space
        "\u200c": "",    # Zero-width non-joiner
        # \u200d (Zero-width joiner) MUST BE PRESERVED for Sinhala ligatures (yansaya, repaya)
        "\u00a0": " ",   # Non-breaking space → regular space
        "\ufeff": "",    # Byte-order mark
        "\u00ad": "",    # Soft hyphen
        "\u200e": "",    # Left-to-right mark
        "\u200f": "",    # Right-to-left mark
        "\u2028": "\n",  # Line separator
        "\u2029": "\n",  # Paragraph separator
    }
    for char, replacement in invisible_chars.items():
        if char in text:
            text = text.replace(char, replacement)

    # Apply known-error dictionary (exact string replacements)
    for error, correction in config.corrections.items():
        if error in text:
            text = text.replace(error, correction)
            correction_count += 1

    # Apply regex-based corrections
    for rx in config.regex_corrections:
        pattern = rx.get("pattern", "")
        replacement = rx.get("replacement", "")
        if pattern:
            new_text = re.sub(pattern, replacement, text)
            if new_text != text:
                correction_count += 1
                text = new_text

    # Fix duplicate Sinhala vowel signs (extraction artifact)
    # e.g., පවතීි (U+0DD3 + U+0DD2) → පවතී (keep only the first)
    # Sinhala dependent vowel range: U+0DCF – U+0DDF, U+0DF2 – U+0DF3
    text = re.sub(r'([\u0DCF-\u0DDF\u0DF2\u0DF3])[\u0DCF-\u0DDF\u0DF2\u0DF3]+', r'\1', text)

    return text, correction_count


# ─────────────────────── Stage 3: Line Classification ───────────────────────

def classify_lines(text: str) -> list[ClassifiedLine]:
    """Stage 3: Classify each line into a type.
    
    Internal-only labels — not exposed in the final output.
    """
    lines = text.split("\n")
    classified: list[ClassifiedLine] = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        if not stripped:
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.PARAGRAPH,
                confidence=1.0, original_line_number=i + 1
            ))
            continue

        # Page number detection
        if re.match(r"^\d{1,3}$", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.PAGE_NUMBER,
                confidence=0.9, original_line_number=i + 1
            ))
            continue

        # Page header/footer: "01 ජීව විද්‍යාව" pattern (page number + subject name)
        if re.match(r"^\d{1,3}\s+[\u0D80-\u0DFF]", stripped) and len(stripped.split()) <= 5 and len(stripped) < 40:
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.HEADER,
                confidence=0.85, original_line_number=i + 1
            ))
            continue

        # Image placeholder
        if re.match(r"^\[image:\s*.+\]$", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.FIGURE_PLACEHOLDER,
                confidence=1.0, original_line_number=i + 1
            ))
            continue

        # Noise: only punctuation, stray chars, or non-meaningful content
        if re.match(r"^[}\u0DCA.\s\t\-:;,]+$", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.NOISE,
                confidence=0.85, original_line_number=i + 1
            ))
            continue

        # Activity heading (match both with and without ZWJ)
        if re.match(r"^ක්\u200d?රියාකාරකම", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.ACTIVITY_HEADING,
                confidence=0.95, original_line_number=i + 1
            ))
            continue

        # Major heading: "1.1 Text" pattern
        if re.match(r"^\d+\.\d+\s+[^.]", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.HEADING,
                confidence=0.95, original_line_number=i + 1
            ))
            continue

        # Subheading: "1.2.1 Text" or "1.2.1.1 Text" pattern
        if re.match(r"^\d+\.\d+\.\d+(\.\d+)?\s+", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.SUBHEADING,
                confidence=0.9, original_line_number=i + 1
            ))
            continue

        # Caption: "මෙම රූපය •" pattern or "රූපයේ සටහන:" or numbered figure ref
        if (re.match(r"^(\d+\.\d+\s*)?රූපය", stripped)
                or stripped.startswith("රූපයේ සටහන:")
                or stripped.startswith("මෙම රූපය")):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.CAPTION,
                confidence=0.85, original_line_number=i + 1
            ))
            continue

        # Dash-prefixed diagram labels: short lines starting with "- " near images
        if stripped.startswith("- ") and len(stripped) < 40:
            # Check if there's an [image:] tag within 8 lines OR if the previous
            # line was already classified as a diagram label (chain detection)
            has_nearby_image = False
            for j in range(max(0, i - 8), min(len(lines), i + 9)):
                if j != i and "[image:" in lines[j]:
                    has_nearby_image = True
                    break
            # Chain: if the immediately preceding non-blank classified line
            # was a DIAGRAM_LABEL, this is likely one too
            is_chain = False
            if classified:
                for prev_cl in reversed(classified):
                    if prev_cl.text.strip():  # skip blanks
                        is_chain = prev_cl.line_type == LineType.DIAGRAM_LABEL
                        break
            if has_nearby_image or is_chain:
                classified.append(ClassifiedLine(
                    text=line, line_type=LineType.DIAGRAM_LABEL,
                    confidence=0.8, original_line_number=i + 1
                ))
                continue

        # Bullet line (• prefixed)
        if re.match(r"^•\s", stripped) or re.match(r"^\d+\.\s", stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.BULLET,
                confidence=0.9, original_line_number=i + 1
            ))
            continue

        # Short non-Sinhala lines or lines without Sinhala content
        if len(stripped) < 5 and not _has_sinhala(stripped):
            classified.append(ClassifiedLine(
                text=line, line_type=LineType.NOISE,
                confidence=0.7, original_line_number=i + 1
            ))
            continue

        # Potential diagram label: very short Sinhala text (1-4 words, < 30 chars)
        word_count = len(stripped.split())
        if word_count <= 4 and len(stripped) < 30 and _has_sinhala(stripped):
            # Check surrounding context — if between image placeholders, likely a label
            has_nearby_image = False
            for j in range(max(0, i - 3), min(len(lines), i + 4)):
                if j != i and "[image:" in lines[j]:
                    has_nearby_image = True
                    break
            if has_nearby_image:
                classified.append(ClassifiedLine(
                    text=line, line_type=LineType.DIAGRAM_LABEL,
                    confidence=0.7, original_line_number=i + 1
                ))
                continue

        # Default: paragraph
        classified.append(ClassifiedLine(
            text=line, line_type=LineType.PARAGRAPH,
            confidence=0.8, original_line_number=i + 1
        ))

    return classified


# ─────────────────────── Stage 4: Noise Removal ───────────────────────

def remove_noise(classified_lines: list[ClassifiedLine]) -> tuple[list[ClassifiedLine], int]:
    """Stage 4: Remove noise lines.
    
    Removes: page numbers, repeated headers/footers, noise-classified lines.
    Returns (filtered_lines, removed_count).
    """
    removed = 0
    filtered: list[ClassifiedLine] = []

    for cl in classified_lines:
        if cl.line_type in (
            LineType.PAGE_NUMBER, LineType.NOISE,
            LineType.HEADER, LineType.FOOTER,
            LineType.DIAGRAM_LABEL,
        ):
            removed += 1
            continue
        filtered.append(cl)

    return filtered, removed


# ─────────────────────── Stage 5: Paragraph Reconstruction ───────────────────────

def reconstruct_paragraphs(lines: list[ClassifiedLine]) -> tuple[str, int]:
    """Stage 5: Join lines that belong to the same paragraph.
    
    Join rules:
    - First line does NOT end with sentence terminator (.?!:)
    - Second line is NOT a heading, bullet, image placeholder, or diagram label
    - Both lines are PARAGRAPH type
    
    Returns (reconstructed_text, join_count).
    """
    if not lines:
        return "", 0

    result_lines: list[str] = []
    join_count = 0

    for i, cl in enumerate(lines):
        text = cl.text.strip()

        if not text:
            result_lines.append("")
            continue

        # Non-paragraph types are never joined — they stand alone
        if cl.line_type != LineType.PARAGRAPH:
            result_lines.append(text)
            continue

        # Try to join with the previous line
        if result_lines and result_lines[-1]:
            prev = result_lines[-1]
            prev_stripped = prev.rstrip()

            # Get previous line's type
            prev_cl = lines[i - 1] if i > 0 else None

            # Only join if previous was also a paragraph
            can_join = (
                prev_cl is not None
                and prev_cl.line_type == LineType.PARAGRAPH
                and prev_stripped  # Not empty
                and prev_stripped[-1] not in ".?!:;\n"  # Not terminated
                and not text.startswith("•")
                and not text.startswith("- ")
                and not re.match(r"^\d+\.\s", text)
                and not re.match(r"^\d+\.\d+", text)
                and cl.line_type not in (
                    LineType.HEADING, LineType.SUBHEADING, LineType.BULLET,
                    LineType.FIGURE_PLACEHOLDER, LineType.DIAGRAM_LABEL,
                    LineType.ACTIVITY_HEADING, LineType.CAPTION
                )
            )

            if can_join:
                # Join with a space
                result_lines[-1] = prev_stripped + " " + text
                join_count += 1
                continue

        result_lines.append(text)

    return "\n".join(result_lines), join_count


# ─────────────────────── Stage 6: Sentence Boundary Repair ───────────────────────

def repair_sentence_boundaries(text: str) -> tuple[str, int]:
    """Stage 6: Split incorrectly joined sentences.
    
    Detects patterns like:
      පිහිටා ඇත.හරස් විලේඛ නො දරයි.
    And splits them:
      පිහිටා ඇත.
      හරස් විලේඛ නො දරයි.
    
    Returns (repaired_text, split_count).
    """
    if not text:
        return text, 0

    split_count = 0

    # Pattern: sentence-ending punctuation immediately followed by Sinhala or English text
    # ([.!?]) directly followed by a Sinhala or Latin letter (no space)
    def split_handler(match):
        nonlocal split_count
        split_count += 1
        punct = match.group(1)
        next_char = match.group(2)
        return f"{punct}\n{next_char}"

    text = re.sub(
        r"([.!?])([A-Za-z\u0D80-\u0DFF])",
        split_handler,
        text
    )

    return text, split_count


# ─────────────────────── Stage 7: Missing-Space Correction ───────────────────────

# Known Sinhala suffix→prefix join patterns
_KNOWN_JOIN_PATTERNS = [
    # "කිරීම" + next word
    (r"කිරීම([ආඉඊඋඌඑඒඓඔඕඅකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවශෂසහළෆ])",
     r"කිරීම \1"),
    # "කිරීම්" + next word
    (r"කිරීම්([ආඉඊඋඌඑඒඓඔඕඅකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවශෂසහළෆ])",
     r"කිරීම් \1"),
    # "වීම" + next word
    (r"වීම([ආඉඊඋඌඑඒඓඔඕඅකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවශෂසහළෆ])",
     r"වීම \1"),
    # "ඇත" + next word (common sentence continuation error)
    (r"ඇත([ආඉඊඋඌඑඒඓඔඕඅකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවශෂසහළෆ])",
     r"ඇත \1"),
    # "වේ" + next word
    (r"වේ([ආඉඊඋඌඑඒඓඔඕඅකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවශෂසහළෆ])",
     r"වේ \1"),
]


def correct_missing_spaces(text: str) -> tuple[str, int]:
    """Stage 7: Correct missing spaces between joined words.
    
    Method A: Known pattern correction (verified phrase patterns).
    Method B: Sinhala vocabulary segmentation (stub — needs dictionary).
    Method C: LLM-based (stub interface — not implemented).
    
    Returns (corrected_text, correction_count).
    """
    if not text:
        return text, 0

    correction_count = 0

    # Method A: Known pattern correction
    for pattern, replacement in _KNOWN_JOIN_PATTERNS:
        new_text = re.sub(pattern, replacement, text)
        if new_text != text:
            correction_count += text.count(pattern) if not pattern.startswith("(") else 1
            text = new_text

    # Re-count more accurately
    correction_count = 0
    original = text
    for pattern, replacement in _KNOWN_JOIN_PATTERNS:
        text = re.sub(pattern, replacement, text)
    if text != original:
        # Count differences
        correction_count = sum(1 for a, b in zip(text, original) if a != b) // 2
        if correction_count == 0:
            correction_count = 1

    return text, correction_count


# ─────────────────────── Stage 8: Bullet List Reconstruction ───────────────────────

def reconstruct_bullet_lists(text: str) -> tuple[str, int]:
    """Stage 8: Detect list sections and add bullet markers.
    
    Detection signals:
    - Previous sentence contains වර්ග, ලක්ෂණ, කෘත්ය, පහත දැක්වේ
    - Several short related lines follow
    - Each line has similar grammatical structure
    
    Returns (reconstructed_text, bullet_count).
    """
    if not text:
        return text, 0

    lines = text.split("\n")
    result: list[str] = []
    bullet_count = 0
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Check if this line introduces a list
        is_list_intro = False
        for intro_word in _LIST_INTRO_WORDS:
            if intro_word in line:
                is_list_intro = True
                break

        if is_list_intro and line:
            result.append(lines[i])
            # Look ahead for short lines that could be list items
            j = i + 1
            # Skip blank lines
            while j < len(lines) and not lines[j].strip():
                j += 1

            candidate_items: list[int] = []
            while j < len(lines):
                candidate = lines[j].strip()
                if not candidate:
                    break
                # List item heuristic: short line, no sentence terminator in middle,
                # already a bullet, or similar structure to other candidates
                is_already_bullet = candidate.startswith("•") or candidate.startswith("- ")
                is_short = len(candidate) < 80 and len(candidate.split()) <= 8
                is_heading = bool(re.match(r"^\d+\.\d+", candidate))

                if is_heading:
                    break
                if is_already_bullet:
                    candidate_items.append(j)
                    j += 1
                    continue
                if is_short and _has_sinhala(candidate):
                    candidate_items.append(j)
                    j += 1
                    continue
                break

            # Only reconstruct if we found 2+ candidate items
            if len(candidate_items) >= 2:
                # Add blank line after intro if needed
                if result and result[-1].strip():
                    result.append("")
                for idx in candidate_items:
                    item_text = lines[idx].strip()
                    if not item_text.startswith("•") and not item_text.startswith("- "):
                        item_text = "• " + item_text
                        bullet_count += 1
                    result.append(item_text)
                i = candidate_items[-1] + 1
                continue
            else:
                # Not a list, just add the intro line and continue
                i += 1
                continue
        else:
            result.append(lines[i])
            i += 1

    return "\n".join(result), bullet_count


# ─────────────────────── Stage 9: Heading Consistency ───────────────────────

def normalize_heading_format(text: str) -> str:
    """Stage 9: Normalize heading formatting.
    
    Rules:
    - One blank line before headings
    - One blank line after headings
    - No blank line between items in the same bullet list
    - One blank line between separate paragraphs
    """
    if not text:
        return text

    lines = text.split("\n")
    result: list[str] = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Detect heading lines
        is_heading = bool(re.match(r"^\d+\.\d+(\.\d+)*\s+", stripped))
        is_activity = stripped.startswith("ක්රියාකාරකම") if stripped else False

        if is_heading or is_activity:
            # Ensure blank line before heading (unless it's the first line)
            if result and result[-1].strip():
                result.append("")
            result.append(line)
            # Ensure blank line after heading
            if i + 1 < len(lines) and lines[i + 1].strip():
                result.append("")
                # The next iteration will add the content line
        else:
            result.append(line)

    text = "\n".join(result)

    # Clean up: no more than 2 consecutive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text


# ─────────────────────── Stage 10: Duplicate Removal ───────────────────────

def remove_duplicates(text: str, threshold: float = 0.90) -> tuple[str, int, list[CleaningFlag]]:
    """Stage 10: Remove duplicate content.
    
    - Automatically remove exact adjacent duplicates.
    - Flag near-duplicates above threshold for review.
    
    Returns (deduplicated_text, removed_count, flags).
    """
    if not text:
        return text, 0, []

    lines = text.split("\n")
    result: list[str] = []
    removed_count = 0
    flags: list[CleaningFlag] = []
    seen_normalized: dict[str, int] = {}

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            result.append(line)
            continue

        normalized = _normalize_for_comparison(stripped)
        if not normalized:
            result.append(line)
            continue

        # Exact adjacent duplicate
        if result and _normalize_for_comparison(result[-1].strip()) == normalized:
            removed_count += 1
            continue

        # Ignore very short lines for non-adjacent duplicate checking
        if len(normalized) < 20 or len(normalized.split()) < 3:
            seen_normalized[normalized] = i + 1
            result.append(line)
            continue

        # Near-duplicate check against recent lines (within 10 lines)
        is_near_dup = False
        if normalized in seen_normalized:
            # Exact duplicate of an earlier non-adjacent line — flag it
            flags.append(CleaningFlag(
                line_number=i + 1,
                flag_type="NEAR_DUPLICATE",
                message=f"Exact duplicate of line {seen_normalized[normalized]}",
                confidence=1.0,
                original_text=stripped,
            ))
            is_near_dup = True
        else:
            # Check similarity against recent lines
            recent_start = max(0, len(result) - 10)
            for j in range(recent_start, len(result)):
                prev_norm = _normalize_for_comparison(result[j].strip())
                if prev_norm and len(prev_norm) >= 20:
                    similarity = SequenceMatcher(None, normalized, prev_norm).ratio()
                    if similarity >= threshold and similarity < 1.0:
                        flags.append(CleaningFlag(
                            line_number=i + 1,
                            flag_type="NEAR_DUPLICATE",
                            message=f"~{int(similarity*100)}% similar to a nearby line",
                            confidence=similarity,
                            original_text=stripped,
                        ))
                        is_near_dup = True
                        break

        if not is_near_dup:
            seen_normalized[normalized] = i + 1
        result.append(line)

    return "\n".join(result), removed_count, flags


# ─────────────────────── Stage 11: Terminology Validation ───────────────────────

def validate_terminology(text: str, glossary_terms: set[str]) -> list[CleaningFlag]:
    """Stage 11: Validate educational terminology against approved glossary.
    
    (Currently disabled as per user request to reduce false positives on inflected terms).
    """
    return []


# ─────────────────────── Stage 12: Structural Validation ───────────────────────

def validate_structure(text: str) -> list[CleaningFlag]:
    """Stage 12: General structural validation.
    
    Checks:
    - Declared-count validation (e.g., 'වර්ග තුනක්' should be followed by 3 items)
    - Incomplete-ending detection (heading without content, list intro without items)
    - Heading-content validation (consecutive headings without content)
    """
    if not text:
        return []

    flags: list[CleaningFlag] = []
    lines = text.split("\n")

    # 12.1: Declared-count validation
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # Look for count declarations
        for count_word, expected_count in _SINHALA_COUNT_WORDS.items():
            if count_word in stripped:
                # Also check the line has a list-intro word
                has_intro = any(w in stripped for w in _LIST_INTRO_WORDS)
                if not has_intro:
                    continue

                # Count bullets or short items following this line
                actual_count = 0
                j = i + 1
                while j < len(lines):
                    next_line = lines[j].strip()
                    if not next_line:
                        j += 1
                        continue
                    if next_line.startswith("•") or next_line.startswith("- "):
                        actual_count += 1
                        j += 1
                        continue
                    # If it's a heading, stop counting
                    if re.match(r"^\d+\.\d+", next_line):
                        break
                    # Short line might be an unnumbered list item
                    if len(next_line) < 60 and _has_sinhala(next_line) and actual_count > 0:
                        actual_count += 1
                        j += 1
                        continue
                    break

                if actual_count > 0 and actual_count != expected_count:
                    flags.append(CleaningFlag(
                        line_number=i + 1,
                        flag_type="COUNT_MISMATCH",
                        message=f"Declared {expected_count} items ('{count_word}') but found {actual_count}",
                        confidence=0.8,
                        original_text=stripped,
                    ))
                break  # Only check first count word per line

    # 12.2: Incomplete-ending detection
    if lines:
        last_non_empty = ""
        last_line_num = 0
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip():
                last_non_empty = lines[i].strip()
                last_line_num = i + 1
                break

        # Ends with a heading without content
        if re.match(r"^\d+\.\d+(\.\d+)*\s+", last_non_empty):
            flags.append(CleaningFlag(
                line_number=last_line_num,
                flag_type="INCOMPLETE_ENDING",
                message="Topic ends with a heading but no content follows",
                confidence=0.85,
                original_text=last_non_empty,
            ))

        # Ends with "පහත දැක්වේ" without a list
        if "පහත දැක්වේ" in last_non_empty or last_non_empty.endswith(":"):
            flags.append(CleaningFlag(
                line_number=last_line_num,
                flag_type="INCOMPLETE_ENDING",
                message="Topic ends with a list introduction but no items follow",
                confidence=0.8,
                original_text=last_non_empty,
            ))

    # 12.3: Consecutive headings without content
    prev_was_heading = False
    prev_heading_line = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        is_heading = bool(re.match(r"^\d+\.\d+(\.\d+)*\s+", stripped))
        if is_heading:
            if prev_was_heading:
                flags.append(CleaningFlag(
                    line_number=prev_heading_line,
                    flag_type="EMPTY_SECTION",
                    message="Heading has no content before the next heading",
                    confidence=0.75,
                    original_text=lines[prev_heading_line - 1].strip() if prev_heading_line > 0 else "",
                ))
            prev_was_heading = True
            prev_heading_line = i + 1
        else:
            prev_was_heading = False

    return flags


# ─────────────────────── Stage 13: Confidence Scoring ───────────────────────

def score_confidence(text: str, flags: list[CleaningFlag], stats: CleaningStats) -> float:
    """Stage 13: Calculate overall confidence score for the cleaned text.
    
    Score from 0.0 to 1.0 based on:
    - Number of corrections applied (more = lower confidence)
    - Number of flags raised
    - Text completeness indicators
    """
    if not text:
        return 0.0

    score = 1.0

    # Penalize for flags
    critical_flags = sum(1 for f in flags if f.flag_type in (
        "INCOMPLETE_ENDING", "COUNT_MISMATCH", "EMPTY_SECTION"
    ))
    warning_flags = sum(1 for f in flags if f.flag_type in (
        "NEAR_DUPLICATE", "POSSIBLE_CORRUPTION"
    ))

    score -= critical_flags * 0.1
    score -= warning_flags * 0.03

    # Penalize for high correction rate
    if stats.lines_processed > 0:
        correction_rate = stats.corrections_applied / max(stats.lines_processed, 1)
        if correction_rate > 0.3:
            score -= 0.1
        elif correction_rate > 0.1:
            score -= 0.05

    return max(0.0, min(1.0, round(score, 2)))


# ─────────────────────── Main Cleaner Class ───────────────────────

class TextCleaner:
    """Orchestrates all cleaning stages on extracted topic text."""

    def __init__(self, config: TextCleanerConfig | None = None):
        if config is None:
            # Load default config from standard locations
            data_dir = Path(__file__).parent / "data"
            config = TextCleanerConfig(
                corrections_path=data_dir / "corrections.json",
                glossary_dir=data_dir / "glossaries",
            )
        self.config = config

    def clean(self, text: str) -> CleaningResult:
        """Run all cleaning stages on the given text.
        
        Returns a CleaningResult with the cleaned text, flags, and stats.
        """
        if not text or not text.strip():
            return CleaningResult(cleaned_text=text)

        stats = CleaningStats()
        all_flags: list[CleaningFlag] = []

        # Stage 1: Basic preprocessing
        text = preprocess_text(text)
        stats.lines_processed = len(text.split("\n"))

        # Stage 2: Sinhala Unicode normalization
        text, correction_count = normalize_sinhala_unicode(text, self.config)
        stats.corrections_applied += correction_count

        # Stage 3: Line classification
        classified = classify_lines(text)

        # Stage 4: Noise removal
        classified, noise_removed = remove_noise(classified)
        stats.noise_lines_removed = noise_removed

        # Stage 5: Paragraph reconstruction
        text, join_count = reconstruct_paragraphs(classified)
        stats.paragraphs_joined = join_count

        # Stage 6: Sentence boundary repair
        text, split_count = repair_sentence_boundaries(text)
        stats.sentences_split = split_count

        # Stage 7: Missing-space correction
        text, space_count = correct_missing_spaces(text)
        stats.spaces_inserted = space_count

        # Stage 8: Bullet list reconstruction
        text, bullet_count = reconstruct_bullet_lists(text)
        stats.bullets_reconstructed = bullet_count

        # Stage 9: Heading consistency
        text = normalize_heading_format(text)

        # Stage 10: Duplicate removal
        text, dup_count, dup_flags = remove_duplicates(
            text, threshold=self.config.near_duplicate_threshold
        )
        stats.duplicates_removed = dup_count
        all_flags.extend(dup_flags)

        # Stage 11: Terminology validation
        term_flags = validate_terminology(text, self.config.glossary_terms)
        stats.terminology_flags = len(term_flags)
        all_flags.extend(term_flags)

        # Stage 12: Structural validation
        struct_flags = validate_structure(text)
        stats.structure_flags = len(struct_flags)
        all_flags.extend(struct_flags)

        # Stage 13: Confidence scoring
        confidence = score_confidence(text, all_flags, stats)

        # Final cleanup
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = text.strip() + "\n"

        logger.info(
            f"TextCleaner: {stats.lines_processed} lines, "
            f"{stats.corrections_applied} corrections, "
            f"{stats.paragraphs_joined} joins, "
            f"{stats.sentences_split} splits, "
            f"{stats.noise_lines_removed} noise removed, "
            f"{stats.duplicates_removed} duplicates removed, "
            f"{len(all_flags)} flags, "
            f"confidence={confidence}"
        )

        return CleaningResult(
            cleaned_text=text,
            flags=all_flags,
            stats=stats,
        )
