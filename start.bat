@echo off
title MIPL PPC Module
setlocal
cd /d "%~dp0"

echo ========================================
echo   MIPL PPC Module - Starting...
echo ========================================
echo.

:: Install backend dependencies if needed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    if errorlevel 1 ( echo ERROR: npm install failed for backend. & pause & exit /b 1 )
    cd ..
    echo.
)

:: Install frontend dependencies if needed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    if errorlevel 1 ( echo ERROR: npm install failed for frontend. & pause & exit /b 1 )
    cd ..
    echo.
)

:: Setup database and admin credentials
echo Setting up database...
cd backend
node scripts/setup-db.js
if errorlevel 1 (
    echo.
    echo ERROR: Database setup failed.
    echo Make sure PostgreSQL is running and backend\.env has correct DATABASE_URL.
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

:: Kill anything already on ports 5000 and 5173
echo Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000 " ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173 " ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

:: Start backend in new window
echo Starting backend...
start "MIPL - Backend (port 5000)" /D "%~dp0backend" cmd /c "node src/app.js & pause"

:: Wait for backend
timeout /t 4 /nobreak >nul

:: Start frontend in new window
echo Starting frontend...
start "MIPL - Frontend (port 5173)" /D "%~dp0frontend" cmd /c "node_modules\.bin\vite.cmd & pause"

timeout /t 5 /nobreak >nul

:: Open browser
start http://localhost:5173

echo.
echo ========================================
echo   App is running!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:5000
echo   Login    : admin@mipl.com / Admin@1234
echo ========================================
echo.
pause
