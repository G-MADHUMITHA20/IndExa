import pytest
from datetime import timedelta
from unittest.mock import patch, AsyncMock

from app.core.security import verify_password, create_access_token
from app.database.mongodb import db_manager, MongoDBManager


@pytest.mark.asyncio
async def test_successful_student_registration(async_client):
    """1. Test successful student registration via POST /auth/register."""
    payload = {
        "name": "Jane Doe",
        "email": "jane.doe@university.edu",
        "password": "SecurePassword123!",
    }
    response = await async_client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Jane Doe"
    assert data["email"] == "jane.doe@university.edu"
    assert data["role"] == "student"
    assert data["is_active"] is True
    assert "id" in data
    # Passwords and hashes must never be exposed
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_duplicate_email_registration_rejection(async_client):
    """2. Test duplicate email registration rejection with case-insensitivity."""
    payload_original = {
        "name": "John Smith",
        "email": "john.smith@university.edu",
        "password": "Password123!",
    }
    res1 = await async_client.post("/auth/register", json=payload_original)
    assert res1.status_code == 201

    # Attempt registration with different casing of the exact same email
    payload_duplicate = {
        "name": "John Smith Duplicate",
        "email": "JOHN.SMITH@UNIVERSITY.EDU",
        "password": "DifferentPassword123!",
    }
    res2 = await async_client.post("/auth/register", json=payload_duplicate)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_email_and_missing_field_validation(async_client):
    """3. Test rejection of invalid emails and missing required fields."""
    # Invalid email format
    res_bad_email = await async_client.post(
        "/auth/register",
        json={"name": "Bad Email", "email": "not-an-email", "password": "Password123!"},
    )
    assert res_bad_email.status_code == 422

    # Missing password
    res_missing_pw = await async_client.post(
        "/auth/register",
        json={"name": "No Password", "email": "nopw@university.edu"},
    )
    assert res_missing_pw.status_code == 422

    # Short password (< 8 chars)
    res_short_pw = await async_client.post(
        "/auth/register",
        json={"name": "Short Pw", "email": "shortpw@university.edu", "password": "short"},
    )
    assert res_short_pw.status_code == 422

    # Missing name
    res_missing_name = await async_client.post(
        "/auth/register",
        json={"email": "noname@university.edu", "password": "Password123!"},
    )
    assert res_missing_name.status_code == 422


@pytest.mark.asyncio
async def test_passwords_are_stored_as_hashes_rather_than_plaintext(async_client):
    """4. Test that passwords in MongoDB are cryptographic hashes, not plaintext."""
    email = "hashed.test@university.edu"
    plain_password = "MySuperSecretPassword123!"

    reg_res = await async_client.post(
        "/auth/register",
        json={"name": "Hash Verification User", "email": email, "password": plain_password},
    )
    assert reg_res.status_code == 201

    # Directly inspect MongoDB document
    user_doc = await db_manager.db.users.find_one({"email": email})
    assert user_doc is not None
    assert "hashed_password" in user_doc
    assert user_doc["hashed_password"] != plain_password
    # Argon2 hashes begin with $argon2
    assert user_doc["hashed_password"].startswith("$argon2")
    # Verify hash decodes and matches plaintext
    assert verify_password(plain_password, user_doc["hashed_password"]) is True


@pytest.mark.asyncio
async def test_successful_login_with_valid_credentials(async_client):
    """5. Test successful login returning a valid JWT access token."""
    email = "valid.login@university.edu"
    password = "ValidPassword123!"

    await async_client.post(
        "/auth/register",
        json={"name": "Valid Login", "email": email, "password": password},
    )

    login_res = await async_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "student"


@pytest.mark.asyncio
async def test_login_failure_with_incorrect_password(async_client):
    """6. Test login failure with incorrect credentials; prevents email enumeration."""
    email = "enumeration.check@university.edu"
    password = "CorrectPassword123!"

    await async_client.post(
        "/auth/register",
        json={"name": "Enum Check", "email": email, "password": password},
    )

    # Wrong password on existing user
    res_wrong_pw = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "WrongPassword123!"},
    )
    assert res_wrong_pw.status_code == 401
    err_wrong_pw = res_wrong_pw.json()["detail"]

    # Completely non-existent email
    res_nonexistent = await async_client.post(
        "/auth/login",
        json={"email": "ghost@university.edu", "password": "RandomPassword123!"},
    )
    assert res_nonexistent.status_code == 401
    err_nonexistent = res_nonexistent.json()["detail"]

    # Both errors must be safe and identical to avoid email enumeration
    assert err_wrong_pw == "Invalid email or password."
    assert err_nonexistent == "Invalid email or password."


@pytest.mark.asyncio
async def test_auth_me_rejects_requests_without_token(async_client):
    """7. Test /auth/me rejects unauthenticated requests."""
    res = await async_client.get("/auth/me")
    assert res.status_code == 401
    assert "token is missing" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_me_rejects_invalid_or_expired_tokens(async_client):
    """8. Test /auth/me rejects malformed, invalid, or expired tokens."""
    # Malformed token
    res_bad = await async_client.get(
        "/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert res_bad.status_code == 401

    # Expired token
    expired_token = create_access_token(
        subject="64b0f0000000000000000001",
        role="student",
        expires_delta=timedelta(seconds=-10),
    )
    res_expired = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res_expired.status_code == 401
    assert "expired" in res_expired.json()["detail"].lower()


@pytest.mark.asyncio
async def test_registered_user_cannot_assign_themselves_teacher_role(async_client):
    """9. Test that public registration rejects attempts to self-assign teacher role."""
    payload = {
        "name": "Wannabe Teacher",
        "email": "fake.teacher@university.edu",
        "password": "Password123!",
        "role": "teacher",
    }
    res = await async_client.post("/auth/register", json=payload)
    # Validation strictly rejects elevated role request
    assert res.status_code == 422
    assert "elevated roles" in str(res.json()).lower()


@pytest.mark.asyncio
async def test_user_cannot_change_role_through_profile_request(async_client):
    """10. Test that an authenticated user cannot escalate their role via profile requests."""
    email = "student.privilege@university.edu"
    password = "Password123!"

    reg_res = await async_client.post(
        "/auth/register",
        json={"name": "Privilege Tester", "email": email, "password": password},
    )
    assert reg_res.status_code == 201

    login_res = await async_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to change role to teacher via PATCH /auth/me
    patch_res = await async_client.patch(
        "/auth/me",
        json={"role": "teacher"},
        headers=headers,
    )
    assert patch_res.status_code == 400
    assert "role cannot be modified" in patch_res.json()["detail"].lower()

    # Verify user in database remains student
    user_doc = await db_manager.db.users.find_one({"email": email})
    assert user_doc["role"] == "student"


@pytest.mark.asyncio
async def test_inactive_users_cannot_access_protected_endpoints(async_client):
    """11. Test that deactivated/inactive users cannot log in or access protected resources."""
    email = "deactivated.user@university.edu"
    password = "Password123!"

    reg_res = await async_client.post(
        "/auth/register",
        json={"name": "Inactive User", "email": email, "password": password},
    )
    assert reg_res.status_code == 201

    login_res = await async_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    token = login_res.json()["access_token"]

    # Deactivate user directly in database
    await db_manager.db.users.update_one(
        {"email": email},
        {"$set": {"is_active": False}},
    )

    # Login attempt must fail with 403 Forbidden
    login_again = await async_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_again.status_code == 403
    assert "deactivated" in login_again.json()["detail"].lower()

    # Accessing /auth/me with existing token must also be denied with 403
    me_res = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 403
    assert "deactivated" in me_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_existing_health_functionality_still_works(async_client):
    """12. Test that existing /health endpoint functions properly without regression."""
    res = await async_client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "service" in data
    assert "database" in data


@pytest.mark.asyncio
async def test_mongodb_connection_failures_reported_honestly(async_client):
    """13. Test that database disconnects are truthfully reported as degraded."""
    mock_manager = MongoDBManager()
    # Uninitialized client
    health_result = await mock_manager.check_health()
    assert health_result["status"] == "disconnected"
    assert "not initialized" in health_result["message"]

    # Test degraded health response when db check returns disconnected
    with patch("app.main.db_manager.check_health", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = {
            "status": "disconnected",
            "database": "indexa_db",
            "message": "Connection unreachable (ServerSelectionTimeoutError)",
        }
        res = await async_client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "degraded"
        assert data["database"]["status"] == "disconnected"


@pytest.mark.asyncio
async def test_controlled_teacher_seeding(async_client):
    """14. Test controlled teacher seeding refusing unsafe runs and working when explicitly enabled."""
    from app.core.config import settings
    from app.services.auth_service import seed_teacher_account

    # When ALLOW_SEED_TEACHER is False, execution must be refused
    settings.ALLOW_SEED_TEACHER = False
    with pytest.raises(PermissionError):
        await seed_teacher_account(db_manager.db)

    # When enabled and configured
    settings.ALLOW_SEED_TEACHER = True
    settings.TEACHER_SEED_EMAIL = "prof.smith@university.edu"
    settings.TEACHER_SEED_PASSWORD = "ProfSecurePassword123!"
    settings.TEACHER_SEED_NAME = "Professor Smith"

    seed_result = await seed_teacher_account(db_manager.db)
    assert seed_result["role"] == "teacher"
    assert seed_result["email"] == "prof.smith@university.edu"

    # Reset safety flag
    settings.ALLOW_SEED_TEACHER = False


@pytest.mark.asyncio
async def test_role_based_access_control_enforcement(async_client):
    """15. Test server-side role enforcement: students cannot access teacher-only endpoints."""
    # 1. Create a student account
    student_email = "student.rbac@university.edu"
    student_pw = "Password123!"
    await async_client.post(
        "/auth/register",
        json={"name": "RBAC Student", "email": student_email, "password": student_pw},
    )
    s_login = await async_client.post(
        "/auth/login",
        json={"email": student_email, "password": student_pw},
    )
    student_token = s_login.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 2. Directly insert teacher account into DB for RBAC verification
    from app.core.security import hash_password
    teacher_email = "teacher.rbac@university.edu"
    teacher_pw = "Password123!"
    await db_manager.db.users.insert_one({
        "name": "RBAC Teacher",
        "email": teacher_email,
        "hashed_password": hash_password(teacher_pw),
        "role": "teacher",
        "is_active": True,
    })
    t_login = await async_client.post(
        "/auth/login",
        json={"email": teacher_email, "password": teacher_pw},
    )
    teacher_token = t_login.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # Student accessing student portal -> 200 OK
    res1 = await async_client.get("/auth/student-portal", headers=student_headers)
    assert res1.status_code == 200

    # Student attempting to access teacher portal -> 403 Forbidden!
    res2 = await async_client.get("/auth/teacher-portal", headers=student_headers)
    assert res2.status_code == 403
    assert "teacher" in res2.json()["detail"].lower()

    # Teacher accessing teacher portal -> 200 OK
    res3 = await async_client.get("/auth/teacher-portal", headers=teacher_headers)
    assert res3.status_code == 200

