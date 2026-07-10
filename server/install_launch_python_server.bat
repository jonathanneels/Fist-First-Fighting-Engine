@echo off
echo ========================================
echo    Fist First Fighting Engine - Python Server
echo ========================================
echo.

:: Controleer of Python is geïnstalleerd
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found!
    echo Install Python: https://python.org
    pause
    exit
)

echo checking dependencies...
python -c "import asyncio, websockets, json" >nul 2>nul
if %errorlevel% neq 0 (
    echo Dependencies installing...
    pip install websockets
)

echo.
echo Server starts at http://127.0.0.1:8087
echo WebSocket at port 8765
echo.

echo opening in browser...
start http://127.0.0.1:8087

:: Start de Python server
python app.py

pause