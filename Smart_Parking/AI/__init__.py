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

from AI.detect import detect_vehicle_and_plate, load_model
from AI.ocr import read_license_plate
from AI.schemas import GeminiReadResult, RecognitionStatus, VehicleType

__all__ = [
    "detect_vehicle_and_plate",
    "load_model",
    "read_license_plate",
    "GeminiReadResult",
    "RecognitionStatus",
    "VehicleType",
]
