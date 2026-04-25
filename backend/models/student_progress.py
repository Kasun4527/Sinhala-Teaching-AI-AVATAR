from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional
from datetime import datetime

class StudentProgressModel(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    level: Optional[str] = None          # Beginner / Intermediate / Advanced
    initial_quiz_marks: Optional[int] = None   # marks before lesson
    final_quiz_marks: Optional[int] = None     # marks after lesson
    lesson_delivered: bool = False
    topic_unlocked: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}