from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.websocket_manager import manager as ws_manager
from app.database import engine
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
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify database is reachable
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("Database connection OK.")
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

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to ["http://localhost:3000"] in production
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
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)


@app.get("/")
async def root():
    return {"message": "Backend running"}
