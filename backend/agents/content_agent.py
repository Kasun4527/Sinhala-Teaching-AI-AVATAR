from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from knowledge_base.retriever import get_retriever

retriever = get_retriever()

def generate_content(topic, level):

    # ✅ Create LLM here (not globally)
    llm = get_llm()

    docs = retriever.invoke(topic)   
    context = "\n".join([doc.page_content for doc in docs])

    prompt = PromptTemplate(
        input_variables=["topic", "level", "context"],
        template="""
        You are a teacher.

        Use ONLY this knowledge:
        {context}

        Explain "{topic}" for a {level} student clearly.
        """
    )

    chain = prompt | llm

    response = chain.invoke({
        "topic": topic,
        "level": level,
        "context": context
    })

    return response.content