@echo off
title FilmRoom Fantasy Football
echo ========================================
echo   Starting FilmRoom Fantasy Football
echo ========================================
echo.

:: Start the backend server (Wrangler) in a new window
echo Starting backend server (port 8787)...
start "FilmRoom API Server" cmd /k "cd /d "%~dp0server" && npm run dev"

:: Wait a moment for the backend to initialize
timeout /t 3 /nobreak >nul

:: Start the frontend dev server (Vite) in a new window
echo Starting frontend server (port 5173)...
start "FilmRoom Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

:: Wait for Vite to start, then open the browser
timeout /t 5 /nobreak >nul
echo.
echo Opening browser...
start http://localhost:3000

echo.
echo ========================================
echo   Servers are running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8787
echo ========================================
echo.
echo Close the server windows to stop.
timeout /t 5 >nul
