from pydantic import BaseModel
from bson import ObjectId
from typing import List

class TopicModel(BaseModel):
    subject: str
    lesson: str
    topics: List[str] = []

    class Config:
        json_encoders = {ObjectId: str}