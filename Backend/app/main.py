from pathlib import Path

from dotenv import load_dotenv

# Load Backend/.env explicitly so local runs work regardless of shell cwd.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy import text, select, func

from app.core.ops_openai_settings import openai_api_key_configured
from app.core.websocket_manager import manager as ws_manager
from app.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api.routers import (
    auth,
    overview,
    patients_beds,
    pharmacy,
    laboratory,
    laboratorian,
    receptionist,
    nurse,
    doctor,
    billing_finance,
    hr_staff,
    alerts_overview,
    analytics_forecasts,
    export_pdf,
    ops_copilot,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify database is reachable
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("Database connection OK.")
        print(
            "Ops Copilot OPENAI_API_KEY visible to this process:",
            "yes" if openai_api_key_configured() else "no",
        )

        # Optional production-safe seeding for deployments:
        # If you deploy against a fresh Neon database (no local seed data),
        # login will return "Invalid email or password" because the user row doesn't exist.
        # Set these env vars on Render to auto-create (only if missing):
        # - SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
        # - (optional) SEED_DOCTOR_EMAIL, SEED_DOCTOR_PASSWORD
        # - (optional) SEED_NURSE_EMAIL, SEED_NURSE_PASSWORD
        seed_admin_email = (os.getenv("SEED_ADMIN_EMAIL") or "").strip().lower()
        seed_admin_password = (os.getenv("SEED_ADMIN_PASSWORD") or "").strip()
        seed_doctor_email = (os.getenv("SEED_DOCTOR_EMAIL") or "").strip().lower()
        seed_doctor_password = (os.getenv("SEED_DOCTOR_PASSWORD") or "").strip()
        seed_nurse_email = (os.getenv("SEED_NURSE_EMAIL") or "").strip().lower()
        seed_nurse_password = (os.getenv("SEED_NURSE_PASSWORD") or "").strip()

        async with SessionLocal() as db:
            async def ensure_user(email: str, password: str, role: UserRole, first: str, last: str) -> None:
                if not email or not password:
                    return
                r = await db.execute(select(User).where(func.lower(User.email) == email))
                existing = r.scalar_one_or_none()
                if existing:
                    return
                db.add(
                    User(
                        email=email,
                        hashed_password=get_password_hash(password),
                        role=role,
                        first_name=first,
                        last_name=last,
                        is_active=True,
                    )
                )

            await ensure_user(seed_admin_email, seed_admin_password, UserRole.admin, "Admin", "User")
            await ensure_user(seed_doctor_email, seed_doctor_password, UserRole.doctor, "Doctor", "User")
            await ensure_user(seed_nurse_email, seed_nurse_password, UserRole.nurse, "Nurse", "User")
            await db.commit()
    except Exception as e:
        err_msg = str(e).strip()
        if "getaddrinfo" in err_msg or "11001" in err_msg:
            print("\n*** Database connection failed: cannot resolve database host (getaddrinfo failed). ***")
            print("  - Check .env: DATABASE_URL must have a valid host (e.g. your Neon host or localhost).")
            print("  - If using a cloud DB (Neon, etc.), ensure you have internet and the host is correct.")
            print("  - If using local PostgreSQL, use host=localhost in DATABASE_URL.")
        else:
            print("\n*** Database connection failed:", err_msg[:200])
        print("  Backend will start but API requests that need the DB will fail.\n")
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Hospital Real-Time Dashboard Backend",
    description="Backend API for the real-time intelligent dashboard project.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: Vercel production + preview URLs (*.vercel.app). Add custom domains via Railway:
# CORS_EXTRA_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
def _cors_allow_origins() -> list[str]:
    origins = ["https://fyp-project-livid.vercel.app"]
    extra = (os.getenv("CORS_EXTRA_ORIGINS") or "").strip()
    if extra:
        for part in extra.split(","):
            p = part.strip()
            if p:
                origins.append(p)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(overview.router)
app.include_router(patients_beds.router)
app.include_router(pharmacy.router)
app.include_router(laboratory.router)
app.include_router(laboratorian.router)
app.include_router(receptionist.router)
app.include_router(nurse.router)
app.include_router(doctor.router)
app.include_router(billing_finance.router)
app.include_router(hr_staff.router)
app.include_router(alerts_overview.router)
app.include_router(analytics_forecasts.router)
app.include_router(export_pdf.router)
app.include_router(ops_copilot.router)


@app.websocket("/ws")
async def websocket_realtime(websocket: WebSocket):
    """
    Real-time events for dashboard updates.
    Clients receive JSON messages: { "type": "laboratory_updated" | "patient_discharged" | "vital_updated" | ... }.
    Used by admin lab, nurse, doctor, and admin overview pages.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            # Keepalive for Vercel browser → Railway: reverse proxies often drop idle sockets.
            try:
                msg = json.loads(raw)
                if isinstance(msg, dict) and msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)


@app.get("/")
async def root():
    return {"message": "Backend running"}
