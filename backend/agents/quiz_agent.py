import json
import re
import random


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


# =========================
# JSON SAFE PARSER
# =========================
def extract_json(text):
    """Safely extract quiz JSON even if the model adds extra text."""
    if not text:
        return {"questions": [], "error": "Empty quiz response from model."}

    cleaned_text = text.replace("```json", "").replace("```", "").strip()

    candidates = [cleaned_text]

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
import requests

def generate_quiz(subject, lesson, topic, level, quiz_type):
    print("\n[DEBUG] Quiz Generation Started")
    
    # The URL for your pre-trained model tunnel
    URL = "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask"
    
    context = """"""
    # STEP 1: Set the Instruction based on quiz type
    if quiz_type == "pre":
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. කරුණාකර පහත මාතෘකාව ඇසුරින් ප්‍රශ්නාවලියක් සකසන්න."
    else:
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. කරුණාකර පහත මාතෘකාව ඇසුරින් පසු-අධ්‍යයන පරිගණන සඳහා ප්‍රශ්නාවලියක් සකසන්න."

    # STEP 2: Create the specific input prompt for the model
    # We ask for JSON format specifically in the prompt
    input_text = f"""
පාඩම: {lesson}
මාතෘකාව: {topic}

පහත දැක්වෙන JSON ආකෘතියට අනුව ප්‍රශ්න පහක් සකසන්න.
සෑම ප්‍රශ්නයකටම පිළිතුරු 4ක් සහ එක් නිවැරදි පිළිතුරක් තිබිය යුතුය.

Format:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "Option text here"
    }}
  ]
}}
"""

    # STEP 3: Call your pre-trained model
    payload = {
        "instruction": instruction,
        "input": input_text,
        "max_new_tokens": 1024,
    }

    try:
        response = requests.post(
            URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=120,
        )
        response.raise_for_status()

        try:
            response_json = response.json()
        except Exception as parse_error:
            print(f"Model response was not valid JSON: {parse_error}")
            return {
                "questions": [],
                "error": "Model response was not valid JSON."
            }

        raw_content = response_json.get("answer", "") or response_json.get("response", "")
        print("\nRAW RESPONSE:\n", raw_content)

        result = extract_json(raw_content)

        if not result.get("questions"):
            print("Invalid quiz format, returning empty quiz")
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