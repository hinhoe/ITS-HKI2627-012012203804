"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Xử lý nghiệp vụ Ghi nhận xe ra & Tính phí (Backend/checkout.py)
==========================================================================

Tương ứng trực tiếp 1-1 với giao diện:
- Frontend HTML : Frontend/pages/Employee/checkout.html
- Frontend JS   : Frontend/js/Employee/checkout.js
- Frontend CSS  : Frontend/css/Employee/checkout.css

Chức năng chính:
1. Nhận diện biển số xe ra (YOLOv8 + Gemini OCR) qua camera hoặc tải ảnh.
2. Tự động đối soát và truy vấn trong CSDL (bảng `parking_sessions`) xem xe này vào lúc nào.
3. Tính toán chính xác thời gian đỗ xe (giờ/phút) và áp dụng biểu phí tự động (Ban ngày / Qua đêm).
4. Xác nhận hoàn tất lượt gửi xe ra bãi, mở barrier và cập nhật giảm số lượng xe đang trong bãi.
"""

from __future__ import annotations

from datetime import datetime
import logging
from pathlib import Path
import re
import time
from typing import Optional
import uuid

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import numpy as np
from pydantic import BaseModel, Field
import sqlite3

from AI.detect import crop_plate, detect_plates, draw_bboxes, save_crop, validate_crop
from AI.ocr import default_reader, normalize_plate_spacing, preprocess_plate, GeminiServiceError
from AI.schemas import PlateResult, RecognitionStatus
from Backend.config import settings
from Backend.database.connection import get_db

logger = logging.getLogger("smart_parking.backend.checkout")

# Router riêng cho nghiệp vụ Check-out
router = APIRouter(tags=["Checkout - Ghi nhận xe ra & Tính phí"])


# ==========================================================================
# CÁC SCHEMA DỮ LIỆU NGHIỆP VỤ CHECK-OUT
# ==========================================================================
class CheckoutConfirmRequest(BaseModel):
    session_id: Optional[int] = Field(default=None, description="ID phiên lượt gửi tìm thấy trong CSDL")
    plate_number: str = Field(..., description="Biển số xe ra bãi")
    vehicle_type: str = Field(default="Ô tô", description="Loại xe: 'Ô tô' hoặc 'Xe máy'")
    checkout_image_url: Optional[str] = Field(default=None, description="Đường dẫn ảnh xe lúc ra")
    checkout_crop_url: Optional[str] = Field(default=None, description="Đường dẫn ảnh crop biển số lúc ra")
    total_fee: int = Field(default=25000, description="Số tiền phí phải thu (VNĐ)")
    payment_status: str = Field(default="PAID", description="Trạng thái thanh toán ('PAID', 'UNPAID')")
    staff_checkout: Optional[str] = Field(default="Trần Bảo Anh", description="Tên nhân viên trực ca lúc xe ra")


def decode_checkout_image(filename: str, raw_bytes: bytes) -> np.ndarray:
    """Kiểm tra tính hợp lệ và giải mã file ảnh xe ra thành ma trận BGR (OpenCV)."""
    if not filename:
        raise HTTPException(status_code=400, detail="Tên file ảnh không hợp lệ.")

    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS and not filename.startswith("blob"):
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng '{ext}' không được hỗ trợ. Chỉ chấp nhận: JPG, JPEG, PNG, WEBP.",
        )

    if not raw_bytes or len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="File ảnh rỗng.")

    if len(raw_bytes) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"Dung lượng ảnh vượt quá giới hạn cho phép {settings.MAX_FILE_SIZE_MB}MB.",
        )

    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise HTTPException(status_code=400, detail="Không thể giải mã dữ liệu file ảnh.")

    return image


def calculate_parking_fee(db: sqlite3.Connection, vehicle_type: str, checkin_dt: datetime, checkout_dt: datetime) -> tuple[str, int]:
    """
    Tính phí gửi xe dựa trên loại xe, thời lượng đỗ và biểu phí trong CSDL:
    - Xe máy: 5.000 đ (Ban ngày), 10.000 đ (Qua đêm)
    - Ô tô   : 25.000 đ (Ban ngày), 50.000 đ (Qua đêm)
    """
    diff = checkout_dt - checkin_dt
    duration_hours = diff.total_seconds() / 3600.0

    # Nếu đỗ qua 18h hoặc gửi trên 8 tiếng tính giá qua đêm
    is_overnight = (checkout_dt.hour >= 18 or checkout_dt.hour < 6 or duration_hours >= 8.0)
    fee_type = "Qua đêm" if is_overnight else "Ban ngày"

    # Đọc từ bảng pricing_rules nếu có
    cur = db.cursor()
    cur.execute(
        "SELECT base_price FROM pricing_rules WHERE vehicle_type = ? AND fee_type = ? AND is_active = 1 LIMIT 1",
        (vehicle_type, fee_type),
    )
    row = cur.fetchone()
    if row:
        return fee_type, row["base_price"]

    # Mặc định an toàn nếu chưa cấu hình CSDL
    if vehicle_type == "Xe máy":
        base_fee = 10000 if is_overnight else 5000
    else:
        base_fee = 50000 if is_overnight else 25000

    return fee_type, base_fee


@router.post("/api/checkout/recognize")
async def process_checkout_recognition(
    file: Optional[UploadFile] = File(default=None, description="Ảnh phương tiện ra bãi"),
    image: Optional[UploadFile] = File(default=None, description="Ảnh phương tiện ra bãi (alias)"),
    use_preprocess: bool = Form(default=True, description="Kích hoạt tiền xử lý nâng cao"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Quy trình nhận diện AI cho xe ra bãi & Tự động đối soát CSDL:
    1. Nhận diện biển số và loại phương tiện qua YOLOv8 + Gemini OCR.
    2. Tự động tra cứu trong CSDL xem biển số này vào lúc nào.
    3. Tính thời gian đỗ xe và số tiền phí tương ứng.
    4. Trả về kết quả đối chiếu đầy đủ cho giao diện checkout.html.
    """
    target_file = file or image
    if target_file is None:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp file ảnh phương tiện ra bãi.")

    start_t = time.perf_counter()
    request_id = uuid.uuid4().hex[:12]

    raw_bytes = await target_file.read()
    image = decode_checkout_image(target_file.filename or "capture_out.jpg", raw_bytes)

    # 1. Lưu ảnh gốc vào uploads/
    orig_filename = f"{request_id}_original_out.jpg"
    orig_path = settings.UPLOAD_DIR / orig_filename
    cv2.imwrite(str(orig_path), image)
    orig_url = f"/uploads/{orig_filename}"

    # 2. Phát hiện vị trí biển số bằng YOLOv8
    detection = detect_plates(image, conf_threshold=settings.CONFIDENCE_THRESHOLD)
    if not detection.found or not detection.boxes:
        return {
            "success": False,
            "status": "not_detected",
            "message": "Không phát hiện thấy biển số xe trong ảnh tại cổng ra!",
            "original_image_url": orig_url,
            "plates": [],
        }

    # Vẽ bounding box lên ảnh annotated
    ann_img = draw_bboxes(image, detection.boxes)
    ann_filename = f"{request_id}_annotated_out.jpg"
    ann_path = settings.RESULTS_DIR / ann_filename
    cv2.imwrite(str(ann_path), ann_img)
    ann_url = f"/results/{ann_filename}"

    # Cắt biển số thứ nhất
    bbox = detection.boxes[0]
    crop_img = crop_plate(image, bbox, pad_ratio=settings.CROP_PAD_RATIO)
    is_valid, reason = validate_crop(crop_img)

    crop_filename = f"{request_id}_crop_0.jpg"
    save_crop(crop_img, settings.RESULTS_DIR / crop_filename)
    crop_url = f"/results/{crop_filename}"

    prep_img = None
    if is_valid and use_preprocess:
        prep_img = preprocess_plate(crop_img)

    # 3. Nhận diện ký tự bằng Gemini Vision OCR
    try:
        rec_result = default_reader.read_plate(crop_img, prep_img)
        raw_plate = rec_result.plate_number or rec_result.raw_text or "Chưa rõ"
        detected_plate = normalize_plate_spacing(raw_plate)
        raw_vtype = rec_result.vehicle_type.value if hasattr(rec_result.vehicle_type, "value") else str(rec_result.vehicle_type)
        vtype = "Xe máy" if raw_vtype == "motorbike" else "Ô tô"
        ocr_conf = rec_result.warnings and 85.0 or 99.5
    except Exception as exc:
        logger.error("[%s] Lỗi nhận diện OCR xe ra: %s", request_id, exc)
        detected_plate = "Chưa rõ"
        vtype = "Ô tô"
        ocr_conf = 0.0
        rec_result = None

    # 4. Tự động đối soát CSDL với các phiên xe đang đỗ (status = 'PARKED')
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    compact_detected = re.sub(r"[\s\-\.]", "", detected_plate.upper())
    cur = db.cursor()

    # Truy vấn phiên xe đang đỗ gần nhất khớp biển số
    cur.execute(
        """
        SELECT id, session_code, plate_number, vehicle_type, checkin_time, checkin_image_url, checkin_crop_url, staff_checkin
        FROM parking_sessions
        WHERE status = 'PARKED'
        ORDER BY checkin_time DESC
        """
    )
    active_sessions = cur.fetchall()

    matched_session = None
    for sess in active_sessions:
        compact_db = re.sub(r"[\s\-\.]", "", sess["plate_number"].upper())
        if compact_db == compact_detected or (len(compact_detected) >= 6 and compact_detected in compact_db):
            matched_session = sess
            break

    total_time_ms = round((time.perf_counter() - start_t) * 1000, 1)

    if matched_session:
        # Tìm thấy lượt xe vào trong CSDL
        checkin_time_str = matched_session["checkin_time"]
        try:
            checkin_dt = datetime.strptime(checkin_time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            checkin_dt = now

        diff_seconds = max(60, int((now - checkin_dt).total_seconds()))
        duration_minutes = diff_seconds // 60
        hours = duration_minutes // 60
        minutes = duration_minutes % 60
        duration_display = f"{hours} giờ {minutes:02d} phút" if hours > 0 else f"{minutes} phút"

        session_vtype = matched_session["vehicle_type"] or vtype
        fee_type, fee_amount = calculate_parking_fee(db, session_vtype, checkin_dt, now)

        return {
            "success": True,
            "matched": True,
            "message": "Đã tìm thấy thông tin lượt xe vào đối soát!",
            "plate": detected_plate,
            "vehicle_type": session_vtype,
            "confidence": f"{ocr_conf:.1f}%",
            "yolo_confidence": f"{bbox.confidence * 100:.1f}%",
            "processing_time_ms": total_time_ms,
            "original_image_url": orig_url,
            "annotated_image_url": ann_url,
            "crop_image_url": crop_url,
            "checkin_info": {
                "session_id": matched_session["id"],
                "session_code": matched_session["session_code"],
                "plate_number": matched_session["plate_number"],
                "vehicle_type": session_vtype,
                "checkin_time": checkin_time_str,
                "checkin_crop_url": matched_session["checkin_crop_url"],
                "checkout_time": now_str,
                "duration_display": duration_display,
                "duration_minutes": duration_minutes,
                "fee_type": fee_type,
                "fee_amount": fee_amount,
                "fee_display": f"{fee_amount:,.0f} VNĐ".replace(",", "."),
                "fee_display_table": f"{fee_amount:,.0f} đ".replace(",", "."),
            },
        }
    else:
        # Không tìm thấy phiên vào (xe vãng lai hoặc biển chưa nhận dạng được lúc vào)
        default_fee = 25000 if vtype == "Ô tô" else 5000
        return {
            "success": True,
            "matched": False,
            "message": "Không tìm thấy thông tin lượt vào của xe này trong hệ thống (Xe vãng lai)!",
            "plate": detected_plate,
            "vehicle_type": vtype,
            "confidence": f"{ocr_conf:.1f}%",
            "yolo_confidence": f"{bbox.confidence * 100:.1f}%",
            "processing_time_ms": total_time_ms,
            "original_image_url": orig_url,
            "annotated_image_url": ann_url,
            "crop_image_url": crop_url,
            "checkin_info": {
                "session_id": None,
                "session_code": f"SES-OUT-{now.strftime('%Y%m%d%H%M%S')}",
                "plate_number": detected_plate,
                "vehicle_type": vtype,
                "checkin_time": "Không xác định",
                "checkin_crop_url": None,
                "checkout_time": now_str,
                "duration_display": "--",
                "duration_minutes": 0,
                "fee_type": "Vãng lai / Thu phí chuẩn",
                "fee_amount": default_fee,
                "fee_display": f"{default_fee:,.0f} VNĐ".replace(",", "."),
                "fee_display_table": f"{default_fee:,.0f} đ".replace(",", "."),
            },
        }


@router.post("/api/checkout/confirm")
async def confirm_checkout_session(
    payload: CheckoutConfirmRequest,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Nghiệp vụ khi nhân viên nhấn "Ghi nhận xe ra bãi (Mở Barrier)":
    1. Cập nhật phiên gửi trong CSDL thành `status = 'COMPLETED'`, `checkout_time = now`.
    2. Cập nhật số tiền phí và trạng thái thanh toán `payment_status = 'PAID'`.
    3. Giảm số lượng xe đang trong bãi.
    4. Trả về thông tin hoàn tất để giao diện mở barrier và cập nhật bảng lịch sử xe ra.
    """
    clean_plate = payload.plate_number.strip().upper()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur = db.cursor()

    try:
        session_id = payload.session_id

        # Nếu chưa có session_id, tìm kiếm phiên PARKED gần nhất khớp biển số này
        if not session_id:
            compact_plate = re.sub(r"[\s\-\.]", "", clean_plate)
            cur.execute(
                """
                SELECT id, plate_number FROM parking_sessions
                WHERE status = 'PARKED'
                ORDER BY checkin_time DESC
                """
            )
            for cand in cur.fetchall():
                cand_compact = re.sub(r"[\s\-\.]", "", cand["plate_number"].upper())
                if cand_compact == compact_plate or (len(compact_plate) >= 6 and compact_plate in cand_compact):
                    session_id = cand["id"]
                    break

        # Nếu có session_id tìm thấy, cập nhật phiên đó thành COMPLETED
        if session_id:
            cur.execute(
                """
                UPDATE parking_sessions
                SET status = 'COMPLETED',
                    checkout_time = ?,
                    checkout_crop_url = ?,
                    total_fee = ?,
                    payment_status = ?,
                    staff_checkout = ?
                WHERE id = ?
                """,
                (
                    now_str,
                    payload.checkout_crop_url,
                    payload.total_fee,
                    payload.payment_status or "PAID",
                    payload.staff_checkout or "Trần Bảo Anh",
                    session_id,
                ),
            )
        else:
            # Nếu là xe vãng lai chưa có session_id, tạo một phiên hoàn tất mới
            date_code = datetime.now().strftime("%Y%m%d")
            random_suffix = uuid.uuid4().hex[:6].upper()
            session_code = f"SES-COMP-{date_code}-{random_suffix}"

            cur.execute(
                """
                INSERT INTO parking_sessions (
                    session_code, plate_number, vehicle_type, checkin_time, checkout_time,
                    checkout_crop_url, total_fee, payment_status, status, staff_checkout
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
                """,
                (
                    session_code,
                    clean_plate,
                    payload.vehicle_type,
                    now_str,
                    now_str,
                    payload.checkout_crop_url,
                    payload.total_fee,
                    payload.payment_status or "PAID",
                    payload.staff_checkout or "Trần Bảo Anh",
                ),
            )
            session_id = cur.lastrowid

        db.commit()

        # Tính toán sức chứa bãi xe sau khi xe đã ra
        cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED'")
        parked_count = cur.fetchone()[0]

        total_cap = 500
        cur.execute("SELECT total_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
        lot_row = cur.fetchone()
        if lot_row:
            total_cap = lot_row["total_capacity"]

        fee_display_table = f"{payload.total_fee:,.0f} đ".replace(",", ".")

        return {
            "success": True,
            "message": "Ghi nhận xe ra bãi thành công. Barrier tự động mở!",
            "session": {
                "id": session_id,
                "plate_number": clean_plate,
                "vehicle_type": payload.vehicle_type,
                "checkout_time": now_str,
                "total_fee": payload.total_fee,
                "fee_display_table": fee_display_table,
                "status": "Hoàn tất & Đã mở barrier",
            },
            "stats": {
                "total_capacity": total_cap,
                "current_count": parked_count,
                "available_spots": max(0, total_cap - parked_count),
            },
        }
    except Exception as exc:
        logger.error("Lỗi khi ghi nhận xe ra: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi cơ sở dữ liệu khi ghi nhận xe ra: {exc}")


@router.get("/api/checkout/history")
async def get_checkout_history(
    limit: int = 10,
    db: sqlite3.Connection = Depends(get_db),
):
    """Lấy danh sách các lượt xe ra bãi gần nhất từ CSDL thật."""
    cur = db.cursor()
    cur.execute(
        """
        SELECT id, session_code, plate_number, vehicle_type, checkin_time, checkout_time, total_fee, status, staff_checkout
        FROM parking_sessions
        WHERE status = 'COMPLETED'
        ORDER BY checkout_time DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cur.fetchall()
    results = []
    for r in rows:
        fee = r["total_fee"] or 0
        fee_str = f"{fee:,.0f} đ".replace(",", ".")
        results.append({
            "id": r["id"],
            "session_code": r["session_code"],
            "plate": r["plate_number"],
            "type": r["vehicle_type"] or "Ô tô",
            "time": r["checkout_time"] or r["checkin_time"],
            "fee": fee_str,
            "fee_raw": fee,
            "status": "Hoàn tất & Đã mở barrier",
            "staff": r["staff_checkout"],
        })
    return results
