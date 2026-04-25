from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional
from datetime import datetime

class DeliveredContentModel(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    level: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}