@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.18 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:5173 in Chrome or Edge.
echo Keep this window open while playing. Press Ctrl+C to stop the server.
call npm.cmd run dev
pause
