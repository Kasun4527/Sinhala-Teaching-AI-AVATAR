import sys
import os
sys.path.insert(0, os.path.abspath('.'))

# pyrefly: ignore [missing-import]
import mongomock
import numpy as np
from datetime import datetime

# Patch db collections with mongomock before importing services
import db
db.client = mongomock.MongoClient()
db.db = db.client['test_db']
db.users_collection = db.db['users']
db.enrollments_collection = db.db['enrollments']
db.student_progress_collection = db.db['student_progress']
db.skill_mastery_col = db.db['skill_mastery']
db.bkt_params_col = db.db['bkt_params']
db.interaction_logs_col = db.db['interaction_logs']
db.student_clusters_col = db.db['student_clusters']
db.kmeans_models_col = db.db['kmeans_models']
db.problem_difficulty_col = db.db['problem_difficulty']

# Re-assign collections in services
import services.bkt_service as bkt
import services.clustering_service as cluster
import services.difficulty_service as diff
import agents.personalization_agent as agent

bkt.skill_mastery_col = db.skill_mastery_col
bkt.bkt_params_col = db.bkt_params_col
bkt.interaction_logs_col = db.interaction_logs_col

cluster.skill_mastery_col = db.skill_mastery_col
cluster.student_clusters_col = db.student_clusters_col
cluster.interaction_logs_col = db.interaction_logs_col
cluster.kmeans_models_col = db.kmeans_models_col

diff.problem_difficulty_col = db.problem_difficulty_col

# Fake LSTM availability to always return None for simplicity, or we can mock it
import services.lstm_service as lstm
def mock_lstm_predict(*args, **kwargs):
    return 0.65  # Dummy LSTM prediction
lstm.predict_next_mastery = mock_lstm_predict
lstm.is_available = lambda: True

student_id = "test_student_001"
subject = "Buddhism"
lesson1 = "Lesson_01"
lesson2 = "Lesson_02"
topic1 = "Topic_1"
topic2 = "Topic_1"
math_subj = "Mathematics"
math_less = "Lesson_01"

def print_table_header():
    print("| Scenario | Pattern | Score | L0 | T | G | S | Mastery | Level | Cluster | LSTM | BKT Uncertain? | Notes |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")

def run_scenario(name, pattern, subj, less, top, quiz_type="pre"):
    skill_id = bkt.make_skill_id(subj, less, top)
    ans = [int(x) for x in pattern]
    correct = [1]*len(ans)
    
    # We will use process_quiz_session directly for BKT updates, 
    # but the prompt asks to trace everything, so let's call personalize_after_quiz
    q_texts = [{"text": f"Q{i}"} for i in range(len(ans))]
    
    res = agent.personalize_after_quiz(
        student_id=student_id,
        subject=subj,
        lesson=less,
        topic=top,
        student_answers=ans,
        correct_answers=correct,
        quiz_type=quiz_type,
        quiz_questions=q_texts
    )
    
    score = sum(ans)
    m = res['mastery']
    hm = res.get('hybrid_mastery', m)
    lvl = res['level']
    p = res['params']
    c_id = res['cluster_id']
    l_pred = res.get('lstm_prediction', 'N/A')
    unc = res.get('is_uncertain', 'N/A')
    notes = "Feedback Applied" if res.get('confidence_warning') else ""
    
    print(f"| {name} | {pattern} | {score}/{len(ans)} | {p['L0']:.3f} | {p['T']:.3f} | {p['G']:.3f} | {p['S']:.3f} | {hm:.3f} | {lvl} | {c_id} | {l_pred} | {unc} | {notes} |")
    
print("# Code-Based Simulation Results\n")

print("## 1. New Student Registration & Enrollment")
print("Initial DB state: Empty.")
print(f"BKT Defaults: L0={bkt.DEFAULT_L0}, T={bkt.DEFAULT_T}, G={bkt.DEFAULT_G}, S={bkt.DEFAULT_S}")
print(f"Initial Cluster (Cold-Start): {cluster.COLD_START_CLUSTER}\n")


print("## 2. Lesson 01 (Pre-Quiz) Scenarios")
patterns = {
    "0/10": "0000000000",
    "2/10": "1100000000",
    "5/10": "1111100000",
    "7/10": "1111111000",
    "8/10": "1111111100",
    "10/10": "1111111111",
    "Alternating": "1010101010",
    "Correct then Wrong": "1111100000",
    "Wrong then Correct": "0000011111"
}

for name, pat in patterns.items():
    # Reset DB for independent pre-quiz testing
    db.interaction_logs_col.delete_many({})
    db.bkt_params_col.delete_many({})
    db.skill_mastery_col.delete_many({})
    db.student_clusters_col.delete_many({})
    
    if name == "0/10": print_table_header()
    run_scenario(f"Pre {name}", pat, subject, lesson1, topic1, "pre")
print("\n")


print("## 3. Lesson 01 (Post-Quiz)")
# To test post-quiz realistically, we should chain it after a pre-quiz.
# Let's say pre-quiz was 5/10.
db.interaction_logs_col.delete_many({})
db.bkt_params_col.delete_many({})
db.skill_mastery_col.delete_many({})

print("Baseline: Pre-Quiz 5/10")
print_table_header()
run_scenario("Pre 5/10", "1111100000", subject, lesson1, topic1, "pre")

post_patterns = {
    "Post 5/10 (No Impr)": "1111100000",
    "Post 8/10 (Impr)": "1111111100",
    "Post 10/10 (Mastery)": "1111111111"
}

for name, pat in post_patterns.items():
    # We want to chain, so we delete ONLY the post-quiz logs. 
    # But for multiple scenarios, we'd need to save state. 
    # Let's just re-run pre 5/10 each time.
    db.interaction_logs_col.delete_many({})
    db.bkt_params_col.delete_many({})
    db.skill_mastery_col.delete_many({})
    
    agent.personalize_after_quiz(
        student_id=student_id, subject=subject, lesson=lesson1, topic=topic1,
        student_answers=[1,1,1,1,1,0,0,0,0,0], correct_answers=[1]*10, quiz_type="pre"
    )
    
    run_scenario(name, pat, subject, lesson1, topic1, "post")
print("\n")

print("## 4. Move to Lesson 02")
# Pre 5/10 -> Post 8/10 on Lesson 1
db.interaction_logs_col.delete_many({})
db.bkt_params_col.delete_many({})
db.skill_mastery_col.delete_many({})
agent.personalize_after_quiz(student_id, subject, lesson1, topic1, [1]*5+[0]*5, [1]*10, "pre")
agent.personalize_after_quiz(student_id, subject, lesson1, topic1, [1]*8+[0]*2, [1]*10, "post")

print_table_header()
run_scenario("L2 Pre 4/10", "1111000000", subject, lesson2, topic2, "pre")
run_scenario("L2 Post 9/10", "1111111110", subject, lesson2, topic2, "post")
print("\n")

print("## 5. Different Subject (Mathematics)")
print_table_header()
run_scenario("Math Pre 7/10", "1111111000", math_subj, math_less, topic1, "pre")
print("\n")

print("## 6. Returning Student")
print("Database retains records:")
logs = list(db.interaction_logs_col.find())
print(f"Total interaction logs across all subjects: {len(logs)}")
masteries = list(db.skill_mastery_col.find())
for m in masteries:
    print(f"  Skill: {m['skill_id']} -> Mastery: {m['mastery']:.3f} ({m['correct_attempts']}/{m['total_attempts']})")
print_table_header()
run_scenario("Math Post 10/10", "1111111111", math_subj, math_less, topic1, "post")

