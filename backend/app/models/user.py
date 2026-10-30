from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"


class UserModel(BaseModel):
    """Internal MongoDB user representation."""
    id: Optional[str] = None
    name: str
    email: str
    hashed_password: str
    role: UserRole = UserRole.STUDENT
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "UserModel":
        """Construct UserModel from MongoDB document, safely mapping _id to id."""
        if not data:
            return None
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)
