from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import auth

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

@app.get("/")
async def root():
    return {"message": "Backend running"}
