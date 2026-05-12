import asyncio
import os
import sys
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/data-entry", tags=["Data Entry"])

class SeedDailyRequest(BaseModel):
    days_back: int = 0
    data_types: list[str] = ["all"]

async def run_script(script_path: str, *args):
    """Helper to run python script as a subprocess"""
    if not os.path.exists(script_path):
        raise HTTPException(status_code=500, detail=f"Script not found at {script_path}")
    
    cmd = [sys.executable, script_path] + list(args)
    
    # We need to make sure the process has the right PYTHONPATH and DATABASE_URL
    env = os.environ.copy()
    
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )
    
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        error_msg = stderr.decode('utf-8') if stderr else stdout.decode('utf-8')
        raise HTTPException(status_code=500, detail=f"Script execution failed:\n{error_msg}")
        
    return stdout.decode('utf-8')

@router.post("/seed-daily")
async def seed_daily(req: SeedDailyRequest):
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".hidden_scripts", "seed_daily_data.py")
    types_arg = ",".join(req.data_types) if req.data_types else "all"
    output = await run_script(script_path, "--days-back", str(req.days_back), "--data-types", types_arg)
    return {"status": "success", "message": "Daily data generated successfully.", "output": output}

@router.post("/seed-overall")
async def seed_overall():
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".hidden_scripts", "seed_hospital_data.py")
    # For full seed, we may want to give unbuffered output flag if needed, but here it's fine.
    output = await run_script(script_path)
    return {"status": "success", "message": "Complete hospital data generated successfully.", "output": output}
