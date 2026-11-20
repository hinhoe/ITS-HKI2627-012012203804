"""
PARKTECH / PARKAIVISION — Application Settings & Configuration

Loads configuration from .env in project root.
Supports multi-key rotation and custom model paths.
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Project root directory: D:\...\Smart_Parking
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load .env
load_dotenv(PROJECT_ROOT / ".env")


class Settings:
    """System settings for Smart Parking ALPR."""

    # Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_API_KEYS_RAW: str = os.getenv("GEMINI_API_KEYS", "").strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()

    # YOLO Model
    YOLO_MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "AI/models/license_plate_detector.pt").strip()
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))

    # Runtime Directories
    UPLOAD_DIR: Path = PROJECT_ROOT / "uploads"
    RESULTS_DIR: Path = PROJECT_ROOT / "results"
    FRONTEND_DIR: Path = PROJECT_ROOT / "Frontend"

    # Image constraints
    MAX_FILE_SIZE_MB: int = 15
    ALLOWED_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".webp"}
    CROP_PAD_RATIO: float = 0.08

    @property
    def gemini_api_keys(self) -> list[str]:
        """Return deduplicated list of configured Gemini API keys."""
        keys: list[str] = []
        if self.GEMINI_API_KEY:
            keys.append(self.GEMINI_API_KEY)
        if self.GEMINI_API_KEYS_RAW:
            for item in self.GEMINI_API_KEYS_RAW.split(","):
                k = item.strip()
                if k and k not in keys:
                    keys.append(k)
        return keys

    @property
    def yolo_model_full_path(self) -> Path:
        """Resolve YOLO model path relative to project root if not absolute."""
        p = Path(self.YOLO_MODEL_PATH)
        if p.is_absolute():
            return p
        return PROJECT_ROOT / p

    def validate(self) -> list[str]:
        """Return list of configuration warnings or errors."""
        issues = []
        if not self.gemini_api_keys:
            issues.append("Chưa thiết lập GEMINI_API_KEY trong .env")
        if not self.yolo_model_full_path.exists():
            issues.append(f"Không tìm thấy file mô hình YOLO tại {self.yolo_model_full_path}")
        return issues


settings = Settings()
