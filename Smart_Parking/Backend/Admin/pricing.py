"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Quản lý mức phí gửi xe (Backend/Admin/pricing.py)
==========================================================================
"""

from __future__ import annotations

from datetime import datetime
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from Backend.Admin.dashboard import get_lot_capacity
from Backend.database.connection import get_db

router = APIRouter(tags=["Admin - Quản lý mức phí"])

VEHICLE_META = {
    "Xe máy": {"key": "motor", "name": "Xe máy"},
    "Ô tô": {"key": "car", "name": "Ô tô"},
    "Xe đạp / Đạp điện": {"key": "bike", "name": "Xe đạp / Đạp điện"},
}

TIER_META = {
    "Ban ngày": {"key": "day", "label": "Ban ngày (06:00 - 18:00)", "unit": "/lượt"},
    "Qua đêm": {"key": "night", "label": "Qua đêm (18:00 - 06:00)", "unit": "/lượt qua đêm"},
    "Chu kỳ 24 giờ": {"key": "cycle", "label": "Chu kỳ 24 giờ", "unit": "/24 giờ"},
}


class PricingUpdatePayload(BaseModel):
    vehicle_type: str = Field(..., description="Loại xe: 'Xe máy', 'Ô tô' hoặc 'Xe đạp / Đạp điện'")
    fee_type: str = Field(..., description="Khung phí: 'Ban ngày', 'Qua đêm' hoặc 'Chu kỳ 24 giờ'")
    base_price: int = Field(..., ge=1000, description="Mức giá mới (VNĐ)")
    actor: Optional[str] = Field(default="Quản trị viên", description="Người thực hiện thay đổi")


@router.get("/api/admin/pricing")
async def get_admin_pricing(db: sqlite3.Connection = Depends(get_db)):
    """Lấy toàn bộ biểu phí hiện hành từ SQLite kèm nhật ký thay đổi giá."""
    cur = db.cursor()
    cur.execute(
        """
        SELECT id, vehicle_type, fee_type, base_price, description, is_active, created_at
        FROM pricing_rules
        WHERE is_active = 1
        ORDER BY id ASC
        """
    )
    rows = cur.fetchall()

    rules_grouped: dict[str, dict] = {}
    for vtype, meta in VEHICLE_META.items():
        rules_grouped[meta["key"]] = {
            "vehicle_type": vtype,
            "name": meta["name"],
            "tiers": {},
            "last_updated": None,
            "last_actor": None,
        }

    for r in rows:
        vtype = r["vehicle_type"]
        ftype = r["fee_type"]
        if vtype not in VEHICLE_META or ftype not in TIER_META:
            continue
        vkey = VEHICLE_META[vtype]["key"]
        tkey = TIER_META[ftype]["key"]
        rules_grouped[vkey]["tiers"][tkey] = {
            "id": r["id"],
            "fee_type": ftype,
            "label": TIER_META[ftype]["label"],
            "price": int(r["base_price"]),
            "unit": TIER_META[ftype]["unit"],
            "description": r["description"] or "",
        }

    # Lấy thông tin lần cập nhật gần nhất cho từng loại xe
    cur.execute(
        """
        SELECT vehicle_type, fee_type, old_price, new_price, actor, changed_at
        FROM pricing_audit_logs
        ORDER BY id DESC
        LIMIT 50
        """
    )
    audit_rows = cur.fetchall()
    logs = []
    for log in audit_rows:
        vtype = log["vehicle_type"]
        ftype = log["fee_type"]
        vkey = VEHICLE_META.get(vtype, {}).get("key")
        changed_dt_raw = log["changed_at"] or ""
        try:
            dt = datetime.strptime(changed_dt_raw, "%Y-%m-%d %H:%M:%S")
            display_time = dt.strftime("%H:%M %d/%m/%Y")
        except Exception:
            display_time = changed_dt_raw

        if vkey and rules_grouped[vkey]["last_updated"] is None:
            rules_grouped[vkey]["last_updated"] = display_time
            rules_grouped[vkey]["last_actor"] = log["actor"]

        tier_label = TIER_META.get(ftype, {}).get("label", ftype)
        logs.append({
            "time": display_time,
            "vehicle": vtype,
            "tier": tier_label,
            "old_price": int(log["old_price"]),
            "new_price": int(log["new_price"]),
            "actor": log["actor"],
        })

    return {
        "success": True,
        "capacity": get_lot_capacity(db),
        "pricing": rules_grouped,
        "logs": logs,
    }


@router.put("/api/admin/pricing")
async def update_admin_pricing(
    payload: PricingUpdatePayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """Cập nhật giá vé trực tiếp vào bảng pricing_rules và ghi nhật ký đổi giá."""
    if payload.vehicle_type not in VEHICLE_META:
        raise HTTPException(status_code=400, detail="Loại phương tiện không hợp lệ.")
    if payload.fee_type not in TIER_META:
        raise HTTPException(status_code=400, detail="Mức phí không hợp lệ.")
    if payload.base_price % 1000 != 0:
        raise HTTPException(status_code=400, detail="Mức giá phải chia hết cho 1.000 VNĐ.")

    cur = db.cursor()
    cur.execute(
        "SELECT id, base_price FROM pricing_rules WHERE vehicle_type = ? AND fee_type = ? LIMIT 1",
        (payload.vehicle_type, payload.fee_type),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình biểu phí cần cập nhật.")

    old_price = int(row["base_price"])
    actor_name = (payload.actor or "Quản trị viên").strip() or "Quản trị viên"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cur.execute(
        "UPDATE pricing_rules SET base_price = ? WHERE id = ?",
        (payload.base_price, row["id"]),
    )
    cur.execute(
        """
        INSERT INTO pricing_audit_logs (vehicle_type, fee_type, old_price, new_price, actor, changed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (payload.vehicle_type, payload.fee_type, old_price, payload.base_price, actor_name, now_str),
    )
    db.commit()

    return {
        "success": True,
        "message": f"Đã cập nhật giá {payload.vehicle_type} ({payload.fee_type}) thành {payload.base_price:,} VNĐ.".replace(",", "."),
        "updated_at": datetime.now().strftime("%H:%M %d/%m/%Y"),
        "actor": actor_name,
        "old_price": old_price,
        "new_price": payload.base_price,
    }
