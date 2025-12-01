@echo off
REM ========================================
REM QQ群相册备份 - 开机自启动脚本
REM 此脚本会启动备份程序并在窗口中实时输出日志
REM ========================================

cd /d "%~dp0"
set "WORKDIR=%CD%"
set "LOG_FILE=%WORKDIR%\startup.log"

REM 记录启动日志
echo [%date% %time%] ====== 启动脚本开始执行 ====== >> "%LOG_FILE%"
echo [%date% %time%] 工作目录: %WORKDIR% >> "%LOG_FILE%"

REM 检查 Node.js 是否可用
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] 错误: Node.js 未找到，请确保已安装并添加到 PATH >> "%LOG_FILE%"
    exit /b 1
)

REM 如果是开机启动，等待网络就绪
REM 可以通过检测网络连接来判断
ping -n 1 qzone.qq.com >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] 网络未就绪，等待10秒... >> "%LOG_FILE%"
    timeout /t 10 /nobreak >nul
)

echo [%date% %time%] 正在启动 Node.js 程序（输出会同步到此窗口） >> "%LOG_FILE%"
echo.
echo ========================================
echo    QQ 群相册备份正在运行
echo    输出同时写入: %LOG_FILE%
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath $env:WORKDIR; $logPath = $env:LOG_FILE; $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; \"[$timestamp] Node.js 备份进程开始输出（同步到窗口）\" | Out-File -FilePath $logPath -Append; & node src/index.js --daemon 2>&1 | Tee-Object -FilePath $logPath -Append; $exitCode = $LASTEXITCODE; exit $exitCode"

set "EXIT_CODE=%errorlevel%"
echo [%date% %time%] Node.js 进程已退出，代码: %EXIT_CODE% >> "%LOG_FILE%"
echo [%date% %time%] 启动脚本执行完毕 >> "%LOG_FILE%"

exit /b %EXIT_CODE%
