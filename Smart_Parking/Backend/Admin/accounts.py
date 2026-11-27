"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Quản lý tài khoản & Phân quyền (Backend/Admin/accounts.py)
==========================================================================
"""

from __future__ import annotations

from datetime import datetime
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from Backend.Admin.dashboard import get_lot_capacity
from Backend.auth import hash_password
from Backend.database.connection import get_db

router = APIRouter(tags=["Admin - Quản lý tài khoản"])


class AccountCreatePayload(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="employee", description="'admin' hoặc 'employee'")
    shift_note: Optional[str] = Field(default="", max_length=120)
    password: str = Field(..., min_length=6, max_length=100)


class AccountUpdatePayload(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="employee")
    shift_note: Optional[str] = Field(default="", max_length=120)
    password: Optional[str] = Field(default=None, description="Để trống nếu giữ nguyên mật khẩu hiện tại")


def _normalize_role(role: str) -> str:
    clean = (role or "").strip().lower()
    if clean in ("staff", "employee"):
        return "employee"
    if clean == "admin":
        return "admin"
    raise HTTPException(status_code=400, detail="Vai trò chỉ được phép là 'admin' hoặc 'employee'.")


def _format_created_at(raw_dt: Optional[str]) -> str:
    if not raw_dt:
        return "--"
    try:
        dt = datetime.strptime(raw_dt[:19], "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return raw_dt


@router.get("/api/admin/accounts")
async def list_admin_accounts(db: sqlite3.Connection = Depends(get_db)):
    """Lấy toàn bộ tài khoản từ bảng users kèm chỉ số KPI thống kê."""
    cur = db.cursor()
    cur.execute(
        """
        SELECT id, username, full_name, role, shift_note, is_active, created_at
        FROM users
        ORDER BY id DESC
        """
    )
    rows = cur.fetchall()

    accounts = []
    admin_count = 0
    staff_count = 0
    active_count = 0
    locked_count = 0

    for r in rows:
        role_val = "admin" if r["role"] == "admin" else "employee"
        is_active = bool(r["is_active"])
        if role_val == "admin":
            admin_count += 1
        else:
            staff_count += 1
        if is_active:
            active_count += 1
        else:
            locked_count += 1

        accounts.append({
            "id": r["id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "role": role_val,
            "role_label": "Quản trị viên" if role_val == "admin" else "Nhân viên bãi xe",
            "shift": r["shift_note"] or ("Toàn quyền quản trị" if role_val == "admin" else "Trực ca cổng"),
            "is_active": is_active,
            "status": "active" if is_active else "locked",
            "status_label": "Đang hoạt động" if is_active else "Đã khóa",
            "created_at": _format_created_at(r["created_at"]),
        })

    return {
        "success": True,
        "capacity": get_lot_capacity(db),
        "kpi": {
            "total": len(accounts),
            "admin": admin_count,
            "staff": staff_count,
            "active": active_count,
            "locked": locked_count,
        },
        "accounts": accounts,
    }


@router.post("/api/admin/accounts")
async def create_admin_account(
    payload: AccountCreatePayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """Tạo tài khoản nhân viên hoặc quản trị viên mới trong SQLite."""
    clean_user = payload.username.strip().lower()
    clean_name = payload.full_name.strip()
    role_val = _normalize_role(payload.role)
    shift_val = (payload.shift_note or "").strip() or ("Toàn quyền quản trị" if role_val == "admin" else "Trực ca linh hoạt")

    if " " in clean_user:
        raise HTTPException(status_code=400, detail="Tên đăng nhập không được chứa khoảng trắng.")

    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE LOWER(username) = ?", (clean_user,))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail=f"Tên đăng nhập '{clean_user}' đã tồn tại trên hệ thống.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pwd_hash = hash_password(payload.password.strip())

    cur.execute(
        """
        INSERT INTO users (username, password_hash, full_name, role, shift_note, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
        """,
        (clean_user, pwd_hash, clean_name, role_val, shift_val, now_str),
    )
    db.commit()

    return {
        "success": True,
        "id": cur.lastrowid,
        "message": f"Đã tạo tài khoản '{clean_user}' thành công.",
    }


@router.put("/api/admin/accounts/{user_id}")
async def update_admin_account(
    user_id: int,
    payload: AccountUpdatePayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """Cập nhật thông tin tài khoản (và đặt lại mật khẩu nếu có nhập mật khẩu mới)."""
    cur = db.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản cần cập nhật.")

    clean_name = payload.full_name.strip()
    role_val = _normalize_role(payload.role)
    shift_val = (payload.shift_note or "").strip() or ("Toàn quyền quản trị" if role_val == "admin" else "Trực ca linh hoạt")

    if existing["username"] == "admin01" and role_val != "admin":
        raise HTTPException(status_code=400, detail="Không thể hạ quyền tài khoản Quản trị viên gốc (admin01).")

    new_pwd = (payload.password or "").strip()
    if new_pwd:
        if len(new_pwd) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự.")
        cur.execute(
            """
            UPDATE users
            SET full_name = ?, role = ?, shift_note = ?, password_hash = ?
            WHERE id = ?
            """,
            (clean_name, role_val, shift_val, hash_password(new_pwd), user_id),
        )
    else:
        cur.execute(
            """
            UPDATE users
            SET full_name = ?, role = ?, shift_note = ?
            WHERE id = ?
            """,
            (clean_name, role_val, shift_val, user_id),
        )
    db.commit()

    return {
        "success": True,
        "message": f"Đã cập nhật thông tin tài khoản '{existing['username']}'.",
    }


@router.patch("/api/admin/accounts/{user_id}/status")
async def toggle_admin_account_status(
    user_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """Khóa hoặc mở khóa quyền đăng nhập của tài khoản."""
    cur = db.cursor()
    cur.execute("SELECT id, username, full_name, is_active FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")

    if row["username"] == "admin01":
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản Quản trị viên gốc (admin01).")

    new_active = 0 if row["is_active"] else 1
    cur.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_active, user_id))
    db.commit()

    return {
        "success": True,
        "is_active": bool(new_active),
        "status": "active" if new_active else "locked",
        "message": f"Đã {'mở khóa' if new_active else 'tạm khóa'} tài khoản '{row['username']}'.",
    }


@router.delete("/api/admin/accounts/{user_id}")
async def delete_admin_account(
    user_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """Xóa tài khoản phụ khỏi CSDL (bảo vệ an toàn tài khoản gốc admin01 và nhanvien01 mặc định)."""
    cur = db.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản cần xóa.")

    if row["username"] in ("admin01", "nhanvien01"):
        raise HTTPException(
            status_code=400,
            detail=f"Không thể xóa tài khoản mặc định '{row['username']}' của hệ thống. Bạn chỉ có thể chỉnh sửa hoặc tạm khóa.",
        )

    cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()

    return {
        "success": True,
        "message": f"Đã xóa tài khoản '{row['username']}' khỏi hệ thống.",
    }

