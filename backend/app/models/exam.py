from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ExamStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    MATHEMATICAL = "mathematical"


class QuestionModel(BaseModel):
    """Internal MongoDB question representation."""
    id: Optional[str] = None
    exam_id: str
    teacher_id: str
    question_text: str
    question_type: QuestionType
    marks: float = 1.0
    order: int = 1
    is_required: bool = True
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "QuestionModel":
        if not data:
            return None
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        if "exam_id" in doc and not isinstance(doc["exam_id"], str):
            doc["exam_id"] = str(doc["exam_id"])
        if "teacher_id" in doc and not isinstance(doc["teacher_id"], str):
            doc["teacher_id"] = str(doc["teacher_id"])
        return cls(**doc)


class ExamModel(BaseModel):
    """Internal MongoDB exam representation."""
    id: Optional[str] = None
    teacher_id: str
    title: str
    subject: str
    description: str = ""
    duration_minutes: int
    total_marks: float
    start_time: datetime
    end_time: datetime
    status: ExamStatus = ExamStatus.DRAFT
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "ExamModel":
        if not data:
            return None
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        if "teacher_id" in doc and not isinstance(doc["teacher_id"], str):
            doc["teacher_id"] = str(doc["teacher_id"])
        return cls(**doc)
