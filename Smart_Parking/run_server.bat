@echo off
chcp 65001 >nul
title PARKTECH / PARKAIVISION — Smart Parking Server
cd /d "%~dp0"
echo Khoi dong Smart Parking Backend & Frontend tai http://127.0.0.1:8000 ...
python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir Backend --reload-dir AI
pause
