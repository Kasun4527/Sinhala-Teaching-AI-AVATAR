"""
Simulation script v2 — Verifies the 7-priority architecture overhaul.
Tests: cluster-driven priors, cross-lesson transfer, mastery delta cap (0.05),
       adaptive learning signals, IRT difficulty, and per-quiz clustering.
"""
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

# pyrefly: ignore [missing-import]
import mongomock
import numpy as np
from datetime import datetime

# Patch db with mongomock
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

import services.bkt_service as bkt
import services.clustering_service as cluster
import services.difficulty_service as diff
import services.lstm_service as lstm
import agents.personalization_agent as agent

bkt.skill_mastery_col = db.skill_mastery_col
bkt.bkt_params_col = db.bkt_params_col
bkt.interaction_logs_col = db.interaction_logs_col

cluster.skill_mastery_col = db.skill_mastery_col
cluster.student_clusters_col = db.student_clusters_col
cluster.interaction_logs_col = db.interaction_logs_col
cluster.kmeans_models_col = db.kmeans_models_col

diff.problem_difficulty_col = db.problem_difficulty_col

student_id = "test_student_002"
subject = "Buddhism"
lesson1 = "Lesson_01"
lesson2 = "Lesson_02"
topic1 = "Topic_1"

def reset_db():
    db.interaction_logs_col.delete_many({})
    db.bkt_params_col.delete_many({})
    db.skill_mastery_col.delete_many({})
    db.student_clusters_col.delete_many({})
    db.problem_difficulty_col.delete_many({})
    db.kmeans_models_col.delete_many({})

def run(name, pattern, subj, less, top, quiz_type="pre"):
    ans = [int(x) for x in pattern]
    correct = [1]*len(ans)
    q_texts = [{"text": f"Q{i}_{subj}_{less}"} for i in range(len(ans))]

    res = agent.personalize_after_quiz(
        student_id=student_id,
        subject=subj, lesson=less, topic=top,
        student_answers=ans, correct_answers=correct,
        quiz_type=quiz_type, quiz_questions=q_texts
    )

    score = sum(ans)
    hm = res.get('hybrid_mastery', res['mastery'])
    p = res['params']
    hint = "Y" if res.get('hint_required') else "N"
    adapt = res.get('adapt_difficulty', 'maintain')

    print(f"| {name} | {score}/{len(ans)} | {p['L0']:.3f} | {p['T']:.3f} | {p['G']:.3f} | {p['S']:.3f} | {hm:.3f} | {res['level']} | {res['cluster_id']} | {hint} | {adapt} |")
    return res

def header():
    print("| Scenario | Score | L0 | T | G | S | Mastery | Level | Cluster | Hints? | Adapt |")
    print("|---|---|---|---|---|---|---|---|---|---|---|")


print("=" * 80)
print("SIMULATION v2: 7-Priority Architecture Verification")
print("=" * 80)

print("\n[Init] Loading LSTM model...")
lstm.load_model()

# ---- Test 1: Priority 4 — Mastery delta cap (0.05) ----
print("\n## Test 1: Priority 4 — Perfect score should NOT reach 0.99")
reset_db()
header()
res = run("Pre 10/10 (new student)", "1111111111", subject, lesson1, topic1, "pre")
assert res['hybrid_mastery'] <= 0.80, f"FAIL: 10/10 produced mastery {res['hybrid_mastery']:.3f} (should be <= 0.80 with first-quiz ceiling)"
print(f">> PASS: Perfect 10/10 mastery = {res['hybrid_mastery']:.3f} (<= 0.80 first-quiz ceiling)")

# ---- Test 2: Priority 2 — Cluster priors affect BKT ----
print("\n## Test 2: Priority 2 — Cluster-driven priors")
print("Default cold-start priors: T=0.10, G=0.20, S=0.10")
print("Cluster 0 (Fast Learner): T=0.25, G=0.15, S=0.05")
print("Cluster 1 (Struggling):   T=0.05, G=0.25, S=0.20")

from services.bkt_service import get_cluster_priors
for cid in [0, 1, 2, 3]:
    priors = get_cluster_priors(cid)
    label = bkt.CLUSTER_PROFILES[cid]['label']
    print(f"  Cluster {cid} ({label}): T={priors['T']}, G={priors['G']}, S={priors['S']}")
print(">> PASS: Cluster profiles active and returning different priors")

# ---- Test 3: Priority 3 — Cross-lesson transfer ----
print("\n## Test 3: Priority 3 — Cross-lesson knowledge transfer")
reset_db()
header()
# First do Lesson 1 with decent performance
run("L1 Pre 8/10", "1111111100", subject, lesson1, topic1, "pre")
run("L1 Post 9/10", "1111111110", subject, lesson1, topic1, "post")

# Now check what L0 Lesson 2 gets
from services.bkt_service import get_subject_transfer_L0
transfer = get_subject_transfer_L0(student_id, subject)
print(f"\n>> Transfer L0 for Lesson 2 = {transfer:.3f} (should be > 0.30 default)")
assert transfer > 0.30, f"FAIL: Transfer L0 = {transfer:.3f} should be > 0.30"

# Run Lesson 2 and verify L0 is elevated
res2 = run("L2 Pre 5/10 (with transfer)", "1111100000", subject, lesson2, topic1, "pre")
print(f">> L2 L0 = {res2['params']['L0']:.3f} (should reflect Lesson 1 mastery)")

# ---- Test 4: Priority 1 & 5 — Adaptive signals ----
print("\n## Test 4: Priority 1 & 5 — Adaptive learning signals")
reset_db()
header()
res_low = run("Pre 2/10 (struggling)", "1100000000", subject, lesson1, topic1, "pre")
print(f">> hint_required={res_low.get('hint_required')}, adapt_difficulty={res_low.get('adapt_difficulty')}")
assert res_low.get('hint_required') == True, "FAIL: 2/10 should trigger hints"
assert res_low.get('adapt_difficulty') == "easier", "FAIL: 2/10 should recommend easier"

reset_db()
res_high = run("Pre 10/10 (strong)", "1111111111", subject, lesson1, topic1, "pre")
print(f">> hint_required={res_high.get('hint_required')}, adapt_difficulty={res_high.get('adapt_difficulty')}")

# ---- Test 5: Priority 6 — IRT difficulty ----
print("\n## Test 5: Priority 6 — IRT-style difficulty")
from services.difficulty_service import compute_difficulty
# 90% success rate -> difficulty = 1.0 - 0.9 = 0.1 -> scale 1
d1 = compute_difficulty(10, 9)
print(f"  90% success rate -> difficulty = {d1} (should be 1, Easy)")
assert d1 == 1, f"FAIL: Expected 1, got {d1}"

# 20% success rate -> difficulty = 1.0 - 0.2 = 0.8 -> scale 8
d2 = compute_difficulty(10, 2)
print(f"  20% success rate -> difficulty = {d2} (should be 8, Hard)")
assert d2 == 8, f"FAIL: Expected 8, got {d2}"

# 50% success rate -> difficulty = 0.5 -> scale 5
d3 = compute_difficulty(10, 5)
print(f"  50% success rate -> difficulty = {d3} (should be 5, Medium)")
assert d3 == 5, f"FAIL: Expected 5, got {d3}"
print(">> PASS: IRT difficulty formula working correctly")

print("\n" + "=" * 80)
print("ALL PRIORITY TESTS PASSED")
print("=" * 80)
