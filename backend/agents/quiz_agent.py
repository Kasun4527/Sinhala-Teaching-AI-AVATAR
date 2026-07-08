import json
import re
import random
import json
import re
import random
import requests
from services.retriever import get_relevant_context
from services.llm import get_llm
from langchain_core.messages import HumanMessage, SystemMessage


def normalize_quiz_questions(result):
    questions = result.get("questions")
    if not isinstance(questions, list):
        return result

    for question in questions:
        if not isinstance(question, dict):
            continue

        options = question.get("options")
        answer = question.get("answer")
        if not isinstance(options, list) or not answer:
            continue

        shuffled_options = [option for option in options if option]
        if answer not in shuffled_options:
            shuffled_options.insert(0, answer)

        random.shuffle(shuffled_options)
        question["options"] = shuffled_options

    return result


def extract_json(text):
    """Safely extract quiz JSON even if the model adds extra text or truncates."""
    if not text:
        return {"questions": [], "error": "Empty quiz response from model."}

    cleaned_text = text.replace("```json", "").replace("```", "").strip()

    candidates = [cleaned_text]

    # Try the outermost JSON object
    match = re.search(r"\{.*\}", cleaned_text, re.DOTALL)
    if match:
        candidates.insert(0, match.group())

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict) and isinstance(parsed.get("questions"), list):
                return normalize_quiz_questions(parsed)
        except Exception:
            continue

    print("Standard JSON failed. Attempting to parse text format...")
    questions = []

    blocks = re.split(r"\n\s*\n", cleaned_text)
    for block in blocks:
        try:
            lines = [line.strip() for line in block.split("\n") if line.strip()]
            if not lines:
                continue

            first_line = lines[0]
            if not first_line.startswith(("ප්‍රශ්නය", "ප්‍රශ්න", "Question")):
                continue

            q_text = first_line.split(":", 1)[-1].strip().rstrip(".")
            correct = ""
            options = []

            for line in lines[1:]:
                if line.startswith(("නිවැරදි පිළිතුර", "Correct Answer")):
                    correct = line.split(":", 1)[-1].strip().rstrip(".")
                    if correct and correct not in options:
                        options.insert(0, correct)
                    continue

                if line.startswith(("වැරදි පිළිතුරු", "Wrong Answers", "Incorrect Answers")):
                    wrong_text = line.split(":", 1)[-1].strip()
                    pieces = re.split(r"\d+\)\s*", wrong_text)
                    for piece in pieces:
                        candidate = piece.strip().rstrip(".")
                        if candidate and candidate not in options:
                            options.append(candidate)
                    continue

                if re.match(r"^\d+\)", line):
                    candidate = re.sub(r"^\d+\)\s*", "", line).strip().rstrip(".")
                    if candidate and candidate not in options:
                        options.append(candidate)

            if q_text and correct and len(options) >= 4:
                questions.append({
                    "question": q_text,
                    "options": options[:4],
                    "answer": correct,
                })
        except Exception:
            continue

    if questions:
        return normalize_quiz_questions({"questions": questions})

    return {
        "questions": [],
        "error": "Quiz generator returned no parseable questions."
    }


# =========================
# QUIZ GENERATOR (PRE / POST)
# =========================
def generate_quiz(subject, lesson, topic, level, quiz_type):
    print("\n[DEBUG] Quiz Generation Started")

    # ✅ Fetch vector DB context
    context = get_relevant_context(subject, lesson, topic, k=6, use_vector_ranking=True)

    # Fallback if context is empty
    if not context or context.strip() == "":
        print("[WARNING] Empty context from vector DB — using fallback")
        context = "No context available."
    else:
        # Truncate to avoid overloading the model
        context = context[:1500]

    print(f"[DEBUG] Context length sent to model: {len(context)} chars")

    # STEP 1: Set instruction based on quiz type
    if quiz_type == "pre":
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. පහත context ඇසුරින් ප්‍රශ්නාවලියක් සකසන්න."
    else:
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. සිසුවාගේ {level} මට්ටම අනුව ප්‍රශ්නාවලියක් සකසන්න."

    # STEP 2: Build input prompt with context
    input_text = f"""Context:
{context}

පාඩම: {lesson}
මාතෘකාව: {topic}

JSON ආකෘතියට ප්‍රශ්න 5ක් සකසන්න. සෑම ප්‍රශ්නයකටම පිළිතුරු 4ක් සහ නිවැරදි පිළිතුරක් තිබිය යුතුය.

Format:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "correct option text"
    }}
  ]
}}"""

    try:
        llm = get_llm()
        messages = [
            SystemMessage(content=instruction),
            HumanMessage(content=input_text)
        ]
        
        response = llm.invoke(messages)
        raw_content = response.content.strip()
        print(f"\nRAW RESPONSE:\n", raw_content)

        result = extract_json(raw_content)

        if not result.get("questions"):
            print(f"Invalid quiz format.")
            return {
                "questions": [],
                "error": result.get("error", "Quiz generator returned no questions.")
            }

        print("Quiz generated successfully", result)
        return result

    except Exception as e:
        print(f"Error calling model: {e}")
        return {"questions": [], "error": f"Error calling model: {e}"}



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