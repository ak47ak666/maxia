@echo off
chcp 65001 >nul
echo ========================================
echo           马虾 AI Agent 启动中
echo ========================================
echo.

:: 检查Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

:: 显示Node版本
echo Node版本:
node --version
echo.

:: 检查端口是否被占用
netstat -ano | findstr ":3006" | findstr "LISTEN" >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 端口3006已被占用，正在终止旧进程...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3006" ^| findstr "LISTEN"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

:: 启动服务
echo 正在启动服务...
echo 访问地址: http://localhost:3006
echo 按 Ctrl+C 可停止服务
echo.

cd /d "%~dp0"
start "" "http://localhost:3006"
node dist/server/index.js

pause
