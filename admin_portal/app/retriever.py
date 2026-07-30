import re
import os
import sys

from app.vector_store import get_vector_store


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


def get_relevant_context(subject: str, lesson: str, topic: str, k: int = 6, use_vector_ranking: bool = False, max_length: int = None) -> str:
    """
    Retrieve context for given subject/lesson/topic directly from vector store.
    """
    # Create the filename prefix match based on the project standard
    # Here, we don't look at local files like in the AVATAR project fallback,
    # we just trust ChromaDB. 
    
    query = f"query: {lesson} {topic}"
    print(f"[DEBUG] Query: {query}")
    
    try:
        vector_store = get_vector_store()
    except Exception as e:
        print(f"[ERROR] Could not load vector store: {e}")
        return "Vector store unavailable."

    # Option A: Content Generation Flow (use_vector_ranking = False)
    # Reconstruct document linearly for a topic
    if not use_vector_ranking:
        try:
            # We filter by subject, lesson, topic metadata
            where_filter = {
                "$and": [
                    {"subject": {"$eq": subject}},
                    {"lesson": {"$eq": lesson}},
                    {"topic": {"$eq": topic}}
                ]
            }
            
            result = vector_store._collection.get(
                where=where_filter,
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
                return context if max_length is None else context[:max_length]
        except Exception as e:
            print(f"[WARNING] Vector DB get() failed: {e}")

    # Option B: Quiz/Search Flow (use_vector_ranking = True)
    # Perform similarity search and then sort by para_index
    try:
        where_filter = {
            "$and": [
                {"subject": {"$eq": subject}},
                {"lesson": {"$eq": lesson}},
                {"topic": {"$eq": topic}}
            ]
        }
        docs = vector_store.similarity_search(
            query=query,
            k=k,
            filter=where_filter
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

    # Fallback - Unfiltered vector search across entire DB
    print("[DEBUG] No metadata match — using unfiltered vector search")
    docs = vector_store.similarity_search(query=query, k=k)
    clean_docs = [doc for doc in docs if not is_garbled(doc.page_content)]
    context = "\n\n".join([clean_chunk(doc.page_content) for doc in clean_docs])
    return context[:8000]
