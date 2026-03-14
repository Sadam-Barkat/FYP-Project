from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import jwt

from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from app.schemas.user import UserLogin, TokenResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.utils.password_reset_email import send_password_reset_email, validate_password_reset_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# This is used for OpenAPI swagger docs and future dependency injection
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post("/login", response_model=TokenResponse)
async def login(
    user_credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    # 1. Query user by email (case-insensitive)
    email_clean = (user_credentials.email or "").strip().lower()
    query = select(User).where(func.lower(User.email) == email_clean)
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


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    If a user with this email exists, send a password reset link. Always return the same message
    to avoid revealing whether the email is registered.
    """
    query = select(User).where(func.lower(User.email) == body.email.strip().lower())
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user:
        try:
            await send_password_reset_email(body.email)
        except Exception:
            pass  # Don't reveal failure; still return generic message
    return {"message": "If an account exists with this email, you will receive a link to reset your password. Please check your inbox."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validate reset token and set new password."""
    email = validate_password_reset_token(body.token)
    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")
    query = select(User).where(func.lower(User.email) == email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")
    user.hashed_password = get_password_hash(body.new_password)
    db.add(user)
    await db.commit()
    return {"message": "Password has been reset. You can now sign in."}


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
