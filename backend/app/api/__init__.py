"""API route handlers and routers."""
from app.api.auth import router as auth_router
from app.api.exams import router as exams_router

__all__ = ["auth_router", "exams_router"]
