"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Thống kê & Báo cáo Quản trị viên (Backend/Admin/dashboard.py)
==========================================================================
"""

from __future__ import annotations

import calendar
from datetime import datetime, timedelta
import io
import logging
from pathlib import Path
import re
import secrets
import sqlite3
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pydantic import BaseModel, Field

from Backend.config import settings
from Backend.database.connection import get_db

logger = logging.getLogger("smart_parking.backend.admin.dashboard")

router = APIRouter(tags=["Admin - Thống kê & Báo cáo"])


def get_lot_capacity(db: sqlite3.Connection) -> dict:
    """Lấy sức chứa thời gian thực từ bảng parking_lots và parking_sessions."""
    cur = db.cursor()
    cur.execute("SELECT total_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
    lot_row = cur.fetchone()
    total_cap = int(lot_row["total_capacity"]) if lot_row else 500

    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED'")
    current_count = int(cur.fetchone()[0] or 0)
    empty_count = max(0, total_cap - current_count)
    percent = round((current_count / total_cap * 100.0), 1) if total_cap > 0 else 0.0

    return {
        "total_capacity": total_cap,
        "current_count": current_count,
        "empty_count": empty_count,
        "percent": min(100.0, percent),
    }


def _build_dashboard_payload(
    db: sqlite3.Connection,
    range_key: str,
    custom_date: Optional[str] = None,
) -> dict:
    """Tổng hợp dữ liệu KPI, biểu đồ và bảng đối soát doanh thu từ SQLite."""
    now = datetime.now()
    today_date = now.date()
    cur = db.cursor()

    # Tải toàn bộ phiên gửi xe để thống kê nhanh và chính xác
    cur.execute(
        """
        SELECT session_code, plate_number, vehicle_type, checkin_time, checkout_time,
               confidence, is_manual, total_fee, status
        FROM parking_sessions
        """
    )
    sessions = cur.fetchall()
    capacity = get_lot_capacity(db)

    # Xác định khung ngày báo cáo
    if range_key == "custom" and custom_date:
        try:
            target_dt = datetime.strptime(custom_date.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ (cần YYYY-MM-DD).")
        bucket_dates = [target_dt]
        period_title = f"ngày {target_dt.strftime('%d/%m/%Y')}"
    elif range_key == "today":
        bucket_dates = [today_date]
        period_title = f"hôm nay ({today_date.strftime('%d/%m/%Y')})"
    elif range_key == "month":
        # 30 ngày gần nhất hoặc từ đầu tháng (chọn theo các ngày trong tháng hiện tại đến hôm nay)
        start_month = today_date.replace(day=1)
        days_count = (today_date - start_month).days + 1
        bucket_dates = [start_month + timedelta(days=i) for i in range(days_count)]
        period_title = f"tháng {today_date.strftime('%m/%Y')}"
    else:
        range_key = "7days"
        bucket_dates = [today_date - timedelta(days=offset) for offset in range(6, -1, -1)]
        period_title = "7 ngày gần nhất"

    start_str = bucket_dates[0].strftime("%Y-%m-%d")
    end_str = bucket_dates[-1].strftime("%Y-%m-%d")

    # Khởi tạo map theo từng ngày
    daily_stats: dict[str, dict] = {}
    weekday_vn = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    for d in bucket_dates:
        d_str = d.strftime("%Y-%m-%d")
        is_today = d == today_date
        if range_key in ("today", "custom"):
            label = d.strftime("%d/%m/%Y")
            display_name = f"Hôm nay ({d.strftime('%d/%m/%Y')})" if is_today else f"{weekday_vn[d.weekday()]}, {d.strftime('%d/%m/%Y')}"
        else:
            label = f"{weekday_vn[d.weekday()]} ({d.strftime('%d/%m')})" if range_key == "7days" else d.strftime("%d/%m")
            display_name = (
                f"Hôm nay - {weekday_vn[d.weekday()]} ({d.strftime('%d/%m/%Y')})"
                if is_today
                else f"{weekday_vn[d.weekday()]}, {d.strftime('%d/%m/%Y')}"
            )
        daily_stats[d_str] = {
            "date": d_str,
            "label": label,
            "date_name": display_name,
            "is_current": is_today,
            "in_count": 0,
            "out_count": 0,
            "motor_in": 0,
            "car_in": 0,
            "bike_in": 0,
            "motor_rev": 0,
            "car_rev": 0,
            "bike_rev": 0,
            "total_rev": 0,
        }

    # Tổng hợp theo từng phiên + Hiệu suất AI + Cảnh báo bất thường
    period_in = 0
    period_out = 0
    period_rev = 0

    alpr_total = 0
    alpr_auto = 0
    alpr_manual = 0
    alpr_conf_sum = 0.0
    alpr_conf_count = 0
    bike_tickets = 0

    overstay_vehicles: list[dict] = []
    manual_or_low_conf: list[dict] = []

    for row in sessions:
        vtype = row["vehicle_type"] or "Ô tô"
        cin_full = row["checkin_time"] or ""
        cin_str = cin_full[:10]
        cout_str = (row["checkout_time"] or "")[:10]
        fee = int(row["total_fee"] or 0)
        status = row["status"] or ""
        conf = float(row["confidence"] or 0.0)
        is_manual = bool(row["is_manual"])

        if cin_str in daily_stats:
            daily_stats[cin_str]["in_count"] += 1
            period_in += 1
            if vtype == "Xe máy":
                daily_stats[cin_str]["motor_in"] += 1
            elif vtype == "Xe đạp / Đạp điện":
                daily_stats[cin_str]["bike_in"] += 1
                bike_tickets += 1
            else:
                daily_stats[cin_str]["car_in"] += 1

            # Thống kê hiệu suất nhận diện ALPR trên Xe máy & Ô tô
            if vtype != "Xe đạp / Đạp điện":
                alpr_total += 1
                if is_manual:
                    alpr_manual += 1
                else:
                    alpr_auto += 1
                if conf > 0:
                    alpr_conf_sum += conf
                    alpr_conf_count += 1
                if is_manual or (0 < conf < 90.0):
                    manual_or_low_conf.append({
                        "plate_number": row["plate_number"],
                        "vehicle_type": vtype,
                        "checkin_time": cin_full,
                        "confidence": round(conf, 1),
                        "reason": "Nhập / sửa tay" if is_manual else f"Tin cậy thấp ({conf:.1f}%)",
                    })

        # Phát hiện xe đang gửi tồn trong bãi >= 24 giờ
        if status == "PARKED" and cin_full:
            try:
                cin_dt = datetime.strptime(cin_full[:19], "%Y-%m-%d %H:%M:%S")
                parked_hours = (now - cin_dt).total_seconds() / 3600.0
                if parked_hours >= 24.0:
                    overstay_vehicles.append({
                        "plate_number": row["plate_number"],
                        "vehicle_type": vtype,
                        "checkin_time": cin_full,
                        "hours_parked": round(parked_hours, 1),
                    })
            except ValueError:
                pass

        if status == "COMPLETED" and cout_str in daily_stats:
            daily_stats[cout_str]["out_count"] += 1
            daily_stats[cout_str]["total_rev"] += fee
            period_out += 1
            period_rev += fee
            if vtype == "Xe máy":
                daily_stats[cout_str]["motor_rev"] += fee
            elif vtype == "Xe đạp / Đạp điện":
                daily_stats[cout_str]["bike_rev"] += fee
            else:
                daily_stats[cout_str]["car_rev"] += fee

    overstay_vehicles.sort(key=lambda item: item["hours_parked"], reverse=True)
    manual_or_low_conf.sort(key=lambda item: item["checkin_time"], reverse=True)
    auto_rate = round((alpr_auto / alpr_total) * 100.0, 1) if alpr_total > 0 else 0.0
    avg_confidence = round((alpr_conf_sum / alpr_conf_count), 1) if alpr_conf_count > 0 else 0.0

    # Nếu xem "Hôm nay" hoặc 1 ngày cụ thể -> vẽ biểu đồ theo các khung giờ trong ngày đó
    if range_key in ("today", "custom"):
        target_day_str = start_str
        hour_slots = [
            ("00-06", "00:00-06:00", 0, 5),
            ("06-09", "06:00-09:00", 6, 8),
            ("09-12", "09:00-12:00", 9, 11),
            ("12-15", "12:00-15:00", 12, 14),
            ("15-18", "15:00-18:00", 15, 17),
            ("18-24", "18:00-24:00", 18, 23),
        ]
        slot_data = [
            {"label": lbl, "start_h": sh, "end_h": eh, "motor": 0, "car": 0, "bike": 0, "rev": 0}
            for _, lbl, sh, eh in hour_slots
        ]

        for row in sessions:
            vtype = row["vehicle_type"] or "Ô tô"
            cin_full = row["checkin_time"] or ""
            cout_full = row["checkout_time"] or ""
            fee = int(row["total_fee"] or 0)
            status = row["status"] or ""

            if cin_full[:10] == target_day_str and len(cin_full) >= 13:
                try:
                    hr = int(cin_full[11:13])
                except ValueError:
                    hr = 0
                for s in slot_data:
                    if s["start_h"] <= hr <= s["end_h"]:
                        if vtype == "Xe máy":
                            s["motor"] += 1
                        elif vtype == "Xe đạp / Đạp điện":
                            s["bike"] += 1
                        else:
                            s["car"] += 1
                        break

            if status == "COMPLETED" and cout_full[:10] == target_day_str and len(cout_full) >= 13:
                try:
                    hr_out = int(cout_full[11:13])
                except ValueError:
                    hr_out = 0
                for s in slot_data:
                    if s["start_h"] <= hr_out <= s["end_h"]:
                        s["rev"] += fee
                        break

        chart_labels = [s["label"] for s in slot_data]
        chart_motor = [s["motor"] for s in slot_data]
        chart_car = [s["car"] for s in slot_data]
        chart_bike = [s["bike"] for s in slot_data]
        chart_revenue = [int(s["rev"]) for s in slot_data]
    else:
        ordered_days = [daily_stats[d.strftime("%Y-%m-%d")] for d in bucket_dates]
        chart_labels = [item["label"] for item in ordered_days]
        chart_motor = [item["motor_in"] for item in ordered_days]
        chart_car = [item["car_in"] for item in ordered_days]
        chart_bike = [item["bike_in"] for item in ordered_days]
        chart_revenue = [int(item["total_rev"]) for item in ordered_days]

    # Bảng đối soát: sắp xếp ngày mới nhất lên đầu
    audit_rows = [daily_stats[d.strftime("%Y-%m-%d")] for d in reversed(bucket_dates)]

    return {
        "success": True,
        "range_key": range_key,
        "period_title": period_title,
        "start_date": start_str,
        "end_date": end_str,
        "capacity": capacity,
        "kpi": {
            "total_in": period_in,
            "total_out": period_out,
            "parked_now": capacity["current_count"],
            "total_revenue": period_rev,
        },
        "ai_stats": {
            "alpr_total": alpr_total,
            "alpr_auto": alpr_auto,
            "alpr_manual": alpr_manual,
            "auto_rate": auto_rate,
            "avg_confidence": avg_confidence,
            "bike_tickets": bike_tickets,
        },
        "alerts": {
            "total_alerts": len(overstay_vehicles) + len(manual_or_low_conf),
            "overstay_count": len(overstay_vehicles),
            "manual_low_count": len(manual_or_low_conf),
            "overstay_vehicles": overstay_vehicles[:5],
            "manual_or_low_conf": manual_or_low_conf[:5],
        },
        "chart": {
            "labels": chart_labels,
            "motor": chart_motor,
            "car": chart_car,
            "bike": chart_bike,
            "revenue": chart_revenue,
        },
        "audit": audit_rows,
    }


@router.get("/api/admin/dashboard")
async def get_admin_dashboard(
    range_key: str = Query("7days", description="Khoảng thời gian: today, 7days, month, custom"),
    date: Optional[str] = Query(None, description="Ngày tùy chọn YYYY-MM-DD khi range_key=custom"),
    db: sqlite3.Connection = Depends(get_db),
):
    """API Thống kê Dashboard tổng quan cho Quản trị viên."""
    return _build_dashboard_payload(db, range_key, date)


@router.get("/api/admin/dashboard/export")
async def export_admin_dashboard_excel(
    range_key: str = Query("7days"),
    date: Optional[str] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    """Xuất báo cáo doanh thu & lưu lượng theo kỳ lọc ra file Excel (.xlsx)."""
    data = _build_dashboard_payload(db, range_key, date)
    audit_rows = data["audit"]

    wb = Workbook()
    ws = wb.active
    ws.title = "BaoCaoDoanhThu"
    ws.views.sheetView[0].showGridLines = True

    navy_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    total_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")

    thin_side = Side(border_style="thin", color="CBD5E1")
    border_cell = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    ws.merge_cells("A1:G1")
    ws["A1"] = "BÁO CÁO ĐỐI SOÁT LƯU LƯỢNG & DOANH THU BÃI ĐỖ XE - PARKTECH"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    ws["A1"].fill = navy_fill
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 34

    ws.merge_cells("A2:G2")
    ws["A2"] = f"Kỳ báo cáo: {data['period_title']}  •  Thời điểm xuất: {datetime.now().strftime('%H:%M:%S %d/%m/%Y')}"
    ws["A2"].font = Font(name="Calibri", size=11, italic=True, color="334155")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 24

    headers = [
        "Ngày đối soát",
        "Lượt vào",
        "Lượt ra",
        "Doanh thu Ô tô (VNĐ)",
        "Doanh thu Xe máy (VNĐ)",
        "Xe đạp / Đạp điện (VNĐ)",
        "Tổng doanh thu (VNĐ)",
    ]
    ws.append([])
    ws.append(headers)
    header_row_idx = 4
    ws.row_dimensions[header_row_idx].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=header_row_idx, column=col_idx)
        cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_cell

    sum_in = sum_out = sum_car = sum_motor = sum_bike = sum_total = 0
    for idx, row in enumerate(audit_rows, start=5):
        sum_in += row["in_count"]
        sum_out += row["out_count"]
        sum_car += row["car_rev"]
        sum_motor += row["motor_rev"]
        sum_bike += row["bike_rev"]
        sum_total += row["total_rev"]

        ws.append([
            row["date_name"],
            row["in_count"],
            row["out_count"],
            row["car_rev"],
            row["motor_rev"],
            row["bike_rev"],
            row["total_rev"],
        ])
        ws.row_dimensions[idx].height = 22
        for col_idx in range(1, 8):
            c = ws.cell(row=idx, column=col_idx)
            c.border = border_cell
            if idx % 2 == 1:
                c.fill = zebra_fill
            if col_idx >= 4:
                c.number_format = '#,##0 "đ"'
                c.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in (2, 3):
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")

    total_row_idx = 5 + len(audit_rows)
    ws.append(["TỔNG CỘNG", sum_in, sum_out, sum_car, sum_motor, sum_bike, sum_total])
    ws.row_dimensions[total_row_idx].height = 26
    for col_idx in range(1, 8):
        c = ws.cell(row=total_row_idx, column=col_idx)
        c.font = Font(name="Calibri", size=11, bold=True, color="0F172A")
        c.fill = total_fill
        c.border = border_cell
        if col_idx >= 4:
            c.number_format = '#,##0 "đ"'
            c.alignment = Alignment(horizontal="right", vertical="center")
        elif col_idx in (2, 3):
            c.alignment = Alignment(horizontal="center", vertical="center")
        else:
            c.alignment = Alignment(horizontal="left", vertical="center")

    col_widths = [28, 14, 14, 24, 24, 24, 24]
    for idx, w in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"BaoCao_ParkTech_{data['start_date']}_{data['end_date']}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ==========================================================================
# SAO LƯU EXCEL & DỌN DẸP ĐỊNH KỲ: CHỌN THÁNG -> CHỌN TUẦN (1-4 / CẢ THÁNG)
# ==========================================================================
_ARCHIVE_EXPORT_TOKENS: dict[str, dict] = {}
_ARCHIVE_TOKEN_TTL_SEC = 1800


class ArchiveCleanupRequest(BaseModel):
    month: str = Field(..., description="Tháng định dạng YYYY-MM")
    week: str = Field(default="ALL", description="ALL hoặc 1, 2, 3, 4")
    mode: str = Field(default="images_only", description="images_only hoặc purge_all")
    backup_token: str = Field(..., description="Mã xác nhận đã xuất Excel sao lưu")


def _get_month_week_ranges(month_str: str) -> tuple[str, int, int, list[dict]]:
    """
    Tính 4 tuần chuẩn trong 1 tháng (1..7, 8..14, 15..21, 22..cuối tháng) và mục ALL (Cả tháng).
    """
    clean_m = (month_str or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}", clean_m):
        raise HTTPException(status_code=400, detail="Định dạng tháng không hợp lệ (cần YYYY-MM).")
    year_num, month_num = map(int, clean_m.split("-"))
    if not (1 <= month_num <= 12):
        raise HTTPException(status_code=400, detail="Tháng phải từ 01 đến 12.")

    last_day = calendar.monthrange(year_num, month_num)[1]
    mm = f"{month_num:02d}"
    defs = [
        ("ALL", f"Cả tháng {mm}/{year_num}", 1, last_day),
        ("1", f"Tuần 1 (01/{mm} - 07/{mm})", 1, 7),
        ("2", f"Tuần 2 (08/{mm} - 14/{mm})", 8, 14),
        ("3", f"Tuần 3 (15/{mm} - 21/{mm})", 15, 21),
        ("4", f"Tuần 4 (22/{mm} - {last_day:02d}/{mm})", 22, last_day),
    ]
    weeks = [
        {
            "week": code,
            "label": label,
            "start_day": sd,
            "end_day": ed,
            "start_date": f"{clean_m}-{sd:02d}",
            "end_date": f"{clean_m}-{ed:02d}",
        }
        for code, label, sd, ed in defs
    ]
    return clean_m, year_num, month_num, weeks


def _resolve_month_week(month_str: str, week_str: str) -> tuple[str, str, str, str, str]:
    """
    Chuẩn hóa (month, week) -> (clean_month, clean_week, start_date, end_date, display_label)
    """
    clean_m, year_num, month_num, weeks = _get_month_week_ranges(month_str)
    clean_w = (week_str or "ALL").strip().upper()
    matched = next((w for w in weeks if w["week"] == clean_w), None)
    if not matched:
        raise HTTPException(status_code=400, detail="Tuần không hợp lệ (chỉ chấp nhận ALL, 1, 2, 3, 4).")
    mm = f"{month_num:02d}"
    label = (
        f"Cả tháng {mm}/{year_num}"
        if clean_w == "ALL"
        else f"{matched['label']} - Tháng {mm}/{year_num}"
    )
    return clean_m, clean_w, matched["start_date"], matched["end_date"], label


def _resolve_media_file(url: Optional[str]) -> Optional[Path]:
    if not url:
        return None
    clean = url.strip().split("?")[0]
    if clean.startswith("/uploads/"):
        base_dir = settings.UPLOAD_DIR.resolve()
        rel = clean[len("/uploads/"):]
    elif clean.startswith("/results/"):
        base_dir = settings.RESULTS_DIR.resolve()
        rel = clean[len("/results/"):]
    else:
        return None

    target = (base_dir / rel).resolve()
    if not target.is_relative_to(base_dir):
        return None
    if target.is_file():
        return target
    return None


@router.get("/api/admin/archive/summary")
@router.get("/api/admin/archive/months")
async def get_archive_summary(db: sqlite3.Connection = Depends(get_db)):
    """Trả về danh sách các Tháng có dữ liệu lịch sử cùng thống kê chi tiết Tuần 1, 2, 3, 4 và Cả tháng."""
    cur = db.cursor()
    cur.execute(
        """
        SELECT
            substr(COALESCE(checkout_time, checkin_time), 1, 10) AS ymd,
            total_fee,
            checkin_image_url, checkin_crop_url, checkout_image_url, checkout_crop_url
        FROM parking_sessions
        WHERE status = 'COMPLETED'
        ORDER BY ymd DESC
        """
    )

    months_rows: dict[str, list] = {}
    for row in cur.fetchall():
        ymd = (row["ymd"] or "").strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", ymd):
            continue
        ym = ymd[:7]
        months_rows.setdefault(ym, []).append(row)

    months_out = []
    for ym in sorted(months_rows.keys(), reverse=True):
        try:
            clean_m, year_num, month_num, week_defs = _get_month_week_ranges(ym)
        except HTTPException:
            continue

        week_stats = {
            w["week"]: {
                "week": w["week"],
                "label": w["label"],
                "session_count": 0,
                "total_revenue": 0,
                "image_paths": set(),
            }
            for w in week_defs
        }

        for row in months_rows[ym]:
            day_num = int(row["ymd"][8:10])
            if day_num <= 7:
                w_code = "1"
            elif day_num <= 14:
                w_code = "2"
            elif day_num <= 21:
                w_code = "3"
            else:
                w_code = "4"

            fee = int(row["total_fee"] or 0)
            row_paths = [
                p for col in ("checkin_image_url", "checkin_crop_url", "checkout_image_url", "checkout_crop_url")
                if (p := _resolve_media_file(row[col])) is not None
            ]

            for target_code in ("ALL", w_code):
                ws_item = week_stats[target_code]
                ws_item["session_count"] += 1
                ws_item["total_revenue"] += fee
                ws_item["image_paths"].update(row_paths)

        weeks_serialized = []
        for w in week_defs:
            st = week_stats[w["week"]]
            total_bytes = sum(p.stat().st_size for p in st["image_paths"] if p.exists())
            weeks_serialized.append({
                "week": st["week"],
                "label": st["label"],
                "session_count": st["session_count"],
                "total_revenue": st["total_revenue"],
                "image_files_count": len(st["image_paths"]),
                "image_size_kb": round(total_bytes / 1024.0, 1),
            })

        months_out.append({
            "month": clean_m,
            "label": f"Tháng {month_num:02d}/{year_num}",
            "weeks": weeks_serialized,
        })

    return {
        "success": True,
        "months": months_out,
    }


@router.get("/api/admin/archive/export")
async def export_archive_excel(
    month: str = Query(..., description="Tháng YYYY-MM"),
    week: str = Query("ALL", description="ALL hoặc 1, 2, 3, 4"),
    db: sqlite3.Connection = Depends(get_db),
):
    """Bước 3: Xuất file Excel (.xlsx) theo Tháng & Tuần (1-4 hoặc Cả tháng) và cấp token mở khóa Bước 4."""
    clean_m, clean_w, start_date, end_date, label = _resolve_month_week(month, week)

    cur = db.cursor()
    cur.execute(
        """
        SELECT session_code, plate_number, vehicle_type, checkin_time, checkout_time,
               duration_minutes, total_fee, payment_status, staff_checkin, staff_checkout
        FROM parking_sessions
        WHERE status = 'COMPLETED'
          AND substr(COALESCE(checkout_time, checkin_time), 1, 10) BETWEEN ? AND ?
        ORDER BY checkout_time ASC, id ASC
        """,
        (start_date, end_date),
    )
    rows = cur.fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu lịch sử đã hoàn tất trong {label}.")

    wb = Workbook()
    ws = wb.active
    suffix_name = "CaThang" if clean_w == "ALL" else f"Tuan{clean_w}"
    ws.title = f"SaoLuu_{clean_m}_{suffix_name}"[:31]
    navy_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")

    ws.merge_cells("A1:I1")
    ws["A1"] = f"SAO LƯU LỊCH SỬ GỬI XE — {label.upper()} (PARKTECH)"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    ws["A1"].fill = navy_fill
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    headers = [
        "STT", "Mã phiên", "Biển số / Mã vé", "Loại xe",
        "Giờ vào", "Giờ ra", "Thời lượng (phút)", "Phí thu (VNĐ)", "Nhân viên ra",
    ]
    ws.append(headers)
    for col_idx in range(1, 10):
        c = ws.cell(row=2, column=col_idx)
        c.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center")

    total_rev = 0
    for idx, r in enumerate(rows, 1):
        fee = int(r["total_fee"] or 0)
        total_rev += fee
        ws.append([
            idx,
            r["session_code"] or "--",
            r["plate_number"] or "--",
            r["vehicle_type"] or "Ô tô",
            r["checkin_time"] or "--",
            r["checkout_time"] or "--",
            int(r["duration_minutes"] or 0),
            fee,
            r["staff_checkout"] or "--",
        ])
        ws.cell(row=idx + 2, column=8).number_format = '#,##0 "VNĐ"'

    total_row = len(rows) + 3
    ws.cell(row=total_row, column=7, value="TỔNG DOANH THU:").font = Font(bold=True)
    ws.cell(row=total_row, column=8, value=total_rev).font = Font(bold=True)
    ws.cell(row=total_row, column=8).number_format = '#,##0 "VNĐ"'

    for col_idx, width in enumerate([7, 20, 16, 18, 22, 22, 16, 18, 20], 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    now_ts = time.time()
    stale = [k for k, v in _ARCHIVE_EXPORT_TOKENS.items() if now_ts - v["issued_at"] > _ARCHIVE_TOKEN_TTL_SEC]
    for k in stale:
        _ARCHIVE_EXPORT_TOKENS.pop(k, None)

    token = secrets.token_urlsafe(20)
    _ARCHIVE_EXPORT_TOKENS[token] = {
        "month": clean_m,
        "week": clean_w,
        "issued_at": now_ts,
    }

    filename = f"SaoLuu_ParkTech_{clean_m}_{suffix_name}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Archive-Token": token,
        },
    )


@router.post("/api/admin/archive/cleanup")
async def cleanup_archived_data(
    payload: ArchiveCleanupRequest,
    db: sqlite3.Connection = Depends(get_db),
):
    """Bước 4: Xóa ảnh cũ hoặc xóa toàn bộ dữ liệu của Tuần / Cả tháng sau khi Admin đã xuất file Excel."""
    clean_m, clean_w, start_date, end_date, label = _resolve_month_week(payload.month, payload.week)

    mode = (payload.mode or "images_only").strip()
    if mode not in ("images_only", "purge_all"):
        raise HTTPException(status_code=400, detail="Chế độ xóa dữ liệu không hợp lệ.")

    token_info = _ARCHIVE_EXPORT_TOKENS.get(payload.backup_token)
    if (
        not token_info
        or token_info.get("month") != clean_m
        or token_info.get("week") != clean_w
    ):
        raise HTTPException(
            status_code=403,
            detail=f"Vui lòng thực hiện Bước 3 (Xuất file Excel) cho đúng {label} trước khi xóa dữ liệu!",
        )
    if time.time() - token_info["issued_at"] > _ARCHIVE_TOKEN_TTL_SEC:
        _ARCHIVE_EXPORT_TOKENS.pop(payload.backup_token, None)
        raise HTTPException(status_code=403, detail="Phiên sao lưu Excel đã hết hạn, vui lòng xuất lại file Excel.")

    cur = db.cursor()
    cur.execute(
        """
        SELECT id, checkin_image_url, checkin_crop_url, checkout_image_url, checkout_crop_url
        FROM parking_sessions
        WHERE status = 'COMPLETED'
          AND substr(COALESCE(checkout_time, checkin_time), 1, 10) BETWEEN ? AND ?
        """,
        (start_date, end_date),
    )
    rows = cur.fetchall()
    session_ids = [r["id"] for r in rows]

    media_paths: set[Path] = set()
    for r in rows:
        for col in ("checkin_image_url", "checkin_crop_url", "checkout_image_url", "checkout_crop_url"):
            fpath = _resolve_media_file(r[col])
            if fpath is not None:
                media_paths.add(fpath)

    deleted_files = 0
    freed_bytes = 0
    for fpath in media_paths:
        try:
            fsize = fpath.stat().st_size
            fpath.unlink()
            deleted_files += 1
            freed_bytes += fsize
        except OSError as exc:
            logger.warning("Không thể xóa file ảnh %s: %s", fpath, exc)

    deleted_sessions = 0
    if session_ids:
        placeholders = ",".join("?" for _ in session_ids)
        if mode == "purge_all":
            cur.execute(f"DELETE FROM parking_sessions WHERE id IN ({placeholders})", session_ids)
            deleted_sessions = cur.rowcount
        else:
            cur.execute(
                f"""
                UPDATE parking_sessions
                SET checkin_image_url = NULL,
                    checkin_crop_url = NULL,
                    checkout_image_url = NULL,
                    checkout_crop_url = NULL
                WHERE id IN ({placeholders})
                """,
                session_ids,
            )
        db.commit()

    _ARCHIVE_EXPORT_TOKENS.pop(payload.backup_token, None)
    freed_kb = round(freed_bytes / 1024.0, 1)
    return {
        "success": True,
        "month": clean_m,
        "week": clean_w,
        "mode": mode,
        "deleted_files": deleted_files,
        "deleted_sessions": deleted_sessions,
        "freed_kb": freed_kb,
        "message": (
            f"Đã xóa {deleted_files} file ảnh ({freed_kb} KB) và {deleted_sessions} bản ghi của {label}."
            if mode == "purge_all"
            else f"Đã dọn {deleted_files} file ảnh ({freed_kb} KB) của {label}, vẫn giữ nguyên số liệu doanh thu."
        ),
    }
