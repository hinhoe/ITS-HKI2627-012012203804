"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Xác thực đăng nhập (Backend/auth.py)
==========================================================================
"""

from __future__ import annotations

import hashlib
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from Backend.database.connection import get_db

router = APIRouter(tags=["Auth - Xác thực tài khoản"])

DEFAULT_PASSWORD_HASH = hashlib.sha256("123456".encode("utf-8")).hexdigest()


def hash_password(raw_password: str) -> str:
    """Băm mật khẩu bằng SHA-256."""
    return hashlib.sha256(raw_password.encode("utf-8")).hexdigest()


class LoginPayload(BaseModel):
    username: str = Field(..., min_length=1, description="Tên đăng nhập")
    password: str = Field(..., min_length=1, description="Mật khẩu")


@router.post("/api/auth/login")
async def login(
    payload: LoginPayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Xác thực người dùng với bảng `users` trong CSDL SQLite.
    Trả về thông tin tài khoản & vai trò để Frontend lưu phiên làm việc.
    """
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.")

    cur = db.cursor()
    cur.execute(
        "SELECT id, username, password_hash, full_name, role, shift_note, is_active FROM users WHERE username = ?",
        (username,),
    )
    user = cur.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác.")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Tài khoản này đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.")

    stored_hash = user["password_hash"] or DEFAULT_PASSWORD_HASH
    if hash_password(payload.password) != stored_hash:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác.")

    return {
        "success": True,
        "message": "Đăng nhập thành công!",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "shift_note": user["shift_note"] or ("Toàn quyền quản trị (24/7)" if user["role"] == "admin" else "Ca sáng (06:00 - 14:00)"),
        },
    }
