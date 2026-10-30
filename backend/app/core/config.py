from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    PROJECT_NAME: str = "IndExa Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # MongoDB configuration (strictly from MONGODB_URI & MONGODB_DATABASE)
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "indexa_db"

    # Allowed CORS Origins for frontend integration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # JWT Authentication configuration
    JWT_SECRET_KEY: str = "change-this-to-a-secure-random-secret-key-in-production-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Controlled Teacher Account Seeding configuration
    ALLOW_SEED_TEACHER: bool = False
    TEACHER_SEED_NAME: Optional[str] = "Faculty Administrator"
    TEACHER_SEED_EMAIL: Optional[str] = "teacher@indexa.edu"
    TEACHER_SEED_PASSWORD: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [str(v)]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
