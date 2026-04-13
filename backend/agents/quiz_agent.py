import json
import re
from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from knowledge_base.retriever import get_retriever


def extract_json(text):
    """
    Safely extract JSON even if LLM adds extra text
    """
    try:
        # remove markdown code blocks if exist
        text = text.replace("```json", "").replace("```", "").strip()

        # extract first JSON block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())

        return json.loads(text)

    except Exception as e:
        print("JSON parsing failed:", e)
        return {
            "questions": []
        }


def generate_quiz(topic, level):

    print("\n🚀 [DEBUG] generate_quiz STARTED")
    print(f"📌 Topic: {topic}")
    print(f"📊 Level: {level}")

    llm = get_llm()
    retriever = get_retriever()

    # STEP 1: TEST RETRIEVER
    docs = retriever.invoke(topic)

    print("\n📚 [DEBUG] Retrieved Docs Count:", len(docs))

    context = "\n".join([doc.page_content for doc in docs])

    print("\n🧾 [DEBUG] Context Preview:\n", context[:1000])  # first 1000 chars only

    # STEP 2: PROMPT
    prompt = PromptTemplate(
        input_variables=["topic", "level", "context"],
        template="""
You are an expert teacher AI.

Context:
{context}

Create 3 MCQs for "{topic}" (Level: {level})

STRICT OUTPUT RULE:
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
- exactly 3 questions
- 4 options each
- answer must be A/B/C/D
- NO explanations
- NO extra text
"""
    )

    chain = prompt | llm

    print("\n🤖 [DEBUG] Calling LLM...")

    response = chain.invoke({
        "topic": topic,
        "level": level,
        "context": context
    })

    # STEP 3: RAW OUTPUT
    print("\n📩 [DEBUG] RAW LLM RESPONSE:\n")
    print(response.content)

    # STEP 4: PARSED OUTPUT
    try:
        result = extract_json(response.content)
        print("\n✅ [DEBUG] Parsed JSON SUCCESS")
        return result

    except Exception as e:
        print("\n❌ [DEBUG] JSON PARSING FAILED:", str(e))
        return response.content

def evaluate_answers(student_answers, correct_answers):

    score = 0
    total = len(correct_answers)

    for s, c in zip(student_answers, correct_answers):
        if s == c:
            score += 1

    percentage = (score / total) * 10

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