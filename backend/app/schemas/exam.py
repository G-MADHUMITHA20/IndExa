from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from app.models.exam import ExamStatus, QuestionType


class ExamCreateRequest(BaseModel):
    """Schema for creating a new exam."""
    title: str = Field(..., min_length=2, max_length=200, description="Exam title")
    subject: str = Field(..., min_length=2, max_length=100, description="Academic subject or course name")
    description: Optional[str] = Field("", description="Exam instructions or description")
    duration_minutes: int = Field(..., gt=0, description="Duration in minutes (must be positive)")
    total_marks: float = Field(..., gt=0, description="Total possible marks (must be positive)")
    start_time: datetime = Field(..., description="Scheduled start date and time")
    end_time: datetime = Field(..., description="Scheduled end date and time")

    @field_validator("title", "subject")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("Field must contain at least 2 characters after trimming.")
        return trimmed

    @model_validator(mode="after")
    def validate_times(self) -> "ExamCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("End date and time must be later than start date and time.")
        return self


class ExamUpdateRequest(BaseModel):
    """Schema for updating an existing exam."""
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    subject: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    total_marks: Optional[float] = Field(None, gt=0)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @field_validator("title", "subject")
    @classmethod
    def strip_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if len(trimmed) < 2:
                raise ValueError("Field must contain at least 2 characters after trimming.")
            return trimmed
        return v

    @model_validator(mode="after")
    def validate_times(self) -> "ExamUpdateRequest":
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("End date and time must be later than start date and time.")
        return self


class QuestionCreateRequest(BaseModel):
    """Schema for creating a question within an exam."""
    question_text: str = Field(..., min_length=1, description="Question prompt text or math expression")
    question_type: QuestionType = Field(..., description="Type of question (mcq, short_answer, long_answer, mathematical)")
    marks: float = Field(..., gt=0, description="Allocated marks for this question (must be positive)")
    order: Optional[int] = Field(None, ge=1, description="Display order sequence index")
    is_required: bool = Field(True, description="Whether question response is required")
    options: Optional[List[str]] = Field(None, description="List of options for MCQ questions")
    correct_answer: Optional[str] = Field(None, description="Correct answer for MCQ")
    expected_answer: Optional[str] = Field(None, description="Private evaluation guidance for instructor")

    @field_validator("question_text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Question text cannot be empty.")
        return trimmed

    @model_validator(mode="after")
    def validate_mcq_requirements(self) -> "QuestionCreateRequest":
        if self.question_type == QuestionType.MCQ:
            if not self.options or len([opt for opt in self.options if opt.strip()]) < 2:
                raise ValueError("Multiple-choice questions (MCQ) must include at least two non-empty options.")
            cleaned_options = [opt.strip() for opt in self.options if opt.strip()]
            self.options = cleaned_options

            if not self.correct_answer or not self.correct_answer.strip():
                raise ValueError("A correct answer must be selected for multiple-choice questions.")
            
            cleaned_correct = self.correct_answer.strip()
            if cleaned_correct not in self.options:
                raise ValueError(f"Correct answer '{cleaned_correct}' must be one of the provided options: {self.options}")
            self.correct_answer = cleaned_correct
        return self


class QuestionUpdateRequest(BaseModel):
    """Schema for updating an existing question."""
    question_text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[QuestionType] = None
    marks: Optional[float] = Field(None, gt=0)
    order: Optional[int] = Field(None, ge=1)
    is_required: Optional[bool] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    expected_answer: Optional[str] = None

    @field_validator("question_text")
    @classmethod
    def validate_text(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Question text cannot be empty.")
            return trimmed
        return v

    @model_validator(mode="after")
    def validate_mcq_update(self) -> "QuestionUpdateRequest":
        if self.question_type == QuestionType.MCQ or (self.options is not None and self.options):
            if self.options is not None:
                cleaned_options = [opt.strip() for opt in self.options if opt.strip()]
                if len(cleaned_options) < 2:
                    raise ValueError("Multiple-choice questions (MCQ) must include at least two non-empty options.")
                self.options = cleaned_options
                if self.correct_answer is not None:
                    cleaned_correct = self.correct_answer.strip()
                    if cleaned_correct not in self.options:
                        raise ValueError(f"Correct answer '{cleaned_correct}' must be one of the provided options.")
                    self.correct_answer = cleaned_correct
        return self


class QuestionReorderRequest(BaseModel):
    """Schema for reordering questions within an exam."""
    question_ids: List[str] = Field(..., min_length=1, description="Ordered list of question IDs")


class QuestionResponse(BaseModel):
    """Public instructor representation of a question."""
    id: str
    exam_id: str
    question_text: str
    question_type: QuestionType
    marks: float
    order: int
    is_required: bool
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExamSummaryResponse(BaseModel):
    """Summary overview of an exam for list views and dashboard cards."""
    id: str
    teacher_id: str
    title: str
    subject: str
    description: str
    duration_minutes: int
    total_marks: float
    start_time: datetime
    end_time: datetime
    status: ExamStatus
    questions_count: int = 0
    current_marks_total: float = 0.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExamDetailResponse(ExamSummaryResponse):
    """Full detail view of an exam including all its questions."""
    questions: List[QuestionResponse] = []

    model_config = ConfigDict(from_attributes=True)
