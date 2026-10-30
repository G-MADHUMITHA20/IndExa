import logging
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger("indexa.database")


class MongoDBManager:
    """Manages asynchronous MongoDB connection lifecycle and client state."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None

    async def connect(self) -> None:
        """Initialize MongoDB client and target database."""
        try:
            logger.info("Initializing MongoDB connection...")
            # Use serverSelectionTimeoutMS to prevent hanging on unreachable hosts
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2500,
            )
            self.db = self.client[settings.MONGODB_DATABASE]
            # Verify connectivity immediately on startup
            await self.client.admin.command("ping")
            logger.info("Successfully connected to MongoDB database: %s", settings.MONGODB_DATABASE)
            await self._create_indexes()
        except Exception as e:
            # Report failure clearly without exposing connection credentials in logs
            logger.warning(
                "Initial MongoDB connection attempt unsuccessful (%s). Database is currently offline.",
                type(e).__name__,
            )

    async def _create_indexes(self) -> None:
        """Create necessary database indexes on startup."""
        if self.db is not None:
            try:
                # Unique index on normalized email for user accounts
                await self.db.users.create_index("email", unique=True)
                # Indexes for exams collection
                await self.db.exams.create_index([("teacher_id", 1), ("created_at", -1)])
                await self.db.exams.create_index("status")
                # Indexes for questions collection
                await self.db.questions.create_index([("exam_id", 1), ("order", 1)])
                # Indexes for exam attempts collection
                await self.db.exam_attempts.create_index([("student_id", 1), ("exam_id", 1)])
                await self.db.exam_attempts.create_index([("exam_id", 1)])
                await self.db.exam_attempts.create_index("status")
                # Indexes for student preferences collection
                await self.db.student_preferences.create_index("student_id", unique=True)
                logger.info("MongoDB collection indexes initialized successfully.")
            except Exception as e:
                logger.warning("MongoDB index initialization warning: %s", type(e).__name__)

    async def close(self) -> None:
        """Close MongoDB client connection pool."""
        if self.client:
            logger.info("Closing MongoDB connection pool...")
            self.client.close()
            self.client = None
            self.db = None
            logger.info("MongoDB connection closed.")

    async def check_health(self) -> Dict[str, Any]:
        """Perform a safe health check on the MongoDB server without exposing credentials."""
        if self.client is None:
            return {
                "status": "disconnected",
                "database": settings.MONGODB_DATABASE,
                "message": "MongoDB client is not initialized",
            }

        try:
            # Ping admin database to confirm alive connection
            await self.client.admin.command("ping")
            return {
                "status": "connected",
                "database": settings.MONGODB_DATABASE,
                "message": "Database connection verified",
            }
        except Exception as e:
            # Return truthful disconnected state; no credentials leaked
            return {
                "status": "disconnected",
                "database": settings.MONGODB_DATABASE,
                "message": f"Connection unreachable ({type(e).__name__})",
            }


db_manager = MongoDBManager()


def get_database() -> AsyncIOMotorDatabase:
    """Dependency helper to get database handle."""
    if db_manager.db is None:
        raise RuntimeError("Database is not connected.")
    return db_manager.db
