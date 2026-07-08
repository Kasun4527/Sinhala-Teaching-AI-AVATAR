import os
import re
import shutil
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
import chromadb
from chromadb.config import Settings

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "intfloat/multilingual-e5-base"

_cached_embeddings = None

def get_embeddings():
    global _cached_embeddings
    if _cached_embeddings is None:
        _cached_embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
    return _cached_embeddings


def get_vector_store():
    embeddings = get_embeddings()
    
    if os.getenv("ENVIRONMENT") == "production":
        client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "localhost"),
            port=os.getenv("CHROMA_PORT", "8001")
        )
        return Chroma(
            client=client,
            embedding_function=embeddings,
            collection_name="sinhala_education"
        )
    else:
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


def ingest_documents(docs_path: str):
    all_chunks = []

    for filename in os.listdir(docs_path):
        filepath = os.path.join(docs_path, filename)
        if not filename.endswith(".txt"):
            continue
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

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

        except Exception as e:
            print(f"   ❌ Failed {filename}: {e}")

    print(f"\n✅ Total chunks: {len(all_chunks)}")

    if not all_chunks:
        print("⚠️  No chunks found")
        return None

    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
        print("🗑️  Cleared old vector DB")

    try:
        print("⏳ Loading embedding model...")
        embeddings = get_embeddings()
        print("✅ Embedding model loaded")

        print("⏳ Creating Chroma vector store...")
        vector_store = Chroma.from_documents(
            documents=all_chunks,
            embedding=embeddings,
            persist_directory=CHROMA_PATH,
            collection_name="sinhala_education"
        )
        vector_store.persist()
        print(f"✅ Vector DB saved to {CHROMA_PATH}")
        return vector_store

    except Exception as e:
        print(f"❌ Chroma creation failed: {e}")
        import traceback
        traceback.print_exc()
        return None