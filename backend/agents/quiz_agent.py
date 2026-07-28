import json
import os
import re
import random
import requests
from services.retriever import get_relevant_context


# Sinhala Unicode block — used to tell genuine Sinhala content apart from
# the fine-tuned model occasionally code-switching into English mid-answer.
_SINHALA_CHAR = re.compile(r'[඀-෿]')
_LATIN_CHAR = re.compile(r'[A-Za-z]')
_ENGLISH_CONTAMINATION_THRESHOLD = 0.15


def _is_english_contaminated(question):
    """True if a question/options/answer blob has enough Latin-alphabet
    content to indicate the model code-switched into English rather than
    staying in Sinhala. Quiz content here is expected to be entirely
    Sinhala, so any real English is a model defect, not a legitimate
    loanword (Sinhala loanwords are written in Sinhala script)."""
    parts = [question.get("question", "")]
    parts.extend(question.get("options") or [])
    parts.append(question.get("answer", ""))
    combined = " ".join(p for p in parts if isinstance(p, str))

    sinhala_count = len(_SINHALA_CHAR.findall(combined))
    latin_count = len(_LATIN_CHAR.findall(combined))
    total = sinhala_count + latin_count
    if total == 0:
        return False
    return (latin_count / total) > _ENGLISH_CONTAMINATION_THRESHOLD


def normalize_quiz_questions(result):
    questions = result.get("questions")
    if not isinstance(questions, list):
        return result

    clean_questions = []
    for question in questions:
        if not isinstance(question, dict):
            continue

        options = question.get("options")
        answer = question.get("answer")
        if not isinstance(options, list) or not answer:
            continue

        if _is_english_contaminated(question):
            print(f"[WARNING] Dropping English-contaminated question: {question.get('question', '')[:60]}")
            continue

        shuffled_options = [option for option in options if option]
        if answer not in shuffled_options:
            shuffled_options.insert(0, answer)

        random.shuffle(shuffled_options)
        question["options"] = shuffled_options
        clean_questions.append(question)

    result["questions"] = clean_questions
    return result


# A "value" in the model's near-JSON output is either a properly quoted
# string or, failing that, bare text up to the next comma/brace/bracket.
# The quoted alternatives also accept a stray "]"/"}" as a terminator
# (in addition to the matching quote) because the model sometimes drops
# the closing quote and writes a bracket instead — without this, a single
# missing quote shifts every subsequent quote-pairing in the blob and
# produces garbage fragments (e.g. a lone ",") as bogus values.
_VALUE = r'(?:"([^"\]}]*)["\]}]|\'([^\'\]}]*)[\'\]}]|([^,}\]]*))'

# Same reasoning applied to individual option items inside an options list.
_OPTION_ITEM = re.compile(r'"([^"\]]*)["\]]|\'([^\'\]]*)[\'\]]')


def _first_group(match, *indices):
    for i in indices:
        if match.group(i) is not None and match.group(i).strip():
            return match.group(i).strip().strip('"\'').strip()
    return ""


def _has_word_char(text):
    return bool(re.search(r'\w', text, re.UNICODE))


def _extract_questions_loose(text):
    """Best-effort extraction of question/options/answer triples from
    near-JSON model output that fails strict json.loads — the fine-tuned
    model frequently produces unquoted keys, single quotes, mismatched or
    extra list nesting, dropped closing quotes, or a misplaced "answer" key.
    Rather than requiring the whole blob to be valid JSON, this scans for
    recognizable question/options/answer triples wherever they appear.
    """
    questions = []
    pattern = re.compile(
        r'["\']?question["\']?\s*:\s*' + _VALUE + r'\s*,\s*'
        r'["\']?options["\']?\s*:\s*\[(.*?)\]\s*,\s*'
        r'["\']?answer["\']?\s*:\s*' + _VALUE,
        re.DOTALL,
    )
    for m in pattern.finditer(text):
        q_text = _first_group(m, 1, 2, 3)
        raw_options = m.group(4)
        answer = _first_group(m, 5, 6, 7)

        # options may be quoted ("a", 'b') or bare (a, b) — split accordingly
        opt_matches = _OPTION_ITEM.findall(raw_options)
        if opt_matches:
            opts = [(a or b).strip() for a, b in opt_matches]
        else:
            opts = [o.strip() for o in raw_options.split(",")]
        # drop empty fragments and pure-punctuation noise (e.g. a lone ",")
        opts = [o for o in opts if o and _has_word_char(o)]
        opts = [o for o in opts if o != "answer" and o != answer]

        if answer and answer not in opts:
            opts.insert(0, answer)

        if q_text and answer and _has_word_char(answer) and len(opts) >= 2:
            questions.append({
                "question": q_text,
                "options": opts[:4],
                "answer": answer,
            })
    return questions


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

    print("Standard JSON failed. Attempting loose extraction...")
    loose_questions = _extract_questions_loose(cleaned_text)
    if loose_questions:
        return normalize_quiz_questions({"questions": loose_questions})

    print("Loose extraction failed. Attempting to parse text format...")
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

    URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")

    # ✅ Fetch vector DB context
    context = get_relevant_context(subject, lesson, topic, k=6, use_vector_ranking=True)

    # Fallback if context is empty
    if not context or context.strip() == "":
        print("[WARNING] Empty context from vector DB — using fallback")
        context = "No context available."
    else:
        # Truncate to avoid overloading the model (keep shorter to prevent CUDA OOM)
        context = context[:1500]

    print(f"[DEBUG] Context length sent to model: {len(context)} chars")
    print(f"[DEBUG] Context preview: {context[:150]}")

    # STEP 1: Set instruction based on quiz type
    # Explicitly forbids English — the fine-tuned model occasionally
    # code-switches mid-answer without this reminder.
    language_rule = "ප්‍රශ්නය, විකල්ප සහ පිළිතුර සම්පූර්ණයෙන්ම සිංහල භාෂාවෙන් පමණක් ලියන්න. ඉංග්‍රීසි වචන හෝ අකුරු කිසිසේත් භාවිත නොකරන්න."
    if quiz_type == "pre":
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. පහත context ඇසුරින් ප්‍රශ්නාවලියක් සකසන්න. {language_rule}"
    else:
        instruction = f"ඔබ {subject} පිළිබඳ ප්‍රවීණ ගුරුවරයෙකි. සිසුවාගේ {level} මට්ටම අනුව ප්‍රශ්නාවලියක් සකසන්න. {language_rule}"

    # STEP 2: Build input prompt with context
    input_text = f"""Context:
{context}

පාඩම: {lesson}
මාතෘකාව: {topic}

JSON ආකෘතියට ප්‍රශ්න 10ක් සකසන්න. සෑම ප්‍රශ්නයකටම පිළිතුරු 4ක් සහ නිවැරදි පිළිතුරක් තිබිය යුතුය.
සම්පූර්ණයෙන්ම සිංහල භාෂාවෙන් පමණක් ලියන්න — ඉංග්‍රීසි වචනයක්වත් භාවිත නොකරන්න.

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

    # STEP 3: Call your pre-trained model with up to 3 retries
    payload = {
        "instruction": instruction,
        "input": input_text,
        "max_new_tokens": 2000,
    }

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        print(f"\n[DEBUG] Quiz generation attempt {attempt}/{max_retries}...")
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
                print(f"Model response was not valid JSON (Attempt {attempt}): {parse_error}")
                if attempt == max_retries:
                    return {
                        "questions": [],
                        "error": "Model response was not valid JSON."
                    }
                continue

            raw_content = response_json.get("answer", "") or response_json.get("response", "")
            print(f"\nRAW RESPONSE (Attempt {attempt}):\n", raw_content)

            result = extract_json(raw_content)

            if not result.get("questions"):
                print(f"Invalid quiz format on attempt {attempt}.")
                if attempt == max_retries:
                    return {
                        "questions": [],
                        "error": result.get("error", "Quiz generator returned no questions.")
                    }
                continue

            print("Quiz generated successfully", result)
            return result

        except Exception as e:
            print(f"Error calling model on attempt {attempt}: {e}")
            if attempt == max_retries:
                return {"questions": [], "error": f"Error calling model: {e}"}
            continue



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