import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
import pymongo.errors

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
)

logger = logging.getLogger("indexa.auth_service")


async def register_student(
    db: AsyncIOMotorDatabase,
    register_in: UserRegisterRequest,
) -> UserResponse:
    """
    Register a new student account.
    Enforces case-insensitive email uniqueness and mandatory student role.
    """
    normalized_email = register_in.email.strip().lower()

    # Pre-check email existence (case-insensitive)
    existing_user = await db.users.find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    now = datetime.now(timezone.utc)
    hashed_pwd = hash_password(register_in.password)

    user_document = {
        "name": register_in.name.strip(),
        "email": normalized_email,
        "hashed_password": hashed_pwd,
        "role": "student",  # Critical: Public registration is always student role
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await db.users.insert_one(user_document)
    except pymongo.errors.DuplicateKeyError:
        # Protect against race conditions on concurrent registration attempts
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    logger.info("Registered new student account with id: %s", result.inserted_id)

    return UserResponse(
        id=str(result.inserted_id),
        name=user_document["name"],
        email=user_document["email"],
        role=user_document["role"],
        is_active=user_document["is_active"],
        created_at=user_document["created_at"],
        updated_at=user_document["updated_at"],
    )


async def authenticate_user(
    db: AsyncIOMotorDatabase,
    login_in: UserLoginRequest,
) -> TokenResponse:
    """
    Authenticate a user by email and password, issuing a signed JWT access token.
    Uses safe error messages to prevent email enumeration attacks.
    """
    normalized_email = login_in.email.strip().lower()

    user = await db.users.find_one({"email": normalized_email})

    # Timing-resistant verification: verify even if user is not found to deter timing attacks
    if not user or not verify_password(login_in.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact support.",
        )

    user_id = str(user["_id"])
    role = user.get("role", "student")

    access_token = create_access_token(
        subject=user_id,
        role=role,
    )

    user_profile = UserResponse(
        id=user_id,
        name=user["name"],
        email=user["email"],
        role=role,
        is_active=user.get("is_active", True),
        created_at=user.get("created_at", datetime.now(timezone.utc)),
        updated_at=user.get("updated_at", datetime.now(timezone.utc)),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_profile,
    )


async def get_user_by_id(
    db: AsyncIOMotorDatabase,
    user_id: str,
) -> Optional[Dict[str, Any]]:
    """Retrieve raw user document by ID, safely handling invalid ObjectIds."""
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None

    return await db.users.find_one({"_id": oid})


async def seed_teacher_account(
    db: AsyncIOMotorDatabase,
) -> Dict[str, Any]:
    """
    Controlled seed command for creating a development/initial teacher account.
    Reads credentials strictly from environment variables and validates safety flags.
    """
    if not settings.ALLOW_SEED_TEACHER:
        raise PermissionError(
            "Teacher seeding is disabled. Set ALLOW_SEED_TEACHER=true in your environment to permit execution."
        )

    if not settings.TEACHER_SEED_EMAIL or not settings.TEACHER_SEED_PASSWORD:
        raise ValueError(
            "TEACHER_SEED_EMAIL and TEACHER_SEED_PASSWORD must be configured in environment variables."
        )

    if len(settings.TEACHER_SEED_PASSWORD) < 8:
        raise ValueError("TEACHER_SEED_PASSWORD must be at least 8 characters.")

    normalized_email = settings.TEACHER_SEED_EMAIL.strip().lower()
    teacher_name = (settings.TEACHER_SEED_NAME or "Faculty Administrator").strip()

    existing = await db.users.find_one({"email": normalized_email})
    now = datetime.now(timezone.utc)
    hashed_pwd = hash_password(settings.TEACHER_SEED_PASSWORD)

    if existing:
        logger.info("Teacher account already exists. Updating credentials for: %s", normalized_email)
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": teacher_name,
                    "hashed_password": hashed_pwd,
                    "role": "teacher",
                    "is_active": True,
                    "updated_at": now,
                }
            },
        )
        return {
            "status": "updated",
            "email": normalized_email,
            "role": "teacher",
            "id": str(existing["_id"]),
        }
    else:
        new_teacher = {
            "name": teacher_name,
            "email": normalized_email,
            "hashed_password": hashed_pwd,
            "role": "teacher",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        res = await db.users.insert_one(new_teacher)
        logger.info("Successfully seeded new teacher account with id: %s", res.inserted_id)
        return {
            "status": "created",
            "email": normalized_email,
            "role": "teacher",
            "id": str(res.inserted_id),
        }
