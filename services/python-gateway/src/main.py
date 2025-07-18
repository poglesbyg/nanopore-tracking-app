from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import os
from datetime import datetime
import json

app = FastAPI(title="Nanopore API Gateway", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for demo
samples_db = [
    {"id": 1, "name": "Sample-001", "status": "processing", "priority": 1, "created_at": "2025-01-18T10:00:00Z"},
    {"id": 2, "name": "Sample-002", "status": "completed", "priority": 2, "created_at": "2025-01-18T09:30:00Z"},
    {"id": 3, "name": "Sample-003", "status": "pending", "priority": 3, "created_at": "2025-01-18T11:00:00Z"}
]

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "service": "nanopore-api-gateway",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    return {
        "message": "Nanopore API Gateway",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "samples": "/api/v1/samples",
            "auth": "/api/v1/auth",
            "docs": "/docs"
        }
    }

@app.get("/api/v1/samples")
async def get_samples():
    return samples_db

@app.post("/api/v1/samples")
async def create_sample(sample: dict):
    new_id = max([s["id"] for s in samples_db]) + 1 if samples_db else 1
    new_sample = {
        "id": new_id,
        "name": sample.get("name", f"Sample-{new_id:03d}"),
        "status": "pending",
        "priority": sample.get("priority", 1),
        "created_at": datetime.now().isoformat() + "Z"
    }
    samples_db.append(new_sample)
    return new_sample

@app.put("/api/v1/samples/{sample_id}")
async def update_sample(sample_id: int, sample: dict):
    for i, s in enumerate(samples_db):
        if s["id"] == sample_id:
            samples_db[i].update(sample)
            return samples_db[i]
    raise HTTPException(status_code=404, detail="Sample not found")

@app.delete("/api/v1/samples/{sample_id}")
async def delete_sample(sample_id: int):
    for i, s in enumerate(samples_db):
        if s["id"] == sample_id:
            deleted = samples_db.pop(i)
            return {"message": "Sample deleted", "sample": deleted}
    raise HTTPException(status_code=404, detail="Sample not found")

@app.get("/api/v1/auth/session")
async def get_session():
    return {
        "user": {"id": 1, "name": "Admin", "role": "admin", "email": "admin@example.com"}, 
        "authenticated": True,
        "session_id": "mock-session-123"
    }

@app.post("/api/v1/auth/login")
async def login(credentials: dict):
    # Mock authentication
    username = credentials.get("username", "")
    password = credentials.get("password", "")
    
    if username and password:
        return {
            "token": "mock-jwt-token-" + username,
            "user": {"id": 1, "name": username.title(), "role": "admin", "email": f"{username}@example.com"},
            "expires_in": 3600
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/v1/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}

# Stats endpoint
@app.get("/api/v1/stats")
async def get_stats():
    status_counts = {}
    for sample in samples_db:
        status = sample["status"]
        status_counts[status] = status_counts.get(status, 0) + 1
    
    return {
        "total_samples": len(samples_db),
        "status_breakdown": status_counts,
        "system_info": {
            "uptime": "healthy",
            "database": "postgresql",
            "cache": "redis"
        }
    } 