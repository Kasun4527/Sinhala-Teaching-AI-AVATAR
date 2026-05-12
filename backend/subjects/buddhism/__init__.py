"""
Buddhism Subject Card
Wraps the existing Hybrid BKT (PC-BKT + LSTM) implementation into a clean interface.
"""
from .models.hybrid.service import hybrid_bkt_service

class BuddhismSubjectCard:
    def __init__(self):
        self.service = hybrid_bkt_service
        self.subject_name = "Buddhism"

    def train(self, n_clusters: int = 4, epochs: int = 30):
        return self.service.train(n_clusters, epochs)

    def predict(self, student_id: str, kc_id: str):
        return self.service.predict(student_id, kc_id)

    def update(self, student_id: str, kc_id: str, correct: bool):
        return self.service.update(student_id, kc_id, correct)

    def get_status(self):
        model = self.service.model
        if model and model.is_fitted:
            return {
                "status": "ready",
                "subject": self.subject_name,
                "n_students": len(model.pc_bkt.student_ids),
                "n_skills": len(model.pc_bkt.kc_ids),
                "n_clusters": model.n_clusters,
                "has_lstm": model.lstm is not None,
            }
        return {"status": "not_trained", "subject": self.subject_name}

buddhism_card = BuddhismSubjectCard()
