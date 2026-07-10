@echo off
echo ========================================
echo    Fist First Fighting Engine Server
echo ========================================
echo.

:: Controleer of node is geïnstalleerd
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Download het van: https://nodejs.org
    pause
    exit
)

:: Controleer of dependencies geïnstalleerd zijn
if not exist node_modules (
    echo Dependencies worden geïnstalleerd...
    call npm install
)

echo Server wordt gestart...
echo.

:: Start de server in een nieuw venster
start "Fist Server" cmd /k "node app.js"

:: Wacht even zodat de server kan opstarten
timeout /t 3 >nul

:: Open de browser
echo opening in browser...
start http://127.0.0.1:8087

echo.
echo Server runs on http://127.0.0.1:8087
echo Press a key to close the server...
pause