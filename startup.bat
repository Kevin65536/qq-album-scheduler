@echo off
REM QQ群相册备份 - 开机自启动脚本
REM 此脚本会在后台静默运行备份程序

cd /d "%~dp0"

REM 记录启动日志
echo [%date% %time%] 正在启动程序... >> startup.log

REM 启动Node.js程序（后台模式）
REM 输出和错误都重定向到日志文件以便调试
start /B node src\\index.js --daemon >> startup.log 2>&1

if %errorlevel% equ 0 (
    echo [%date% %time%] 程序启动成功 >> startup.log
) else (
    echo [%date% %time%] 程序启动失败，错误代码: %errorlevel% >> startup.log
)
