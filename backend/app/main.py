import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.mongodb import db_manager
from app.api.auth import router as auth_router
from app.api.exams import router as exams_router
from app.api.student import router as student_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("indexa.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to handle startup and shutdown events cleanly."""
    logger.info("Starting up %s (v%s)...", settings.PROJECT_NAME, settings.VERSION)
    await db_manager.connect()
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)
    await db_manager.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="IndExa — Accessible Digital Examination Platform Backend API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication and user endpoints
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"], include_in_schema=False)

# Exam and question management endpoints (Teacher only)
app.include_router(exams_router, prefix="/exams", tags=["Exam Management"])
app.include_router(exams_router, prefix=f"{settings.API_V1_STR}/exams", tags=["Exam Management"], include_in_schema=False)

# Student examination and attempt endpoints (Student only)
app.include_router(student_router, prefix="/student", tags=["Student Examination"])
app.include_router(student_router, prefix=f"{settings.API_V1_STR}/student", tags=["Student Examination"], include_in_schema=False)


@app.get("/", tags=["Root"])
async def root():
    """Welcome endpoint providing core service metadata."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint reporting application and database connectivity.
    Does not expose sensitive credentials. Truthfully reports database status.
    """
    db_health = await db_manager.check_health()
    is_db_connected = db_health.get("status") == "connected"

    overall_status = "healthy" if is_db_connected else "degraded"

    payload = {
        "status": overall_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_health,
    }

    # Return HTTP 200 with degraded status if API is alive but DB is unreachable
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=payload,
    )
