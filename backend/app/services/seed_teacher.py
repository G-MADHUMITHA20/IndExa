"""
Controlled CLI command to seed a teacher account from environment variables.
Run from backend directory:
    python -m app.services.seed_teacher
"""
import sys
import asyncio
import logging
from app.database.mongodb import db_manager
from app.services.auth_service import seed_teacher_account

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("indexa.seed")


async def main():
    logger.info("Initializing teacher seed operation...")
    try:
        await db_manager.connect()
        if db_manager.db is None:
            logger.error("Failed to establish connection with MongoDB.")
            sys.exit(1)

        result = await seed_teacher_account(db_manager.db)
        logger.info(
            "Teacher account successfully provisioned: %s (role: %s, id: %s)",
            result["email"],
            result["role"],
            result["id"],
        )
    except (PermissionError, ValueError) as e:
        logger.error("Safety check refused execution: %s", str(e))
        sys.exit(1)
    except Exception as e:
        logger.error("Seeding operation failed: %s", str(e))
        sys.exit(1)
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
