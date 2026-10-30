import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongodb import get_database
from app.api.deps import require_role
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
from app.services.student_service import (
    list_available_exams,
    get_student_exam_detail,
    start_or_resume_attempt,
    list_student_attempts,
    get_student_attempt,
    get_attempt_questions,
    save_draft_answer,
    submit_attempt,
    get_student_preferences,
    update_student_preferences,
)

logger = logging.getLogger("indexa.api.student")
router = APIRouter()


@router.get(
    "/exams",
    response_model=List[StudentExamCardResponse],
    status_code=status.HTTP_200_OK,
    summary="List published exams available to the student",
    description="Returns all published exams with student eligibility, schedule, and attempt status. Drafts are omitted.",
)
async def api_list_available_exams(
    status: Optional[str] = Query(None, description="Filter by status (available, upcoming, ongoing, completed, in_progress)"),
    search: Optional[str] = Query(None, description="Search term matching title or subject"),
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await list_available_exams(db, student_id, status_filter=status, search_query=search)


@router.get(
    "/exams/{exam_id}",
    response_model=StudentExamCardResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve an eligible exam without private answers",
    description="Returns public details of a published exam. Prohibits accessing draft exams.",
)
async def api_get_student_exam(
    exam_id: str,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await get_student_exam_detail(db, exam_id, student_id)


@router.post(
    "/exams/{exam_id}/start",
    response_model=ExamAttemptDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Start or resume an exam attempt",
    description="Starts a new attempt or resumes an ongoing attempt. Validates scheduled window and duration deadline.",
)
async def api_start_or_resume_exam(
    exam_id: str,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await start_or_resume_attempt(db, exam_id, current_student)


@router.get(
    "/attempts",
    response_model=List[StudentAttemptSummaryResponse],
    status_code=status.HTTP_200_OK,
    summary="List the student's attempts",
    description="Returns historical examination attempts belonging to the authenticated student.",
)
async def api_list_student_attempts(
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await list_student_attempts(db, student_id)


@router.get(
    "/attempts/{attempt_id}",
    response_model=ExamAttemptDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve the student's own attempt",
    description="Returns full attempt details with saved draft answers and authoritative remaining time. Verifies student ownership.",
)
async def api_get_student_attempt(
    attempt_id: str,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await get_student_attempt(db, attempt_id, student_id)


@router.get(
    "/attempts/{attempt_id}/questions",
    response_model=List[StudentQuestionResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve questions for an attempt",
    description="Returns question prompts for an active attempt. Correct answers and instructor guidance are strictly hidden.",
)
async def api_get_attempt_questions(
    attempt_id: str,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await get_attempt_questions(db, attempt_id, student_id)


@router.put(
    "/attempts/{attempt_id}/answers/{question_id}",
    response_model=AnswerRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Save or autosave draft answer",
    description="Stores an unconfirmed answer draft in MongoDB. Validates attempt ownership, active status, and deadline.",
)
async def api_save_draft_answer(
    attempt_id: str,
    question_id: str,
    save_in: AnswerSaveRequest,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await save_draft_answer(db, attempt_id, question_id, student_id, save_in.draft_response)


@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=SubmitAttemptResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit exam attempt",
    description="Explicitly confirms and locks the exam attempt. Prevents duplicate submissions and further modifications.",
)
async def api_submit_attempt(
    attempt_id: str,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await submit_attempt(db, attempt_id, student_id)


@router.get(
    "/preferences",
    response_model=StudentPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get student accessibility preferences",
    description="Returns accessibility, speech, and display preferences for the authenticated student.",
)
async def api_get_preferences(
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await get_student_preferences(db, student_id)


@router.put(
    "/preferences",
    response_model=StudentPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update student accessibility preferences",
    description="Updates and persists accessibility, speech, and display preferences in MongoDB.",
)
async def api_update_preferences(
    update_in: StudentPreferenceUpdateRequest,
    current_student: Dict[str, Any] = Depends(require_role("student")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    student_id = str(current_student["_id"])
    return await update_student_preferences(db, student_id, update_in)
