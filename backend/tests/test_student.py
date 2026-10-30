import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient


async def create_user_and_get_token(client: AsyncClient, name: str, email: str, role: str = "student") -> dict:
    """Helper to create a user with specified role and return auth headers and user doc."""
    # Register via regular endpoint (defaults to student)
    reg_res = await client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "SecurePassword123!"},
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()

    # If teacher role is requested, elevate directly in DB
    if role == "teacher":
        from app.database.mongodb import db_manager
        await db_manager.db.users.update_one(
            {"email": email.lower().strip()},
            {"$set": {"role": "teacher"}},
        )

    # Login to acquire token
    login_res = await client.post(
        "/auth/login",
        json={"email": email, "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    return {"user": user_data, "headers": headers, "token": token}


async def setup_test_exam(
    client: AsyncClient,
    teacher_headers: dict,
    start_offset_minutes: int = -10,
    end_offset_minutes: int = 120,
    publish: bool = True,
    duration_minutes: int = 60,
    total_marks: float = 20.0,
) -> dict:
    """Helper to create an exam with questions and optionally publish it."""
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(minutes=start_offset_minutes)
    end_time = now + timedelta(minutes=end_offset_minutes)

    create_res = await client.post(
        "/exams",
        headers=teacher_headers,
        json={
            "title": "Computer Architecture Midterm",
            "subject": "Computer Science",
            "description": "Standard term examination",
            "duration_minutes": duration_minutes,
            "total_marks": total_marks,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        },
    )
    assert create_res.status_code == 201
    exam = create_res.json()
    exam_id = exam["id"]

    # Add MCQ question (10 marks)
    q1_res = await client.post(
        f"/exams/{exam_id}/questions",
        headers=teacher_headers,
        json={
            "question_text": "What is the primary role of the ALU?",
            "question_type": "mcq",
            "marks": 10.0,
            "options": ["Arithmetic operations", "Graphics rendering", "Power management", "Network routing"],
            "correct_answer": "Arithmetic operations",
            "expected_answer": "Arithmetic operations perform core calculations.",
        },
    )
    assert q1_res.status_code == 201
    q1 = q1_res.json()

    # Add Short Answer question (10 marks)
    q2_res = await client.post(
        f"/exams/{exam_id}/questions",
        headers=teacher_headers,
        json={
            "question_text": "Explain the difference between Harvard and von Neumann architecture.",
            "question_type": "short_answer",
            "marks": 10.0,
            "expected_answer": "Harvard separates bus for code and data, von Neumann shares.",
        },
    )
    assert q2_res.status_code == 201
    q2 = q2_res.json()

    if publish:
        pub_res = await client.post(f"/exams/{exam_id}/publish", headers=teacher_headers)
        assert pub_res.status_code == 200
        exam = pub_res.json()

    return {"exam": exam, "exam_id": exam_id, "questions": [q1, q2]}


@pytest.mark.asyncio
async def test_student_can_view_published_exams(async_client: AsyncClient):
    """1. Student can view published exams."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    await setup_test_exam(async_client, teacher["headers"], publish=True)

    res = await async_client.get("/student/exams", headers=student["headers"])
    assert res.status_code == 200
    exams = res.json()
    assert len(exams) >= 1
    assert exams[0]["title"] == "Computer Architecture Midterm"
    assert exams[0]["subject"] == "Computer Science"
    assert exams[0]["teacher_name"] == "Prof Smith"
    assert exams[0]["is_available"] is True


@pytest.mark.asyncio
async def test_student_cannot_view_draft_exams(async_client: AsyncClient):
    """2. Student cannot view draft exams."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"], publish=False)
    draft_exam_id = setup_data["exam_id"]

    # In exam list: draft exam is omitted
    res = await async_client.get("/student/exams", headers=student["headers"])
    assert res.status_code == 200
    exams = res.json()
    assert all(e["id"] != draft_exam_id for e in exams)

    # In direct detail lookup: draft exam returns 404
    detail_res = await async_client.get(f"/student/exams/{draft_exam_id}", headers=student["headers"])
    assert detail_res.status_code == 404


@pytest.mark.asyncio
async def test_student_cannot_start_an_exam_before_its_start_time(async_client: AsyncClient):
    """3. Student cannot start an exam before its start time."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    # Exam scheduled to start in 2 hours
    setup_data = await setup_test_exam(async_client, teacher["headers"], start_offset_minutes=120, end_offset_minutes=240)
    exam_id = setup_data["exam_id"]

    res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert res.status_code == 400
    assert "not started yet" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_student_cannot_start_an_expired_exam(async_client: AsyncClient):
    """4. Student cannot start an expired exam."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    # Exam that ended 10 minutes ago
    setup_data = await setup_test_exam(async_client, teacher["headers"], start_offset_minutes=-120, end_offset_minutes=-10)
    exam_id = setup_data["exam_id"]

    res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert res.status_code == 400
    assert "ended" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_student_can_start_an_eligible_exam(async_client: AsyncClient):
    """5. Student can start an eligible exam."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"], start_offset_minutes=-10, end_offset_minutes=120)
    exam_id = setup_data["exam_id"]

    res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert res.status_code == 200
    attempt = res.json()
    assert attempt["exam_id"] == exam_id
    assert attempt["status"] == "in_progress"
    assert attempt["remaining_seconds"] > 0
    assert attempt["remaining_seconds"] <= 60 * 60


@pytest.mark.asyncio
async def test_student_can_resume_an_existing_active_attempt(async_client: AsyncClient):
    """6. Student can resume an existing active attempt."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]

    # Start first time
    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert start_res.status_code == 200
    attempt_id = start_res.json()["id"]

    # Call start again (resuming)
    resume_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert resume_res.status_code == 200
    resumed = resume_res.json()
    assert resumed["id"] == attempt_id
    assert resumed["status"] == "in_progress"


@pytest.mark.asyncio
async def test_student_cannot_access_another_students_attempt(async_client: AsyncClient):
    """7. Student cannot access another student's attempt."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    alice = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")
    bob = await create_user_and_get_token(async_client, "Bob Student", "bob@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]

    # Alice starts attempt
    alice_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=alice["headers"])
    attempt_id = alice_res.json()["id"]

    # Bob tries to view Alice's attempt
    bob_view = await async_client.get(f"/student/attempts/{attempt_id}", headers=bob["headers"])
    assert bob_view.status_code == 403

    # Bob tries to view questions using Alice's attempt_id
    bob_q = await async_client.get(f"/student/attempts/{attempt_id}/questions", headers=bob["headers"])
    assert bob_q.status_code == 403

    # Bob tries to save an answer to Alice's attempt
    q_id = setup_data["questions"][0]["id"]
    bob_save = await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q_id}",
        headers=bob["headers"],
        json={"draft_response": "Malicious answer"},
    )
    assert bob_save.status_code == 403


@pytest.mark.asyncio
async def test_answers_are_saved_to_mongodb(async_client: AsyncClient):
    """8. Answers are saved to MongoDB."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]
    q1_id = setup_data["questions"][0]["id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    save_res = await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Arithmetic operations"},
    )
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["draft_response"] == "Arithmetic operations"
    assert saved["question_id"] == q1_id

    # Verify directly from database
    from app.database.mongodb import db_manager
    from bson import ObjectId
    doc = await db_manager.db.exam_attempts.find_one({"_id": ObjectId(attempt_id)})
    assert doc is not None
    assert q1_id in doc["answers"]
    assert doc["answers"][q1_id]["draft_response"] == "Arithmetic operations"


@pytest.mark.asyncio
async def test_autosaved_answers_remain_unconfirmed(async_client: AsyncClient):
    """9. Autosaved answers remain unconfirmed."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]
    q1_id = setup_data["questions"][0]["id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    save_res = await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Arithmetic operations"},
    )
    assert save_res.status_code == 200
    answer_data = save_res.json()
    assert answer_data["is_confirmed"] is False
    assert answer_data["confirmed_response"] is None


@pytest.mark.asyncio
async def test_answers_persist_after_refresh(async_client: AsyncClient):
    """10. Answers persist after refresh."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]
    q1_id = setup_data["questions"][0]["id"]
    q2_id = setup_data["questions"][1]["id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    # Save answers for both questions
    await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Arithmetic operations"},
    )
    await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q2_id}",
        headers=student["headers"],
        json={"draft_response": "Harvard architecture has separate memory buses."},
    )

    # Simulate browser refresh by fetching attempt again
    refresh_res = await async_client.get(f"/student/attempts/{attempt_id}", headers=student["headers"])
    assert refresh_res.status_code == 200
    refreshed = refresh_res.json()
    assert refreshed["answers"][q1_id]["draft_response"] == "Arithmetic operations"
    assert refreshed["answers"][q2_id]["draft_response"] == "Harvard architecture has separate memory buses."
    assert refreshed["answered_count"] == 2


@pytest.mark.asyncio
async def test_timer_remains_consistent_after_refresh(async_client: AsyncClient):
    """11. Timer remains consistent after refresh."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"], duration_minutes=30)
    exam_id = setup_data["exam_id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt = start_res.json()
    attempt_id = attempt["id"]
    initial_remaining = attempt["remaining_seconds"]

    # Fetch attempt again (refresh)
    get_res = await async_client.get(f"/student/attempts/{attempt_id}", headers=student["headers"])
    second_remaining = get_res.json()["remaining_seconds"]

    # Both values reflect authoritative server deadline, difference should be tiny (<= 2 seconds)
    assert abs(initial_remaining - second_remaining) <= 2


@pytest.mark.asyncio
async def test_expired_attempts_cannot_continue(async_client: AsyncClient):
    """12. Expired attempts cannot continue."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]
    q1_id = setup_data["questions"][0]["id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    # Manually backdate the attempt deadline in MongoDB to simulate expiration
    from app.database.mongodb import db_manager
    from bson import ObjectId
    past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    await db_manager.db.exam_attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {"$set": {"deadline": past_time}},
    )

    # Attempting to save an answer after deadline must fail with 400
    save_res = await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Too late response"},
    )
    assert save_res.status_code == 400
    assert "deadline has passed" in save_res.json()["detail"].lower()

    # Attempting to resume after expiration must fail
    resume_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    assert resume_res.status_code == 400
    assert "expired" in resume_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_students_cannot_modify_answers_after_submission(async_client: AsyncClient):
    """13. Students cannot modify answers after submission."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]
    q1_id = setup_data["questions"][0]["id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    # Save initial answer
    await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Initial Answer"},
    )

    # Submit exam
    sub_res = await async_client.post(f"/student/attempts/{attempt_id}/submit", headers=student["headers"])
    assert sub_res.status_code == 200

    # Try modifying answer post-submission
    edit_res = await async_client.put(
        f"/student/attempts/{attempt_id}/answers/{q1_id}",
        headers=student["headers"],
        json={"draft_response": "Modified After Submit"},
    )
    assert edit_res.status_code == 400
    assert "submitted" in edit_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_submissions_are_prevented(async_client: AsyncClient):
    """14. Duplicate submissions are prevented."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    # Submit first time
    sub1 = await async_client.post(f"/student/attempts/{attempt_id}/submit", headers=student["headers"])
    assert sub1.status_code == 200

    # Submit second time
    sub2 = await async_client.post(f"/student/attempts/{attempt_id}/submit", headers=student["headers"])
    assert sub2.status_code == 400
    assert "already" in sub2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_teacher_apis_remain_protected(async_client: AsyncClient):
    """15. Teacher APIs remain protected from student access, and student APIs from teacher access."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    # Student cannot create exam
    now = datetime.now(timezone.utc)
    res1 = await async_client.post(
        "/exams",
        headers=student["headers"],
        json={
            "title": "Hacked Exam",
            "subject": "Security",
            "duration_minutes": 60,
            "total_marks": 50,
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(hours=2)).isoformat(),
        },
    )
    assert res1.status_code == 403

    # Student cannot list teacher exams
    res2 = await async_client.get("/exams", headers=student["headers"])
    assert res2.status_code == 403

    # Teacher cannot call student examination APIs
    res3 = await async_client.get("/student/exams", headers=teacher["headers"])
    assert res3.status_code == 403


@pytest.mark.asyncio
async def test_mcq_correct_answers_and_evaluation_guidance_are_hidden_from_students(async_client: AsyncClient):
    """Verify security constraint: MCQ correct answers and expected answers are never leaked to students."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof@university.edu", "teacher")
    student = await create_user_and_get_token(async_client, "Alice Student", "alice@university.edu", "student")

    setup_data = await setup_test_exam(async_client, teacher["headers"])
    exam_id = setup_data["exam_id"]

    start_res = await async_client.post(f"/student/exams/{exam_id}/start", headers=student["headers"])
    attempt_id = start_res.json()["id"]

    q_res = await async_client.get(f"/student/attempts/{attempt_id}/questions", headers=student["headers"])
    assert q_res.status_code == 200
    questions = q_res.json()
    assert len(questions) == 2

    for q in questions:
        # Check that forbidden fields are absent or null
        assert "correct_answer" not in q or q.get("correct_answer") is None
        assert "expected_answer" not in q or q.get("expected_answer") is None
        # Verify valid public fields exist
        assert "question_text" in q
        assert "marks" in q
        assert "question_type" in q


@pytest.mark.asyncio
async def test_student_default_accessibility_preferences(async_client: AsyncClient):
    """Verify sensible defaults are returned when no custom preferences exist."""
    student = await create_user_and_get_token(async_client, "Alice Student", "alice_pref@university.edu", "student")

    res = await async_client.get("/student/preferences", headers=student["headers"])
    assert res.status_code == 200
    pref = res.json()
    assert pref["font_size"] == "medium"
    assert pref["high_contrast"] is False
    assert pref["speech_enabled"] is True
    assert pref["speech_rate"] == 1.0
    assert pref["speech_volume"] == 1.0
    assert pref["auto_read_questions"] is False
    assert pref["preferred_input_method"] == "keyboard"


@pytest.mark.asyncio
async def test_student_can_update_accessibility_preferences(async_client: AsyncClient):
    """Verify student can customize and persist speech, font, contrast, and input preferences."""
    student = await create_user_and_get_token(async_client, "Alice Student", "alice_pref2@university.edu", "student")

    update_payload = {
        "font_size": "large",
        "high_contrast": True,
        "speech_enabled": True,
        "speech_rate": 1.25,
        "speech_volume": 0.8,
        "preferred_voice": "Google UK English Female",
        "auto_read_questions": True,
        "preferred_input_method": "keyboard",
    }

    put_res = await async_client.put(
        "/student/preferences",
        headers=student["headers"],
        json=update_payload,
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["font_size"] == "large"
    assert updated["high_contrast"] is True
    assert updated["speech_rate"] == 1.25
    assert updated["speech_volume"] == 0.8
    assert updated["preferred_voice"] == "Google UK English Female"
    assert updated["auto_read_questions"] is True

    # Verify directly from MongoDB
    from app.database.mongodb import db_manager
    doc = await db_manager.db.student_preferences.find_one({"student_id": student["user"]["id"]})
    assert doc is not None
    assert doc["font_size"] == "large"
    assert doc["high_contrast"] is True

    # Verify subsequent GET returns the persisted preferences
    get_res = await async_client.get("/student/preferences", headers=student["headers"])
    assert get_res.status_code == 200
    assert get_res.json()["font_size"] == "large"
    assert get_res.json()["high_contrast"] is True


@pytest.mark.asyncio
async def test_accessibility_preferences_isolation_between_students(async_client: AsyncClient):
    """Verify Student A's preferences do not leak or overwrite Student B's preferences."""
    alice = await create_user_and_get_token(async_client, "Alice Student", "alice_iso@university.edu", "student")
    bob = await create_user_and_get_token(async_client, "Bob Student", "bob_iso@university.edu", "student")

    # Alice sets extra-large and high contrast
    await async_client.put(
        "/student/preferences",
        headers=alice["headers"],
        json={"font_size": "extra-large", "high_contrast": True},
    )

    # Bob's preferences should remain default
    bob_res = await async_client.get("/student/preferences", headers=bob["headers"])
    assert bob_res.status_code == 200
    bob_pref = bob_res.json()
    assert bob_pref["font_size"] == "medium"
    assert bob_pref["high_contrast"] is False


@pytest.mark.asyncio
async def test_invalid_accessibility_preference_values_are_rejected(async_client: AsyncClient):
    """Verify schema bounds validation (rate 0.5-2.0, volume 0.0-1.0, valid font enum)."""
    student = await create_user_and_get_token(async_client, "Alice Student", "alice_val@university.edu", "student")

    # Invalid speech rate (> 2.0)
    res1 = await async_client.put(
        "/student/preferences",
        headers=student["headers"],
        json={"speech_rate": 3.5},
    )
    assert res1.status_code == 422

    # Invalid volume (< 0.0)
    res2 = await async_client.put(
        "/student/preferences",
        headers=student["headers"],
        json={"speech_volume": -0.5},
    )
    assert res2.status_code == 422

    # Invalid font size string
    res3 = await async_client.put(
        "/student/preferences",
        headers=student["headers"],
        json={"font_size": "gigantic"},
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_unauthenticated_and_teacher_cannot_access_student_preferences(async_client: AsyncClient):
    """Verify endpoint authentication and role guards."""
    teacher = await create_user_and_get_token(async_client, "Prof Smith", "prof_pref@university.edu", "teacher")

    # Unauthenticated request
    unauth_res = await async_client.get("/student/preferences")
    assert unauth_res.status_code == 401

    # Teacher request
    teacher_res = await async_client.get("/student/preferences", headers=teacher["headers"])
    assert teacher_res.status_code == 403
