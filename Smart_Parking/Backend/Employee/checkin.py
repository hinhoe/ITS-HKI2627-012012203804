"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend: Xử lý nghiệp vụ Ghi nhận xe vào bãi (Backend/checkin.py)
==========================================================================

Tương ứng trực tiếp 1-1 với giao diện:
- Frontend HTML : Frontend/pages/Employee/checkin.html
- Frontend JS   : Frontend/js/Employee/checkin.js
- Frontend CSS  : Frontend/css/Employee/checkin.css

Chức năng chính:
1. Tiếp nhận ảnh xe vào bãi (chụp từ Webcam/Camera giám sát hoặc tải từ máy tính).
2. Gọi mô hình AI YOLOv8 (AI/detect.py) để khoanh vùng và cắt riêng biển số xe.
3. Gọi mô hình AI Gemini Vision OCR (AI/ocr.py) nhận diện ký tự biển số (Xe máy / Ô tô).
4. Lưu ảnh gốc vào uploads/ và ảnh xử lý (annotated, crop) vào results/.
5. Trả về kết quả JSON chi tiết cho giao diện checkin.html hiển thị.
"""

from __future__ import annotations

from datetime import datetime
import logging
from pathlib import Path
import re
import time
from typing import Any, Optional
import uuid

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import numpy as np
from pydantic import BaseModel, Field
import sqlite3

from AI.detect import crop_plate, detect_plates, draw_bboxes, save_crop, validate_crop
from AI.ocr import default_reader, preprocess_plate, GeminiServiceError
from AI.schemas import PlateResult, RecognitionStatus, RecognizeResponse
from Backend.config import settings
from Backend.database.connection import get_db

logger = logging.getLogger("smart_parking.backend.checkin")

# Router riêng biệt cho nghiệp vụ Check-in
router = APIRouter(tags=["Checkin - Ghi nhận xe vào"])


# ==========================================================================
# CÁC SCHEMA DỮ LIỆU NGHIỆP VỤ CHECK-IN
# ==========================================================================
class CheckinConfirmRequest(BaseModel):
    plate_number: str = Field(..., description="Biển số xe cần ghi nhận vào bãi")
    vehicle_type: str = Field(default="Ô tô", description="Loại xe: 'Ô tô' hoặc 'Xe máy'")
    checkin_image_url: Optional[str] = Field(default=None, description="Đường dẫn ảnh xe lúc vào")
    checkin_crop_url: Optional[str] = Field(default=None, description="Đường dẫn ảnh crop biển số lúc vào")
    confidence: Optional[float] = Field(default=99.5, description="Độ tin cậy nhận diện (%)")
    is_manual: bool = Field(default=False, description="Nhân viên nhập tay hay AI đọc tự động")
    staff_checkin: Optional[str] = Field(default="Trần Bảo Anh", description="Tên nhân viên trực ca")


class CheckinRecordOut(BaseModel):
    id: int
    session_code: str
    plate_number: str
    vehicle_type: str
    checkin_time: str
    confidence: float
    is_manual: int
    status: str
    staff_checkin: Optional[str] = None
    checkin_crop_url: Optional[str] = None


class CheckinStatsOut(BaseModel):
    total_capacity: int
    current_count: int
    available_spots: int
    moto_count: int
    car_count: int


def decode_checkin_image(filename: str, raw_bytes: bytes) -> np.ndarray:
    """
    Kiểm tra tính hợp lệ và giải mã file ảnh xe vào bãi thành ma trận BGR (OpenCV).
    """
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


@router.post("/api/recognize", response_model=RecognizeResponse)
@router.post("/api/checkin/recognize", response_model=RecognizeResponse)
async def process_checkin_recognition(
    file: UploadFile = File(..., description="Ảnh phương tiện vào bãi (từ camera hoặc máy tính)"),
    plate_index: Optional[int] = Form(default=None, description="Chỉ định chỉ số biển số cần đọc (nếu có nhiều biển)"),
    read_all: bool = Form(default=False, description="Nhận diện toàn bộ tất cả biển số tìm thấy"),
    use_preprocess: bool = Form(default=True, description="Kích hoạt tiền xử lý nâng cao tương phản CLAHE"),
):
    """
    Quy trình nhận diện AI cho xe vào bãi:
    1. Tiếp nhận và lưu ảnh gốc vào uploads/
    2. YOLOv8 phát hiện tọa độ biển số (Bounding Box)
    3. Cắt an toàn vùng biển số kèm padding 8%
    4. Gemini Vision OCR đọc ký tự biển số
    5. Trả về kết quả kèm URL ảnh khoanh vùng và ảnh crop cho checkin.html
    """
    start_t = time.perf_counter()
    request_id = uuid.uuid4().hex[:12]

    # Đọc dữ liệu nhị phân của ảnh tải lên
    raw_bytes = await file.read()
    image = decode_checkin_image(file.filename or "capture.jpg", raw_bytes)

    # Lưu ảnh gốc vào thư mục uploads/
    ext = Path(file.filename or "capture.jpg").suffix.lower()
    if not ext or ext not in settings.ALLOWED_EXTENSIONS:
        ext = ".jpg"
    orig_filename = f"{request_id}_original{ext}"
    orig_path = settings.UPLOAD_DIR / orig_filename
    orig_path.write_bytes(raw_bytes)
    orig_url = f"/uploads/{orig_filename}"

    # 1. Gọi mô hình YOLOv8 phát hiện biển số
    try:
        detection = detect_plates(image)
    except Exception as exc:
        logger.error("[%s] Lỗi YOLOv8: %s", request_id, exc)
        return RecognizeResponse(
            request_id=request_id,
            status=RecognitionStatus.ERROR,
            message=f"Lỗi khi phát hiện biển số: {exc}",
            original_image_url=orig_url,
            processing_time_ms=round((time.perf_counter() - start_t) * 1000, 1),
        )

    # Không phát hiện thấy biển số trong ảnh
    if not detection.found:
        return RecognizeResponse(
            request_id=request_id,
            status=RecognitionStatus.NOT_DETECTED,
            message="Không phát hiện thấy biển số trong ảnh phương tiện.",
            original_image_url=orig_url,
            plate_count=0,
            plates=[],
            processing_time_ms=round((time.perf_counter() - start_t) * 1000, 1),
        )

    # Lưu ảnh có vẽ Bounding box xanh lá vào results/
    annotated = draw_bboxes(image, detection.boxes)
    ann_filename = f"{request_id}_annotated.jpg"
    ann_path = settings.RESULTS_DIR / ann_filename
    ok_ann, buf_ann = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if ok_ann:
        ann_path.write_bytes(buf_ann.tobytes())
    ann_url = f"/results/{ann_filename}"

    # 2. Cắt các vùng biển số (Crop)
    cropped_entries: list[tuple[int, PlateResult, Optional[np.ndarray], Optional[np.ndarray]]] = []

    for idx, bbox in enumerate(detection.boxes):
        crop_img = crop_plate(image, bbox)
        if crop_img is None:
            pr = PlateResult(
                index=idx,
                bbox=bbox,
                crop_valid=False,
                crop_error="Vùng crop không hợp lệ hoặc quá nhỏ.",
            )
            cropped_entries.append((idx, pr, None, None))
            continue

        is_valid, reason = validate_crop(crop_img)
        crop_filename = f"{request_id}_crop_{idx}.jpg"
        save_crop(crop_img, settings.RESULTS_DIR / crop_filename)
        crop_url = f"/results/{crop_filename}"

        prep_img = None
        prep_url = None
        if is_valid and use_preprocess:
            prep_img = preprocess_plate(crop_img)
            prep_filename = f"{request_id}_prep_{idx}.jpg"
            save_crop(prep_img, settings.RESULTS_DIR / prep_filename)
            prep_url = f"/results/{prep_filename}"

        pr = PlateResult(
            index=idx,
            bbox=bbox,
            crop_image_url=crop_url,
            preprocessed_image_url=prep_url,
            crop_valid=is_valid,
            crop_error=None if is_valid else reason,
        )
        cropped_entries.append((idx, pr, crop_img if is_valid else None, prep_img))

    # Nếu có nhiều hơn 1 biển số và không chọn riêng chỉ số, vẫn tự động OCR biển rõ nhất (index 0)
    target_indices = {plate_index} if plate_index is not None else ({entry[0] for entry in cropped_entries} if read_all else {0})

    # 3. Gọi Gemini Vision OCR nhận diện ký tự
    results_out: list[PlateResult] = []
    any_error = False
    error_message = ""

    for idx, pr, crop_img, prep_img in cropped_entries:
        if idx not in target_indices or not pr.crop_valid or crop_img is None:
            results_out.append(pr)
            continue

        try:
            validated_read = default_reader.read_plate(crop_img, prep_img)
            pr.recognition = validated_read
        except GeminiServiceError as exc:
            any_error = True
            error_message = str(exc)
            logger.error("[%s] Lỗi Gemini OCR trên biển #%d: %s", request_id, idx, exc)
            pr.recognition = None
        except Exception as exc:
            any_error = True
            error_message = f"Lỗi không xác định khi OCR: {exc}"
            logger.error("[%s] Lỗi không xác định: %s", request_id, exc)
            pr.recognition = None

        results_out.append(pr)

    total_time_ms = round((time.perf_counter() - start_t) * 1000, 1)

    if any_error and not any(p.recognition for p in results_out):
        return RecognizeResponse(
            request_id=request_id,
            status=RecognitionStatus.ERROR,
            message=f"Lỗi nhận diện OCR: {error_message}",
            original_image_url=orig_url,
            annotated_image_url=ann_url,
            plate_count=len(detection.boxes),
            plates=results_out,
            processing_time_ms=total_time_ms,
        )

    return RecognizeResponse(
        request_id=request_id,
        status=RecognitionStatus.RECOGNIZED,
        message="Nhận diện biển số thành công.",
        original_image_url=orig_url,
        annotated_image_url=ann_url,
        plate_count=len(detection.boxes),
        plates=results_out,
        processing_time_ms=total_time_ms,
    )


def validate_vietnamese_plate(plate: str) -> tuple[bool, str]:
    """Kiểm tra hợp lệ quy chuẩn biển số xe Việt Nam."""
    clean = plate.strip().upper()
    if not clean or clean in ("---", "CHƯA RÕ", "CHUA RO"):
        return False, "Biển số xe không được để trống."

    stripped = re.sub(r"[\s\.\-_]", "", clean)
    if len(stripped) < 6 or len(stripped) > 11:
        return False, f"Biển số '{clean}' không đúng độ dài quy định (6–10 ký tự)."

    digits = sum(1 for c in stripped if c.isdigit())
    if digits < 4:
        return False, f"Biển số '{clean}' thiếu chữ số đăng ký (cần tối thiểu 4 chữ số)."

    letters = sum(1 for c in stripped if c.isalpha())
    if letters < 1:
        return False, f"Biển số '{clean}' thiếu ký tự chữ cái sê-ri (VD: 51F, 29A, 59P1)."

    return True, ""


# ==========================================================================
# CÁC ENDPOINT NGHIỆP VỤ CHECK-IN VỚI DATABASE
# ==========================================================================

@router.post("/api/checkin/confirm")
async def confirm_checkin_session(
    payload: CheckinConfirmRequest,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Nghiệp vụ khi nhân viên nhấn "Ghi nhận xe vào bãi (Mở Barrier)":
    1. Chuẩn hóa biển số xe và loại xe.
    2. Kiểm tra tính hợp lệ biển số (bắt buộc có chữ số, đúng quy chuẩn).
    3. Sinh mã phiên lượt gửi (session_code) duy nhất.
    4. Lưu lượt xe vào bảng `parking_sessions` với trạng thái 'PARKED'.
    5. Trả về thông tin phiên vừa tạo kèm thống kê sức chứa bãi xe mới nhất.
    """
    clean_plate = payload.plate_number.strip().upper()
    is_valid, error_msg = validate_vietnamese_plate(clean_plate)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Biển số xe không hợp lệ: {error_msg} Yêu cầu nhân viên nhập lại, không thể mở barrier!"
        )

    # Thời gian vào bãi hiện tại theo chuẩn YYYY-MM-DD HH:MM:SS
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    date_code = datetime.now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    session_code = f"SES-{date_code}-{random_suffix}"

    try:
        cur = db.cursor()

        # Kiểm tra 1: Không cho phép check-in trùng biển số xe hiện ĐANG ĐỖ trong bãi (status = 'PARKED')
        compact_new = re.sub(r"[\s\.\-_]", "", clean_plate)
        cur.execute("SELECT id, plate_number, checkin_time FROM parking_sessions WHERE status = 'PARKED'")
        for parked_row in cur.fetchall():
            compact_existing = re.sub(r"[\s\.\-_]", "", (parked_row["plate_number"] or "").upper())
            if compact_existing == compact_new:
                raise HTTPException(
                    status_code=409,
                    detail=f"Xe biển số {parked_row['plate_number']} hiện ĐANG ĐỖ TRONG BÃI (vào lúc {parked_row['checkin_time']}). Không thể check-in trùng 2 lần!"
                )

        # Kiểm tra 2: Bãi xe đã đạt giới hạn sức chứa tối đa chưa
        cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED'")
        current_parked = cur.fetchone()[0]
        total_cap_check = 500
        cur.execute("SELECT total_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
        lot_check = cur.fetchone()
        if lot_check:
            total_cap_check = lot_check["total_capacity"]

        if current_parked >= total_cap_check:
            raise HTTPException(
                status_code=400,
                detail=f"Bãi xe đã ĐẦY SỨC CHỨA ({current_parked}/{total_cap_check} xe)! Không thể tiếp nhận thêm phương tiện vào bãi."
            )

        cur.execute(
            """
            INSERT INTO parking_sessions (
                session_code, plate_number, vehicle_type, checkin_time,
                checkin_image_url, checkin_crop_url, confidence, is_manual,
                status, staff_checkin
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PARKED', ?)
            """,
            (
                session_code,
                clean_plate,
                payload.vehicle_type,
                now_str,
                payload.checkin_image_url,
                payload.checkin_crop_url,
                payload.confidence or 99.5,
                1 if payload.is_manual else 0,
                payload.staff_checkin or "Trần Bảo Anh",
            ),
        )
        db.commit()
        session_id = cur.lastrowid

        # Đọc lại thông tin phiên vừa tạo
        cur.execute("SELECT * FROM parking_sessions WHERE id = ?", (session_id,))
        row = cur.fetchone()

        # Tính toán thống kê bãi xe mới nhất
        cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED'")
        parked_count = cur.fetchone()[0]

        total_cap = 500
        cur.execute("SELECT total_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
        lot_row = cur.fetchone()
        if lot_row:
            total_cap = lot_row["total_capacity"]

        return {
            "success": True,
            "message": "Ghi nhận xe vào bãi thành công. Barrier đã mở!",
            "session": {
                "id": row["id"],
                "session_code": row["session_code"],
                "plate_number": row["plate_number"],
                "vehicle_type": row["vehicle_type"],
                "checkin_time": row["checkin_time"],
                "confidence": row["confidence"],
                "is_manual": row["is_manual"],
                "status": "Ghi nhận (Nhập tay)" if row["is_manual"] else "Ghi nhận thành công",
                "staff_checkin": row["staff_checkin"],
            },
            "stats": {
                "total_capacity": total_cap,
                "current_count": parked_count,
                "available_spots": max(0, total_cap - parked_count),
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Lỗi khi lưu lượt check-in: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi cơ sở dữ liệu khi ghi nhận xe vào bãi: {exc}")


@router.get("/api/checkin/history")
async def get_checkin_history(
    limit: int = 10,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Lấy danh sách các lượt xe vào bãi gần nhất từ CSDL thật để hiển thị lên bảng.
    """
    cur = db.cursor()
    cur.execute(
        """
        SELECT id, session_code, plate_number, vehicle_type, checkin_time, confidence, is_manual, status, staff_checkin, checkin_crop_url
        FROM parking_sessions
        ORDER BY checkin_time DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cur.fetchall()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "session_code": r["session_code"],
            "plate": r["plate_number"],
            "type": r["vehicle_type"],
            "time": r["checkin_time"],
            "confidence": f"{r['confidence']:.1f}%" if r["confidence"] else "--%",
            "is_manual": bool(r["is_manual"]),
            "status": "Ghi nhận (Nhập tay)" if r["is_manual"] else "Ghi nhận thành công",
            "staff": r["staff_checkin"],
            "crop_url": r["checkin_crop_url"],
        })
    return results


@router.get("/api/checkin/stats")
async def get_checkin_stats(
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Trả về số liệu thống kê công suất sức chứa bãi xe từ Database thực tế.
    """
    cur = db.cursor()
    
    total_cap = 500
    cur.execute("SELECT total_capacity FROM parking_lots WHERE lot_code = 'LOT-A'")
    lot_row = cur.fetchone()
    if lot_row:
        total_cap = lot_row["total_capacity"]

    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED'")
    parked_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED' AND vehicle_type = 'Ô tô'")
    car_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status = 'PARKED' AND vehicle_type = 'Xe máy'")
    moto_count = cur.fetchone()[0]

    return {
        "total_capacity": total_cap,
        "current_count": parked_count,
        "available_spots": max(0, total_cap - parked_count),
        "car_count": car_count,
        "moto_count": moto_count,
    }


class UpdateCheckinPayload(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = None


@router.put("/api/checkin/sessions/{session_id}")
async def update_checkin_session(
    session_id: int,
    payload: UpdateCheckinPayload,
    db: sqlite3.Connection = Depends(get_db),
):
    """Sửa biển số xe hoặc loại xe của lượt vừa check-in nếu bị nhập sai."""
    clean_plate = payload.plate_number.strip().upper()
    is_valid, error_msg = validate_vietnamese_plate(clean_plate)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Biển số xe không hợp lệ: {error_msg}")

    cur = db.cursor()
    cur.execute("SELECT id FROM parking_sessions WHERE id = ?", (session_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt xe cần sửa")

    if payload.vehicle_type:
        cur.execute(
            "UPDATE parking_sessions SET plate_number = ?, vehicle_type = ?, is_manual = 1 WHERE id = ?",
            (clean_plate, payload.vehicle_type, session_id),
        )
    else:
        cur.execute(
            "UPDATE parking_sessions SET plate_number = ?, is_manual = 1 WHERE id = ?",
            (clean_plate, session_id),
        )
    db.commit()

    return {"success": True, "message": f"Đã cập nhật biển số thành: {clean_plate}", "plate": clean_plate}
