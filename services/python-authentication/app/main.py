"""
Authentication Service - Python FastAPI
JWT authentication, user management, and role-based access control
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Boolean, select, update
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import os
import logging
import hashlib
import secrets
import jwt
from passlib.context import CryptContext
from contextlib import asynccontextmanager
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/auth_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "24h")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Database models
class Base(DeclarativeBase):
    pass

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=UserRole.USER.value)
    
    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Profile information
    organization: Mapped[Optional[str]] = mapped_column(String(255))
    department: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Security
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)
    login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "auth_audit_logs"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=100, description="Username")
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name")
    password: str = Field(..., min_length=8, description="Password")
    role: UserRole = Field(UserRole.USER, description="User role")
    organization: Optional[str] = Field(None, description="Organization")
    department: Optional[str] = Field(None, description="Department")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    email: str
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    organization: Optional[str]
    department: Optional[str]
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

# Database dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Authentication Service
class AuthenticationService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, user_id: str, username: str, role: str) -> tuple[str, int]:
        """Create JWT access token"""
        # Parse expires_in (e.g., "24h", "30m", "7d")
        expires_delta = self._parse_time_delta(JWT_EXPIRES_IN)
        expire = datetime.utcnow() + expires_delta
        
        payload = {
            "sub": user_id,
            "username": username,
            "role": role,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return token, int(expires_delta.total_seconds())
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create refresh token"""
        token = secrets.token_urlsafe(32)
        return token
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def _parse_time_delta(self, time_str: str) -> timedelta:
        """Parse time string like '24h', '30m', '7d' into timedelta"""
        if time_str.endswith('h'):
            return timedelta(hours=int(time_str[:-1]))
        elif time_str.endswith('m'):
            return timedelta(minutes=int(time_str[:-1]))
        elif time_str.endswith('d'):
            return timedelta(days=int(time_str[:-1]))
        else:
            return timedelta(hours=24)  # Default to 24 hours
    
    async def create_user(self, user_data: UserCreate) -> UserResponse:
        """Create a new user"""
        import uuid
        
        # Check if user already exists
        existing_user = await self.db.execute(
            select(User).where(
                (User.email == user_data.email) | 
                (User.username == user_data.username)
            )
        )
        
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="User with this email or username already exists"
            )
        
        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = self.hash_password(user_data.password)
        
        db_user = User(
            id=user_id,
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            role=user_data.role.value,
            organization=user_data.organization,
            department=user_data.department
        )
        
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        
        # Log user creation
        await self._log_audit_event(user_id, "user_created", f"User {user_data.username} created")
        
        logger.info(f"Created user {user_data.username} with ID {user_id}")
        return UserResponse.model_validate(db_user)
    
    async def authenticate_user(self, username: str, password: str, ip_address: str = None) -> Optional[UserResponse]:
        """Authenticate user with username/email and password"""
        # Find user by username or email
        result = await self.db.execute(
            select(User).where(
                (User.username == username) | (User.email == username)
            )
        )
        user = result.scalar_one_or_none()
        
        if not user:
            await self._log_audit_event(None, "login_failed", f"User not found: {username}", ip_address)
            return None
        
        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.utcnow():
            await self._log_audit_event(user.id, "login_blocked", "Account locked", ip_address)
            raise HTTPException(
                status_code=423,
                detail="Account is temporarily locked due to multiple failed attempts"
            )
        
        # Verify password
        if not self.verify_password(password, user.hashed_password):
            # Increment login attempts
            user.login_attempts += 1
            
            # Lock account after 5 failed attempts
            if user.login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=30)
                await self._log_audit_event(user.id, "account_locked", "Too many failed attempts", ip_address)
            
            await self.db.commit()
            await self._log_audit_event(user.id, "login_failed", "Invalid password", ip_address)
            return None
        
        # Check if user is active
        if not user.is_active:
            await self._log_audit_event(user.id, "login_failed", "Account inactive", ip_address)
            return None
        
        # Successful login - reset login attempts
        user.login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.utcnow()
        await self.db.commit()
        
        await self._log_audit_event(user.id, "login_success", "User logged in", ip_address)
        
        return UserResponse.model_validate(user)
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Get user by ID"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if user:
            return UserResponse.model_validate(user)
        return None
    
    async def update_user(self, user_id: str, user_data: UserUpdate) -> Optional[UserResponse]:
        """Update user information"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Update fields
        update_data = user_data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            await self.db.execute(
                update(User)
                .where(User.id == user_id)
                .values(**update_data)
            )
            await self.db.commit()
            await self.db.refresh(user)
        
        await self._log_audit_event(user_id, "user_updated", "User profile updated")
        
        return UserResponse.model_validate(user)
    
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """Change user password"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        # Verify current password
        if not self.verify_password(current_password, user.hashed_password):
            await self._log_audit_event(user_id, "password_change_failed", "Invalid current password")
            return False
        
        # Update password
        user.hashed_password = self.hash_password(new_password)
        user.updated_at = datetime.utcnow()
        await self.db.commit()
        
        await self._log_audit_event(user_id, "password_changed", "Password changed successfully")
        
        return True
    
    async def store_refresh_token(self, user_id: str, refresh_token: str) -> str:
        """Store refresh token in database"""
        import uuid
        
        token_id = str(uuid.uuid4())
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        expires_at = datetime.utcnow() + timedelta(days=30)  # Refresh tokens expire in 30 days
        
        db_token = RefreshToken(
            id=token_id,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at
        )
        
        self.db.add(db_token)
        await self.db.commit()
        
        return token_id
    
    async def verify_refresh_token(self, refresh_token: str) -> Optional[str]:
        """Verify refresh token and return user ID"""
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        result = await self.db.execute(
            select(RefreshToken).where(
                (RefreshToken.token_hash == token_hash) &
                (RefreshToken.is_revoked == False) &
                (RefreshToken.expires_at > datetime.utcnow())
            )
        )
        
        token_record = result.scalar_one_or_none()
        
        if token_record:
            return token_record.user_id
        return None
    
    async def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke refresh token"""
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        result = await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(is_revoked=True)
        )
        
        if result.rowcount > 0:
            await self.db.commit()
            return True
        return False
    
    async def _log_audit_event(self, user_id: Optional[str], action: str, details: str, ip_address: str = None):
        """Log audit event"""
        import uuid
        
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address
        )
        
        self.db.add(audit_log)
        await self.db.commit()

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Authentication Service...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Authentication Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down Authentication Service...")
    await engine.dispose()
    logger.info("Authentication Service shutdown complete")

# FastAPI app
app = FastAPI(
    title="Authentication Service",
    description="Python-based Authentication and User Management",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Current user dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Get current authenticated user"""
    auth_service = AuthenticationService(db)
    payload = auth_service.verify_token(credentials.credentials)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await auth_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

# Admin user dependency
async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Require admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# Health check
@app.get("/health")
async def health_check():
    """Service health check"""
    return {
        "service": "authentication",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# Authentication endpoints
@app.post("/register", response_model=UserResponse)
async def register_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    auth_service = AuthenticationService(db)
    return await auth_service.create_user(user)

@app.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """User login"""
    auth_service = AuthenticationService(db)
    
    # Authenticate user
    user = await auth_service.authenticate_user(
        login_data.username, 
        login_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Create tokens
    access_token, expires_in = auth_service.create_access_token(
        user.id, user.username, user.role.value
    )
    refresh_token = auth_service.create_refresh_token(user.id)
    
    # Store refresh token
    await auth_service.store_refresh_token(user.id, refresh_token)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=user
    )

@app.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token"""
    auth_service = AuthenticationService(db)
    
    # Verify refresh token
    user_id = await auth_service.verify_refresh_token(refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get user
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create new access token
    access_token, expires_in = auth_service.create_access_token(
        user.id, user.username, user.role.value
    )
    
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in
    )

@app.post("/logout")
async def logout(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """User logout"""
    auth_service = AuthenticationService(db)
    
    # Revoke refresh token
    await auth_service.revoke_refresh_token(refresh_token)
    
    return {"message": "Logged out successfully"}

# User management endpoints
@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@app.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """Update current user information"""
    auth_service = AuthenticationService(db)
    
    # Remove role update for non-admin users
    if current_user.role != UserRole.ADMIN:
        user_update.role = None
        user_update.is_active = None
    
    updated_user = await auth_service.update_user(current_user.id, user_update)
    
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return updated_user

@app.post("/change-password")
async def change_password(
    password_data: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """Change user password"""
    auth_service = AuthenticationService(db)
    
    success = await auth_service.change_password(
        current_user.id,
        password_data.current_password,
        password_data.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password"
        )
    
    return {"message": "Password changed successfully"}

# Admin endpoints
@app.get("/users", response_model=List[UserResponse])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    admin_user: UserResponse = Depends(get_admin_user)
):
    """Get all users (admin only)"""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [UserResponse.model_validate(user) for user in users]

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: UserResponse = Depends(get_admin_user)
):
    """Get user by ID (admin only)"""
    auth_service = AuthenticationService(db)
    user = await auth_service.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: UserResponse = Depends(get_admin_user)
):
    """Update user (admin only)"""
    auth_service = AuthenticationService(db)
    updated_user = await auth_service.update_user(user_id, user_update)
    
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return updated_user

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8003")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 