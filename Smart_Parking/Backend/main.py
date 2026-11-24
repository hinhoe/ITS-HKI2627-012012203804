"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Backend chính: Máy chủ API điều phối toàn hệ thống (Backend/main.py)
==========================================================================

Tập trung điều phối toàn bộ các module nghiệp vụ của dự án:
- Backend/checkin.py  : Nghiệp vụ Ghi nhận xe vào bãi (Check-in)
- Backend/checkout.py : Nghiệp vụ Ghi nhận xe ra & Tính phí (Check-out)
- Backend/config.py   : Cấu hình hệ thống, đọc .env, kiểm tra API key
- AI/                 : Bộ thư viện lõi AI (YOLOv8 + Gemini OCR)

Khởi động máy chủ:
- Chạy trực tiếp qua file: run_server.bat
- Hoặc gõ lệnh: python -m uvicorn Backend.main:app --reload --reload-dir Backend --reload-dir AI
"""

from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from AI.detect import load_model
from Backend.config import settings
from Backend.database.connection import init_db
from Backend.Employee.checkin import router as checkin_router
from Backend.Employee.checkout import router as checkout_router
from Backend.Employee.current_parking import router as current_parking_router
from Backend.Employee.history import router as history_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("smart_parking.backend")

# Khởi tạo ứng dụng FastAPI
app = FastAPI(
    title="PARKTECH / PARKAIVISION — Smart Parking ALPR API",
    description="Hệ thống quản lý bãi đỗ xe thông minh ứng dụng AI nhận diện biển số xe",
    version="2.0.0",
)

@app.on_event("startup")
async def on_startup():
    """Khởi tạo cơ sở dữ liệu và thư mục khi khởi động ứng dụng"""
    try:
        init_db()
    except Exception as exc:
        logger.error("Không thể khởi tạo cơ sở dữ liệu: %s", exc)

# Cấu hình CORS cho phép giao diện Frontend kết nối thông suốt
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chống lưu bộ nhớ đệm (Cache) cho các file giao diện Frontend trong quá trình phát triển
@app.middleware("http")
async def disable_frontend_cache_middleware(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/Frontend") or request.url.path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Tự động tạo thư mục và gắn đường dẫn tĩnh (Static Mounts)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.RESULTS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/results", StaticFiles(directory=str(settings.RESULTS_DIR)), name="results")

if settings.FRONTEND_DIR.exists():
    app.mount("/Frontend", StaticFiles(directory=str(settings.FRONTEND_DIR)), name="frontend")

# GẮN CÁC MODULE NGHIỆP VỤ NHÂN VIÊN (EMPLOYEE ROUTERS)
# 1. Nghiệp vụ Check-in (Ghi nhận xe vào bãi) -> Quản lý bởi Backend/Employee/checkin.py
app.include_router(checkin_router)

# 2. Nghiệp vụ Check-out (Ghi nhận xe ra & Tính phí) -> Quản lý bởi Backend/Employee/checkout.py
app.include_router(checkout_router)

# 3. Nghiệp vụ Xe đang gửi trong bãi -> Quản lý bởi Backend/Employee/current_parking.py
app.include_router(current_parking_router)

# 4. Nghiệp vụ Lịch sử vào/ra & Tra cứu -> Quản lý bởi Backend/Employee/history.py
app.include_router(history_router)


@app.get("/", include_in_schema=False)
async def root():
    """Tự động chuyển hướng đến giao diện Check-in khi truy cập http://127.0.0.1:8000/"""
    return RedirectResponse(url="/Frontend/pages/Employee/checkin.html")


@app.get("/api/health", tags=["Hệ thống"])
async def health_check():
    """
    Kiểm tra tình trạng sẵn sàng của toàn hệ thống:
    - Mô hình YOLOv8 nạp thành công chưa
    - API Key Gemini đã cấu hình chưa và đang dùng model nào
    """
    issues = settings.validate()
    yolo_ready = False
    yolo_classes: list[str] = []
    try:
        model = load_model()
        yolo_ready = True
        yolo_classes = list(model.names.values())
    except Exception as exc:
        issues.append(f"YOLO load error: {exc}")

    return {
        "status": "ok" if (yolo_ready and not issues) else "degraded",
        "yolo_ready": yolo_ready,
        "yolo_model": settings.YOLO_MODEL_PATH,
        "yolo_classes": yolo_classes,
        "gemini_configured": bool(settings.gemini_api_keys),
        "gemini_key_count": len(settings.gemini_api_keys),
        "gemini_model": settings.GEMINI_MODEL,
        "issues": issues,
    }
