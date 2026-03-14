import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import DATABASE_URL


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=True, future=True)
    async with engine.begin() as conn:
        # Create nurse_patient_assignments table if it does not exist.
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS nurse_patient_assignments (
                    id SERIAL PRIMARY KEY,
                    nurse_id INTEGER NOT NULL REFERENCES users(id),
                    patient_id INTEGER NOT NULL REFERENCES patients(id),
                    assigned_date DATE NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP NOT NULL DEFAULT now()
                );
                """
            )
        )


if __name__ == "__main__":
    asyncio.run(main())

