import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import DATABASE_URL


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=True, future=True)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS staff_invitations (
                    id SERIAL PRIMARY KEY,
                    email_lower VARCHAR(255) NOT NULL UNIQUE,
                    staff_type VARCHAR(64) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT now()
                )
                """
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
