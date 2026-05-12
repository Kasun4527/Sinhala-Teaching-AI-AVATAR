import csv
import sys
from pathlib import Path
from pymongo import MongoClient


CSV_PATH = Path(__file__).resolve().parent / "data" / "question_bank.csv"

def seed():
    # Connect to MongoDB
    client = MongoClient("mongodb://localhost:27017")
    db = client["ai_avatar"]
    topics_collection = db["topics"]
    questions_collection = db["questions"]

    # CSV path
    csv_path = CSV_PATH
    
    if not csv_path.exists():
        print(f"Error: {csv_path} not found")
        sys.exit(1)

    inserted_questions = 0
    kcs_found = set()

    with open(csv_path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            q_id = row["question_id"].strip()
            kc_id = row["kc_id"].strip()
            q_text = row["question_text"].strip()
            opt_a = row["option_a"].strip()
            opt_b = row["option_b"].strip()
            opt_c = row["option_c"].strip()
            opt_d = row["option_d"].strip()
            correct = row["correct_answer"].strip().upper()
            difficulty = row.get("difficulty", "medium").strip()

            kcs_found.add(kc_id)

            if correct not in ("A", "B", "C", "D"):
                continue

            # Update or insert question
            questions_collection.update_one(
                {"question_id": q_id},
                {"$set": {
                    "kc_id": kc_id,
                    "question_text": q_text,
                    "option_a": opt_a,
                    "option_b": opt_b,
                    "option_c": opt_c,
                    "option_d": opt_d,
                    "correct_answer": correct,
                    "difficulty": difficulty,
                    "subject": "Buddhism"
                }},
                upsert=True
            )
            inserted_questions += 1

    inserted_kcs = 0
    for kc in kcs_found:
        topics_collection.update_one(
            {"kc_id": kc},
            {"$set": {
                "subject": "Buddhism",
                "kc_id": kc,
                "lesson": kc.split('_')[1] if '_' in kc else "general",
                "topic": f"Topic for {kc}"
            }},
            upsert=True
        )
        inserted_kcs += 1

    print(f"Seed complete - Inserted/Updated {inserted_questions} questions and {inserted_kcs} topics/KCs.")

if __name__ == "__main__":
    seed()
