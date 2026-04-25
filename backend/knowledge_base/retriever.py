from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

# ✅ Load ONCE when server starts
embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2"
)

db = FAISS.load_local(
    "knowledge_base/vector_store",
    embeddings,
    allow_dangerous_deserialization=True
)

def get_retriever():
    return db.as_retriever(search_kwargs={"k": 3})