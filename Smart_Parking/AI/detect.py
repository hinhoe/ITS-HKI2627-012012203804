"""
PARKTECH / PARKAIVISION — AI Module: License Plate Detection (YOLOv8)

Performs vehicle license plate localization and safe cropping.
YOLO is used strictly for localization, NOT for character recognition.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from ultralytics import YOLO

from Backend.config import settings
from AI.schemas import BoundingBox, DetectionResult

logger = logging.getLogger("smart_parking.ai.detect")

# Singleton model cache
_model: Optional[YOLO] = None
_model_names: dict = {}

MIN_CROP_WIDTH = 20
MIN_CROP_HEIGHT = 15


def load_model() -> YOLO:
    """Load YOLOv8 model from configured path (cached after first call)."""
    global _model, _model_names

    if _model is not None:
        return _model

    model_path = settings.yolo_model_full_path
    if not model_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file mô hình YOLOv8: {model_path}")

    logger.info("Đang nạp mô hình YOLOv8 từ %s ...", model_path)
    _model = YOLO(str(model_path))
    _model_names = _model.names
    logger.info("Mô hình YOLOv8 nạp thành công — %d classes: %s", len(_model_names), list(_model_names.values()))
    return _model


def detect_plates(
    image: np.ndarray,
    conf_threshold: Optional[float] = None,
) -> DetectionResult:
    """
    Run YOLOv8 inference to locate license plate regions.

    Parameters
    ----------
    image : np.ndarray (BGR format)
    conf_threshold : Optional override for confidence threshold

    Returns
    -------
    DetectionResult with list of BoundingBox
    """
    model = load_model()
    threshold = conf_threshold if conf_threshold is not None else settings.CONFIDENCE_THRESHOLD

    results = model(image, conf=threshold, verbose=False)[0]
    boxes: list[BoundingBox] = []
    h_img, w_img = image.shape[:2]

    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w_img, x2)
        y2 = min(h_img, y2)

        confidence = float(box.conf[0])
        cls_id = int(box.cls[0])
        class_name = _model_names.get(cls_id, "license_plate")

        boxes.append(BoundingBox(
            x1=x1, y1=y1, x2=x2, y2=y2,
            confidence=round(confidence, 4),
            class_name=class_name,
        ))

    boxes.sort(key=lambda b: b.confidence, reverse=True)
    logger.info("YOLOv8 phát hiện %d vùng biển số.", len(boxes))
    return DetectionResult(found=len(boxes) > 0, boxes=boxes)


def crop_plate(
    image: np.ndarray,
    bbox: BoundingBox,
    pad_ratio: Optional[float] = None,
) -> Optional[np.ndarray]:
    """
    Crop license plate region with safe padding to ensure no edge characters are cut.
    Preserves exact aspect ratio.
    """
    h_img, w_img = image.shape[:2]
    ratio = pad_ratio if pad_ratio is not None else settings.CROP_PAD_RATIO

    bw = bbox.x2 - bbox.x1
    bh = bbox.y2 - bbox.y1

    pad_x = int(bw * ratio)
    pad_y = int(bh * ratio)

    x1 = max(0, bbox.x1 - pad_x)
    y1 = max(0, bbox.y1 - pad_y)
    x2 = min(w_img, bbox.x2 + pad_x)
    y2 = min(h_img, bbox.y2 + pad_y)

    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    crop_h, crop_w = crop.shape[:2]
    if crop_w < MIN_CROP_WIDTH or crop_h < MIN_CROP_HEIGHT:
        return None

    return crop


def validate_crop(crop: np.ndarray) -> tuple[bool, str]:
    """Validate crop dimension and texture."""
    if crop is None or crop.size == 0:
        return False, "Vùng crop rỗng."
    h, w = crop.shape[:2]
    if w < MIN_CROP_WIDTH or h < MIN_CROP_HEIGHT:
        return False, f"Vùng crop quá nhỏ ({w}x{h})."

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
    if float(np.std(gray)) < 5.0:
        return False, "Vùng crop đồng màu (ảnh trống/lóa hoàn toàn)."

    return True, "OK"


def save_crop(crop: np.ndarray, output_path: Path, quality: int = 95) -> Path:
    """Save cropped image safely with UTF-8 Windows path support."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError(f"Không thể encode ảnh crop: {output_path}")
    output_path.write_bytes(buf.tobytes())
    return output_path


def draw_bboxes(
    image: np.ndarray,
    boxes: list[BoundingBox],
    color: tuple[int, int, int] = (0, 255, 0),
    thickness: int = 3,
) -> np.ndarray:
    """Draw bounding boxes and confidence score on image copy."""
    annotated = image.copy()
    for b in boxes:
        cv2.rectangle(annotated, (b.x1, b.y1), (b.x2, b.y2), color, thickness)
        label = f"{b.class_name} {b.confidence:.2f}"
        font_scale = 0.6
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
        cv2.rectangle(
            annotated,
            (b.x1, max(0, b.y1 - th - 10)),
            (min(image.shape[1], b.x1 + tw + 6), max(0, b.y1)),
            color,
            -1,
        )
        cv2.putText(
            annotated,
            label,
            (b.x1 + 3, max(12, b.y1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
    return annotated
