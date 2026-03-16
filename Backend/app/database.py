import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from fastapi import HTTPException, status
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the async database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create Async Engine
# Tuned for Neon (serverless PostgreSQL that can pause/wake).
# - connect_args timeout: give asyncpg longer to connect when Neon is waking up.
# - pool_pre_ping: recycle dead/stale connections automatically.
# - pool_recycle: periodically recycle connections even if still open.
# - pool_size / max_overflow: keep a small, stable async pool.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"timeout": 120},  # seconds for initial connect to Neon
    pool_pre_ping=True,
    pool_recycle=1800,              # 30 minutes
    pool_size=5,
    max_overflow=10,
)

# Create Async Session Factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# Dependency to get DB session with simple retry for Neon wake-up
async def get_db():
    last_error: Exception | None = None

    for attempt in range(3):
        session: AsyncSession = SessionLocal()
        try:
            # Force a lightweight query so we hit the DB immediately;
            # if Neon is waking up, this is where the timeout will happen.
            await session.execute(text("SELECT 1"))

            try:
                yield session
            finally:
                await session.close()

            return
        except (TimeoutError, asyncio.TimeoutError, OperationalError) as exc:
            await session.close()
            last_error = exc
            # Small backoff between retries while Neon wakes
            if attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))
                continue

            # After retries, surface a clear API error instead of raw traceback
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database is waking up or temporarily unavailable. Please try again in a few seconds.",
            ) from exc
        except Exception as exc:  # other unexpected errors: don't retry blindly
            await session.close()
            last_error = exc
            raise

    # Fallback: if loop exits without returning or raising (should not happen)
    if last_error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again shortly.",
        ) from last_error
