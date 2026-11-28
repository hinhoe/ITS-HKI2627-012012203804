"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Nghiệp vụ Quản lý xe đang gửi trong bãi (Backend/current_parking.py)
==========================================================================

Tương ứng 1-1 với giao diện:
- Frontend HTML : Frontend/pages/Employee/current-parking.html
- Frontend JS   : Frontend/js/Employee/current-parking.js
- Frontend CSS  : Frontend/css/Employee/current-parking.css

Chức năng:
1. Lấy danh sách toàn bộ xe đang đỗ trong bãi (status = 'PARKED') từ SQLite.
2. Tính toán chính xác thời gian đã gửi theo thời gian thực (Giờ/Phút/Ngày).
3. Đánh dấu và lọc xe đã đỗ quá 24 giờ.
4. Lọc tìm kiếm theo biển số xe và phân loại phương tiện (Ô tô / Xe máy).
5. Phân trang linh hoạt chuẩn giao diện.
6. Cung cấp dữ liệu chi tiết kèm ảnh chụp cổng vào khi xem Modal.
"""

from __future__ import annotations

from datetime import datetime
import logging
from math import ceil
import re
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from Backend.database.connection import get_db
from Backend.Employee.checkin import validate_vietnamese_plate

logger = logging.getLogger("smart_parking.backend.current_parking")

router = APIRouter(tags=["Current Parking - Xe đang gửi trong bãi"])


def compute_duration(checkin_dt: datetime, now_dt: datetime) -> tuple[str, int, bool]:
    """
    Tính toán thời gian đã đỗ từ lúc check-in đến hiện tại:
    - Trả về: (Chuỗi hiển thị, tổng số phút, cờ quá hạn 24h)
    """
    diff_sec = max(0, int((now_dt - checkin_dt).total_seconds()))
    total_minutes = diff_sec // 60
    total_hours = total_minutes // 60
    days = total_hours // 24
    rem_hours = total_hours % 24
    rem_minutes = total_minutes % 60

    is_overdue = (total_hours >= 24)

    if days > 0:
        duration_str = f"{days} ngày {rem_hours:02d} giờ"
    elif total_hours > 0:
        duration_str = f"{total_hours} giờ {rem_minutes:02d} phút"
    else:
        duration_str = f"{rem_minutes} phút"

    return duration_str, total_minutes, is_overdue


def format_dt_vn(dt_str: str) -> str:
    """Chuyển chuỗi YYYY-MM-DD HH:MM:SS sang định dạng chuẩn HH:MM:SS - DD/MM/YYYY"""
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%H:%M:%S - %d/%m/%Y")
    except Exception:
        return dt_str or "--"


@router.get("/api/current-parking/stats")
async def get_current_parking_stats(
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Lấy số liệu thống kê thời gian thực của bãi xe:
    - Tổng số xe đang gửi (PARKED)
    - Số xe đã đỗ quá 24h
    - Tổng sức chứa và số chỗ còn trống
    """
    cur = db.cursor()

    # 1. Tổng xe đang đỗ
    cur.execute("SELECT id, checkin_time, vehicle_type FROM parking_sessions WHERE status = 'PARKED'")
    parked_rows = cur.fetchall()
    total_parked = len(parked_rows)

    now = datetime.now()
    overdue_count = 0
    moto_count = 0
    car_count = 0

    for r in parked_rows:
        vtype = r["vehicle_type"] or "Ô tô"
        if vtype == "Xe máy":
            moto_count += 1
        else:
            car_count += 1

        t_str = r["checkin_time"]
        try:
            c_dt = datetime.strptime(t_str, "%Y-%m-%d %H:%M:%S")
            if (now - c_dt).total_seconds() >= 24 * 3600:
                overdue_count += 1
        except Exception:
            pass

    # 2. Sức chứa bãi xe
    total_capacity = 500
    cur.execute("SELECT total_capacity, moto_capacity, car_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
    lot_row = cur.fetchone()
    if lot_row:
        total_capacity = lot_row["total_capacity"]

    available_spots = max(0, total_capacity - total_parked)
    capacity_percent = round((total_parked / total_capacity * 100), 1) if total_capacity > 0 else 0.0

    return {
        "total_parked": total_parked,
        "overdue_count": overdue_count,
        "total_capacity": total_capacity,
        "available_spots": available_spots,
        "capacity_percent": capacity_percent,
        "car_count": car_count,
        "moto_count": moto_count,
    }


@router.get("/api/current-parking/vehicles")
async def get_current_parking_vehicles(
    keyword: Optional[str] = Query(default=None, description="Từ khóa biển số xe"),
    vehicle_type: Optional[str] = Query(default="all", description="Lọc theo loại xe ('all', 'Ô tô', 'Xe máy')"),
    duration_filter: Optional[str] = Query(default="all", description="Lọc thời gian ('all', 'under24', 'overdue')"),
    page: int = Query(default=1, ge=1, description="Trang hiện tại"),
    page_size: int = Query(default=20, ge=1, le=100, description="Số lượng xe trên 1 trang"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Truy vấn danh sách xe đang gửi trong bãi với bộ lọc đa tiêu chí và phân trang:
    - Tìm kiếm nhanh theo biển số (không phân biệt chữ hoa, chữ thường hay dấu chấm gạch)
    - Lọc theo loại xe (Ô tô, Xe máy)
    - Lọc xe đỗ dưới 24h hoặc quá 24h
    """
    cur = db.cursor()

    # Truy vấn tất cả phiên PARKED sắp xếp từ mới nhất đến cũ nhất
    cur.execute(
        """
        SELECT id, session_code, plate_number, vehicle_type, checkin_time,
               checkin_image_url, checkin_crop_url, confidence, is_manual, staff_checkin
        FROM parking_sessions
        WHERE status = 'PARKED'
        ORDER BY checkin_time DESC, id DESC
        """
    )
    all_sessions = cur.fetchall()

    now = datetime.now()
    clean_keyword = re.sub(r"[\s\-\.]", "", keyword.upper()) if keyword else None

    filtered_list = []
    for s in all_sessions:
        plate = s["plate_number"]
        vtype = s["vehicle_type"] or "Ô tô"
        t_str = s["checkin_time"]

        # 1. Lọc theo từ khóa biển số
        if clean_keyword:
            compact_plate = re.sub(r"[\s\-\.]", "", plate.upper())
            if clean_keyword not in compact_plate:
                continue

        # 2. Lọc theo loại phương tiện
        if vehicle_type and vehicle_type != "all" and vtype != vehicle_type:
            continue

        # Tính thời lượng đỗ
        try:
            c_dt = datetime.strptime(t_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            c_dt = now

        duration_display, duration_minutes, is_overdue = compute_duration(c_dt, now)

        # 3. Lọc theo thời gian gửi
        if duration_filter == "under24" and is_overdue:
            continue
        if duration_filter == "overdue" and not is_overdue:
            continue

        # Gán cổng giả định Cổng A/Cổng B theo id chẵn lẻ nếu chưa lưu cột gate
        gate = "Cổng B" if (s["id"] % 2 == 0) else "Cổng A"

        status_text = "Đậu quá 24h" if is_overdue else "Đang gửi"

        filtered_list.append({
            "id": s["id"],
            "session_code": s["session_code"],
            "plate": plate,
            "type": vtype,
            "timeIn": format_dt_vn(t_str),
            "rawTimeIn": t_str,
            "duration": duration_display,
            "durationMinutes": duration_minutes,
            "gate": gate,
            "status": status_text,
            "isOverdue": is_overdue,
            "checkin_image_url": s["checkin_image_url"],
            "checkin_crop_url": s["checkin_crop_url"],
            "confidence": s["confidence"],
            "is_manual": bool(s["is_manual"]),
            "staff": s["staff_checkin"],
        })

    # Phân trang (Pagination)
    total_items = len(filtered_list)
    total_pages = max(1, ceil(total_items / page_size))
    current_page = min(page, total_pages)

    start_idx = (current_page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered_list[start_idx:end_idx]

    return {
        "success": True,
        "items": page_items,
        "total_items": total_items,
        "page": current_page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": current_page < total_pages,
        "has_prev": current_page > 1,
    }


class UpdateSessionPayload(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = None
    operator_username: Optional[str] = None


def _verify_admin_operator(
    db: sqlite3.Connection,
    x_user_role: Optional[str],
    operator_username: Optional[str],
) -> str:
    """Xác thực quyền Admin trước khi cho phép sửa biển số xe đang gửi."""
    if (x_user_role or "").strip().lower() != "admin":
        raise HTTPException(
            status_code=403,
            detail="Chỉ tài khoản Quản trị viên (Admin) mới có quyền sửa biển số xe đang trong bãi.",
        )

    clean_op = (operator_username or "").strip()
    if clean_op:
        cur = db.cursor()
        cur.execute(
            "SELECT role, is_active FROM users WHERE username = ? LIMIT 1",
            (clean_op,),
        )
        u_row = cur.fetchone()
        if not u_row or int(u_row["is_active"] or 0) != 1 or (u_row["role"] or "").lower() != "admin":
            raise HTTPException(
                status_code=403,
                detail="Tài khoản thao tác không có quyền Quản trị viên hợp lệ.",
            )
    return clean_op or "admin"


@router.put("/api/current-parking/sessions/{session_id}")
async def update_current_parking_session(
    session_id: int,
    payload: UpdateSessionPayload,
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Cho phép Quản trị viên (Admin) sửa lại biển số / mã vé của lượt xe đang gửi trong bãi
    khi nhân viên lỡ nhập lệch ký tự lúc check-in.
    """
    admin_user = _verify_admin_operator(db, x_user_role, payload.operator_username)

    clean_plate = payload.plate_number.strip().upper()
    if not clean_plate:
        raise HTTPException(status_code=400, detail="Biển số xe không được để trống")

    cur = db.cursor()
    cur.execute(
        "SELECT id, plate_number, vehicle_type, status FROM parking_sessions WHERE id = ?",
        (session_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên gửi xe cần sửa")
    if row["status"] != "PARKED":
        raise HTTPException(status_code=400, detail="Chỉ được phép sửa biển số cho xe đang gửi trong bãi (PARKED).")

    target_vtype = payload.vehicle_type or row["vehicle_type"] or "Ô tô"
    is_valid, error_msg = validate_vietnamese_plate(clean_plate, target_vtype)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Biển số / mã vé không hợp lệ: {error_msg}",
        )

    # Chặn trùng biển số với xe khác đang gửi trong bãi
    compact_new = re.sub(r"[\s\.\-_]", "", clean_plate)
    cur.execute(
        "SELECT id, plate_number FROM parking_sessions WHERE status = 'PARKED' AND id != ?",
        (session_id,),
    )
    for other in cur.fetchall():
        compact_other = re.sub(r"[\s\.\-_]", "", (other["plate_number"] or "").upper())
        if compact_other == compact_new:
            raise HTTPException(
                status_code=409,
                detail=f"Biển số / mã vé '{clean_plate}' hiện đang có ở một lượt xe khác trong bãi!",
            )

    if payload.vehicle_type:
        cur.execute(
            """
            UPDATE parking_sessions
            SET plate_number = ?, vehicle_type = ?, is_manual = 1
            WHERE id = ?
            """,
            (clean_plate, payload.vehicle_type, session_id),
        )
    else:
        cur.execute(
            """
            UPDATE parking_sessions
            SET plate_number = ?, is_manual = 1
            WHERE id = ?
            """,
            (clean_plate, session_id),
        )
    db.commit()
    logger.info(
        "Admin '%s' đã sửa biển số phiên #%s: %s -> %s",
        admin_user,
        session_id,
        row["plate_number"],
        clean_plate,
    )

    return {
        "success": True,
        "message": f"Đã cập nhật biển số xe thành công: {clean_plate}",
        "session_id": session_id,
        "plate_number": clean_plate,
        "vehicle_type": payload.vehicle_type,
    }


@router.delete("/api/current-parking/sessions/{session_id}")
async def delete_current_parking_session(
    session_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Xóa phiên gửi xe nếu phát hiện sai lệch không đúng hoặc xe ảo:
    Xóa khỏi CSDL và tự động hoàn trả chỗ trống cho bãi xe.
    """
    cur = db.cursor()
    cur.execute("SELECT id, plate_number FROM parking_sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên gửi xe cần xóa")

    plate = row["plate_number"]
    cur.execute("DELETE FROM parking_sessions WHERE id = ?", (session_id,))
    db.commit()

    return {
        "success": True,
        "message": f"Đã xóa thành công phiên gửi xe biển số {plate}",
        "session_id": session_id,
    }
