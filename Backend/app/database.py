import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the async database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create Async Engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

# Create Async Session Factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Dependency to get DB session
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
