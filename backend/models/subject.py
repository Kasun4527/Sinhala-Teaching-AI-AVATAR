from pydantic import BaseModel, Field
from bson import ObjectId
from typing import List

class SubjectModel(BaseModel):
    name: str
    lessons: List[str] = []

    class Config:
        json_encoders = {ObjectId: str}
        