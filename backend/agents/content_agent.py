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
    input_variables=["subject", "lesson", "topic", "level", "context", "instruction"],
    template="""
You are an expert {subject} teacher.

Lesson: {lesson}
Topic: {topic}
Student Level: {level}

Context:
{context}

Adaptive Teaching Style:
{instruction}

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

    # Build a plain-text prompt string for debugging / tracing
    try:
        prompt_text = prompt.template.format(
            subject=subject,
            lesson=lesson,
            topic=topic,
            level=level,
            context=context,
            instruction=adaptive_instruction,
        )
    except Exception:
        prompt_text = f"Lesson: {lesson}\nTopic: {topic}\nLevel: {level}\nInstruction: {adaptive_instruction}" 

    try:
        response = chain.invoke({
            "subject": subject,
            "lesson": lesson,
            "topic": topic,
            "level": level,
            "context": context,
            "instruction": adaptive_instruction
        })
        return {"content": response.content, "rag_prompt": prompt_text}
    except Exception as exc:
        # Keep learning flow alive if the external LLM provider is unavailable.
        print(f"[ContentAgent] LLM generation failed, serving fallback content: {exc}")

        if context.strip():
            context_lines = [line.strip() for line in context.splitlines() if line.strip()]
            fallback_body = "\n".join(context_lines[:12])
            return {"content": (
                f"Topic: {topic}\n"
                f"Level: {level}\n\n"
                "We are currently using textbook-based fallback content because the AI service is unavailable.\n\n"
                f"{fallback_body}"
            ), "rag_prompt": prompt_text}

        return {"content": (
            f"Topic: {topic}\n"
            f"Level: {level}\n\n"
            "AI lesson generation is temporarily unavailable. "
            "Please try again after checking the GROQ_API_KEY in backend/.env."
        ), "rag_prompt": prompt_text}