import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from httpx import AsyncClient, ASGITransport

from app.core.config import settings
from app.database.mongodb import db_manager
from app.main import app

# Use dedicated isolated test database
TEST_DB_NAME = "indexa_test_db"
settings.MONGODB_DATABASE = TEST_DB_NAME
settings.JWT_SECRET_KEY = "test-secret-key-for-unit-testing-min-32-chars-long"


@pytest.fixture(autouse=True)
async def setup_test_database():
    """
    Ensure each test runs with a fresh database connection attached
    to the active test event loop, preventing event loop mismatch errors.
    """
    await db_manager.close()
    await db_manager.connect()
    if db_manager.client:
        await db_manager.client.drop_database(TEST_DB_NAME)
        await db_manager.db.users.create_index("email", unique=True)
        await db_manager.db.exam_attempts.create_index([("student_id", 1), ("exam_id", 1)])
        await db_manager.db.student_preferences.create_index("student_id", unique=True)

    yield

    if db_manager.client:
        await db_manager.client.drop_database(TEST_DB_NAME)
    await db_manager.close()


@pytest.fixture
async def async_client():
    """Provide an HTTPX AsyncClient for FastAPI application testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client
