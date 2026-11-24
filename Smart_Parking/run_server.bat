@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title PARKTECH / PARKAIVISION - He Thong Quan Ly Bai Do Xe Thong Minh

echo ===============================================================================
echo     HE THONG QUAN LY BAI DO XE THONG MINH - PARKTECH / PARKAIVISION
echo     Khoi dong Backend API FastAPI va Giao dien Quan tri Bai xe
echo ===============================================================================
echo.

REM 1. Kiem tra Python tren may tinh
set "PY_CMD=python"
python --version >nul 2>&1
if %errorlevel% equ 0 goto check_venv

set "PY_CMD=py"
py --version >nul 2>&1
if %errorlevel% equ 0 goto check_venv

echo [LOI] May tinh cua ban chua cai dat Python hoac chua them vao PATH!
echo Vui long cai dat Python 3.10+ va tich vao 'Add python.exe to PATH'.
echo ===============================================================================
pause
exit /b 1

:check_venv
REM 2. Kiem tra moi truong ao .venv
if exist ".venv\Scripts\python.exe" goto activate_venv

echo [OK] Dang su dung Python he thong...
set "RUN_PY=%PY_CMD%"
goto check_deps

:activate_venv
echo [OK] Dang su dung moi truong ao .venv...
call ".venv\Scripts\activate.bat"
set "RUN_PY=python"

:check_deps
REM Kiem tra xem da cai dat fastapi va uvicorn chua
%RUN_PY% -c "import fastapi, uvicorn" >nul 2>&1
if %errorlevel% equ 0 goto start_server

echo [THONG BAO] Dang tu dong cai dat cac thu vien can thiet tu requirements.txt...
echo (Qua trinh nay chi dien ra 1 LAN DUY NHAT, vui long cho trong giay lat...)
%RUN_PY% -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [LOI] Khong the cai dat thu vien! Vui long kiem tra ket noi mang.
    pause
    exit /b 1
)

:start_server
REM Giai phong port 8000 neu bi chiem boi tien trinh cu truoc khi khoi chay
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="" taskkill /f /pid %%a >nul 2>&1
)

REM 3. Tu dong doi may chu khoi dong thanh cong roi moi mo trinh duyet (tranh loi ERR_CONNECTION_REFUSED)
start "" powershell -NoProfile -WindowStyle Hidden -Command "$w=0; while($w -lt 40){ try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -lt 400 -or $r.StatusCode -eq 404){ Start-Process 'http://127.0.0.1:8000/'; break } } catch {}; Start-Sleep -Milliseconds 500; $w++ }"

REM 4. Khoi chay may chu Uvicorn
echo.
echo ===============================================================================
echo   Dang chay may chu tai: http://127.0.0.1:8000
echo   Trinh duyet se tu dong mo trang web ngay khi may chu san sang...
echo   Nhan to hop phim Ctrl + C de dung may chu.
echo ===============================================================================
echo.

%RUN_PY% -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir Backend --reload-dir AI

echo.
echo May chu da dung.
pause
