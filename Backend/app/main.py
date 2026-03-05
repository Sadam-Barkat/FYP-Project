from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Hospital Real-Time Dashboard Backend",
    description="Backend API for the real-time intelligent dashboard project.",
    version="1.0.0"
)

# CORS configuration (allow frontend origin later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Backend running"}
