from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import auth, overview, patients_beds, pharmacy, laboratory

app = FastAPI(
    title="Hospital Real-Time Dashboard Backend",
    description="Backend API for the real-time intelligent dashboard project.",
    version="1.0.0"
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

@app.get("/")
async def root():
    return {"message": "Backend running"}
