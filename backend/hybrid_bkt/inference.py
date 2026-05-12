import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
from typing import List, Tuple, Optional, Dict
import logging

from .lstm_model import HybridBKTLSTM
from .pc_bkt_engine import pc_bkt_engine
from .utils import serialize_tensor, deserialize_tensor
from db import lstm_states_collection, pc_bkt_states_collection
import os

logger = logging.getLogger(__name__)

# Reusing the model structure from lstm_model.py
model = HybridBKTLSTM()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

ensemble_alpha = 0.65
seq_length = 10
problem_difficulties = {}

class HybridSequenceDataset(Dataset):
    def __init__(self, sequences: List[Tuple[np.ndarray, float]]):
        self.sequences = sequences
    def __len__(self): return len(self.sequences)
    def __getitem__(self, idx):
        seq, target = self.sequences[idx]
        return torch.FloatTensor(seq), torch.FloatTensor([target])

def get_lstm_state_from_db(student_id):
    doc = lstm_states_collection.find_one({"student_id": student_id})
    if doc and "hidden_state" in doc and "cell_state" in doc:
        return doc["hidden_state"], doc["cell_state"]
    return None, None

def save_lstm_state_to_db(student_id, h_data, c_data):
    lstm_states_collection.update_one(
        {"student_id": student_id},
        {"$set": {"hidden_state": h_data, "cell_state": c_data}},
        upsert=True
    )

def _compute_problem_difficulty(df: pd.DataFrame):
    global problem_difficulties
    problem_difficulties = {}
    q_col = 'question_id' if 'question_id' in df.columns else 'kc_id'
    for q_id, group in df.groupby(q_col):
        n = len(group)
        if n >= 4:
            avg = group['correct'].mean()
            level = int(avg * 10) % 10
        else:
            level = 5
        problem_difficulties[str(q_id)] = level

def _build_feature_vector(student_id: str, kc_id: str, correct: float, attempt_ratio: float = 0.0) -> np.ndarray:
    num_kcs = len(pc_bkt_engine.kc_ids)
    if num_kcs == 0:
        mastery_vec = np.zeros(1)
    else:
        mastery_vec = np.zeros(num_kcs)
        for i, kc in enumerate(pc_bkt_engine.kc_ids):
            mastery_vec[i] = pc_bkt_engine._get_p_know(student_id, kc)
            
    cluster_vec = np.zeros(pc_bkt_engine.n_clusters + 1)
    cluster_id = pc_bkt_engine.student_clusters.get(student_id, 0)
    cluster_vec[min(cluster_id, pc_bkt_engine.n_clusters)] = 1.0
    
    diff_vec = np.zeros(10)
    diff_level = problem_difficulties.get(kc_id, 5)
    diff_vec[min(diff_level, 9)] = 1.0
    
    extras = np.array([correct, attempt_ratio])
    return np.concatenate([mastery_vec, cluster_vec, diff_vec, extras])

def _prepare_training_sequences(df: pd.DataFrame) -> List[Tuple[np.ndarray, float]]:
    sequences = []
    sorted_df = df.sort_values('response_time')
    for student_id, student_df in sorted_df.groupby('student_id'):
        rows = student_df.to_dict('records')
        if len(rows) < 3: continue
        history = []
        total_attempts = len(rows)
        for i, row in enumerate(rows):
            kc_id = row['kc_id']
            correct = float(row['correct'])
            attempt_ratio = (i + 1) / total_attempts
            feat = _build_feature_vector(student_id, kc_id, correct, attempt_ratio)
            history.append(feat)
            pc_bkt_engine.update_after_response(student_id, kc_id, bool(row['correct']))
            if i + 1 < len(rows) and len(history) >= 2:
                seq = np.array(history[-seq_length:])
                if len(seq) < seq_length:
                    padding = np.zeros((seq_length - len(seq), seq.shape[1]))
                    seq = np.vstack([padding, seq])
                target = float(rows[i + 1]['correct'])
                sequences.append((seq, target))
    return sequences

def train_hybrid_model(interactions_df: pd.DataFrame, epochs: int = 30):
    logger.info("Starting Hybrid-BKT training pipeline...")
    
    if len(interactions_df) == 0:
        logger.warning("No interactions provided for training.")
        return {"status": "error", "message": "No interactions provided"}

    logger.info("Training PC-BKT backbone...")
    pc_bkt_engine.fit(interactions_df)

    logger.info("Computing problem difficulty levels...")
    _compute_problem_difficulty(interactions_df)

    logger.info("Preparing LSTM sequences with PC-BKT features...")
    # Reset PC-BKT mastery for a clean forward pass
    pc_bkt_engine.p_know = {}
    pc_bkt_engine._init_personalized_priors(interactions_df)
    sequences = _prepare_training_sequences(interactions_df)

    if not sequences:
        logger.warning("No sequences generated; LSTM not trained.")
        return {"status": "success", "message": "PC-BKT trained, but no sequences for LSTM"}

    input_size = sequences[0][0].shape[1]
    
    global model
    model = HybridBKTLSTM(input_dim=input_size, hidden_dim=128, num_layers=2, dropout=0.3).to(device)

    dataset = HybridSequenceDataset(sequences)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
    criterion = nn.BCELoss()

    model.train()
    for epoch in range(epochs):
        total_loss = 0.0
        n_batches = 0
        for seq_batch, target_batch in dataloader:
            seq_batch = seq_batch.to(device)
            target_batch = target_batch.to(device)
            optimizer.zero_grad()
            output, _ = model(seq_batch)
            loss = criterion(output, target_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

    # Save globally
    torch.save(model.state_dict(), "hybrid_lstm_weights.pth")
    return {"status": "success", "message": "Hybrid BKT successfully trained"}

def predict_next_response(student_id, skill_id, difficulty=5.0):
    p_pcbkt = pc_bkt_engine.predict_single(student_id, skill_id)
    p_lstm = p_pcbkt

    if os.path.exists("hybrid_lstm_weights.pth"):
        try:
            # We would need sequence history to do a proper LSTM inference here.
            # For online fallback without full history, we can approximate or use a simple vector
            # In a full production env, we'd fetch the last N interactions for this student.
            # We'll just return PC-BKT for the online prediction if we don't have full history implemented.
            pass
        except Exception:
            pass

    final_p = ensemble_alpha * p_pcbkt + (1 - ensemble_alpha) * p_lstm
    return float(np.clip(final_p, 0.01, 0.99))

def get_hybrid_mastery(student_id: str):
    return pc_bkt_engine.get_student_state(student_id)

def update_student_hybrid_state(student_id, skill_id, is_correct, difficulty=5.0):
    p_L_new = pc_bkt_engine.update_after_response(student_id, skill_id, is_correct)
    logger.info(f"🧠 [BKT Update] Student: {student_id} | Skill: {skill_id} | Correct: {is_correct} | New P(Know): {p_L_new:.4f}")
    print(f"🧠 [BKT Update] Student: {student_id} | Skill: {skill_id} | Correct: {is_correct} | New P(Know): {p_L_new:.4f}")
    return p_L_new
