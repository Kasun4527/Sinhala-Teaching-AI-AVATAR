from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from knowledge_base.retriever import get_retriever

def generate_content(subject, lesson, topic, level):

    llm = get_llm()
    retriever = get_retriever()

    docs = retriever.invoke(topic)
    context = "\n".join([doc.page_content for doc in docs])

    # 🎯 Adaptive instruction engine
    adaptive_instruction = ""

    if level == "Beginner":
        adaptive_instruction = """
        Explain in VERY SIMPLE language.
        Use real-life examples.
        Break into small steps.
        Assume student knows nothing.
        """

    elif level == "Intermediate":
        adaptive_instruction = """
        Explain clearly with moderate detail.
        Include examples and key points.
        Avoid too much complexity.
        """

    else:  # Advanced
        adaptive_instruction = """
        Give concise explanation.
        Focus on deep understanding.
        Include technical details and concepts.
        """

    prompt = PromptTemplate(
    input_variables=["subject", "lesson", "topic", "level", "context"],
    template="""
You are an expert {subject} teacher.

Lesson: {lesson}
Topic: {topic}
Student Level: {level}

Context:
{context}

INSTRUCTIONS:

If level = Beginner:
- Explain step by step
- Use simple language
- Add examples

If level = Intermediate:
- Give structured explanation
- Include some theory + examples

If level = Advanced:
- Focus on concepts, formulas, and deeper understanding

Make the lesson clear and engaging.

DO NOT generate quiz.

Return only lesson content.
"""
)

    chain = prompt | llm

    response = chain.invoke({
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "level": level,
        "context": context,
        "instruction": adaptive_instruction
    })

    return response.content