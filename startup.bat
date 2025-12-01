@echo off
REM ========================================
REM QQ群相册备份 - 开机自启动脚本
REM 此脚本会在后台静默运行备份程序
REM ========================================

cd /d "%~dp0"

REM 记录启动日志
echo [%date% %time%] ====== 启动脚本开始执行 ====== >> startup.log
echo [%date% %time%] 工作目录: %CD% >> startup.log

REM 检查 Node.js 是否可用
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] 错误: Node.js 未找到，请确保已安装并添加到 PATH >> startup.log
    exit /b 1
)

REM 如果是开机启动，等待网络就绪
REM 可以通过检测网络连接来判断
ping -n 1 qzone.qq.com >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] 网络未就绪，等待10秒... >> startup.log
    timeout /t 10 /nobreak >nul
)

REM 检查是否已经有实例在运行
tasklist /fi "imagename eq node.exe" /fo csv 2>nul | find /i "index.js" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] 警告: 程序实例已在运行中，跳过本次启动 >> startup.log
    exit /b 0
)

echo [%date% %time%] 正在启动 Node.js 程序... >> startup.log

REM 使用 start 命令在新的独立进程中运行，不阻塞脚本
REM /MIN 最小化窗口，程序将在后台运行
start "QQ Album Backup" /MIN cmd /c "cd /d "%~dp0" && node src\index.js --daemon >> startup.log 2>&1"

REM 等待1秒让进程启动
timeout /t 2 /nobreak >nul

REM 检查进程是否成功启动
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] 程序启动成功，Node.js 进程正在运行 >> startup.log
) else (
    echo [%date% %time%] 警告: 启动后未检测到 Node.js 进程 >> startup.log
)

echo [%date% %time%] 启动脚本执行完毕 >> startup.log
