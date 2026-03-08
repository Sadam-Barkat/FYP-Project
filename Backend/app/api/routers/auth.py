from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import jwt

from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from app.schemas.user import UserLogin, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# This is used for OpenAPI swagger docs and future dependency injection
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post("/login", response_model=TokenResponse)
async def login(
    user_credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    # 1. Query user by email
    query = select(User).where(User.email == user_credentials.email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # 2. Check existence and password
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Hybrid migration: Auto-hash plain text passwords for ALL roles (including admin)
    if not (user.hashed_password.startswith("$2b$") or user.hashed_password.startswith("$2a$")):
        # Hash the raw password and update the DB row
        hashed = get_password_hash(user_credentials.password)
        user.hashed_password = hashed
        db.add(user)
        await db.commit()

    # 4. Generate JWT
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "first_name": user.first_name,
            "last_name": user.last_name
        }
    }

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Dependency to retrieve the current logged-in user using the JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    query = select(User).where(User.id == int(user_id))
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    return user
