import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.exam import ExamStatus
from app.models.attempt import AttemptStatus, AnswerRecord
from app.schemas.attempt import (
    StudentExamCardResponse,
    StudentQuestionResponse,
    AnswerRecordResponse,
    ExamAttemptDetailResponse,
    StudentAttemptSummaryResponse,
    SubmitAttemptResponse,
)
from app.schemas.preference import (
    StudentPreferenceUpdateRequest,
    StudentPreferenceResponse,
)

logger = logging.getLogger("indexa.student_service")


def to_utc(dt: datetime) -> datetime:
    """Ensure datetime has UTC timezone to avoid offset comparison errors."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_object_id(oid_str: str, resource_name: str = "Resource") -> ObjectId:
    """Safely convert string to BSON ObjectId or raise HTTP 404."""
    try:
        return ObjectId(oid_str)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} not found: Invalid identifier.",
        )


async def _enrich_attempt_response(
    db: AsyncIOMotorDatabase,
    attempt: Dict[str, Any],
) -> ExamAttemptDetailResponse:
    """Compute live remaining seconds and populate exam metadata for an attempt."""
    now = datetime.now(timezone.utc)
    deadline = to_utc(attempt["deadline"])
    current_status = attempt.get("status", AttemptStatus.IN_PROGRESS.value)

    # Automatically transition expired attempts
    if current_status == AttemptStatus.IN_PROGRESS.value and now > deadline:
        await db.exam_attempts.update_one(
            {"_id": attempt["_id"]},
            {"$set": {"status": AttemptStatus.EXPIRED.value, "updated_at": now}},
        )
        current_status = AttemptStatus.EXPIRED.value
        attempt["status"] = current_status

    remaining_seconds = 0
    if current_status == AttemptStatus.IN_PROGRESS.value:
        remaining_seconds = max(0, int((deadline - now).total_seconds()))

    exam = await db.exams.find_one({"_id": parse_object_id(attempt["exam_id"], "Exam")})
    exam_title = exam["title"] if exam else "Exam"
    exam_subject = exam["subject"] if exam else "Subject"

    total_questions = await db.questions.count_documents({"exam_id": attempt["exam_id"]})

    answers_dict = {}
    raw_answers = attempt.get("answers", {})
    answered_count = 0

    for qid, ans in raw_answers.items():
        if isinstance(ans, dict):
            draft = ans.get("draft_response", "")
            if draft and draft.strip():
                answered_count += 1
            answers_dict[qid] = AnswerRecordResponse(
                attempt_id=str(attempt["_id"]),
                question_id=qid,
                student_id=str(attempt["student_id"]),
                draft_response=draft,
                confirmed_response=ans.get("confirmed_response"),
                is_confirmed=ans.get("is_confirmed", False),
                updated_at=ans.get("updated_at", now),
            )

    return ExamAttemptDetailResponse(
        id=str(attempt["_id"]),
        exam_id=str(attempt["exam_id"]),
        student_id=str(attempt["student_id"]),
        start_time=attempt["start_time"],
        deadline=attempt["deadline"],
        duration_minutes=int(attempt["duration_minutes"]),
        remaining_seconds=remaining_seconds,
        status=AttemptStatus(current_status),
        submitted_at=attempt.get("submitted_at"),
        answers=answers_dict,
        exam_title=exam_title,
        exam_subject=exam_subject,
        total_questions=total_questions,
        answered_count=answered_count,
    )


async def list_available_exams(
    db: AsyncIOMotorDatabase,
    student_id: str,
    status_filter: Optional[str] = None,
    search_query: Optional[str] = None,
) -> List[StudentExamCardResponse]:
    """
    List published exams available to the student with eligibility, schedule,
    and student attempt status. Draft exams are never returned.
    """
    now = datetime.now(timezone.utc)
    query: Dict[str, Any] = {"status": ExamStatus.PUBLISHED.value}

    if search_query and search_query.strip():
        safe_regex = re.escape(search_query.strip())
        query["$or"] = [
            {"title": {"$regex": safe_regex, "$options": "i"}},
            {"subject": {"$regex": safe_regex, "$options": "i"}},
        ]

    cursor = db.exams.find(query).sort("start_time", 1)
    exams = await cursor.to_list(length=1000)

    # Pre-fetch student's existing attempts for quick matching
    attempts_cursor = db.exam_attempts.find({"student_id": str(student_id)})
    attempts = await attempts_cursor.to_list(length=1000)
    attempts_by_exam: Dict[str, Dict[str, Any]] = {str(a["exam_id"]): a for a in attempts}

    cards: List[StudentExamCardResponse] = []

    for exam in exams:
        exam_id_str = str(exam["_id"])
        start = to_utc(exam["start_time"])
        end = to_utc(exam["end_time"])

        is_upcoming = now < start
        is_ongoing = start <= now <= end

        # Fetch instructor profile name
        teacher_name = "Instructor"
        if "teacher_id" in exam:
            try:
                teacher = await db.users.find_one({"_id": parse_object_id(exam["teacher_id"])})
                if teacher and teacher.get("name"):
                    teacher_name = teacher["name"]
            except Exception:
                pass

        q_count = await db.questions.count_documents({"exam_id": exam_id_str})

        attempt = attempts_by_exam.get(exam_id_str)
        attempt_id = str(attempt["_id"]) if attempt else None
        attempt_status = None
        is_available = False
        is_completed = False
        can_start = False
        can_resume = False

        if attempt:
            raw_status = attempt.get("status", AttemptStatus.IN_PROGRESS.value)
            if raw_status == AttemptStatus.IN_PROGRESS.value:
                deadline = to_utc(attempt["deadline"])
                if now > deadline:
                    # Expired attempt
                    await db.exam_attempts.update_one(
                        {"_id": attempt["_id"]},
                        {"$set": {"status": AttemptStatus.EXPIRED.value, "updated_at": now}},
                    )
                    attempt_status = AttemptStatus.EXPIRED.value
                    is_completed = True
                else:
                    attempt_status = AttemptStatus.IN_PROGRESS.value
                    can_resume = True
                    is_available = True
            elif raw_status == AttemptStatus.SUBMITTED.value:
                attempt_status = AttemptStatus.SUBMITTED.value
                is_completed = True
            else:
                attempt_status = AttemptStatus.EXPIRED.value
                is_completed = True
        else:
            if is_ongoing:
                is_available = True
                can_start = True
            elif is_upcoming:
                is_available = False
                can_start = False
            else:
                # Exam window has passed without attempt
                is_available = False
                is_completed = True

        card = StudentExamCardResponse(
            id=exam_id_str,
            title=exam["title"],
            subject=exam["subject"],
            description=exam.get("description", ""),
            teacher_name=teacher_name,
            duration_minutes=int(exam["duration_minutes"]),
            total_marks=float(exam["total_marks"]),
            start_time=exam["start_time"],
            end_time=exam["end_time"],
            status=exam["status"],
            questions_count=q_count,
            attempt_status=attempt_status,
            attempt_id=attempt_id,
            is_available=is_available,
            is_upcoming=is_upcoming,
            is_ongoing=is_ongoing,
            is_completed=is_completed,
            can_start=can_start,
            can_resume=can_resume,
        )

        # Apply optional filter
        if status_filter:
            filter_lower = status_filter.lower()
            if filter_lower == "available" and not card.is_available:
                continue
            if filter_lower == "upcoming" and not card.is_upcoming:
                continue
            if filter_lower == "ongoing" and not card.is_ongoing:
                continue
            if filter_lower == "completed" and not card.is_completed:
                continue
            if filter_lower == "in_progress" and card.attempt_status != AttemptStatus.IN_PROGRESS.value:
                continue

        cards.append(card)

    return cards


async def get_student_exam_detail(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    student_id: str,
) -> StudentExamCardResponse:
    """
    Retrieve single published exam details for a student.
    Prohibits viewing draft or non-existent exams.
    """
    exam_oid = parse_object_id(exam_id, "Exam")
    exam = await db.exams.find_one({"_id": exam_oid, "status": ExamStatus.PUBLISHED.value})

    if not exam:
        # Check if draft or truly non-existent
        draft = await db.exams.find_one({"_id": exam_oid})
        if draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found: Only published exams are accessible to students.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    all_cards = await list_available_exams(db, student_id)
    for c in all_cards:
        if c.id == str(exam_oid):
            return c

    # Fallback construct
    return (await list_available_exams(db, student_id, search_query=exam["title"]))[0]


async def start_or_resume_attempt(
    db: AsyncIOMotorDatabase,
    exam_id: str,
    student: Dict[str, Any],
) -> ExamAttemptDetailResponse:
    """
    Start a new examination attempt or safely resume an existing active attempt.
    Enforces scheduled window, duration deadline, and duplicate protection.
    """
    exam_oid = parse_object_id(exam_id, "Exam")
    exam = await db.exams.find_one({"_id": exam_oid})

    if not exam or exam.get("status") != ExamStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found or is not published.",
        )

    now = datetime.now(timezone.utc)
    student_id_str = str(student["_id"])

    # Check for existing attempt
    existing_attempt = await db.exam_attempts.find_one(
        {"student_id": student_id_str, "exam_id": str(exam_oid)}
    )

    if existing_attempt:
        current_status = existing_attempt.get("status", AttemptStatus.IN_PROGRESS.value)
        if current_status == AttemptStatus.IN_PROGRESS.value:
            deadline = to_utc(existing_attempt["deadline"])
            if now > deadline:
                await db.exam_attempts.update_one(
                    {"_id": existing_attempt["_id"]},
                    {"$set": {"status": AttemptStatus.EXPIRED.value, "updated_at": now}},
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Your examination attempt deadline has expired.",
                )
            # Resume ongoing active attempt
            return await _enrich_attempt_response(db, existing_attempt)

        if current_status == AttemptStatus.SUBMITTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already submitted this examination.",
            )

        if current_status == AttemptStatus.EXPIRED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your examination attempt has already expired.",
            )

    # New attempt: Validate scheduled window
    start_time = to_utc(exam["start_time"])
    end_time = to_utc(exam["end_time"])

    if now < start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exam has not started yet. Scheduled to start at {start_time.isoformat()}.",
        )

    if now > end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam has already ended and can no longer be started.",
        )

    # Authoritative server deadline: earlier of (now + duration) and exam end_time
    duration_delta = timedelta(minutes=int(exam["duration_minutes"]))
    tentative_deadline = now + duration_delta
    authoritative_deadline = min(tentative_deadline, end_time)

    attempt_doc = {
        "exam_id": str(exam["_id"]),
        "student_id": student_id_str,
        "student_name": student.get("name", "Student"),
        "student_email": student.get("email", ""),
        "start_time": now,
        "duration_minutes": int(exam["duration_minutes"]),
        "deadline": authoritative_deadline,
        "submitted_at": None,
        "status": AttemptStatus.IN_PROGRESS.value,
        "answers": {},
        "created_at": now,
        "updated_at": now,
    }

    result = await db.exam_attempts.insert_one(attempt_doc)
    attempt_doc["_id"] = result.inserted_id

    logger.info(
        "Student %s started attempt %s on exam %s",
        student_id_str,
        result.inserted_id,
        exam["_id"],
    )

    return await _enrich_attempt_response(db, attempt_doc)


async def list_student_attempts(
    db: AsyncIOMotorDatabase,
    student_id: str,
) -> List[StudentAttemptSummaryResponse]:
    """Retrieve history of all attempts belonging to the authenticated student."""
    cursor = db.exam_attempts.find({"student_id": str(student_id)}).sort("created_at", -1)
    attempts = await cursor.to_list(length=1000)

    results: List[StudentAttemptSummaryResponse] = []
    for att in attempts:
        exam = await db.exams.find_one({"_id": parse_object_id(att["exam_id"], "Exam")})
        exam_title = exam["title"] if exam else "Exam"
        exam_subject = exam["subject"] if exam else "Subject"

        total_q = await db.questions.count_documents({"exam_id": att["exam_id"]})
        raw_answers = att.get("answers", {})
        answered_count = len([
            k for k, v in raw_answers.items()
            if isinstance(v, dict) and v.get("draft_response", "").strip()
        ])

        results.append(
            StudentAttemptSummaryResponse(
                id=str(att["_id"]),
                exam_id=str(att["exam_id"]),
                exam_title=exam_title,
                exam_subject=exam_subject,
                start_time=att["start_time"],
                deadline=att["deadline"],
                submitted_at=att.get("submitted_at"),
                status=AttemptStatus(att.get("status", AttemptStatus.IN_PROGRESS.value)),
                duration_minutes=int(att["duration_minutes"]),
                total_questions=total_q,
                answered_count=answered_count,
            )
        )

    return results


async def get_student_attempt(
    db: AsyncIOMotorDatabase,
    attempt_id: str,
    student_id: str,
) -> ExamAttemptDetailResponse:
    """Retrieve attempt details with strict student ownership verification."""
    attempt_oid = parse_object_id(attempt_id, "Attempt")
    attempt = await db.exam_attempts.find_one({"_id": attempt_oid})

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam attempt not found.",
        )

    if str(attempt["student_id"]) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot access another student's exam attempt.",
        )

    return await _enrich_attempt_response(db, attempt)


async def get_attempt_questions(
    db: AsyncIOMotorDatabase,
    attempt_id: str,
    student_id: str,
) -> List[StudentQuestionResponse]:
    """
    Retrieve question prompts for an active attempt.
    CRITICAL: Strips correct MCQ answers and instructor private guidance.
    """
    attempt_oid = parse_object_id(attempt_id, "Attempt")
    attempt = await db.exam_attempts.find_one({"_id": attempt_oid})

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam attempt not found.",
        )

    if str(attempt["student_id"]) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot view questions for another student's attempt.",
        )

    cursor = db.questions.find({"exam_id": attempt["exam_id"]}).sort("order", 1)
    questions = await cursor.to_list(length=1000)

    clean_questions: List[StudentQuestionResponse] = []
    for q in questions:
        clean_questions.append(
            StudentQuestionResponse(
                id=str(q["_id"]),
                exam_id=str(q["exam_id"]),
                question_text=q["question_text"],
                question_type=q["question_type"],
                marks=float(q.get("marks", 1.0)),
                order=int(q.get("order", 1)),
                is_required=q.get("is_required", True),
                options=q.get("options"),
            )
        )

    return clean_questions


async def save_draft_answer(
    db: AsyncIOMotorDatabase,
    attempt_id: str,
    question_id: str,
    student_id: str,
    draft_response: str,
) -> AnswerRecordResponse:
    """
    Save or autosave draft response for an active attempt.
    Guarantees:
    - Never sets is_confirmed to True (reserved for Prompt 7 explicit confirmation).
    - Preserves separation of draft_response and confirmed_response.
    - Rejects modifications if attempt is submitted or expired.
    - Validates deadline against authoritative server clock.
    """
    attempt_oid = parse_object_id(attempt_id, "Attempt")
    attempt = await db.exam_attempts.find_one({"_id": attempt_oid})

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam attempt not found.",
        )

    if str(attempt["student_id"]) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot edit answers for another student's attempt.",
        )

    current_status = attempt.get("status", AttemptStatus.IN_PROGRESS.value)
    if current_status == AttemptStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify answers: Examination attempt has already been submitted.",
        )

    if current_status == AttemptStatus.EXPIRED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify answers: Examination attempt has expired.",
        )

    # Authoritative server clock deadline validation
    now = datetime.now(timezone.utc)
    deadline = to_utc(attempt["deadline"])
    if now > deadline:
        await db.exam_attempts.update_one(
            {"_id": attempt["_id"]},
            {"$set": {"status": AttemptStatus.EXPIRED.value, "updated_at": now}},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify answers: Examination deadline has passed.",
        )

    # Validate that question belongs to this exam
    q_oid = parse_object_id(question_id, "Question")
    question = await db.questions.find_one({"_id": q_oid, "exam_id": attempt["exam_id"]})
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this exam.",
        )

    answer_entry = {
        "attempt_id": str(attempt["_id"]),
        "question_id": str(question_id),
        "student_id": str(student_id),
        "draft_response": draft_response,
        "confirmed_response": None,
        "is_confirmed": False,
        "updated_at": now,
    }

    await db.exam_attempts.update_one(
        {"_id": attempt["_id"]},
        {
            "$set": {
                f"answers.{question_id}": answer_entry,
                "updated_at": now,
            }
        },
    )

    return AnswerRecordResponse(**answer_entry)


async def submit_attempt(
    db: AsyncIOMotorDatabase,
    attempt_id: str,
    student_id: str,
) -> SubmitAttemptResponse:
    """
    Explicitly finalize and submit an exam attempt.
    Enforces ownership, duplicate protection, and locks all answers.
    """
    attempt_oid = parse_object_id(attempt_id, "Attempt")
    attempt = await db.exam_attempts.find_one({"_id": attempt_oid})

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam attempt not found.",
        )

    if str(attempt["student_id"]) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot submit another student's exam attempt.",
        )

    current_status = attempt.get("status", AttemptStatus.IN_PROGRESS.value)
    if current_status == AttemptStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate submission prevented: This attempt has already been submitted.",
        )

    if current_status == AttemptStatus.EXPIRED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit: This examination attempt has expired.",
        )

    now = datetime.now(timezone.utc)
    deadline = to_utc(attempt["deadline"])

    # Grace period or transition to submitted
    final_status = AttemptStatus.SUBMITTED.value

    await db.exam_attempts.update_one(
        {"_id": attempt["_id"]},
        {
            "$set": {
                "status": final_status,
                "submitted_at": now,
                "updated_at": now,
            }
        },
    )

    total_q = await db.questions.count_documents({"exam_id": attempt["exam_id"]})
    raw_answers = attempt.get("answers", {})
    answered_count = len([
        k for k, v in raw_answers.items()
        if isinstance(v, dict) and v.get("draft_response", "").strip()
    ])

    logger.info("Attempt %s successfully submitted by student %s", attempt_id, student_id)

    return SubmitAttemptResponse(
        attempt_id=str(attempt["_id"]),
        status=AttemptStatus.SUBMITTED,
        submitted_at=now,
        message="Examination successfully submitted and locked.",
        total_questions=total_q,
        answered_questions=answered_count,
    )


async def get_student_preferences(
    db: AsyncIOMotorDatabase,
    student_id: str,
) -> StudentPreferenceResponse:
    """Retrieve accessibility preferences for the authenticated student, or sensible defaults."""
    pref = await db.student_preferences.find_one({"student_id": str(student_id)})
    if not pref:
        return StudentPreferenceResponse(student_id=str(student_id))
    return StudentPreferenceResponse(
        student_id=str(student_id),
        font_size=pref.get("font_size", "medium"),
        high_contrast=pref.get("high_contrast", False),
        speech_enabled=pref.get("speech_enabled", True),
        speech_rate=float(pref.get("speech_rate", 1.0)),
        speech_volume=float(pref.get("speech_volume", 1.0)),
        preferred_voice=pref.get("preferred_voice", ""),
        auto_read_questions=pref.get("auto_read_questions", False),
        preferred_input_method=pref.get("preferred_input_method", "keyboard"),
        updated_at=pref.get("updated_at"),
    )


async def update_student_preferences(
    db: AsyncIOMotorDatabase,
    student_id: str,
    update_in: StudentPreferenceUpdateRequest,
) -> StudentPreferenceResponse:
    """Persist student accessibility preferences in MongoDB."""
    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {"updated_at": now}

    if update_in.font_size is not None:
        updates["font_size"] = update_in.font_size.value
    if update_in.high_contrast is not None:
        updates["high_contrast"] = update_in.high_contrast
    if update_in.speech_enabled is not None:
        updates["speech_enabled"] = update_in.speech_enabled
    if update_in.speech_rate is not None:
        updates["speech_rate"] = float(update_in.speech_rate)
    if update_in.speech_volume is not None:
        updates["speech_volume"] = float(update_in.speech_volume)
    if update_in.preferred_voice is not None:
        updates["preferred_voice"] = update_in.preferred_voice
    if update_in.auto_read_questions is not None:
        updates["auto_read_questions"] = update_in.auto_read_questions
    if update_in.preferred_input_method is not None:
        updates["preferred_input_method"] = update_in.preferred_input_method.value

    await db.student_preferences.update_one(
        {"student_id": str(student_id)},
        {"$set": updates, "$setOnInsert": {"created_at": now, "student_id": str(student_id)}},
        upsert=True,
    )

    return await get_student_preferences(db, student_id)
