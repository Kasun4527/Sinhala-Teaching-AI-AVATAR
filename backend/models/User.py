import re
from pydantic import BaseModel, EmailStr, field_validator

class User(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"
    is_verified: bool = False
    # Links a student to their teacher (an "admin"-role account). The value
    # a student enters is that teacher's own user id, shown on the teacher's
    # dashboard. Not persisted as-is — resolved to teacher_id at signup.
    teacher_code: str | None = None
    # Education level: "OL" (G.C.E. O/L) or "AL" (G.C.E. A/L).
    # None for legacy accounts — they can access both levels.
    education_level: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one special character")
        return v