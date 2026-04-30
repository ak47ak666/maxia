@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ========================================
echo           马虾 AI Agent
echo ========================================
echo.

:: 查找占用3006端口的进程PID
echo 正在检查3006端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3006" ^| findstr "LISTEN"') do (
    echo 找到进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    echo 已终止旧进程
)

:: 等待端口释放
timeout /t 1 >nul

echo.
echo 正在启动服务...
echo 访问地址: http://localhost:3006
echo.

:: 启动服务
node dist/server/index.js

pause