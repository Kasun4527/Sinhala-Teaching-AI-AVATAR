from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional, List
from datetime import datetime


class PracticeQuizQuestionRecord(BaseModel):
    question: str
    options: List[str]
    answer: str


class PracticeQuizResultModel(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    level: Optional[str] = None
    quiz_questions: List[PracticeQuizQuestionRecord] = Field(default_factory=list)
    student_answers: List[str] = Field(default_factory=list)
    correct_answers: List[str] = Field(default_factory=list)
    score: float
    score_level: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
