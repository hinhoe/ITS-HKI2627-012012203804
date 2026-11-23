"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Nghiệp vụ Lịch sử vào/ra & Tra cứu (Backend/history.py)
==========================================================================

Tương ứng 1-1 với giao diện:
- Frontend HTML : Frontend/pages/Employee/history.html
- Frontend JS   : Frontend/js/Employee/history.js
- Frontend CSS  : Frontend/css/Employee/history.css

Chức năng:
1. Tra cứu toàn bộ lịch sử các lượt gửi xe đã hoàn tất (status = 'COMPLETED') từ CSDL SQLite.
2. Bộ lọc đa chiều:
   - Tìm kiếm theo biển số xe (chuẩn hóa không phân biệt dấu cách, gạch nối, hoa/thường).
   - Lọc theo thời gian (Hôm nay, Hôm qua, 7 ngày qua, Tháng này, Tất cả).
   - Lọc theo loại phương tiện (Ô tô, Xe máy).
3. Phân trang linh hoạt chuẩn 20 dòng/trang.
4. Cung cấp dữ liệu chi tiết kèm ảnh đối soát 2 chiều (ảnh lúc vào vs ảnh lúc ra) khi xem Modal.
5. Xuất danh sách báo cáo lịch sử sang file CSV chuẩn UTF-8 BOM hiển thị chuẩn tiếng Việt trên Excel.
"""

from __future__ import annotations

import csv
from datetime import datetime, timedelta
import io
import logging
from math import ceil
import re
import sqlite3
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

from Backend.database.connection import get_db

logger = logging.getLogger("smart_parking.backend.history")

router = APIRouter(tags=["History - Lịch sử vào/ra & Tra cứu"])


def format_dt_vn(dt_str: Optional[str]) -> str:
    """Chuyển chuỗi YYYY-MM-DD HH:MM:SS sang định dạng chuẩn HH:MM:SS - DD/MM/YYYY"""
    if not dt_str:
        return "--"
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%H:%M:%S - %d/%m/%Y")
    except Exception:
        return dt_str


def compute_duration_text(checkin_str: Optional[str], checkout_str: Optional[str]) -> tuple[str, int]:
    """
    Tính thời gian gửi xe giữa thời điểm vào và thời điểm ra.
    Trả về: (Chuỗi hiển thị tiếng Việt, tổng số phút)
    """
    if not checkin_str:
        return "--", 0
    try:
        dt_in = datetime.strptime(checkin_str, "%Y-%m-%d %H:%M:%S")
        if checkout_str:
            dt_out = datetime.strptime(checkout_str, "%Y-%m-%d %H:%M:%S")
        else:
            dt_out = datetime.now()
        
        diff_sec = max(60, int((dt_out - dt_in).total_seconds()))
        total_minutes = diff_sec // 60
        hours = total_minutes // 60
        days = hours // 24
        rem_hours = hours % 24
        rem_minutes = total_minutes % 60

        if days > 0:
            duration_str = f"{days} ngày {rem_hours:02d} giờ"
        elif hours > 0:
            duration_str = f"{hours} giờ {rem_minutes:02d} phút"
        else:
            duration_str = f"{rem_minutes} phút"

        return duration_str, total_minutes
    except Exception:
        return "--", 0


def format_currency_vn(amount: Optional[int]) -> str:
    """Định dạng tiền tệ chuẩn tiếng Việt (VD: 25.000 VNĐ)"""
    if amount is None:
        return "0 VNĐ"
    return f"{amount:,.0f} VNĐ".replace(",", ".")


@router.get("/api/history")
async def get_parking_history(
    keyword: str = Query("", description="Từ khóa biển số xe cần tìm"),
    date_filter: str = Query("all", description="Bộ lọc thời gian: all, today, yesterday, week, month"),
    vehicle_type: str = Query("all", description="Loại xe: all, Ô tô, Xe máy"),
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi trên mỗi trang"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Truy vấn danh sách lịch sử gửi xe đã hoàn tất (status = 'COMPLETED')
    Hỗ trợ tìm kiếm biển số, lọc thời gian, loại xe và phân trang.
    """
    cur = db.cursor()

    # Truy vấn toàn bộ các phiên đã hoàn tất sắp xếp mới nhất lên đầu
    cur.execute(
        """
        SELECT 
            id, session_code, plate_number, vehicle_type, 
            checkin_time, checkout_time, duration_minutes,
            checkin_image_url, checkin_crop_url, 
            checkout_image_url, checkout_crop_url,
            confidence, is_manual, total_fee, payment_status, status,
            staff_checkin, staff_checkout
        FROM parking_sessions
        WHERE status = 'COMPLETED'
        ORDER BY checkout_time DESC, id DESC
        """
    )
    rows = cur.fetchall()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago_dt = now - timedelta(days=7)
    month_start_str = now.strftime("%Y-%m-01")

    filtered = []
    compact_kw = re.sub(r"[\s\-\.]", "", keyword.upper()) if keyword else ""

    for r in rows:
        plate = r["plate_number"] or ""
        compact_plate = re.sub(r"[\s\-\.]", "", plate.upper())

        # 1. Lọc theo từ khóa biển số
        if compact_kw and compact_kw not in compact_plate:
            continue

        # 2. Lọc theo loại xe
        vtype = r["vehicle_type"] or "Ô tô"
        if vehicle_type != "all" and vtype != vehicle_type:
            continue

        # 3. Lọc theo mốc thời gian
        checkout_str = r["checkout_time"] or r["checkin_time"] or ""
        checkout_date = checkout_str[:10] if len(checkout_str) >= 10 else ""

        if date_filter == "today":
            if checkout_date != today_str:
                continue
        elif date_filter == "yesterday":
            if checkout_date != yesterday_str:
                continue
        elif date_filter == "week":
            try:
                co_dt = datetime.strptime(checkout_str, "%Y-%m-%d %H:%M:%S")
                if co_dt < week_ago_dt:
                    continue
            except Exception:
                continue
        elif date_filter == "month":
            if checkout_date < month_start_str:
                continue
        elif date_filter.startswith("date:"):
            target_date = date_filter.replace("date:", "").strip()
            if checkout_date != target_date:
                continue
        elif re.match(r"^\d{4}-\d{2}-\d{2}$", date_filter):
            if checkout_date != date_filter:
                continue
        elif date_filter.startswith("month:"):
            target_month = date_filter.replace("month:", "").strip()
            if not checkout_date.startswith(target_month):
                continue
        elif re.match(r"^\d{4}-\d{2}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue
        elif date_filter.startswith("year:"):
            target_year = date_filter.replace("year:", "").strip()
            if not checkout_date.startswith(target_year):
                continue
        elif re.match(r"^\d{4}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue
        elif date_filter.startswith("date:"):
            target_date = date_filter.replace("date:", "").strip()
            if checkout_date != target_date:
                continue
        elif re.match(r"^\d{4}-\d{2}-\d{2}$", date_filter):
            if checkout_date != date_filter:
                continue
        elif date_filter.startswith("month:"):
            target_month = date_filter.replace("month:", "").strip()
            if not checkout_date.startswith(target_month):
                continue
        elif re.match(r"^\d{4}-\d{2}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue
        elif date_filter.startswith("year:"):
            target_year = date_filter.replace("year:", "").strip()
            if not checkout_date.startswith(target_year):
                continue
        elif re.match(r"^\d{4}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue

        # Tính toán thông tin hiển thị
        duration_text, dur_min = compute_duration_text(r["checkin_time"], r["checkout_time"])
        fee_num = r["total_fee"] or 0

        # Ưu tiên ảnh crop hoặc ảnh toàn cảnh
        in_photo = r["checkin_crop_url"] or r["checkin_image_url"] or None
        out_photo = r["checkout_crop_url"] or r["checkout_image_url"] or None

        filtered.append({
            "id": r["id"],
            "session_code": r["session_code"],
            "plate": plate,
            "type": vtype,
            "timeIn": format_dt_vn(r["checkin_time"]),
            "timeOut": format_dt_vn(r["checkout_time"]),
            "rawTimeIn": r["checkin_time"],
            "rawTimeOut": r["checkout_time"],
            "duration": duration_text,
            "duration_minutes": dur_min,
            "fee": format_currency_vn(fee_num),
            "total_fee": fee_num,
            "payment_status": r["payment_status"] or "PAID",
            "status": "Hoàn tất & Đã mở barrier",
            "checkin_photo": in_photo,
            "checkout_photo": out_photo,
            "staff_checkin": r["staff_checkin"] or "Trần Bảo Anh",
            "staff_checkout": r["staff_checkout"] or "Trần Bảo Anh",
        })

    total_items = len(filtered)
    total_pages = max(1, ceil(total_items / page_size))
    current_page = min(page, total_pages) if total_pages > 0 else 1

    start_idx = (current_page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered[start_idx:end_idx]

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


@router.get("/api/history/stats")
async def get_history_stats(
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Thống kê tổng quan các lượt gửi xe đã hoàn tất và doanh thu:
    - Tổng số lượt đã hoàn tất
    - Số lượt hoàn tất hôm nay
    - Tổng doanh thu
    - Doanh thu hôm nay
    """
    cur = db.cursor()
    cur.execute(
        """
        SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(total_fee), 0) as total_revenue
        FROM parking_sessions
        WHERE status = 'COMPLETED'
        """
    )
    row_total = cur.fetchone()
    total_count = row_total["total_count"] if row_total else 0
    total_rev = row_total["total_revenue"] if row_total else 0

    today_str = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        """
        SELECT 
            COUNT(*) as today_count,
            COALESCE(SUM(total_fee), 0) as today_revenue
        FROM parking_sessions
        WHERE status = 'COMPLETED' AND DATE(checkout_time) = ?
        """,
        (today_str,),
    )
    row_today = cur.fetchone()
    today_count = row_today["today_count"] if row_today else 0
    today_rev = row_today["today_revenue"] if row_today else 0

    return {
        "total_completed": total_count,
        "today_completed": today_count,
        "total_revenue": total_rev,
        "today_revenue": today_rev,
        "total_revenue_display": format_currency_vn(total_rev),
        "today_revenue_display": format_currency_vn(today_rev),
    }


@router.get("/api/history/export")
async def export_parking_history_excel(
    keyword: str = Query("", description="Từ khóa biển số xe cần tìm"),
    date_filter: str = Query("all", description="Bộ lọc thời gian: all, today, yesterday, week, month"),
    vehicle_type: str = Query("all", description="Loại xe: all, Ô tô, Xe máy"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Xuất danh sách lịch sử gửi xe ra file Microsoft Excel (.xlsx) chuẩn chỉnh, chuyên nghiệp:
    - Tiêu đề banner doanh nghiệp nổi bật
    - Bảng thông tin siêu dữ liệu (Thời gian xuất, Bộ lọc, Tổng lượt xe, Tổng doanh thu)
    - Định dạng cột số tiền kế toán (#,##0 VNĐ), căn giữa các trường mã/thời gian
    - Màu xen kẽ (Zebra rows) và dòng Tổng cộng nổi bật
    - Tự động căn chỉnh độ rộng cột chuẩn xác không bị tràn chữ
    """
    cur = db.cursor()
    cur.execute(
        """
        SELECT 
            id, session_code, plate_number, vehicle_type, 
            checkin_time, checkout_time, duration_minutes,
            total_fee, payment_status, staff_checkin, staff_checkout
        FROM parking_sessions
        WHERE status = 'COMPLETED'
        ORDER BY checkout_time DESC, id DESC
        """
    )
    rows = cur.fetchall()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago_dt = now - timedelta(days=7)
    month_start_str = now.strftime("%Y-%m-01")

    compact_kw = re.sub(r"[\s\-\.]", "", keyword.upper()) if keyword else ""
    filtered_rows = []
    total_revenue = 0

    for r in rows:
        plate = r["plate_number"] or ""
        compact_plate = re.sub(r"[\s\-\.]", "", plate.upper())

        if compact_kw and compact_kw not in compact_plate:
            continue

        vtype = r["vehicle_type"] or "Ô tô"
        if vehicle_type != "all" and vtype != vehicle_type:
            continue

        checkout_str = r["checkout_time"] or r["checkin_time"] or ""
        checkout_date = checkout_str[:10] if len(checkout_str) >= 10 else ""

        if date_filter == "today":
            if checkout_date != today_str:
                continue
        elif date_filter == "yesterday":
            if checkout_date != yesterday_str:
                continue
        elif date_filter == "week":
            try:
                co_dt = datetime.strptime(checkout_str, "%Y-%m-%d %H:%M:%S")
                if co_dt < week_ago_dt:
                    continue
            except Exception:
                continue
        elif date_filter == "month":
            if checkout_date < month_start_str:
                continue
        elif date_filter.startswith("date:"):
            target_date = date_filter.replace("date:", "").strip()
            if checkout_date != target_date:
                continue
        elif re.match(r"^\d{4}-\d{2}-\d{2}$", date_filter):
            if checkout_date != date_filter:
                continue
        elif date_filter.startswith("month:"):
            target_month = date_filter.replace("month:", "").strip()
            if not checkout_date.startswith(target_month):
                continue
        elif re.match(r"^\d{4}-\d{2}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue
        elif date_filter.startswith("year:"):
            target_year = date_filter.replace("year:", "").strip()
            if not checkout_date.startswith(target_year):
                continue
        elif re.match(r"^\d{4}$", date_filter):
            if not checkout_date.startswith(date_filter):
                continue

        fee_num = r["total_fee"] or 0
        total_revenue += fee_num
        filtered_rows.append(r)

    # =========================================================================
    # KHỞI TẠO VÀ ĐỊNH DẠNG WORKBOOK EXCEL BẰNG OPENPYXL
    # =========================================================================
    wb = Workbook()
    ws = wb.active
    ws.title = "Lịch Sử Gửi Xe"
    ws.views.sheetView[0].showGridLines = True

    # Khai báo các style mẫu chuyên nghiệp
    font_company = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    font_report_title = Font(name="Segoe UI", size=12, bold=True, color="1E3A8A")
    font_meta_label = Font(name="Segoe UI", size=10, bold=True, color="475569")
    font_meta_val = Font(name="Segoe UI", size=10, bold=False, color="0F172A")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Segoe UI", size=10, color="1E293B")
    font_data_bold = Font(name="Segoe UI", size=10, bold=True, color="0F172A")
    font_paid = Font(name="Segoe UI", size=10, bold=True, color="15803D")
    font_total = Font(name="Segoe UI", size=11, bold=True, color="1E3A8A")

    fill_banner = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_header = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    fill_zebra_even = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    fill_zebra_odd = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    fill_total = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")

    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")

    thin_border_side = Side(style="thin", color="CBD5E1")
    border_cell = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    border_total = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=Side(style="thin", color="1E3A8A"),
        bottom=Side(style="double", color="1E3A8A")
    )

    # 1. Hàng 2: Banner Doanh nghiệp
    ws.merge_cells("A2:K2")
    cell_a2 = ws["A2"]
    cell_a2.value = "HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH"
    cell_a2.font = font_company
    cell_a2.fill = fill_banner
    cell_a2.alignment = align_center
    ws.row_dimensions[2].height = 36

    # 2. Hàng 3: Tiêu đề báo cáo
    ws.merge_cells("A3:K3")
    cell_a3 = ws["A3"]
    cell_a3.value = "BÁO CÁO LỊCH SỬ GỬI XE & TRA CỨU CHI TIẾT"
    cell_a3.font = font_report_title
    cell_a3.alignment = align_center
    ws.row_dimensions[3].height = 24

    # 3. Hàng 5 & 6: Khối thông tin bổ trợ (Metadata)
    ws["B5"] = "Thời gian xuất báo cáo:"
    ws["B5"].font = font_meta_label
    ws["C5"] = now.strftime("%H:%M:%S - %d/%m/%Y")
    ws["C5"].font = font_meta_val

    ws["G5"] = "Tổng số lượt xe:"
    ws["G5"].font = font_meta_label
    ws["H5"] = f"{len(filtered_rows):,} lượt".replace(",", ".")
    ws["H5"].font = font_meta_val

    ws["B6"] = "Bộ lọc áp dụng:"
    ws["B6"].font = font_meta_label
    filter_desc = f"Thời gian: {date_filter} | Loại xe: {vehicle_type}"
    if keyword:
        filter_desc += f" | Từ khóa: {keyword}"
    ws["C6"] = filter_desc
    ws["C6"].font = font_meta_val

    ws["G6"] = "Tổng doanh thu thu được:"
    ws["G6"].font = font_meta_label
    ws["H6"] = f"{total_revenue:,.0f} VNĐ".replace(",", ".")
    ws["H6"].font = font_data_bold

    # 4. Hàng 8: Tiêu đề bảng cột dữ liệu
    headers = [
        "STT",
        "Mã Phiên Gửi",
        "Biển Số Xe",
        "Loại Phương Tiện",
        "Thời Gian Vào",
        "Thời Gian Ra",
        "Thời Gian Gửi",
        "Phí Thu (VNĐ)",
        "Trạng Thái Thanh Toán",
        "Nhân Viên Vào",
        "Nhân Viên Ra",
    ]

    header_row = 8
    ws.row_dimensions[header_row].height = 28

    for col_idx, header_text in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=header_text)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center
        cell.border = border_cell

    # 5. Điền dữ liệu các dòng
    current_row = 9

    for idx, r in enumerate(filtered_rows, 1):
        ws.row_dimensions[current_row].height = 22
        fill_row = fill_zebra_even if idx % 2 == 0 else fill_zebra_odd

        duration_text, _ = compute_duration_text(r["checkin_time"], r["checkout_time"])
        fee_num = r["total_fee"] or 0
        plate = r["plate_number"] or ""

        row_data = [
            (idx, align_center, font_data),
            (r["session_code"] or "--", align_center, font_data),
            (plate, align_center, font_data_bold),
            (r["vehicle_type"] or "Ô tô", align_center, font_data),
            (format_dt_vn(r["checkin_time"]), align_center, font_data),
            (format_dt_vn(r["checkout_time"]), align_center, font_data),
            (duration_text, align_center, font_data),
            (fee_num, align_right, font_data_bold),
            ("Đã thanh toán" if (r["payment_status"] == "PAID") else "Chưa thanh toán", align_center, font_paid),
            (r["staff_checkin"] or "--", align_center, font_data),
            (r["staff_checkout"] or "--", align_center, font_data),
        ]

        for col_idx, (val, align, font_style) in enumerate(row_data, 1):
            cell = ws.cell(row=current_row, column=col_idx, value=val)
            cell.font = font_style
            cell.alignment = align
            cell.fill = fill_row
            cell.border = border_cell
            if col_idx == 8:  # Cột phí thu
                cell.number_format = '#,##0 "VNĐ"'

        current_row += 1

    # 6. Dòng Tổng cộng Doanh thu (Summary Row)
    ws.row_dimensions[current_row].height = 26
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=7)
    cell_total_label = ws.cell(row=current_row, column=1, value="TỔNG CỘNG DOANH THU:")
    cell_total_label.font = font_total
    cell_total_label.alignment = align_right
    cell_total_label.fill = fill_total

    for c in range(1, 8):
        ws.cell(row=current_row, column=c).border = border_total
        ws.cell(row=current_row, column=c).fill = fill_total

    cell_total_val = ws.cell(row=current_row, column=8, value=total_revenue)
    cell_total_val.font = font_total
    cell_total_val.alignment = align_right
    cell_total_val.fill = fill_total
    cell_total_val.number_format = '#,##0 "VNĐ"'
    cell_total_val.border = border_total

    for c in range(9, 12):
        ws.cell(row=current_row, column=c).border = border_total
        ws.cell(row=current_row, column=c).fill = fill_total

    # 7. Tự động tính toán và đặt độ rộng cột tối ưu
    col_min_widths = {
        1: 8,   # STT
        2: 20,  # Mã Phiên Gửi
        3: 18,  # Biển Số Xe
        4: 20,  # Loại Phương Tiện
        5: 25,  # Thời Gian Vào
        6: 25,  # Thời Gian Ra
        7: 18,  # Thời Gian Gửi
        8: 20,  # Phí Thu
        9: 24,  # Trạng Thái Thanh Toán
        10: 18, # Nhân Viên Vào
        11: 18, # Nhân Viên Ra
    }

    for col_idx, min_w in col_min_widths.items():
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = min_w

    # Xuất ra bộ nhớ đệm BytesIO
    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_data = excel_buffer.getvalue()
    filename = f"Lich_Su_Gui_Xe_{now.strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


class UpdateHistoryPayload(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = None


@router.put("/api/history/{session_id}")
async def update_history_session(
    session_id: int,
    payload: UpdateHistoryPayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Sửa biển số xe hoặc loại xe trong lịch sử nếu bị nhập sai.
    """
    clean_plate = payload.plate_number.strip().upper()
    if not clean_plate:
        raise HTTPException(status_code=400, detail="Biển số xe không được để trống")

    cur = db.cursor()
    cur.execute("SELECT id FROM parking_sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi lịch sử cần sửa")

    if payload.vehicle_type:
        cur.execute(
            """
            UPDATE parking_sessions
            SET plate_number = ?, vehicle_type = ?
            WHERE id = ?
            """,
            (clean_plate, payload.vehicle_type, session_id),
        )
    else:
        cur.execute(
            """
            UPDATE parking_sessions
            SET plate_number = ?
            WHERE id = ?
            """,
            (clean_plate, session_id),
        )
    db.commit()

    return {
        "success": True,
        "message": f"Đã sửa thành công biển số thành: {clean_plate}",
        "session_id": session_id,
        "plate_number": clean_plate,
        "vehicle_type": payload.vehicle_type,
    }


@router.delete("/api/history/{session_id}")
async def delete_history_session(
    session_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Xóa bản ghi lịch sử gửi xe bị sai hoặc không hợp lệ.
    """
    cur = db.cursor()
    cur.execute("SELECT id, plate_number FROM parking_sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi cần xóa")

    plate = row["plate_number"]
    cur.execute("DELETE FROM parking_sessions WHERE id = ?", (session_id,))
    db.commit()

    return {
        "success": True,
        "message": f"Đã xóa thành công bản ghi lịch sử xe {plate}",
        "session_id": session_id,
    }
