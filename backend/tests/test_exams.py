import pytest
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.database.mongodb import db_manager


async def create_test_user(email: str, role: str, name: str, password: str = "Password123!"):
    """Helper to insert a test user into the database."""
    now = datetime.now(timezone.utc)
    user_doc = {
        "name": name,
        "email": email.lower().strip(),
        "hashed_password": hash_password(password),
        "role": role,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    res = await db_manager.db.users.insert_one(user_doc)
    return str(res.inserted_id)


async def get_auth_token(async_client, email: str, password: str = "Password123!") -> str:
    """Helper to log in and retrieve access token."""
    login_res = await async_client.post(
        "/auth/login",
        json={"email": email.lower().strip(), "password": password},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


def get_sample_exam_payload():
    """Helper to build a valid exam payload."""
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=3)
    return {
        "title": "Computer Networks Midterm",
        "subject": "CS 401",
        "description": "Comprehensive midterm covering OSI model and TCP/IP.",
        "duration_minutes": 120,
        "total_marks": 100.0,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }


@pytest.mark.asyncio
async def test_teacher_can_create_exam(async_client):
    """1. Test that authenticated teacher can create an exam in draft status."""
    teacher_email = "prof.create@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Create")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    payload = get_sample_exam_payload()
    res = await async_client.post("/exams", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["title"] == payload["title"]
    assert data["subject"] == payload["subject"]
    assert data["status"] == "draft"
    assert data["duration_minutes"] == 120
    assert data["total_marks"] == 100.0
    assert "id" in data
    assert "teacher_id" in data


@pytest.mark.asyncio
async def test_student_cannot_create_exam(async_client):
    """2. Test that student role is strictly rejected from creating exams (HTTP 403)."""
    student_email = "student.denied@university.edu"
    await create_test_user(student_email, "student", "Student Denied")
    token = await get_auth_token(async_client, student_email)
    headers = {"Authorization": f"Bearer {token}"}

    payload = get_sample_exam_payload()
    res = await async_client.post("/exams", json=payload, headers=headers)
    assert res.status_code == 403
    assert "teacher" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unauthenticated_cannot_access_teacher_apis(async_client):
    """3. Test that unauthenticated requests to teacher APIs return HTTP 401."""
    res_list = await async_client.get("/exams")
    assert res_list.status_code == 401

    payload = get_sample_exam_payload()
    res_create = await async_client.post("/exams", json=payload)
    assert res_create.status_code == 401


@pytest.mark.asyncio
async def test_teacher_can_retrieve_own_exams(async_client):
    """4. Test that a teacher can retrieve their own exam list and individual detail."""
    teacher_email = "prof.retrieve@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Retrieve")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    # Create exam
    payload = get_sample_exam_payload()
    create_res = await async_client.post("/exams", json=payload, headers=headers)
    exam_id = create_res.json()["id"]

    # List exams
    list_res = await async_client.get("/exams", headers=headers)
    assert list_res.status_code == 200
    exams = list_res.json()
    assert len(exams) >= 1
    assert any(e["id"] == exam_id for e in exams)

    # Get single exam detail
    detail_res = await async_client.get(f"/exams/{exam_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == exam_id
    assert detail["title"] == payload["title"]
    assert "questions" in detail


@pytest.mark.asyncio
async def test_teacher_cannot_access_another_teachers_exam(async_client):
    """5. Test that Teacher A cannot view, modify, or delete Teacher B's exam (HTTP 403)."""
    # Teacher A creates an exam
    teacher_a_email = "prof.a@university.edu"
    await create_test_user(teacher_a_email, "teacher", "Professor A")
    token_a = await get_auth_token(async_client, teacher_a_email)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res_a = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers_a)
    exam_id = res_a.json()["id"]

    # Teacher B attempts to access Teacher A's exam
    teacher_b_email = "prof.b@university.edu"
    await create_test_user(teacher_b_email, "teacher", "Professor B")
    token_b = await get_auth_token(async_client, teacher_b_email)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Attempt view
    get_res = await async_client.get(f"/exams/{exam_id}", headers=headers_b)
    assert get_res.status_code == 403

    # Attempt edit
    put_res = await async_client.put(
        f"/exams/{exam_id}",
        json={"title": "Hacked Title"},
        headers=headers_b,
    )
    assert put_res.status_code == 403

    # Attempt delete
    del_res = await async_client.delete(f"/exams/{exam_id}", headers=headers_b)
    assert del_res.status_code == 403


@pytest.mark.asyncio
async def test_invalid_exam_data_is_rejected(async_client):
    """6. Test validation rejections for incomplete, negative, or invalid date exams."""
    teacher_email = "prof.invalid@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Invalid")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    # Missing title
    res1 = await async_client.post(
        "/exams",
        json={"subject": "CS 101", "duration_minutes": 60, "total_marks": 50},
        headers=headers,
    )
    assert res1.status_code == 422

    # Negative duration
    res2 = await async_client.post(
        "/exams",
        json={
            "title": "Bad Exam",
            "subject": "CS 101",
            "duration_minutes": -30,
            "total_marks": 50,
            "start_time": "2026-11-01T10:00:00Z",
            "end_time": "2026-11-01T12:00:00Z",
        },
        headers=headers,
    )
    assert res2.status_code == 422

    # End time before start time
    res3 = await async_client.post(
        "/exams",
        json={
            "title": "Bad Date Exam",
            "subject": "CS 101",
            "duration_minutes": 60,
            "total_marks": 50,
            "start_time": "2026-11-01T12:00:00Z",
            "end_time": "2026-11-01T10:00:00Z",
        },
        headers=headers,
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_teacher_can_add_edit_and_delete_questions(async_client):
    """7. Test question management: adding questions, editing them, and deleting them."""
    teacher_email = "prof.questions@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Questions")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # 1. Add short answer question
    q1_payload = {
        "question_text": "Define latency and throughput in networks.",
        "question_type": "short_answer",
        "marks": 20.0,
        "is_required": True,
        "expected_answer": "Latency is transmission delay; throughput is rate of delivery.",
    }
    q1_res = await async_client.post(f"/exams/{exam_id}/questions", json=q1_payload, headers=headers)
    assert q1_res.status_code == 201
    q1_data = q1_res.json()
    assert q1_data["marks"] == 20.0
    question_id = q1_data["id"]

    # 2. Edit question
    update_payload = {
        "question_text": "Explain latency and throughput in data communication networks.",
        "marks": 25.0,
    }
    put_res = await async_client.put(
        f"/exams/{exam_id}/questions/{question_id}",
        json=update_payload,
        headers=headers,
    )
    assert put_res.status_code == 200
    assert put_res.json()["marks"] == 25.0
    assert "Explain latency" in put_res.json()["question_text"]

    # 3. Delete question
    del_res = await async_client.delete(f"/exams/{exam_id}/questions/{question_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify question is no longer present in exam detail
    detail = await async_client.get(f"/exams/{exam_id}", headers=headers)
    assert len(detail.json()["questions"]) == 0


@pytest.mark.asyncio
async def test_mcq_validation_rules(async_client):
    """8. Test multiple-choice question validation rules (min 2 options, valid correct option)."""
    teacher_email = "prof.mcq@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor MCQ")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Less than 2 options
    bad_mcq1 = {
        "question_text": "Which layer is IP in?",
        "question_type": "mcq",
        "marks": 10.0,
        "options": ["Network Layer"],
        "correct_answer": "Network Layer",
    }
    res1 = await async_client.post(f"/exams/{exam_id}/questions", json=bad_mcq1, headers=headers)
    assert res1.status_code == 422

    # Correct answer not in options
    bad_mcq2 = {
        "question_text": "Which layer is IP in?",
        "question_type": "mcq",
        "marks": 10.0,
        "options": ["Application Layer", "Data Link Layer"],
        "correct_answer": "Network Layer",
    }
    res2 = await async_client.post(f"/exams/{exam_id}/questions", json=bad_mcq2, headers=headers)
    assert res2.status_code == 422

    # Valid MCQ
    good_mcq = {
        "question_text": "Which layer is IP in OSI model?",
        "question_type": "mcq",
        "marks": 10.0,
        "options": ["Transport Layer", "Network Layer", "Application Layer"],
        "correct_answer": "Network Layer",
    }
    res3 = await async_client.post(f"/exams/{exam_id}/questions", json=good_mcq, headers=headers)
    assert res3.status_code == 201
    assert res3.json()["correct_answer"] == "Network Layer"


@pytest.mark.asyncio
async def test_exam_marks_mismatch_prevents_publishing(async_client):
    """9. Test that publishing fails if the sum of question marks != exam total marks."""
    teacher_email = "prof.mismatch@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Mismatch")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    # Total marks = 100
    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Add question with marks = 60 (mismatch: 60 != 100)
    await async_client.post(
        f"/exams/{exam_id}/questions",
        json={
            "question_text": "Explain TCP handshake.",
            "question_type": "long_answer",
            "marks": 60.0,
        },
        headers=headers,
    )

    publish_res = await async_client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert publish_res.status_code == 400
    assert "marks mismatch" in publish_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_exam_without_questions_cannot_be_published(async_client):
    """10. Test that publishing an exam with zero questions is rejected."""
    teacher_email = "prof.noquestions@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor NoQuestions")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    publish_res = await async_client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert publish_res.status_code == 400
    assert "without questions" in publish_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_valid_exams_can_be_published(async_client):
    """11. Test that a valid exam with matching question marks can be published."""
    teacher_email = "prof.publish@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Publish")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    # Exam with total marks = 100
    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Add Q1: MCQ (40 marks)
    await async_client.post(
        f"/exams/{exam_id}/questions",
        json={
            "question_text": "Default HTTP port?",
            "question_type": "mcq",
            "marks": 40.0,
            "options": ["80", "443", "8080"],
            "correct_answer": "80",
        },
        headers=headers,
    )

    # Add Q2: Mathematical (60 marks) -> 40 + 60 = 100 exactly!
    await async_client.post(
        f"/exams/{exam_id}/questions",
        json={
            "question_text": "Calculate Nyquist channel capacity formula: C = 2B * log2(M)",
            "question_type": "mathematical",
            "marks": 60.0,
            "expected_answer": "Substitute bandwidth and signal levels into C = 2B log2(M)",
        },
        headers=headers,
    )

    publish_res = await async_client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert publish_res.status_code == 200
    assert publish_res.json()["status"] == "published"


@pytest.mark.asyncio
async def test_invalid_status_transitions_are_rejected(async_client):
    """12. Test that illegal status transitions (e.g. draft directly to closed) are rejected."""
    teacher_email = "prof.transitions@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Transitions")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Attempt closing a draft exam directly (must be published first)
    close_res = await async_client.post(f"/exams/{exam_id}/close", headers=headers)
    assert close_res.status_code == 400
    assert "draft exams cannot be closed directly" in close_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_closed_exams_cannot_be_reopened(async_client):
    """13. Test that once an exam is closed, it cannot be republished or modified."""
    teacher_email = "prof.closed@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Closed")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Add matching question (100 marks)
    await async_client.post(
        f"/exams/{exam_id}/questions",
        json={
            "question_text": "Comprehensive analysis question.",
            "question_type": "long_answer",
            "marks": 100.0,
        },
        headers=headers,
    )

    # Publish exam
    pub_res = await async_client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert pub_res.status_code == 200

    # Close exam
    close_res = await async_client.post(f"/exams/{exam_id}/close", headers=headers)
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"

    # Attempt republishing (must fail!)
    republish_res = await async_client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert republish_res.status_code == 400
    assert "closed exams cannot be republished" in republish_res.json()["detail"].lower()

    # Attempt adding question to closed exam (must fail!)
    add_q_res = await async_client.post(
        f"/exams/{exam_id}/questions",
        json={"question_text": "Late question", "question_type": "short_answer", "marks": 5.0},
        headers=headers,
    )
    assert add_q_res.status_code == 400


@pytest.mark.asyncio
async def test_draft_deletion_works_correctly(async_client):
    """14. Test that draft exams can be deleted, while published exams cannot be deleted."""
    teacher_email = "prof.deletion@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Deletion")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Draft exam deletion
    exam1 = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    id1 = exam1.json()["id"]

    del_res1 = await async_client.delete(f"/exams/{id1}", headers=headers)
    assert del_res1.status_code == 200
    # Confirm it no longer exists
    check_res = await async_client.get(f"/exams/{id1}", headers=headers)
    assert check_res.status_code == 404

    # 2. Published exam deletion rejected
    exam2 = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    id2 = exam2.json()["id"]
    await async_client.post(
        f"/exams/{id2}/questions",
        json={"question_text": "Q1", "question_type": "short_answer", "marks": 100.0},
        headers=headers,
    )
    await async_client.post(f"/exams/{id2}/publish", headers=headers)

    del_res2 = await async_client.delete(f"/exams/{id2}", headers=headers)
    assert del_res2.status_code == 400
    assert "only draft exams can be deleted" in del_res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_question_reordering_workflow(async_client):
    """15. Test question reordering sequence updates display order."""
    teacher_email = "prof.reorder@university.edu"
    await create_test_user(teacher_email, "teacher", "Professor Reorder")
    token = await get_auth_token(async_client, teacher_email)
    headers = {"Authorization": f"Bearer {token}"}

    exam_res = await async_client.post("/exams", json=get_sample_exam_payload(), headers=headers)
    exam_id = exam_res.json()["id"]

    # Add Q1, Q2, Q3
    q1 = (await async_client.post(f"/exams/{exam_id}/questions", json={"question_text": "Q1", "question_type": "short_answer", "marks": 10.0}, headers=headers)).json()["id"]
    q2 = (await async_client.post(f"/exams/{exam_id}/questions", json={"question_text": "Q2", "question_type": "short_answer", "marks": 20.0}, headers=headers)).json()["id"]
    q3 = (await async_client.post(f"/exams/{exam_id}/questions", json={"question_text": "Q3", "question_type": "short_answer", "marks": 30.0}, headers=headers)).json()["id"]

    # Reorder to Q3, Q1, Q2
    reorder_res = await async_client.put(
        f"/exams/{exam_id}/questions/reorder",
        json={"question_ids": [q3, q1, q2]},
        headers=headers,
    )
    assert reorder_res.status_code == 200
    reordered_list = reorder_res.json()
    assert reordered_list[0]["id"] == q3
    assert reordered_list[0]["order"] == 1
    assert reordered_list[1]["id"] == q1
    assert reordered_list[1]["order"] == 2
    assert reordered_list[2]["id"] == q2
    assert reordered_list[2]["order"] == 3
