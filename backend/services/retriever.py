import re
import os
import sys

# Fix Windows console encoding for Sinhala Unicode
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from services.vector_store import get_vector_store

DOCS_PATH = "./documents_unicode"


def is_garbled(text: str) -> bool:
    # Strip e5 prefix before checking
    t = text.strip()
    if t.startswith("passage: "):
        t = t[len("passage: "):]
    # [IMAGE:] tags are never garbled
    if t.upper().startswith("[IMAGE"):
        return False
    unicode_sinhala = sum(1 for c in text if '඀' <= c <= '෿')
    total = len(text.strip())
    if total == 0:
        return True
    return (unicode_sinhala / total) < 0.3


def clean_chunk(text: str) -> str:
    """Remove e5 prefix and OCR garbage."""
    if text.startswith("passage: "):
        text = text[len("passage: "):]
    lines = text.splitlines()
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            clean_lines.append(line)
            continue
        # Preserve [IMAGE:] and [IMAGE_x.png] tags — do not filter
        if stripped.startswith("[IMAGE"):
            clean_lines.append(line)
            continue
        if len(stripped) < 8:
            continue
        if '_' in stripped and ('"' in stripped or "'" in stripped):
            continue
        clean_lines.append(line)
    text = "\n".join(clean_lines).strip()
    text = re.sub(r'(\.\s+|\.\n)\s*[඀-෿]{1,5}\s*$', r'\1', text).strip()
    return text


def _find_matching_file(subject: str, lesson: str, topic: str) -> str | None:
    """Find the best matching txt file using word prefix matching."""
    def normalize(s):
        return re.sub(r'[\s_\-]+', '', s)

    def word_prefixes(s, n=4):
        words = re.split(r'[\s_]+', s)
        return [w[:n] for w in words if len(w) >= n]

    n_topic         = normalize(topic)
    n_lesson        = normalize(lesson)
    topic_prefixes  = word_prefixes(topic, n=4)
    lesson_prefixes = word_prefixes(lesson, n=4)

    best_file  = None
    best_score = 0

    try:
        files = os.listdir(DOCS_PATH)
    except Exception as e:
        print(f"[ERROR] Cannot list {DOCS_PATH}: {e}")
        return None

    for filename in files:
        if not filename.endswith(".txt"):
            continue
        try:
            n_file = normalize(filename.replace(".txt", ""))
            score  = 0

            if n_topic  in n_file: score += 6
            if n_lesson in n_file: score += 4

            score += sum(2 for p in topic_prefixes  if p in n_file)
            score += sum(1 for p in lesson_prefixes if p in n_file)

            if score > best_score:
                best_score = score
                best_file  = filename
        except Exception:
            continue

    print(f"[DEBUG] Best match score={best_score} file={best_file}")
    return best_file if best_score >= 3 else None


def get_relevant_context(subject: str, lesson: str, topic: str, k: int = 6, use_vector_ranking: bool = False, max_length: int = None) -> str:
    """
    Retrieve context for given subject/lesson/topic.
    use_vector_ranking=False → document order (for content generation)
    use_vector_ranking=True  → vector similarity ranking (for quiz generation)
    """

    matched_file = _find_matching_file(subject, lesson, topic)
    print(f"\n[DEBUG] Matched file: {matched_file}")

    query = f"query: {lesson} {topic}"
    print(f"[DEBUG] Query: {query}")

    # Vector DB - document order (content generation)
    # Use collection.get() to fetch ALL chunks for the file — not similarity search,
    # so IMAGE tag chunks (low similarity score) are always included.
    if matched_file and not use_vector_ranking:
        try:
            vector_store = get_vector_store()
            result = vector_store._collection.get(
                where={"source_file": matched_file},
                include=["documents", "metadatas"]
            )
            docs_raw = list(zip(result["documents"], result["metadatas"]))
            print(f"[DEBUG] Vector DB (content): {len(docs_raw)} chunks via get()")
            if docs_raw:
                docs_sorted = sorted(docs_raw, key=lambda x: x[1].get("para_index", 999))
                parts = []
                for doc_text, _ in docs_sorted:
                    cleaned = clean_chunk(doc_text)
                    if cleaned and not is_garbled(doc_text):
                        parts.append(cleaned)
                context = "\n\n".join(parts)
                print(f"[DEBUG] Context length: {len(context)} chars")
                image_tags = [p for p in parts if p.strip().upper().startswith("[IMAGE")]
                print(f"[DEBUG] IMAGE tags in context: {image_tags}")
                return context if max_length is None else context[:max_length]
        except Exception as e:
            print(f"[WARNING] Vector DB failed: {e}")
            return _load_from_file(matched_file)

    # Vector similarity ranking sorted by document order
    if matched_file and use_vector_ranking:
        try:
            vector_store = get_vector_store()
            docs = vector_store.similarity_search(
                query=query,
                k=k,
                filter={"source_file": matched_file}
            )
            print(f"[DEBUG] Vector search (filtered): {len(docs)} chunks")
            if docs:
                # Sort by para_index to restore document order
                docs_sorted = sorted(
                    docs,
                    key=lambda d: d.metadata.get("para_index", 999)
                )
                clean_docs = [doc for doc in docs_sorted if not is_garbled(doc.page_content)]
                context = "\n\n".join([clean_chunk(doc.page_content) for doc in clean_docs])
                print(f"[DEBUG] Context length: {len(context)} chars")
                return context[:8000]
        except Exception as e:
            print(f"[WARNING] Vector search failed: {e}")
            return _load_from_file(matched_file)

    # Fallback - unfiltered vector search
    print("[DEBUG] No file match — using unfiltered vector search")
    vector_store = get_vector_store()
    docs = vector_store.similarity_search(query=query, k=k)
    clean_docs = [doc for doc in docs if not is_garbled(doc.page_content)]
    context = "\n\n".join([clean_chunk(doc.page_content) for doc in clean_docs])
    return context[:8000]


def _load_from_file(filename: str) -> str:
    """Load and return all valid paragraphs from a txt file."""
    filepath = os.path.join(DOCS_PATH, filename)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] Cannot read {filename}: {e}")
        return ""

    paras = []
    for para in re.split(r'\n{2,}', content):
        para = para.strip()
        if para.upper().startswith("[IMAGE"):
            paras.append(para)
            continue
        if len(para) < 80 or is_garbled(para):
            continue
        cleaned = clean_chunk(para)
        if cleaned:
            paras.append(cleaned)

    result = "\n\n".join(paras)
    print(f"[DEBUG] Direct file load: {len(paras)} paragraphs, {len(result)} chars")
    return result[:8000]


def get_retriever(k: int = 4):
    vector_store = get_vector_store()
    return vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k}
    )