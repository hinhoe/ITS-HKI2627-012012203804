"""
PARKTECH / PARKAIVISION — AI Module: Character Recognition (Gemini Vision OCR)

Uses Google GenAI SDK (v1beta) with Structured Output (JSON Schema)
to transcribe Vietnamese license plate characters strictly without guessing.

Features:
- Dual-image reference (Original Crop as Primary, Preprocessed as Secondary).
- Automatic multi-key rotation on 429/401/403.
- Automatic model fallback on 503/504/404/429.
- Soft validation against Vietnamese license plate standards.
- Strict anti-hallucination prompt.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Optional

import cv2
import numpy as np
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from Backend.config import settings
from AI.schemas import (
    GeminiReadResult,
    GeminiStructuredOutput,
    RecognitionStatus,
    VehicleType,
)

logger = logging.getLogger("smart_parking.ai.ocr")

# Minimum dimension for upscaling small plates
TARGET_MIN_DIM = 200

# ---------------------------------------------------------------------------
# Strict ALPR Prompt — NO GUESSING
# ---------------------------------------------------------------------------

ALPR_SYSTEM_PROMPT = """You are a strict Vietnamese Automatic License Plate Recognition (ALPR) vision reader.
Your ONLY job is to transcribe exactly what is visibly printed on the license plate image.

STRICT RULES (NON-NEGOTIABLE):
1. Observe the image directly. Read characters in visual order: top row left-to-right, then bottom row left-to-right (for 2-row plates, separate row 1 and row 2 with a single space), or left-to-right (for 1-row plates).
2. Support both motorbike plates (1-row or 2-row) and car plates (1-row long or 2-row square).
3. NEVER add characters that are not visibly present in the image.
4. NEVER guess, infer, or auto-correct characters based on Vietnamese license plate format conventions.
5. NEVER convert letter 'O' to digit '0' or '0' to 'O'. Transcribe the exact glyph you visually see.
6. NEVER convert letter 'I' to digit '1' or '1' to 'I'.
7. Pay careful attention to visually similar pairs: B/8, S/5, Z/2, D/0, Q/0, G/6, A/4, T/1 — do NOT confuse or force-swap them.
8. Do NOT skip small characters or characters near the border.
9. Do NOT insert dots (.), hyphens (-), or spaces in `plate_number` if they are not visibly present or clear on the plate.
10. NO-GUESSING RULE: If ANY character is blurry, overexposed, glared, occluded, cut off, shadowed, or cannot be identified with visual certainty:
    - Set `status` to "needs_review" (or "unreadable" if the plate cannot be read at all).
    - Set `plate_number` to null.
    - Put '?' at uncertain positions in `raw_text`.
    - List the 1-based positions of uncertain characters in `uncertain_characters`.
    - Explain briefly in `reason` (e.g., "Character at position 5 is obscured by glare").
11. If two images are provided:
    - Image 1 is the ORIGINAL cropped plate (PRIMARY REFERENCE).
    - Image 2 is a contrast/sharpened enhanced copy (SECONDARY REFERENCE ONLY).
    - Trust Image 1 over Image 2 whenever Image 2 introduces artifacts.
    - If a character is readable in Image 1 and consistent with Image 2, transcribe it.
    - If Image 1 and Image 2 disagree on any character, mark that character as uncertain (`needs_review`, `plate_number`: null) and state the discrepancy in `reason`.
12. Determine `vehicle_type`:
    - "motorbike" if the plate layout/format clearly belongs to a Vietnamese motorbike (e.g. square 2-row with 2-character series like 59-A1, 64-H4, 29-B1, etc.).
    - "car" if the plate layout/format clearly belongs to a Vietnamese car (e.g. 1-row long plate or 2-row square with 1-letter series like 51H, 30A, etc.).
    - "unknown" if you cannot tell from the cropped plate alone.
"""

USER_PROMPT_DUAL = (
    "Read the Vietnamese license plate strictly following all rules.\n"
    "Image 1 is the ORIGINAL cropped plate (primary reference).\n"
    "Image 2 is a preprocessed copy (secondary reference for cross-checking).\n"
    "If any character is unclear or disagrees between Image 1 and Image 2, set status to 'needs_review' and plate_number to null."
)

USER_PROMPT_SINGLE = (
    "Read the Vietnamese license plate in this cropped image strictly following all rules. "
    "Do not guess any unclear character."
)


class GeminiServiceError(Exception):
    """Sanitized error from Gemini service (never leaks API keys)."""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


def _sanitize_error(text: str, extra_keys: Optional[list[str]] = None) -> str:
    """Mask any API keys from error messages before logging or returning."""
    if not text:
        return "Unknown error"
    sanitized = text
    keys_to_mask = list(settings.gemini_api_keys)
    if extra_keys:
        keys_to_mask.extend(extra_keys)
    for k in keys_to_mask:
        if k:
            sanitized = sanitized.replace(k, "[REDACTED]")
    return re.sub(r"key=[^&\s\"']+", "key=[REDACTED]", sanitized)


def _encode_jpeg(image: np.ndarray, quality: int = 95) -> bytes:
    """Encode BGR numpy image to JPEG bytes."""
    ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise GeminiServiceError("Không thể mã hóa ảnh sang JPEG", "ENCODE_ERROR")
    return buf.tobytes()


def preprocess_plate(crop: np.ndarray) -> np.ndarray:
    """Conservative preprocessing (Upscale keeping ratio, CLAHE, unsharp mask, gamma)."""
    result = crop.copy()
    h, w = result.shape[:2]

    # 1. Upscale if too small
    if min(h, w) < TARGET_MIN_DIM:
        scale = TARGET_MIN_DIM / min(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        result = cv2.resize(result, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    # 2. CLAHE on L-channel in LAB space
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    l_ch = clahe.apply(l_ch)
    lab = cv2.merge([l_ch, a_ch, b_ch])
    result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3. Subtle sharpening
    blurred = cv2.GaussianBlur(result, (0, 0), sigmaX=2.0)
    result = cv2.addWeighted(result, 1.5, blurred, -0.5, 0)

    # 4. Brightness balance (gamma)
    gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    mean_val = float(np.mean(gray))
    if mean_val < 70:
        gamma = 0.65
        table = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype("uint8")
        result = cv2.LUT(result, table)
    elif mean_val > 200:
        gamma = 1.4
        table = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype("uint8")
        result = cv2.LUT(result, table)

    return result


def _parse_gemini_json(raw_text: str) -> GeminiReadResult:
    """Parse structured JSON from Gemini."""
    if not raw_text or not raw_text.strip():
        return GeminiReadResult(
            status=RecognitionStatus.UNREADABLE,
            reason="Gemini trả về chuỗi rỗng.",
        )

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return GeminiReadResult(
            status=RecognitionStatus.NEEDS_REVIEW,
            reason="Kết quả từ Gemini không phải định dạng JSON hợp lệ.",
        )

    if not isinstance(data, dict):
        return GeminiReadResult(
            status=RecognitionStatus.NEEDS_REVIEW,
            reason="Dữ liệu JSON từ Gemini không phải đối tượng (object).",
        )

    vt_raw = str(data.get("vehicle_type", "unknown")).lower().strip()
    try:
        vehicle_type = VehicleType(vt_raw)
    except ValueError:
        vehicle_type = VehicleType.UNKNOWN

    status_raw = str(data.get("status", "needs_review")).lower().strip()
    allowed_statuses = {
        "recognized": RecognitionStatus.RECOGNIZED,
        "needs_review": RecognitionStatus.NEEDS_REVIEW,
        "unreadable": RecognitionStatus.UNREADABLE,
    }
    status = allowed_statuses.get(status_raw, RecognitionStatus.NEEDS_REVIEW)

    plate_number = data.get("plate_number")
    if plate_number is not None:
        plate_number = str(plate_number).strip() or None

    raw_val = data.get("raw_text")
    if raw_val is not None:
        raw_val = str(raw_val).strip() or None

    uncertain_raw = data.get("uncertain_characters", [])
    uncertain_chars: list[int] = []
    if isinstance(uncertain_raw, list):
        for item in uncertain_raw:
            try:
                uncertain_chars.append(int(item))
            except (ValueError, TypeError):
                pass

    reason = data.get("reason")
    if reason is not None:
        reason = str(reason).strip() or None

    return GeminiReadResult(
        vehicle_type=vehicle_type,
        plate_number=plate_number,
        raw_text=raw_val,
        status=status,
        uncertain_characters=uncertain_chars,
        reason=reason,
    )


# Permissive reference patterns for Vietnamese civilian plates (Warnings only)
_MOTORBIKE_PATTERN = re.compile(r"^[0-9]{2}[A-Z][A-Z0-9][0-9]{4,5}$")
_CAR_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$")
_SPECIAL_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{4,6}$")


def validate_recognition_result(result: GeminiReadResult) -> GeminiReadResult:
    """Validate result without mutating or guessing characters."""
    validated = result.model_copy(deep=True)
    warnings: list[str] = list(validated.warnings)

    # 1. Uncertain characters
    if validated.uncertain_characters:
        warnings.append(f"Ký tự tại vị trí {validated.uncertain_characters} chưa chắc chắn.")
        if validated.status == RecognitionStatus.RECOGNIZED:
            validated.status = RecognitionStatus.NEEDS_REVIEW
        validated.plate_number = None

    # 2. '?' mark
    if (validated.raw_text and "?" in validated.raw_text) or (validated.plate_number and "?" in validated.plate_number):
        warnings.append("Biển số chứa ký tự không thể nhận diện chắc chắn ('?').")
        if validated.status == RecognitionStatus.RECOGNIZED:
            validated.status = RecognitionStatus.NEEDS_REVIEW
        validated.plate_number = None

    # 3. Empty plate_number with recognized status
    if validated.status == RecognitionStatus.RECOGNIZED and not validated.plate_number:
        warnings.append("Trạng thái nhận diện ghi nhận thành công nhưng thiếu chuỗi biển số.")
        validated.status = RecognitionStatus.NEEDS_REVIEW

    candidate = validated.plate_number or validated.raw_text
    if candidate and validated.status != RecognitionStatus.UNREADABLE:
        compact = re.sub(r"[\s\-\.]", "", candidate.upper())
        if re.search(r"[^A-Z0-9?]", compact):
            warnings.append(f"Ký tự bất thường trong biển số: '{candidate}'.")
            if validated.status == RecognitionStatus.RECOGNIZED:
                validated.status = RecognitionStatus.NEEDS_REVIEW

        if "?" not in compact:
            if len(compact) < 6 or len(compact) > 9:
                warnings.append(f"Độ dài biển số ({len(compact)} ký tự) bất thường so với chuẩn Việt Nam (6–9 ký tự).")
                if validated.status == RecognitionStatus.RECOGNIZED:
                    validated.status = RecognitionStatus.NEEDS_REVIEW
            else:
                matches_mb = bool(_MOTORBIKE_PATTERN.match(compact))
                matches_car = bool(_CAR_PATTERN.match(compact))
                matches_sp = bool(_SPECIAL_PATTERN.match(compact))
                if not (matches_mb or matches_car or matches_sp):
                    warnings.append(f"Cấu trúc biển số '{candidate}' không khớp định dạng thông dụng.")
                    if validated.status == RecognitionStatus.RECOGNIZED:
                        validated.status = RecognitionStatus.NEEDS_REVIEW

    # Deduplicate warnings
    seen = set()
    dedup_warnings = []
    for w in warnings:
        if w not in seen:
            seen.add(w)
            dedup_warnings.append(w)

    validated.warnings = dedup_warnings
    if validated.status == RecognitionStatus.NEEDS_REVIEW and not validated.reason and dedup_warnings:
        validated.reason = dedup_warnings[0]

    return validated


class GeminiPlateReader:
    """Client wrapper for Gemini OCR with Multi-Key Rotation and Model Fallback."""

    FALLBACK_MODELS: tuple[str, ...] = (
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
    )

    def __init__(self, api_keys: Optional[list[str]] = None, model_name: Optional[str] = None):
        if api_keys is not None:
            self._api_keys = [k.strip() for k in api_keys if k and k.strip()]
        else:
            self._api_keys = settings.gemini_api_keys

        self._model_name = model_name or settings.GEMINI_MODEL
        self._clients: dict[int, genai.Client] = {}
        self._active_key_idx: int = 0

    @property
    def key_count(self) -> int:
        return len(self._api_keys)

    def _get_client(self, idx: int) -> genai.Client:
        if idx not in self._clients:
            self._clients[idx] = genai.Client(
                api_key=self._api_keys[idx],
                http_options={"api_version": "v1beta"},
            )
        return self._clients[idx]

    def read_plate(
        self,
        original_crop: np.ndarray,
        preprocessed_crop: Optional[np.ndarray] = None,
    ) -> GeminiReadResult:
        """Call Gemini Vision with original crop and optional preprocessed reference."""
        if not self._api_keys:
            raise GeminiServiceError("Chưa cấu hình GEMINI_API_KEY trong file .env", "MISSING_API_KEY")

        if original_crop is None or original_crop.size == 0:
            return GeminiReadResult(status=RecognitionStatus.UNREADABLE, reason="Ảnh crop đầu vào rỗng.")

        images = [original_crop]
        prompt = USER_PROMPT_SINGLE
        if preprocessed_crop is not None and preprocessed_crop.size > 0:
            images.append(preprocessed_crop)
            prompt = USER_PROMPT_DUAL

        contents: list = [prompt]
        for img in images:
            img_bytes = _encode_jpeg(img)
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"))

        config = types.GenerateContentConfig(
            system_instruction=ALPR_SYSTEM_PROMPT,
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=GeminiStructuredOutput,
        )

        model_chain: list[str] = [self._model_name]
        for fb in self.FALLBACK_MODELS:
            if fb not in model_chain:
                model_chain.append(fb)

        total_keys = len(self._api_keys)
        key_order = [(self._active_key_idx + offset) % total_keys for offset in range(total_keys)]

        response = None
        last_error: Optional[GeminiServiceError] = None

        for key_idx in key_order:
            client = self._get_client(key_idx)
            key_dead = False

            for model_name in model_chain:
                max_attempts = 2
                for attempt in range(1, max_attempts + 1):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=contents,
                            config=config,
                        )
                        if key_idx != self._active_key_idx:
                            logger.info("Chuyển API Key thành công sang slot #%d/%d", key_idx + 1, total_keys)
                            self._active_key_idx = key_idx
                        if model_name != self._model_name:
                            logger.info("Fallback Gemini thành công với mô hình '%s'", model_name)
                        break
                    except genai_errors.APIError as exc:
                        code = getattr(exc, "code", None)
                        msg = _sanitize_error(str(exc), self._api_keys)
                        logger.error("Lỗi Gemini API (key #%d, model=%s, attempt %d/%d, code=%s): %s",
                                     key_idx + 1, model_name, attempt, max_attempts, code, msg)

                        if code in (401, 403) or "API_KEY_INVALID" in msg:
                            last_error = GeminiServiceError("Khóa API Gemini không hợp lệ.", "INVALID_API_KEY")
                            key_dead = True
                            break
                        if code == 429 or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                            last_error = GeminiServiceError("Gemini API hết quota (429).", "QUOTA_EXCEEDED")
                            break
                        if code in (500, 502, 503, 504):
                            last_error = GeminiServiceError("Máy chủ Gemini quá tải tạm thời (503).", "SERVICE_UNAVAILABLE")
                            if attempt < max_attempts:
                                time.sleep(1.0)
                                continue
                            break
                        if code == 404:
                            last_error = GeminiServiceError(f"Không tìm thấy model '{model_name}'.", "MODEL_NOT_FOUND")
                            break
                        raise GeminiServiceError(f"Lỗi Gemini API (mã {code}).", "API_ERROR") from None
                    except Exception as exc:
                        msg = _sanitize_error(str(exc), self._api_keys)
                        raise GeminiServiceError("Không thể kết nối tới Gemini API.", "NETWORK_ERROR") from None

                if response is not None or key_dead:
                    break

            if response is not None:
                break

        if response is None:
            raise last_error or GeminiServiceError("Không nhận được phản hồi từ Gemini API.", "API_ERROR")

        raw_text = getattr(response, "text", None) or ""
        parsed = _parse_gemini_json(raw_text)
        return validate_recognition_result(parsed)


# Singleton reader
default_reader = GeminiPlateReader()
