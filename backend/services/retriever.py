from services.vector_store import get_vector_store

def get_relevant_context(subject: str, lesson: str, topic: str, k: int = 4) -> str:
    """
    Subject, lesson, topic අනුව relevant context retrieve කරන්න
    """
    vector_store = get_vector_store()
    
    # Query සකසන්න - සිංහල + English දෙකෙන්ම search කරන්න
    query = f"{subject} {lesson} {topic}"
    
    # Metadata filter (optional - files subject අනුව නම් කළොත්)
    # filter_dict = {"subject": subject}
    
    docs = vector_store.similarity_search(
        query=query,
        k=k,
        # filter=filter_dict  # metadata filter add කළොත්
    )
    
    if not docs:
        return ""
    
    # Docs join කරන්න
    context = "\n\n".join([
        f"[Source: {doc.metadata.get('source_file', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    ])
    
    return context


def get_retriever(k: int = 4):
    """LangChain retriever object return කරන්න"""
    vector_store = get_vector_store()
    return vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k}
    )