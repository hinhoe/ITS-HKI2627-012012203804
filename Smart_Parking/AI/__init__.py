"""
==========================================================================
PARKTECH / PARKAIVISION — AI Core Module
==========================================================================
Bao gồm:
- detect.py  : Phát hiện vị trí biển số xe và phân loại phương tiện (YOLOv8)
- ocr.py     : Nhận diện ký tự biển số không suy đoán (Gemini Vision OCR)
- schemas.py : Pydantic schemas định nghĩa dữ liệu đầu ra AI
- models/    : Lưu trữ file trọng số mô hình YOLO (.pt)
"""

from AI.detect import (
    crop_plate,
    detect_plates,
    draw_bboxes,
    load_model,
    save_crop,
    validate_crop,
)
from AI.ocr import read_license_plate
from AI.schemas import GeminiReadResult, RecognitionStatus, VehicleType

# Alias tương thích ngược
detect_vehicle_and_plate = detect_plates

__all__ = [
    "crop_plate",
    "detect_plates",
    "detect_vehicle_and_plate",
    "draw_bboxes",
    "load_model",
    "save_crop",
    "validate_crop",
    "read_license_plate",
    "GeminiReadResult",
    "RecognitionStatus",
    "VehicleType",
]
