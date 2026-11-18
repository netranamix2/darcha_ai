"""JWT login and role checks for the operator panel and dashboard."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import JWT_SECRET, JWT_TTL_HOURS
from app.db.models import Staff
from app.db.session import DB

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)

ROLES = {"operator", "specialist", "manager", "kb_admin", "admin"}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return "pbkdf2$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, dk_b64 = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), 200_000)
    return hmac.compare_digest(dk, base64.b64decode(dk_b64))


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn, s: AsyncSession = DB):
    staff = (await s.execute(select(Staff).where(Staff.username == body.username, Staff.is_active))).scalar()
    if not staff or not verify_password(body.password, staff.password_hash):
        raise HTTPException(401, "invalid credentials")
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS)
    token = jwt.encode({"sub": str(staff.id), "role": staff.role, "exp": exp}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "role": staff.role,
            "user": {"id": staff.id, "username": staff.username, "full_name": staff.full_name,
                     "department_id": staff.department_id, "region": staff.region}}


async def current_staff(creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
                        s: AsyncSession = DB) -> Staff:
    if creds is None:
        raise HTTPException(401, "missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    staff = await s.get(Staff, int(payload["sub"]))
    if not staff or not staff.is_active:
        raise HTTPException(401, "inactive user")
    return staff


def require(*roles: str):
    async def dep(staff: Staff = Depends(current_staff)) -> Staff:
        if staff.role != "admin" and staff.role not in roles:
            raise HTTPException(403, f"role {staff.role} not allowed")
        return staff
    return dep


@router.get("/me")
async def me(staff: Staff = Depends(current_staff)):
    return {"id": staff.id, "username": staff.username, "full_name": staff.full_name, "role": staff.role,
            "department_id": staff.department_id, "region": staff.region}
