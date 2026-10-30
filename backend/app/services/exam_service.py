import logging
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.exam import ExamStatus, QuestionType
from app.schemas.exam import (
    ExamCreateRequest,
    ExamUpdateRequest,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    QuestionResponse,
    ExamSummaryResponse,
    ExamDetailResponse,
)

logger = logging.getLogger("indexa.exam_service")


def parse_object_id(oid_str: str, resource_name: str = "Resource") -> ObjectId:
    """Safely convert string to BSON ObjectId or raise HTTP 404."""
    try:
        return ObjectId(oid_str)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} not found: Invalid identifier.",
        )


async def validate_exam_ownership(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
) -> Dict[str, Any]:
    """
    Validate that the specified exam exists and is owned by the authenticated teacher.
    Raises HTTP 404 if not found or HTTP 403 if belonging to another teacher.
    """
    exam_oid = parse_object_id(exam_id, "Exam")
    exam = await db.exams.find_one({"_id": exam_oid})

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    if str(exam["teacher_id"]) != str(teacher_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access or modify this exam.",
        )

    return exam


async def _enrich_exam_summary(
    db: AsyncIOMotorDatabase,
    exam: Dict[str, Any],
) -> ExamSummaryResponse:
    """Helper to compute question count and mark sums for an exam document."""
    exam_id_str = str(exam["_id"])
    questions_cursor = db.questions.find({"exam_id": exam_id_str})
    questions = await questions_cursor.to_list(length=1000)

    q_count = len(questions)
    marks_sum = sum(float(q.get("marks", 0.0)) for q in questions)

    return ExamSummaryResponse(
        id=exam_id_str,
        teacher_id=str(exam["teacher_id"]),
        title=exam["title"],
        subject=exam["subject"],
        description=exam.get("description", ""),
        duration_minutes=int(exam["duration_minutes"]),
        total_marks=float(exam["total_marks"]),
        start_time=exam["start_time"],
        end_time=exam["end_time"],
        status=ExamStatus(exam.get("status", ExamStatus.DRAFT.value)),
        questions_count=q_count,
        current_marks_total=marks_sum,
        created_at=exam.get("created_at", datetime.now(timezone.utc)),
        updated_at=exam.get("updated_at", datetime.now(timezone.utc)),
    )


async def create_exam(
    db: AsyncIOMotorDatabase,
    teacher_id: str,
    exam_in: ExamCreateRequest,
) -> ExamSummaryResponse:
    """Create a new exam associated with the authenticated teacher."""
    now = datetime.now(timezone.utc)
    exam_doc = {
        "teacher_id": str(teacher_id),
        "title": exam_in.title,
        "subject": exam_in.subject,
        "description": exam_in.description or "",
        "duration_minutes": exam_in.duration_minutes,
        "total_marks": float(exam_in.total_marks),
        "start_time": exam_in.start_time,
        "end_time": exam_in.end_time,
        "status": ExamStatus.DRAFT.value,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.exams.insert_one(exam_doc)
    exam_doc["_id"] = result.inserted_id

    logger.info("Teacher %s created new exam '%s' (id: %s)", teacher_id, exam_in.title, result.inserted_id)
    return await _enrich_exam_summary(db, exam_doc)


async def list_teacher_exams(
    db: AsyncIOMotorDatabase,
    teacher_id: str,
    status_filter: Optional[str] = None,
    search_query: Optional[str] = None,
) -> List[ExamSummaryResponse]:
    """Retrieve exams created by the authenticated teacher with optional status and search filters."""
    query: Dict[str, Any] = {"teacher_id": str(teacher_id)}

    if status_filter:
        valid_statuses = [s.value for s in ExamStatus]
        if status_filter.lower() in valid_statuses:
            query["status"] = status_filter.lower()

    if search_query and search_query.strip():
        safe_regex = re.escape(search_query.strip())
        query["$or"] = [
            {"title": {"$regex": safe_regex, "$options": "i"}},
            {"subject": {"$regex": safe_regex, "$options": "i"}},
        ]

    cursor = db.exams.find(query).sort("created_at", -1)
    exams = await cursor.to_list(length=1000)

    results: List[ExamSummaryResponse] = []
    for exam in exams:
        results.append(await _enrich_exam_summary(db, exam))

    return results


async def get_exam_detail(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
) -> ExamDetailResponse:
    """Retrieve full exam details including all configured questions."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    exam_id_str = str(exam["_id"])

    cursor = db.questions.find({"exam_id": exam_id_str}).sort("order", 1)
    raw_questions = await cursor.to_list(length=1000)

    question_responses: List[QuestionResponse] = []
    marks_sum = 0.0

    for q in raw_questions:
        marks = float(q.get("marks", 1.0))
        marks_sum += marks
        question_responses.append(
            QuestionResponse(
                id=str(q["_id"]),
                exam_id=exam_id_str,
                question_text=q["question_text"],
                question_type=QuestionType(q["question_type"]),
                marks=marks,
                order=int(q.get("order", 1)),
                is_required=q.get("is_required", True),
                options=q.get("options"),
                correct_answer=q.get("correct_answer"),
                expected_answer=q.get("expected_answer"),
                created_at=q.get("created_at", datetime.now(timezone.utc)),
                updated_at=q.get("updated_at", datetime.now(timezone.utc)),
            )
        )

    return ExamDetailResponse(
        id=exam_id_str,
        teacher_id=str(exam["teacher_id"]),
        title=exam["title"],
        subject=exam["subject"],
        description=exam.get("description", ""),
        duration_minutes=int(exam["duration_minutes"]),
        total_marks=float(exam["total_marks"]),
        start_time=exam["start_time"],
        end_time=exam["end_time"],
        status=ExamStatus(exam.get("status", ExamStatus.DRAFT.value)),
        questions_count=len(question_responses),
        current_marks_total=marks_sum,
        created_at=exam.get("created_at", datetime.now(timezone.utc)),
        updated_at=exam.get("updated_at", datetime.now(timezone.utc)),
        questions=question_responses,
    )


async def update_exam(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
    update_in: ExamUpdateRequest,
) -> ExamDetailResponse:
    """Update exam parameters. Prohibits editing closed exams."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status == ExamStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Closed exams cannot be modified.",
        )

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if update_in.title is not None:
        updates["title"] = update_in.title
    if update_in.subject is not None:
        updates["subject"] = update_in.subject
    if update_in.description is not None:
        updates["description"] = update_in.description
    if update_in.duration_minutes is not None:
        updates["duration_minutes"] = update_in.duration_minutes
    if update_in.total_marks is not None:
        updates["total_marks"] = float(update_in.total_marks)
    if update_in.start_time is not None:
        updates["start_time"] = update_in.start_time
    if update_in.end_time is not None:
        updates["end_time"] = update_in.end_time

    # Validate final effective start and end times
    effective_start = updates.get("start_time", exam["start_time"])
    effective_end = updates.get("end_time", exam["end_time"])
    if effective_end <= effective_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date and time must be later than start date and time.",
        )

    await db.exams.update_one({"_id": exam["_id"]}, {"$set": updates})
    return await get_exam_detail(db, exam_id, teacher_id)


async def delete_exam(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
) -> Dict[str, str]:
    """Delete an exam and all its associated questions. Only draft exams can be deleted."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only draft exams can be deleted. Current exam status is '{current_status}'.",
        )

    exam_id_str = str(exam["_id"])
    await db.exams.delete_one({"_id": exam["_id"]})
    deleted_questions = await db.questions.delete_many({"exam_id": exam_id_str})

    logger.info(
        "Deleted exam %s and %d associated questions by teacher %s",
        exam_id,
        deleted_questions.deleted_count,
        teacher_id,
    )
    return {"message": "Exam and associated questions successfully deleted."}


async def add_question(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
    q_in: QuestionCreateRequest,
) -> QuestionResponse:
    """Add a question to a draft exam."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions can only be added to draft exams.",
        )

    exam_id_str = str(exam["_id"])

    # Determine order sequence
    if q_in.order is not None:
        assigned_order = q_in.order
    else:
        existing_count = await db.questions.count_documents({"exam_id": exam_id_str})
        assigned_order = existing_count + 1

    now = datetime.now(timezone.utc)
    question_doc = {
        "exam_id": exam_id_str,
        "teacher_id": str(teacher_id),
        "question_text": q_in.question_text,
        "question_type": q_in.question_type.value,
        "marks": float(q_in.marks),
        "order": assigned_order,
        "is_required": q_in.is_required,
        "options": q_in.options if q_in.question_type == QuestionType.MCQ else None,
        "correct_answer": q_in.correct_answer if q_in.question_type == QuestionType.MCQ else None,
        "expected_answer": q_in.expected_answer,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.questions.insert_one(question_doc)
    question_doc["_id"] = result.inserted_id

    # Touch parent exam updated_at
    await db.exams.update_one({"_id": exam["_id"]}, {"$set": {"updated_at": now}})

    return QuestionResponse(
        id=str(result.inserted_id),
        exam_id=exam_id_str,
        question_text=question_doc["question_text"],
        question_type=QuestionType(question_doc["question_type"]),
        marks=question_doc["marks"],
        order=question_doc["order"],
        is_required=question_doc["is_required"],
        options=question_doc.get("options"),
        correct_answer=question_doc.get("correct_answer"),
        expected_answer=question_doc.get("expected_answer"),
        created_at=question_doc["created_at"],
        updated_at=question_doc["updated_at"],
    )


async def update_question(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    question_id: str,
    teacher_id: str,
    q_in: QuestionUpdateRequest,
) -> QuestionResponse:
    """Update a question inside a draft exam."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions can only be modified in draft exams.",
        )

    q_oid = parse_object_id(question_id, "Question")
    question = await db.questions.find_one({"_id": q_oid, "exam_id": str(exam["_id"])})

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this exam.",
        )

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if q_in.question_text is not None:
        updates["question_text"] = q_in.question_text
    if q_in.question_type is not None:
        updates["question_type"] = q_in.question_type.value
    if q_in.marks is not None:
        updates["marks"] = float(q_in.marks)
    if q_in.order is not None:
        updates["order"] = q_in.order
    if q_in.is_required is not None:
        updates["is_required"] = q_in.is_required
    if q_in.options is not None:
        updates["options"] = q_in.options
    if q_in.correct_answer is not None:
        updates["correct_answer"] = q_in.correct_answer
    if q_in.expected_answer is not None:
        updates["expected_answer"] = q_in.expected_answer

    # Validate MCQ consistency
    effective_type = updates.get("question_type", question["question_type"])
    if effective_type == QuestionType.MCQ.value:
        effective_options = updates.get("options", question.get("options"))
        effective_correct = updates.get("correct_answer", question.get("correct_answer"))
        if not effective_options or len(effective_options) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Multiple-choice questions must include at least two options.",
            )
        if not effective_correct or effective_correct not in effective_options:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Correct answer '{effective_correct}' must be one of the provided options: {effective_options}.",
            )

    await db.questions.update_one({"_id": q_oid}, {"$set": updates})
    updated_q = await db.questions.find_one({"_id": q_oid})

    return QuestionResponse(
        id=str(updated_q["_id"]),
        exam_id=str(exam["_id"]),
        question_text=updated_q["question_text"],
        question_type=QuestionType(updated_q["question_type"]),
        marks=float(updated_q["marks"]),
        order=int(updated_q["order"]),
        is_required=updated_q["is_required"],
        options=updated_q.get("options"),
        correct_answer=updated_q.get("correct_answer"),
        expected_answer=updated_q.get("expected_answer"),
        created_at=updated_q["created_at"],
        updated_at=updated_q["updated_at"],
    )


async def delete_question(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    question_id: str,
    teacher_id: str,
) -> Dict[str, str]:
    """Delete a question from a draft exam."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions can only be deleted from draft exams.",
        )

    q_oid = parse_object_id(question_id, "Question")
    res = await db.questions.delete_one({"_id": q_oid, "exam_id": str(exam["_id"])})

    if res.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this exam.",
        )

    # Touch exam updated_at
    await db.exams.update_one({"_id": exam["_id"]}, {"$set": {"updated_at": datetime.now(timezone.utc)}})

    return {"message": "Question deleted successfully."}


async def reorder_questions(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
    question_ids: List[str],
) -> List[QuestionResponse]:
    """Update question sequence orders within a draft exam."""
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions can only be reordered in draft exams.",
        )

    exam_id_str = str(exam["_id"])
    cursor = db.questions.find({"exam_id": exam_id_str})
    all_questions = await cursor.to_list(length=1000)

    existing_ids = {str(q["_id"]) for q in all_questions}
    provided_ids = set(question_ids)

    if existing_ids != provided_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reorder list must contain all existing question IDs without additions, omissions, or duplicates.",
        )

    now = datetime.now(timezone.utc)
    for index, q_id_str in enumerate(question_ids, start=1):
        await db.questions.update_one(
            {"_id": ObjectId(q_id_str)},
            {"$set": {"order": index, "updated_at": now}},
        )

    updated_detail = await get_exam_detail(db, exam_id, teacher_id)
    return updated_detail.questions


async def publish_exam(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
) -> ExamDetailResponse:
    """
    Publish an exam.
    Validates status transition (draft -> published), requirement for >= 1 question,
    and strict mark equality (sum of question marks must equal exam total marks).
    """
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status == ExamStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam is already published.",
        )
    if current_status == ExamStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Closed exams cannot be republished or reopened.",
        )
    if current_status != ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current_status}' to 'published'.",
        )

    exam_id_str = str(exam["_id"])
    questions_cursor = db.questions.find({"exam_id": exam_id_str})
    questions = await questions_cursor.to_list(length=1000)

    # 1. Require at least one question
    if len(questions) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish an exam without questions. Please add at least one question.",
        )

    # 2. Check question marks and total marks equality
    total_question_marks = sum(float(q.get("marks", 0.0)) for q in questions)
    expected_marks = float(exam["total_marks"])

    if abs(total_question_marks - expected_marks) > 0.001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Marks mismatch: Total question marks ({total_question_marks:g}) must exactly equal "
                f"exam total marks ({expected_marks:g}) before publishing."
            ),
        )

    # 3. Transition status to published
    now = datetime.now(timezone.utc)
    await db.exams.update_one(
        {"_id": exam["_id"]},
        {"$set": {"status": ExamStatus.PUBLISHED.value, "updated_at": now}},
    )

    logger.info("Exam %s published by teacher %s", exam_id, teacher_id)
    return await get_exam_detail(db, exam_id, teacher_id)


async def close_exam(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    teacher_id: str,
) -> ExamDetailResponse:
    """
    Close an exam.
    Validates status transition (published -> closed). Draft exams cannot be closed directly.
    """
    exam = await validate_exam_ownership(db, exam_id, teacher_id)
    current_status = exam.get("status", ExamStatus.DRAFT.value)

    if current_status == ExamStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam is already closed.",
        )
    if current_status == ExamStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft exams cannot be closed directly. Only published exams can be closed.",
        )

    now = datetime.now(timezone.utc)
    await db.exams.update_one(
        {"_id": exam["_id"]},
        {"$set": {"status": ExamStatus.CLOSED.value, "updated_at": now}},
    )

    logger.info("Exam %s closed by teacher %s", exam_id, teacher_id)
    return await get_exam_detail(db, exam_id, teacher_id)
