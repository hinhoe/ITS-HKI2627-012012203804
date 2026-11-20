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

import logging
from pathlib import Path
import time
from typing import Optional
import uuid

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import numpy as np

from AI.detect import crop_plate, detect_plates, draw_bboxes, save_crop, validate_crop
from AI.ocr import default_reader, preprocess_plate, GeminiServiceError
from AI.schemas import PlateResult, RecognitionStatus, RecognizeResponse
from Backend.config import settings

logger = logging.getLogger("smart_parking.backend.checkin")

# Router riêng biệt cho nghiệp vụ Check-in
router = APIRouter(tags=["Checkin - Ghi nhận xe vào"])


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

    # Xử lý trường hợp có nhiều hơn 1 biển số trong ảnh
    if len(detection.boxes) > 1 and plate_index is None and not read_all:
        return RecognizeResponse(
            request_id=request_id,
            status=RecognitionStatus.MULTIPLE_DETECTED,
            message=f"Phát hiện {len(detection.boxes)} vùng biển số trong ảnh.",
            original_image_url=orig_url,
            annotated_image_url=ann_url,
            plate_count=len(detection.boxes),
            plates=[entry[1] for entry in cropped_entries],
            processing_time_ms=round((time.perf_counter() - start_t) * 1000, 1),
        )

    target_indices = {plate_index} if plate_index is not None else {entry[0] for entry in cropped_entries}

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
