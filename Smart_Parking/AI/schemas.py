"""
PARKTECH / PARKAIVISION — AI Data Models (Schemas)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class VehicleType(str, Enum):
    MOTORBIKE = "motorbike"
    CAR = "car"
    UNKNOWN = "unknown"


class RecognitionStatus(str, Enum):
    RECOGNIZED = "recognized"
    NEEDS_REVIEW = "needs_review"
    UNREADABLE = "unreadable"
    NOT_DETECTED = "not_detected"
    MULTIPLE_DETECTED = "multiple_detected"
    ERROR = "error"


class BoundingBox(BaseModel):
    """Bounding box from YOLO detection."""
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float = Field(ge=0.0, le=1.0)
    class_name: str


class DetectionResult(BaseModel):
    """Result from YOLO plate detection step."""
    found: bool
    boxes: list[BoundingBox] = Field(default_factory=list)


class GeminiStructuredOutput(BaseModel):
    """Schema passed to Gemini Structured Output (JSON Schema)."""
    vehicle_type: VehicleType = Field(
        description="Type of vehicle: motorbike, car, or unknown."
    )
    plate_number: Optional[str] = Field(
        default=None,
        description="The exact license plate characters and symbols visibly printed on the plate (letters, digits, '-' and '.' if present, without inventing symbols that are not present), or null if any character is unclear."
    )
    raw_text: Optional[str] = Field(
        default=None,
        description="Raw characters and symbols exactly as seen on the plate in visual reading order. Use '?' for uncertain characters."
    )
    status: str = Field(
        description="'recognized', 'needs_review', or 'unreadable'."
    )
    uncertain_characters: list[int] = Field(
        default_factory=list,
        description="1-based positions of characters that are unclear or uncertain."
    )
    reason: Optional[str] = Field(
        default=None,
        description="Reason if status is needs_review or unreadable; null if recognized."
    )


class GeminiReadResult(BaseModel):
    """Validated OCR recognition result."""
    vehicle_type: VehicleType = VehicleType.UNKNOWN
    plate_number: Optional[str] = None
    raw_text: Optional[str] = None
    status: RecognitionStatus = RecognitionStatus.UNREADABLE
    uncertain_characters: list[int] = Field(default_factory=list)
    reason: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    dual_check_consistent: Optional[bool] = None


class PlateResult(BaseModel):
    """Result for a single detected plate region."""
    index: int = 0
    bbox: BoundingBox
    crop_image_url: Optional[str] = None
    preprocessed_image_url: Optional[str] = None
    crop_valid: bool = True
    crop_error: Optional[str] = None
    recognition: Optional[GeminiReadResult] = None


class RecognizeResponse(BaseModel):
    """API Response for license plate recognition."""
    request_id: str
    status: RecognitionStatus
    message: str
    original_image_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    plate_count: int = 0
    plates: list[PlateResult] = Field(default_factory=list)
    processing_time_ms: Optional[float] = None
    duplicate_warning: Optional[dict[str, Any]] = None
