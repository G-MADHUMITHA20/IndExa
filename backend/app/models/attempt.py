from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AttemptStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    EXPIRED = "expired"


class AnswerRecord(BaseModel):
    """Internal MongoDB answer record representation."""
    attempt_id: str
    question_id: str
    student_id: str
    draft_response: str = ""
    confirmed_response: Optional[str] = None
    is_confirmed: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExamAttemptModel(BaseModel):
    """Internal MongoDB exam attempt representation."""
    id: Optional[str] = None
    exam_id: str
    student_id: str
    student_name: str = ""
    student_email: str = ""
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_minutes: int
    deadline: datetime
    submitted_at: Optional[datetime] = None
    status: AttemptStatus = AttemptStatus.IN_PROGRESS
    answers: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "ExamAttemptModel":
        if not data:
            return None
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        if "exam_id" in doc and not isinstance(doc["exam_id"], str):
            doc["exam_id"] = str(doc["exam_id"])
        if "student_id" in doc and not isinstance(doc["student_id"], str):
            doc["student_id"] = str(doc["student_id"])
        return cls(**doc)
