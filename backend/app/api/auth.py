import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.database.mongodb import get_database
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
)
from app.services.auth_service import (
    register_student,
    authenticate_user,
)
from app.api.deps import get_current_user, require_role

logger = logging.getLogger("indexa.api.auth")
router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, description="Prohibited field for profile updates")


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
    description="Registers a new student account. Public registration strictly assigns the 'student' role.",
)
async def register(
    register_in: UserRegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Register a new student account."""
    return await register_student(db, register_in)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue JWT",
    description="Authenticates credentials and returns a signed JWT token with user metadata.",
)
async def login(
    login_in: UserLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Authenticate with email and password."""
    return await authenticate_user(db, login_in)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description="Retrieves the profile of the currently authenticated user.",
)
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id=str(current_user["_id"]),
        name=current_user["name"],
        email=current_user["email"],
        role=current_user.get("role", "student"),
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at", datetime.now(timezone.utc)),
        updated_at=current_user.get("updated_at", datetime.now(timezone.utc)),
    )


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
    description="Updates user profile information. Role changes are strictly rejected.",
)
@router.put(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def update_my_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update user profile. Strictly rejects any attempt to alter role."""
    if update_data.role is not None and update_data.role.strip().lower() != current_user.get("role"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role cannot be modified through profile updates. Role changes require administrator intervention.",
        )

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if update_data.name:
        updates["name"] = update_data.name.strip()

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})
    updated_user = await db.users.find_one({"_id": current_user["_id"]})

    return UserResponse(
        id=str(updated_user["_id"]),
        name=updated_user["name"],
        email=updated_user["email"],
        role=updated_user.get("role", "student"),
        is_active=updated_user.get("is_active", True),
        created_at=updated_user.get("created_at", datetime.now(timezone.utc)),
        updated_at=updated_user.get("updated_at", datetime.now(timezone.utc)),
    )


@router.get(
    "/student-portal",
    summary="Protected student endpoint",
    description="Endpoint restricted to users with the 'student' role.",
)
async def student_portal(
    current_user: Dict[str, Any] = Depends(require_role("student")),
):
    """Protected student-only resource."""
    return {
        "message": f"Welcome to the student examination portal, {current_user['name']}.",
        "role": current_user.get("role"),
    }


@router.get(
    "/teacher-portal",
    summary="Protected teacher endpoint",
    description="Endpoint restricted to users with the 'teacher' role.",
)
async def teacher_portal(
    current_user: Dict[str, Any] = Depends(require_role("teacher")),
):
    """Protected teacher-only resource."""
    return {
        "message": f"Welcome to the faculty administration portal, {current_user['name']}.",
        "role": current_user.get("role"),
    }
