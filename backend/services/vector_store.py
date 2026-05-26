import os
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

def get_embeddings():
    """Multilingual embeddings - සිංහල සඳහා හොඳ ක්‍රියා කරයි"""
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True}
    )

def get_vector_store():
    """Existing ChromaDB load කරන්න"""
    embeddings = get_embeddings()
    return Chroma(
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings,
        collection_name="sinhala_education"
    )

def ingest_documents(docs_path: str):
    """
    Documents ingest කරන්න
    docs_path: folder path (PDFs, txt files)
    """
    documents = []
    
    # PDF files load කරන්න
    for filename in os.listdir(docs_path):
        filepath = os.path.join(docs_path, filename)
        
        if filename.endswith(".pdf"):
            loader = PyPDFLoader(filepath)
            docs = loader.load()
            # Metadata add කරන්න
            for doc in docs:
                doc.metadata["source_file"] = filename
                doc.metadata["file_type"] = "pdf"
            documents.extend(docs)
            
        elif filename.endswith(".txt"):
            loader = TextLoader(filepath, encoding="utf-8")
            docs = loader.load()
            for doc in docs:
                doc.metadata["source_file"] = filename
                doc.metadata["file_type"] = "txt"
            documents.extend(docs)
    
    print(f"✅ Loaded {len(documents)} documents")
    
    # Chunks බවට බෙදන්න
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,          # සිංහල සඳහා කුඩා chunks
        chunk_overlap=100,       # Context රඳවා ගන්නා overlap
        separators=["\n\n", "\n", ".", "।", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"✅ Created {len(chunks)} chunks")
    
    # Vector Store save කරන්න
    embeddings = get_embeddings()
    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_PATH,
        collection_name="sinhala_education"
    )
    vector_store.persist()
    print(f"✅ Vector DB saved to {CHROMA_PATH}")
    return vector_store