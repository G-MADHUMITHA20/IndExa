import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongodb import get_database
from app.api.deps import require_role
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
from app.services.exam_service import (
    create_exam,
    list_teacher_exams,
    get_exam_detail,
    update_exam,
    delete_exam,
    add_question,
    update_question,
    delete_question,
    reorder_questions,
    publish_exam,
    close_exam,
)

logger = logging.getLogger("indexa.api.exams")
router = APIRouter()


@router.post(
    "",
    response_model=ExamSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new exam",
    description="Creates a new exam in Draft status associated with the authenticated teacher.",
)
async def api_create_exam(
    exam_in: ExamCreateRequest,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await create_exam(db, teacher_id, exam_in)


@router.get(
    "",
    response_model=List[ExamSummaryResponse],
    status_code=status.HTTP_200_OK,
    summary="List exams belonging to the authenticated teacher",
    description="Returns all exams created by the teacher with optional status and search term filters.",
)
async def api_list_exams(
    status: Optional[str] = Query(None, description="Filter by status (draft, published, closed)"),
    search: Optional[str] = Query(None, description="Search term matching title or subject"),
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await list_teacher_exams(db, teacher_id, status_filter=status, search_query=search)


@router.get(
    "/{exam_id}",
    response_model=ExamDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a specific exam",
    description="Returns full exam details and all its questions. Only accessible by the creator teacher.",
)
async def api_get_exam(
    exam_id: str,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await get_exam_detail(db, exam_id, teacher_id)


@router.put(
    "/{exam_id}",
    response_model=ExamDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update exam details",
    description="Updates exam properties. Cannot modify closed exams.",
)
async def api_update_exam(
    exam_id: str,
    update_in: ExamUpdateRequest,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await update_exam(db, exam_id, teacher_id, update_in)


@router.delete(
    "/{exam_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an eligible draft exam",
    description="Deletes a draft exam and all associated questions. Published or closed exams cannot be deleted.",
)
async def api_delete_exam(
    exam_id: str,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await delete_exam(db, exam_id, teacher_id)


@router.post(
    "/{exam_id}/questions",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a question to an exam",
    description="Adds a new question to a draft exam. Validates question type and MCQ options.",
)
async def api_add_question(
    exam_id: str,
    q_in: QuestionCreateRequest,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await add_question(db, exam_id, teacher_id, q_in)


@router.put(
    "/{exam_id}/questions/reorder",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder questions within an exam",
    description="Updates the display order sequence of questions in a draft exam.",
)
async def api_reorder_questions(
    exam_id: str,
    reorder_in: QuestionReorderRequest,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await reorder_questions(db, exam_id, teacher_id, reorder_in.question_ids)


@router.put(
    "/{exam_id}/questions/{question_id}",
    response_model=QuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a question",
    description="Updates question text, type, marks, or options in a draft exam.",
)
async def api_update_question(
    exam_id: str,
    question_id: str,
    q_in: QuestionUpdateRequest,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await update_question(db, exam_id, question_id, teacher_id, q_in)


@router.delete(
    "/{exam_id}/questions/{question_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a question",
    description="Deletes a question from a draft exam.",
)
async def api_delete_question(
    exam_id: str,
    question_id: str,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await delete_question(db, exam_id, question_id, teacher_id)


@router.post(
    "/{exam_id}/publish",
    response_model=ExamDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Publish an exam",
    description="Publishes a draft exam. Validates that >=1 question exists and question marks equal total marks.",
)
async def api_publish_exam(
    exam_id: str,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await publish_exam(db, exam_id, teacher_id)


@router.post(
    "/{exam_id}/close",
    response_model=ExamDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Close an exam",
    description="Closes an active published exam. Closed exams cannot be reopened.",
)
async def api_close_exam(
    exam_id: str,
    current_teacher: Dict[str, Any] = Depends(require_role("teacher")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    teacher_id = str(current_teacher["_id"])
    return await close_exam(db, exam_id, teacher_id)
