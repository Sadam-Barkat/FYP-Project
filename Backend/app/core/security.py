import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

load_dotenv()

# JWT Config
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-for-dev-only")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hashes a plain text password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Hybrid verification for transition period:
    If the stored password starts with the bcrypt prefix ($2b$ or $2a$), use passlib.
    Otherwise, fall back to plain-text comparison.
    """
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        return pwd_context.verify(plain_password, hashed_password)
    else:
        # Legacy plain text comparison
        return plain_password == hashed_password

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Generates a JWT token containing user identity and role."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
