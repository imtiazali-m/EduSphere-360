@echo off
cd /d "%~dp0"
echo ==========================================
echo   EduSphere 360 - Local Development
echo ==========================================
if not exist node_modules (
  echo Installing project packages for the first run...
  call npm install
  if errorlevel 1 (
    echo.
    echo Package installation failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)
echo Starting EduSphere 360 at http://localhost:5173
call npm run dev
pause
