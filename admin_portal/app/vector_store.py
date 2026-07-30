import os
import re
import shutil
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

load_dotenv()

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "intfloat/multilingual-e5-base"

_embeddings_instance = None

def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
    return _embeddings_instance


def get_vector_store():
    embeddings = get_embeddings()
    
    # if os.getenv("ENVIRONMENT") == "production":
    #     # Use HttpClient for robust remote connections
    #     chroma_client = chromadb.HttpClient(
    #         host=os.getenv("CHROMA_HOST", "206.189.152.26"),
    #         port=os.getenv("CHROMA_PORT", "8000")
    #     )
    #     return Chroma(
    #         client=chroma_client,
    #         embedding_function=embeddings,
    #         collection_name="sinhala_education"
    #     )
    # else:
    return Chroma(
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings,
        collection_name="sinhala_education"
    )


def parse_filename_metadata(filename: str) -> dict:
    """Parse subject, lesson, topic from filename: subject_lesson_topic.txt"""
    name = filename.replace(".txt", "")
    parts = name.split("_")
    if len(parts) >= 3:
        subject = parts[0].strip()
        topic   = parts[-1].strip()
        lesson  = "_".join(parts[1:-1]).strip()
    elif len(parts) == 2:
        subject = parts[0].strip()
        lesson  = parts[1].strip()
        topic   = parts[1].strip()
    else:
        subject = name
        lesson  = name
        topic   = name
    return {"subject": subject, "lesson": lesson, "topic": topic}


def ingest_text_content(content: str, filename: str = "Unknown_Lesson_Topic.txt"):
    """
    Ingest a raw string of text directly (used from the Pipeline UI).
    """
    all_chunks = []
    meta = parse_filename_metadata(filename)
    paragraphs = re.split(r'\n{2,}', content)
    file_chunks = 0
    para_index = 0

    for para in paragraphs:
        para = para.strip()
        # Always preserve IMAGE tags regardless of length or char ratio
        if para.upper().startswith("[IMAGE"):
            doc = Document(
                page_content=f"passage: {para}",
                metadata={
                    "source_file": filename,
                    "subject": meta["subject"],
                    "lesson": meta["lesson"],
                    "topic": meta["topic"],
                    "para_index": para_index,
                }
            )
            all_chunks.append(doc)
            file_chunks += 1
            para_index += 1
            continue
            
        if len(para) < 80:
            continue
        sinhala_chars = sum(1 for c in para if '඀' <= c <= '෿')
        if sinhala_chars / len(para) < 0.3:
            continue

        doc = Document(
            page_content=f"passage: {para}",
            metadata={
                "source_file": filename,
                "subject": meta["subject"],
                "lesson": meta["lesson"],
                "topic": meta["topic"],
                "para_index": para_index,
            }
        )
        all_chunks.append(doc)
        file_chunks += 1
        para_index += 1

    print(f"   📄 {filename} → {file_chunks} chunks")
    print(f"\n✅ Total chunks to ingest: {len(all_chunks)}")

    if not all_chunks:
        print("⚠️  No chunks found")
        return None

    try:
        print("⏳ Loading embedding model...")
        embeddings = get_embeddings()
        print("✅ Embedding model loaded")

        print("⏳ Adding to Chroma vector store...")
        # Get vector store (doesn't wipe old data, just adds to it)
        vector_store = get_vector_store()
        vector_store.add_documents(all_chunks)
        print(f"✅ Vector DB updated in {CHROMA_PATH}")
        return vector_store

    except Exception as e:
        print(f"❌ Chroma ingestion failed: {e}")
        import traceback
        traceback.print_exc()
        return None
