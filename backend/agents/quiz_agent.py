import json
import re
from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from knowledge_base.retriever import get_retriever


# =========================
# JSON SAFE PARSER
# =========================
def extract_json(text):
    """
    Safely extract JSON even if LLM adds extra text
    """
    try:
        text = text.replace("```json", "").replace("```", "").strip()

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())

        return json.loads(text)

    except Exception as e:
        print("❌ JSON parsing failed:", e)
        return {"questions": []}


# =========================
# QUIZ GENERATOR (PRE / POST)
# =========================
def generate_quiz(subject, lesson, topic, level, quiz_type):

    print("\n🚀 [DEBUG] Quiz Generation Started")
    print(f"📌 Topic: {topic}")
    print(f"📊 Level: {level}")
    print(f"🧠 Type: {quiz_type}")

    llm = get_llm()
    retriever = get_retriever()

    # STEP 1: Retrieve context
    docs = retriever.invoke(topic)
    context = "\n".join([doc.page_content for doc in docs])

    print("\n📚 Retrieved Docs:", len(docs))

    # STEP 2: Define difficulty instruction
    if quiz_type == "pre":
        instruction = """
You are creating a PRE-LEARNING diagnostic quiz.
Focus on basic understanding and conceptual awareness.
"""
    else:
        instruction = """
You are creating a POST-LEARNING evaluation quiz.
Focus on application-based and slightly harder conceptual questions.
"""

    # STEP 3: Prompt
    prompt = PromptTemplate(
    input_variables=["subject", "lesson", "topic", "level", "quiz_type", "context"],
    template="""
You are an expert {subject} teacher.

Lesson: {lesson}
Topic: {topic}
Student Level: {level}
Quiz Type: {quiz_type}

Context:
{context}

INSTRUCTIONS:

If quiz_type = "pre":
- Generate basic questions to assess prior knowledge
- Keep difficulty EASY

If quiz_type = "post":
- Generate conceptual and application-based questions
- Match difficulty with {level}

Return ONLY valid JSON:

{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }}
  ]
}}

Rules:
- Exactly 3 questions
- 4 options each
- No explanations
"""
)

    chain = prompt | llm

    # STEP 4: LLM Call
    response = chain.invoke({
    "subject": subject,
    "lesson": lesson,
    "topic": topic,
    "level": level,
    "quiz_type": quiz_type,   # ✅ ADD THIS
    "context": context,
    "instruction": instruction
})

    print("\n🤖 RAW RESPONSE:\n", response.content)

    # STEP 5: Parse JSON
    result = extract_json(response.content)

    if "questions" not in result:
        print("⚠️ Invalid quiz format, returning empty quiz")
        return {"questions": []}

    print("✅ Quiz generated successfully")
    return result


# =========================
# EVALUATION LOGIC
# =========================
def evaluate_answers(student_answers, correct_answers):

    score = 0
    total = len(correct_answers)

    for s, c in zip(student_answers, correct_answers):
        if s == c:
            score += 1

    percentage = (score / total) * 10  # scale 10

    # LEVEL DECISION
    if percentage >= 8:
        level = "Advanced"
    elif percentage >= 5:
        level = "Intermediate"
    else:
        level = "Beginner"

    return {
        "score": percentage,
        "level": level
    }