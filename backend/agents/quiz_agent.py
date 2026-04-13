from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from knowledge_base.retriever import get_retriever

def generate_quiz(topic, level):
    llm = get_llm()              # ✅ moved inside
    retriever = get_retriever() # ✅ moved inside

    docs = retriever.invoke(topic)
    context = "\n".join([doc.page_content for doc in docs])

    prompt = PromptTemplate(
        input_variables=["topic", "level", "context"],
        template="""
        Based on:
        {context}

        Create 3 MCQs about {topic}.

        Format:
        Q1:
        A)
        B)
        C)
        Answer:

        Keep it suitable for {level}.
        """
    )

    chain = prompt | llm

    response = chain.invoke({
        "topic": topic,
        "level": level,
        "context": context
    })

    return response.content

def evaluate_answers(student_answers, correct_answers):
    score = 0
    for s, c in zip(student_answers, correct_answers):
        if s == c:
            score += 1

    return (score / len(correct_answers)) * 100