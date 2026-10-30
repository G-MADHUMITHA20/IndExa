"""Pydantic request and response schemas."""
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
)
from app.schemas.exam import (
    ExamCreateRequest,
    ExamUpdateRequest,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    QuestionReorderRequest,
    QuestionResponse,
    ExamSummaryResponse,
    ExamDetailResponse,
)
from app.schemas.attempt import (
    StudentExamCardResponse,
    StudentQuestionResponse,
    AnswerSaveRequest,
    AnswerRecordResponse,
    ExamAttemptDetailResponse,
    StudentAttemptSummaryResponse,
    SubmitAttemptResponse,
)
from app.schemas.preference import (
    StudentPreferenceUpdateRequest,
    StudentPreferenceResponse,
)

__all__ = [
    "UserRegisterRequest",
    "UserLoginRequest",
    "UserResponse",
    "TokenResponse",
    "ExamCreateRequest",
    "ExamUpdateRequest",
    "QuestionCreateRequest",
    "QuestionUpdateRequest",
    "QuestionReorderRequest",
    "QuestionResponse",
    "ExamSummaryResponse",
    "ExamDetailResponse",
    "StudentExamCardResponse",
    "StudentQuestionResponse",
    "AnswerSaveRequest",
    "AnswerRecordResponse",
    "ExamAttemptDetailResponse",
    "StudentAttemptSummaryResponse",
    "SubmitAttemptResponse",
    "StudentPreferenceUpdateRequest",
    "StudentPreferenceResponse",
]
