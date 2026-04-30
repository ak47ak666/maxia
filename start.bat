@echo off
cd /d "%~dp0"

:: 只杀死占用3006端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3006" ^| findstr "LISTEN"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo 正在启动马虾...
start http://localhost:3006
node dist/server/index.js
pause
