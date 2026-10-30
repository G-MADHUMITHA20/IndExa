from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


class UserRegisterRequest(BaseModel):
    """Schema for public user registration. Public registration strictly creates students."""
    name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    email: EmailStr = Field(..., description="Valid institutional or personal email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password minimum 8 characters")
    role: Optional[str] = Field(None, description="Role assignment (prohibited for public registration)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("Name must be at least 2 characters after trimming.")
        return trimmed

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("role")
    @classmethod
    def reject_elevated_role(cls, v: Optional[str]) -> str:
        """Reject any attempt to request an elevated role on public registration."""
        if v is not None:
            normalized = v.strip().lower()
            if normalized != "student":
                raise ValueError("Self-assigning elevated roles is strictly prohibited. Public registration is restricted to students.")
        return "student"


class UserLoginRequest(BaseModel):
    """Schema for authenticating existing users."""
    email: EmailStr = Field(..., description="User's registered email address")
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("email")
    @classmethod
    def normalize_login_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    """Safe public representation of user profile. Never exposes hashed passwords."""
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Token response returned upon successful authentication."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
