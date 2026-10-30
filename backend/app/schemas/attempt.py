from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from app.models.attempt import AttemptStatus


class AnswerSaveRequest(BaseModel):
    """Schema for saving/autosaving a student answer draft."""
    draft_response: str = Field(..., description="Student's drafted answer content")


class AnswerRecordResponse(BaseModel):
    """Public representation of an answer draft record."""
    attempt_id: str
    question_id: str
    student_id: str
    draft_response: str
    confirmed_response: Optional[str] = None
    is_confirmed: bool = False
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentQuestionResponse(BaseModel):
    """
    Question representation for students during examination.
    Correct answer and private instructor guidance are strictly excluded.
    """
    id: str
    exam_id: str
    question_text: str
    question_type: str
    marks: float
    order: int
    is_required: bool
    options: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class StudentExamCardResponse(BaseModel):
    """Exam overview representation for student dashboard views."""
    id: str
    title: str
    subject: str
    description: str = ""
    teacher_name: Optional[str] = None
    duration_minutes: int
    total_marks: float
    start_time: datetime
    end_time: datetime
    status: str
    questions_count: int = 0
    attempt_status: Optional[str] = None  # None, "in_progress", "submitted", "expired"
    attempt_id: Optional[str] = None
    is_available: bool = False
    is_upcoming: bool = False
    is_ongoing: bool = False
    is_completed: bool = False
    can_start: bool = False
    can_resume: bool = False

    model_config = ConfigDict(from_attributes=True)


class StudentAttemptSummaryResponse(BaseModel):
    """Overview of a single examination attempt by a student."""
    id: str
    exam_id: str
    exam_title: str
    exam_subject: str
    start_time: datetime
    deadline: datetime
    submitted_at: Optional[datetime] = None
    status: AttemptStatus
    duration_minutes: int
    total_questions: int = 0
    answered_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ExamAttemptDetailResponse(BaseModel):
    """Comprehensive details of an active or completed attempt."""
    id: str
    exam_id: str
    student_id: str
    start_time: datetime
    deadline: datetime
    duration_minutes: int
    remaining_seconds: int
    status: AttemptStatus
    submitted_at: Optional[datetime] = None
    answers: Dict[str, AnswerRecordResponse] = {}
    exam_title: Optional[str] = None
    exam_subject: Optional[str] = None
    total_questions: int = 0
    answered_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class SubmitAttemptResponse(BaseModel):
    """Confirmation payload returned upon exam submission."""
    attempt_id: str
    status: AttemptStatus
    submitted_at: datetime
    message: str
    total_questions: int
    answered_questions: int

    model_config = ConfigDict(from_attributes=True)
