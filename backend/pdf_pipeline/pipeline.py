from __future__ import annotations

import logging
import re
import shutil
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import fitz

from pdf_pipeline.text_cleaner import TextCleaner, TextCleanerConfig
from pdf_pipeline.page_detector import detect_page_type, PageType

logger = logging.getLogger("uvicorn.error")


@dataclass(slots=True)
class FontSample:
    page: int
    font_names: list[str]
    font_sizes: list[float]
    scanned: bool


@dataclass(slots=True)
class BlockItem:
    kind: str
    page: int
    bbox: tuple[float, float, float, float]
    content: str
    font_name: str | None = None
    font_size: float | None = None
    bold: bool = False
    image_path: str | None = None
    is_label: bool = False

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "page": self.page,
            "bbox": self.bbox,
            "content": self.content,
            "font_name": self.font_name,
            "font_size": self.font_size,
            "bold": self.bold,
            "image_path": self.image_path,
            "is_label": self.is_label,
        }

    @classmethod
    def from_dict(cls, data: dict) -> BlockItem:
        return cls(
            kind=data["kind"],
            page=data["page"],
            bbox=tuple(data["bbox"]),
            content=data["content"],
            font_name=data.get("font_name"),
            font_size=data.get("font_size"),
            bold=data.get("bold", False),
            image_path=data.get("image_path"),
            is_label=data.get("is_label", False),
        )


@dataclass(slots=True)
class TopicUnit:
    title: str
    page: int
    blocks: list[BlockItem] = field(default_factory=list)

    def render(self, body_size: float = 12.0) -> str:
        body_parts: list[str] = []
        in_activity_section = False
        
        # 12. Remove duplicate headings (naive deduplication)
        deduped_blocks: list[BlockItem] = []
        last_text = None
        for block in self.blocks:
            if block.kind == "text":
                text = block.content.strip()
                if text == last_text:
                    continue
                last_text = text
            deduped_blocks.append(block)
            
        # 13. Preserve Scientific Terms (Horizontal Merging)
        merged_blocks: list[BlockItem] = []
        for block in deduped_blocks:
            if merged_blocks and block.kind == "text" and merged_blocks[-1].kind == "text":
                prev = merged_blocks[-1]
                # If same page and similar y-coordinate
                if prev.page == block.page and abs(prev.bbox[1] - block.bbox[1]) < 4:
                    if prev.bbox[0] < block.bbox[0]:
                        prev.content = f"{prev.content.strip()} {block.content.strip()}"
                        prev.bbox = (prev.bbox[0], prev.bbox[1], max(prev.bbox[2], block.bbox[2]), max(prev.bbox[3], block.bbox[3]))
                    else:
                        prev.content = f"{block.content.strip()} {prev.content.strip()}"
                        prev.bbox = (block.bbox[0], min(prev.bbox[1], block.bbox[1]), max(prev.bbox[2], block.bbox[2]), max(prev.bbox[3], block.bbox[3]))
                    continue
            merged_blocks.append(block)

        last_rendered_block: BlockItem | None = None
        
        for block in merged_blocks:
            if block.kind == "image":
                if body_parts and not body_parts[-1].endswith("\n\n"):
                    if not body_parts[-1].endswith(" "):
                        body_parts.append("\n\n")
                body_parts.append(block.content)
                body_parts.append("\n\n")
                last_rendered_block = block
                continue

            text = block.content.strip()
            if not text:
                continue

            # 5. Sinhala Typography Cleanup
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"^\s*(?:••|    |--)\s*", "• ", text)
            text = text.replace("-:-", ":")
            # Strip unwanted stray characters specified by user
            text = text.replace("{", "").replace("}", "").replace("¾", "")
            text = re.sub(r"\b[xX]\b", "", text)
            text = re.sub(r"(?<!\S)ර්(?!\S)", "", text)
            
            # Fix known legacy font conversion glitches and line-break artifacts
            text = text.replace("`ඵ", "ළු")
            text = text.replace("`ප", "ළ") # Adding another common backtick glitch just in case
            text = text.replace("¥ෂිත", "දූෂිත") # user requested fix
            # Remove hyphens strictly between two Sinhala characters (fixes words like අඟු-රු that were split across printed lines)
            text = re.sub(r"(?<=[\u0D80-\u0DFF])-(?=[\u0D80-\u0DFF])", "", text)

            if "y හ " in text:
                text = text.replace("y හ ", "\n- ")

            # We no longer forcefully replace "1.1 රූපය" with "මෙම රූපය"
            # as it creates confusing artifacts for the reviewer.

            if re.match(r"^[}්. \t]+$", text):
                continue
                
            is_heading = _is_heading(text, block.font_size, block.bold, body_size)

            # Close activity section on major heading
            if in_activity_section and is_heading:
                if body_parts and not body_parts[-1].endswith("\n\n"):
                    body_parts.append("\n")
                body_parts.append("-" * 34 + "\n\n")
                in_activity_section = False

            # 7. Activity Section Formatting
            if text.startswith("ක්රියාකාරකම"):
                if body_parts and not body_parts[-1].endswith("\n\n"):
                    body_parts.append("\n\n")
                body_parts.append("-" * 34 + "\n")
                body_parts.append(text + "\n\n")
                in_activity_section = True
                last_rendered_block = block
                continue
                
            # Formatting for diagram labels
            if block.is_label:
                # Use regex to identify if this label is a caption
                if re.match(r"^(\d+\.\d+\s*)?රූපය", text) or text.startswith("රූපයේ සටහන:"):
                    # Strip the generic prefix if it exists
                    text = text.replace("රූපයේ සටහන: ", "")
                    body_parts.append("\n\n" + text + "\n")
                else:
                    body_parts.append("- " + text + "\n")
                last_rendered_block = block
                continue

            # 6. Bullet List Reconstruction
            is_bullet = text.startswith("•") or text.startswith("- ") or re.match(r"^\d+\.\s", text)

            if not body_parts:
                body_parts.append(text)
            else:
                prev_text = body_parts[-1].strip()
                if not prev_text or last_rendered_block is None or last_rendered_block.kind == "image":
                    body_parts.append("\n\n" + text)
                elif is_heading:
                    body_parts.append("\n\n" + text)
                elif is_bullet:
                    body_parts.append("\n" + text)
                elif in_activity_section:
                    body_parts.append("\n\n" + text)
                else:
                    # 4. Paragraph Reconstruction
                    prev_b = last_rendered_block
                    # Check merging rules: same font, size, aligned left, small vertical gap, no terminator
                    is_same_page = prev_b.page == block.page
                    gap = block.bbox[1] - prev_b.bbox[3]
                    
                    is_same_font = prev_b.font_name == block.font_name and abs((prev_b.font_size or 0) - (block.font_size or 0)) < 1.0
                    # Relax alignment check slightly to allow minor indentations
                    is_aligned = abs(prev_b.bbox[0] - block.bbox[0]) < 25
                    # Tighten gap to < 0.8x font size. PyMuPDF blocks are already grouped, so any large gap on the same page means they are distinct items!
                    is_close = (-25 <= gap < (block.font_size or 12.0) * 0.8) if is_same_page else True
                    
                    ends_with_terminator = prev_text[-1] in ".?!:;" if prev_text else False
                    ends_with_hyphen = prev_text.endswith("-") if prev_text else False
                    
                    if is_same_font and is_aligned and is_close and not ends_with_terminator:
                        if ends_with_hyphen:
                            # Trim trailing spaces and hyphen from the last appended chunk
                            body_parts[-1] = body_parts[-1].rstrip()[:-1]
                            body_parts.append(text)
                        else:
                            body_parts.append(" " + text)
                    else:
                        body_parts.append("\n\n" + text)

            last_rendered_block = block

        if in_activity_section:
            if body_parts and not body_parts[-1].endswith("\n\n"):
                body_parts.append("\n")
            body_parts.append("-" * 34 + "\n\n")

        body = "".join(body_parts).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        return f"{self.title}\n\n{body}\n".strip() + "\n"


@dataclass(slots=True)
class LessonTopicSpec:
    title: str
    filename_slug: str
    start_page: int
    end_page: int


@dataclass(slots=True)
class LessonSpec:
    output_prefix: str
    topics: tuple[LessonTopicSpec, ...]


@dataclass(slots=True)
class ProcessingResult:
    output_dir: Path
    text_files: list[Path]
    image_files: list[Path]
    archive_path: Path
    font_samples: list[FontSample]
    topics: list[TopicUnit]


LESSON_01_SPEC = LessonSpec(
    output_prefix="grade11_lesson01",
    topics=(
        LessonTopicSpec(
            title="ශාක පටක", filename_slug="plant_tissue", start_page=1, end_page=9
        ),
        LessonTopicSpec(
            title="සත්ව පටක", filename_slug="animal_tissue", start_page=10, end_page=15
        ),
    ),
)


class LegacySinhalaConverter:
    def __init__(self, mapping_dir: Path | None = None) -> None:
        self.mapping_dir = mapping_dir
        try:
            from pandukabhaya import Converter
            self._converter = Converter("fm_abhaya")
        except ImportError as e:
            import logging
            logging.error(f"CRITICAL: pandukabhaya is not installed or failed to load. Legacy fonts will NOT be converted! Error: {e}")
            self._converter = None

    def convert(self, text: str, font_name: str | None) -> str:
        if not text:
            return text
        if font_name and _looks_like_legacy_sinhala_font(font_name):
            if self._converter:
                return self._converter.convert(text)
        return text


class PDFPipeline:
    def __init__(self, mapping_dir: Path | None = None) -> None:
        self.converter = LegacySinhalaConverter(mapping_dir)
        # Initialize the text cleaner with default config
        data_dir = Path(__file__).parent / "data"
        self.text_cleaner = TextCleaner(TextCleanerConfig(
            corrections_path=data_dir / "corrections.json",
            glossary_dir=data_dir / "glossaries",
        ))

    def inspect_fonts(
        self, pdf_path: str | Path, sample_pages: int = 3
    ) -> list[FontSample]:
        document = fitz.open(pdf_path)
        results: list[FontSample] = []
        for page_index in range(min(sample_pages, document.page_count)):
            page = document.load_page(page_index)
            text_dict = page.get_text("dict")
            font_names: set[str] = set()
            font_sizes: list[float] = []
            scanned = True
            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue
                scanned = False
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        font = span.get("font")
                        size = span.get("size")
                        if font:
                            font_names.add(font)
                        if isinstance(size, (int, float)):
                            font_sizes.append(float(size))
            results.append(
                FontSample(
                    page=page_index + 1,
                    font_names=sorted(font_names),
                    font_sizes=sorted(set(font_sizes)),
                    scanned=scanned,
                )
            )
        document.close()
        return results

    def _extract_blocks_and_images(
        self,
        pdf_path: str | Path,
        image_dir: str | Path | None,
    ) -> tuple[list[BlockItem], list[Path]]:
        document = fitz.open(pdf_path)
        items: list[BlockItem] = []
        saved_images: list[Path] = []
        output_path = Path(image_dir) if image_dir is not None else None
        if output_path is not None:
            output_path.mkdir(parents=True, exist_ok=True)

        image_counter = 1
        for page_index in range(document.page_count):
            # Per-page type detection (logged for diagnostics)
            page = document.load_page(page_index)
            try:
                page_analysis = detect_page_type(page, page_number=page_index + 1)
                if page_analysis.page_type == PageType.SCANNED:
                    logger.warning(
                        f"Page {page_index + 1}: Detected as SCANNED — "
                        f"text extraction may be incomplete"
                    )
                elif page_analysis.page_type == PageType.LEGACY_FONT:
                    logger.info(
                        f"Page {page_index + 1}: Legacy font detected — "
                        f"using pandukabhaya conversion"
                    )
            except Exception as e:
                logger.debug(f"Page type detection failed for page {page_index + 1}: {e}")
            rect = page.rect
            header_threshold = rect.height * 0.06
            footer_threshold = rect.height * 0.92

            text_dict = page.get_text("dict", sort=True)
            for block in text_dict.get("blocks", []):
                bbox = tuple(float(value) for value in block.get("bbox", (0, 0, 0, 0)))

                # Ignore headers and footers
                if bbox[1] < header_threshold or bbox[3] > footer_threshold:
                    continue

                if block.get("type") == 0:
                    for line in block.get("lines", []):
                        text_parts: list[str] = []
                        font_name = None
                        font_size = None
                        bold = False
                        
                        line_bbox = tuple(float(value) for value in line.get("bbox", (0, 0, 0, 0)))

                        for span in line.get("spans", []):
                            span_text = str(span.get("text", ""))
                            span_font = span.get("font")
                            if span_text:
                                converted_text = self.converter.convert(span_text, span_font)
                                text_parts.append(converted_text)
                            font_name = font_name or span_font
                            if font_size is None and isinstance(
                                span.get("size"), (int, float)
                            ):
                                font_size = float(span["size"])
                            if str(span.get("font", "")).lower().endswith("bold"):
                                bold = True
                                
                        content = "".join(text_parts).strip()
                        if content:
                            items.append(
                                BlockItem(
                                    kind="text",
                                    page=page_index + 1,
                                    bbox=line_bbox,
                                    content=content,
                                    font_name=font_name,
                                    font_size=font_size,
                                    bold=bold,
                                )
                            )

            # Better Image Extraction using get_image_info to catch all graphical elements
            image_info_list = page.get_image_info(xrefs=True)
            for img_info in image_info_list:
                bbox = img_info.get("bbox", (0, 0, 0, 0))
                if bbox[1] < header_threshold or bbox[3] > footer_threshold:
                    continue
                xref = img_info.get("xref")
                if not xref:
                    continue
                try:
                    pix = fitz.Pixmap(document, xref)
                    if pix.n - pix.alpha >= 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    image_bytes = pix.tobytes("png")
                    suffix = "png"
                    image_name = (
                        f"image_{subject}_{image_counter}.{suffix}"
                        if "subject" in locals()
                        else f"image_science_{image_counter}.{suffix}"
                    )
                    if output_path is not None:
                        image_path = output_path / image_name
                        image_path.write_bytes(bytes(image_bytes))
                        saved_images.append(image_path)
                    items.append(
                        BlockItem(
                            kind="image",
                            page=page_index + 1,
                            bbox=bbox,
                            content=f"[image: {image_name.split('.')[0]}]",
                            image_path=image_name,
                        )
                    )
                    image_counter += 1
                except Exception:
                    pass

        # Identify diagram labels by checking if text overlaps with any image bounding box
        image_items = [it for it in items if it.kind == "image"]
        for item in items:
            if item.kind == "text":
                cx = (item.bbox[0] + item.bbox[2]) / 2
                cy = (item.bbox[1] + item.bbox[3]) / 2
                for img in image_items:
                    if img.page == item.page:
                        # Expand image bbox slightly to catch nearby labels
                        ib = img.bbox
                        if (ib[0] - 20) <= cx <= (ib[2] + 20) and (ib[1] - 20) <= cy <= (ib[3] + 20):
                            item.is_label = True
                            break

        items = self._process_tables(document, items)

        document.close()
        # Column-aware reading order sort: page, column (left/right), rounded Y, then X
        items.sort(
            key=lambda item: (
                item.page,
                1 if item.bbox[0] > 300 else 0,  # Column detection (Left=0, Right=1)
                round(item.bbox[1] / 15.0),
                item.bbox[0],
                0 if item.kind == "text" else 1,
            )
        )
        return items, saved_images

    def _process_tables(self, document: fitz.Document, items: list[BlockItem]) -> list[BlockItem]:
        page_items = {}
        for item in items:
            page_items.setdefault(item.page, []).append(item)
            
        new_items = []
        global_headers = []
        last_table_col_count = 0
        
        for page_index in range(document.page_count):
            page_num = page_index + 1
            if page_num not in page_items:
                continue
                
            page = document.load_page(page_index)
            tabs = page.find_tables()
            p_items = page_items[page_num]
            
            if not tabs.tables:
                new_items.extend(p_items)
                continue
                
            consumed_items = set()
            for tab in tabs.tables:
                data = tab.extract()
                valid_rows = sum(1 for r in data if len([c for c in r if c and str(c).strip()]) >= 2)
                if valid_rows < 1:
                    continue
                    
                col_count = len(data[0]) if data else 0
                first_row = [self.converter.convert(str(c), "fm_abhaya").strip().replace('\n', ' ') if c else "" for c in data[0]] if data else []
                
                # Table Continuation Heuristic: If we have headers and the column count matches the last table, assume it's a continuation
                is_header = False
                if global_headers and col_count == last_table_col_count:
                    pass # Keep existing global_headers
                else:
                    is_header = True
                    
                if is_header:
                    global_headers = first_row
                    data_rows = data[1:]
                else:
                    data_rows = data
                    
                headers = global_headers
                last_table_col_count = len(headers)
                
                table_lines = []
                
                for row in data_rows:
                    raw_row_vals = [self.converter.convert(str(c), "fm_abhaya").strip() if c else "" for c in row]
                    row_vals = [c.replace('\n', ' ') for c in raw_row_vals]
                    if not any(row_vals):
                        continue
                        
                    if row_vals[0]:
                        table_lines.append(row_vals[0])
                        
                    i = 1
                    while i < len(row_vals):
                        val = row_vals[i]
                        raw_val = raw_row_vals[i]
                        header = headers[i] if i < len(headers) else ""
                        
                        if not val:
                            i += 1
                            continue
                            
                        # Standard generic formatting
                        # Join lines with a space to gracefully handle both lists and wrapped text
                        val_clean = raw_val.replace('\n', ' ')
                        if header:
                            val_clean = val_clean if val_clean.endswith(".") else val_clean + "."
                            table_lines.append(f"- {header}: {val_clean}")
                        else:
                            table_lines.append(f"- {val_clean}")
                            
                        i += 1
                        
                    table_lines.append("")
                    
                table_text = "\n".join(table_lines).strip()
                if not table_text:
                    continue
                    
                tab_bbox = tab.bbox
                for item in p_items:
                    if id(item) in consumed_items:
                        continue
                    if item.kind == "text":
                        cx = (item.bbox[0] + item.bbox[2]) / 2
                        cy = (item.bbox[1] + item.bbox[3]) / 2
                        if tab_bbox[0] <= cx <= tab_bbox[2] and tab_bbox[1] <= cy <= tab_bbox[3]:
                            consumed_items.add(id(item))
                            
                new_items.append(BlockItem(
                    kind="text",
                    page=page_num,
                    bbox=tab_bbox,
                    content=table_text,
                    font_name=None,
                    font_size=12.0,
                    bold=False
                ))
                
            for item in p_items:
                if id(item) not in consumed_items:
                    new_items.append(item)
                    
        return new_items

    def extract_blocks(self, pdf_path: str | Path) -> list[BlockItem]:
        items, _ = self._extract_blocks_and_images(pdf_path, None)
        return items

    def extract_and_save_images(
        self, pdf_path: str | Path, output_dir: str | Path
    ) -> list[Path]:
        _, saved_images = self._extract_blocks_and_images(pdf_path, output_dir)
        return saved_images

    def detect_topic_units(self, blocks: list[BlockItem]) -> list[TopicUnit]:
        if not blocks:
            return []
        font_sizes = [
            block.font_size
            for block in blocks
            if block.kind == "text" and block.font_size is not None
        ]
        body_size = _mode_size(font_sizes)
        heading_floor = body_size
        topics: list[TopicUnit] = []
        current_topic: TopicUnit | None = None
        pre_topic_blocks: list[BlockItem] = []

        for block in blocks:
            if block.kind == "text":
                text = block.content.strip()
                # Handle image captions: strip the "1.1 රූපය" boilerplate and just keep the description
                caption_match = re.match(r'^(?:මෙම\s*)?(?:\d+\.\d+(?:\.\d+)?\s*)?රූපය(?:ේ\s*සටහන:?|\s*\d+\.\d+(?:\.\d+)?|ේ)?\s*-?\s*', text)
                if caption_match:
                    desc = text[caption_match.end():].strip()
                    if desc:
                        block.content = desc
                        if current_topic is None:
                            pre_topic_blocks.append(block)
                        else:
                            current_topic.blocks.append(block)
                    continue

                is_heading = _is_heading(text, block.font_size, block.bold, heading_floor)
                if is_heading:
                    current_topic = TopicUnit(title=text, page=block.page)
                    if not topics and pre_topic_blocks:
                        current_topic.blocks.extend(pre_topic_blocks)
                        pre_topic_blocks = []
                    topics.append(current_topic)
                    continue

                if current_topic is None:
                    pre_topic_blocks.append(block)
                else:
                    current_topic.blocks.append(block)
            else:
                if current_topic is None:
                    pre_topic_blocks.append(block)
                else:
                    current_topic.blocks.append(block)
                    
        # If there are pre_topic_blocks but no topics were found, create a single topic
        if not topics and pre_topic_blocks:
            current_topic = TopicUnit(title="Lesson", page=1)
            current_topic.blocks.extend(pre_topic_blocks)
            topics.append(current_topic)
            
        return topics

    def build_lesson_topics(
        self, blocks: list[BlockItem], lesson_spec: LessonSpec
    ) -> list[TopicUnit]:
        topics: list[TopicUnit] = []
        for topic_spec in lesson_spec.topics:
            topic = TopicUnit(title=topic_spec.title, page=topic_spec.start_page)
            for block in blocks:
                if topic_spec.start_page <= block.page <= topic_spec.end_page:
                    topic.blocks.append(block)
            if not topic.blocks:
                raise ValueError(f"No content extracted for {topic_spec.title}")
            topics.append(topic)
        return topics

    def extract_phase(
        self,
        pdf_path: str | Path,
        output_root: str | Path,
    ) -> tuple[list[BlockItem], list[Path]]:
        source_path = Path(pdf_path)
        base_output = Path(output_root)
        image_dir = base_output / "images"
        if image_dir.exists():
            shutil.rmtree(image_dir)
        image_dir.mkdir(parents=True, exist_ok=True)
        blocks, image_files = self._extract_blocks_and_images(source_path, image_dir)
        return blocks, image_files

    def build_text_phase(
        self,
        blocks: list[BlockItem],
        output_root: str | Path,
        selected_images: list[str],
        subject: str = "Science11",
        lesson_spec: LessonSpec | None = None,
    ) -> dict:
        base_output = Path(output_root)
        image_dir = base_output / "images"

        final_blocks = []

        temp_image_dir = base_output / "temp_images_final"
        temp_image_dir.mkdir(parents=True, exist_ok=True)

        # Pre-calculate mapping based on explicit array order
        final_images_mapping = {}
        for idx, img_name in enumerate(selected_images, start=1):
            old_path = image_dir / img_name
            suffix = old_path.suffix if old_path.suffix else ".png"
            new_name = f"image_{subject}_{idx}{suffix}"
            new_path = temp_image_dir / new_name
            
            if old_path.exists():
                shutil.copy2(old_path, new_path)
            
            final_images_mapping[img_name] = new_name

        # Update existing blocks
        for block in blocks:
            if block.kind == "image":
                if block.image_path in final_images_mapping:
                    new_name = final_images_mapping[block.image_path]
                    block.image_path = new_name
                    block.content = f"[image: {Path(new_name).stem}]"
                    final_blocks.append(block)
            else:
                final_blocks.append(block)

        # Append manual images (images in selected_images but not seen in blocks)
        seen_images = {b.image_path for b in final_blocks if b.kind == "image"}
        for old_name, new_name in final_images_mapping.items():
            if new_name not in seen_images:
                final_blocks.append(
                    BlockItem(
                        kind="image",
                        page=9999,
                        bbox=(0, 0, 0, 0),
                        content=f"[image: {Path(new_name).stem}]",
                        image_path=new_name,
                    )
                )

        # Replace old image_dir with the new temp_image_dir
        if image_dir.exists():
            shutil.rmtree(image_dir)
        temp_image_dir.rename(image_dir)

        topics = (
            self.build_lesson_topics(final_blocks, lesson_spec)
            if lesson_spec
            else self.detect_topic_units(final_blocks)
        )

        if lesson_spec and len(topics) != len(lesson_spec.topics):
            raise ValueError(
                f"Expected {len(lesson_spec.topics)} lesson topics, got {len(topics)}"
            )

        # Extract actual lesson name from the first text block in the PDF
        lesson_name_extracted = "lesson"
        for block in blocks:
            if block.kind == "text" and block.content.strip():
                lesson_name_extracted = _slugify(block.content.strip())
                break
                
        font_sizes = [
            block.font_size
            for block in final_blocks
            if block.kind == "text" and block.font_size is not None
        ]
        body_size = _mode_size(font_sizes)

        # Render topics, then run the text cleaner on each
        topics_data = []
        all_flags = []
        for topic in topics:
            raw_content = topic.render(body_size)
            cleaning_result = self.text_cleaner.clean(raw_content)
            topic_flags = [
                {
                    "line_number": f.line_number,
                    "flag_type": f.flag_type,
                    "message": f.message,
                    "confidence": f.confidence,
                    "original_text": f.original_text,
                    "suggested_text": f.suggested_text,
                }
                for f in cleaning_result.flags
            ]
            topics_data.append({
                "title": topic.title,
                "content": cleaning_result.cleaned_text,
                "flags": topic_flags,
            })
            all_flags.extend(topic_flags)

        logger.info(
            f"Text cleaning complete: {len(topics_data)} topics, "
            f"{len(all_flags)} total flags raised"
        )

        return {
            "lesson_name": lesson_name_extracted,
            "topics": topics_data,
            "final_images_mapping": final_images_mapping,
        }

    def finalize_zip_phase(
        self,
        topics_data: list[dict],
        output_root: str | Path,
        lesson_name: str = "lesson",
        subject: str = "Science11",
        lesson_spec: LessonSpec | None = None,
    ) -> ProcessingResult:
        base_output = Path(output_root)
        text_dir = base_output / "txt"
        if text_dir.exists():
            shutil.rmtree(text_dir)
        text_dir.mkdir(parents=True, exist_ok=True)

        text_files: list[Path] = []
        subject_slug = _slugify(subject)
        lesson_slug = _slugify(lesson_name)
        for index, topic in enumerate(topics_data, start=1):
            if lesson_spec:
                topic_slug = _slugify(lesson_spec.topics[index - 1].filename_slug)
            else:
                # Remove the '1.1' or '1.2' numbering from the slug as requested
                clean_title = re.sub(r'^\d+\.\d+\s*', '', topic["title"])
                topic_slug = _slugify(clean_title)
            
            # Canonical backend metadata contract: subject_lesson_topic.txt.
            txt_path = text_dir / f"{subject_slug}_{lesson_slug}_{topic_slug}.txt"
            txt_path.write_text(topic["content"], encoding="utf-8")
            text_files.append(txt_path)

        export_dir = base_output / "export"
        if export_dir.exists():
            shutil.rmtree(export_dir)
        export_dir.mkdir(parents=True, exist_ok=True)

        image_dir = base_output / "images"
        final_image_files = list(image_dir.glob("*")) if image_dir.exists() else []

        shutil.copytree(text_dir, export_dir / "txt")
        if image_dir.exists():
            shutil.copytree(image_dir, export_dir / "images")

        archive_path = base_output / f"{subject_slug}_{lesson_slug}.zip"
        if archive_path.exists():
            archive_path.unlink()

        temp_zip = base_output.parent / f"{subject_slug}_{lesson_slug}_results.zip"
        shutil.make_archive(
            str(temp_zip.with_suffix("")), "zip", root_dir=export_dir, base_dir="."
        )
        shutil.move(str(temp_zip), str(archive_path))

        return ProcessingResult(
            output_dir=base_output,
            text_files=text_files,
            image_files=final_image_files,
            archive_path=archive_path,
            font_samples=[],
            topics=[],
        )

    def process_pdf(
        self,
        pdf_path: str | Path,
        output_root: str | Path | None = None,
        lesson_spec: LessonSpec | None = None,
    ) -> ProcessingResult:
        source_path = Path(pdf_path)
        base_output = (
            Path(output_root)
            if output_root
            else Path(tempfile.mkdtemp(prefix="sinhala_pipeline_"))
        )
        blocks, image_files = self.extract_phase(source_path, base_output)
        selected_images = [img.name for img in image_files]
        topics_result = self.build_text_phase(
            blocks,
            base_output,
            selected_images,
            subject="Science11",
            lesson_spec=lesson_spec,
        )
        return self.finalize_zip_phase(
            topics_result["topics"], 
            base_output, 
            lesson_name=topics_result["lesson_name"], 
            subject="Science11", 
            lesson_spec=lesson_spec
        )


def _normalize_font_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _looks_like_legacy_sinhala_font(font_name: str) -> bool:
    normalized = _normalize_font_name(font_name)
    return (
        normalized.startswith("fm")
        or normalized.startswith("dinalternate")
    )


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\u0D80-\u0DFF]+", "_", value.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "untitled"


def _mode_size(values: list[float]) -> float:
    if not values:
        return 0.0
    counter = Counter(round(value, 1) for value in values)
    return float(counter.most_common(1)[0][0])


def _is_heading(text: str, size: float | None, bold: bool, heading_floor: float) -> bool:
    if not text or size is None:
        return False
    compact = text.strip()
    if len(compact) > 120 or len(compact.split()) > 15:
        return False
        
    # Exclude figure/table captions that often start with X.Y
    if re.search(r'(රූපය|රුපය|රූපයේ|රුපයේ|වගුව|වගුවේ)', compact):
        return False

    # Strictly match major topics like "1.1 ", "1.2 " but NOT subtopics like "1.2.1 "
    is_numbered_topic = bool(re.match(r"^\d+\.\d+\s+[^.]", compact))
    
    if is_numbered_topic:
        return True
        
    return False
