"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Thống kê & Báo cáo Quản trị viên (Backend/Admin/dashboard.py)
==========================================================================
"""

from __future__ import annotations

from datetime import datetime, timedelta
import io
import logging
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

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
        SELECT vehicle_type, checkin_time, checkout_time, total_fee, status
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

    # Tổng hợp theo từng phiên
    period_in = 0
    period_out = 0
    period_rev = 0

    for row in sessions:
        vtype = row["vehicle_type"] or "Ô tô"
        cin_str = (row["checkin_time"] or "")[:10]
        cout_str = (row["checkout_time"] or "")[:10]
        fee = int(row["total_fee"] or 0)
        status = row["status"] or ""

        if cin_str in daily_stats:
            daily_stats[cin_str]["in_count"] += 1
            period_in += 1
            if vtype == "Xe máy":
                daily_stats[cin_str]["motor_in"] += 1
            elif vtype == "Xe đạp / Đạp điện":
                daily_stats[cin_str]["bike_in"] += 1
            else:
                daily_stats[cin_str]["car_in"] += 1

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
