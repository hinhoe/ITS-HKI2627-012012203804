@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title PARKTECH / PARKAIVISION - Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh

echo ===============================================================================
echo     HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
echo     Khởi động Backend API FastAPI và Giao diện Quản trị Bãi xe
echo ===============================================================================
echo.

REM 1. Kiem tra Python tren may tinh
set "PY_CMD=python"
python --version >nul 2>&1
if %errorlevel% equ 0 goto :check_venv

set "PY_CMD=py"
py --version >nul 2>&1
if %errorlevel% equ 0 goto :check_venv

echo [LỖI] Máy tính của bạn chưa cài đặt Python hoặc chưa tích chọn Add Python to PATH!
echo.
echo Vui lòng tải và cài đặt Python (phiên bản 3.10 trở lên) tại:
echo https://www.python.org/downloads/
echo * LƯU Ý: Khi cài đặt, hãy tích chọn "Add python.exe to PATH".
echo ===============================================================================
pause
exit /b 1

:check_venv
REM 2. Kiem tra moi truong ao .venv
if exist ".venv\Scripts\python.exe" goto :activate_venv

echo [THÔNG BÁO] Phát hiện đây là lần đầu tiên chạy dự án trên máy tính này!
echo Đang tự động thiết lập môi trường và cài đặt các thư viện cần thiết...
echo.

echo [1/3] Đang tạo môi trường ảo .venv...
%PY_CMD% -m venv .venv
if not exist ".venv\Scripts\python.exe" (
    echo [CẢNH BÁO] Không thể tạo môi trường ảo, sẽ dùng Python hệ thống.
    set "RUN_PY=%PY_CMD%"
    goto :install_reqs
)

:activate_venv
echo [OK] Đang kích hoạt môi trường ảo .venv...
call ".venv\Scripts\activate.bat"
set "RUN_PY=python"

if exist ".venv\.installed" goto :start_server

:install_reqs
echo [2/3] Đang nâng cấp pip...
%RUN_PY% -m pip install --upgrade pip --quiet

echo [3/3] Đang cài đặt các thư viện từ requirements.txt...
echo (Quá trình này chỉ diễn ra 1 LẦN DUY NHẤT, vui lòng chờ trong giây lát...)
%RUN_PY% -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Có lỗi trong quá trình cài đặt thư viện! Vui lòng kiểm tra kết nối mạng.
    pause
    exit /b 1
)

echo ok > ".venv\.installed"
echo.
echo [HOÀN TẤT] Cài đặt thành công toàn bộ thư viện!
echo Từ lần chạy sau, hệ thống sẽ mở ngay lập tức mà không cần cài đặt lại.
echo ===============================================================================
echo.

:start_server
REM 3. Tu dong mo trinh duyet web sau 2 giay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000/"

REM 4. Khoi chay may chu Uvicorn
echo Đang chạy máy chủ tại: http://127.0.0.1:8000
echo Nhấn Ctrl + C để dừng máy chủ khi không sử dụng.
echo ===============================================================================
echo.

%RUN_PY% -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir Backend --reload-dir AI

echo.
echo Máy chủ đã dừng.
pause
