@echo off
chcp 65001 >nul
title PARKTECH / PARKAIVISION - Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh
cd /d "%~dp0"

echo ===============================================================================
echo     HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
echo     Khởi động Backend API FastAPI và Giao diện Quản trị Bãi xe
echo ===============================================================================
echo.

:: 1. Kiểm tra Python trên máy tính
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set "PY_CMD=py"
    ) else (
        echo [LỖI] Máy tính của bạn chưa cài đặt Python hoặc chưa tích chọn Add Python to PATH!
        echo.
        echo Vui lòng tải và cài đặt Python (phiên bản 3.10 trở lên) tại:
        echo https://www.python.org/downloads/
        echo * LƯU Ý QUAN TRỌNG: Trong quá trình cài, hãy tích vào ô "Add python.exe to PATH".
        echo ===============================================================================
        pause
        exit /b 1
    )
)

:: 2. Kiểm tra Môi trường ảo (.venv) & Thư viện phụ thuộc
if exist ".venv\Scripts\python.exe" (
    echo [OK] Môi trường ảo (.venv) đã được cấu hình từ trước.
    echo Bỏ qua bước cài đặt lại để khởi động nhanh chóng...
    echo.
    call .venv\Scripts\activate.bat
) else (
    echo [THÔNG BÁO] Phát hiện đây là lần đầu tiên chạy dự án trên máy tính này!
    echo Đang tự động thiết lập môi trường và cài đặt toàn bộ thư viện cần thiết...
    echo.

    echo [1/3] Đang khởi tạo môi trường ảo độc lập (.venv)...
    %PY_CMD% -m venv .venv
    if errorlevel 1 (
        echo [CẢNH BÁO] Không thể tạo môi trường ảo .venv, sẽ cài trực tiếp vào Python hiện tại...
        set "ACTIVE_PY=%PY_CMD%"
    ) else (
        call .venv\Scripts\activate.bat
        set "ACTIVE_PY=python"
    )

    echo [2/3] Đang nâng cấp pip...
    %ACTIVE_PY% -m pip install --upgrade pip --quiet

    echo [3/3] Đang tải và cài đặt các thư viện từ requirements.txt...
    echo (Quá trình này chỉ diễn ra DUY NHẤT 1 LẦN, vui lòng đợi trong giây lát...)
    %ACTIVE_PY% -m pip install -r requirements.txt

    if errorlevel 1 (
        echo.
        echo [LỖI] Có lỗi xảy ra trong quá trình cài đặt thư viện! Vui lòng kiểm tra lại kết nối mạng.
        pause
        exit /b 1
    )

    echo.
    echo [HOÀN TẤT] Cài đặt thành công toàn bộ thư viện!
    echo Từ lần khởi động tiếp theo, hệ thống sẽ mở ngay lập tức mà không cần cài lại.
    echo ===============================================================================
    echo.
)

:: 3. Tự động mở trình duyệt web sau 2 giây khi máy chủ bắt đầu chạy
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000/"

:: 4. Khởi chạy máy chủ FastAPI Uvicorn
echo Đang chạy máy chủ tại: http://127.0.0.1:8000
echo Nhấn Ctrl + C để dừng máy chủ khi không sử dụng.
echo ===============================================================================
echo.

python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir Backend --reload-dir AI

echo.
echo Máy chủ đã dừng.
pause
