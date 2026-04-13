from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
import os

# ✅ FIXED PATHS (IMPORTANT)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_PATH = os.path.join(BASE_DIR, "data")
VECTOR_PATH = os.path.join(BASE_DIR, "vector_store")


def create_vector_store_from_pdf():
    documents = []

    # ✅ Check folder exists
    if not os.path.exists(DATA_PATH):
        raise Exception(f"DATA_PATH not found: {DATA_PATH}")

    for file in os.listdir(DATA_PATH):
        if file.endswith(".pdf"):
            loader = PyPDFLoader(os.path.join(DATA_PATH, file))
            documents.extend(loader.load())

    print(f"Loaded {len(documents)} pages")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )

    docs = splitter.split_documents(documents)

    print(f"Split into {len(docs)} chunks")

    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )

    db = FAISS.from_documents(docs, embeddings)
    db.save_local(VECTOR_PATH)

    print("✅ Physics PDF Knowledge Base Ready!")


if __name__ == "__main__":
    create_vector_store_from_pdf()