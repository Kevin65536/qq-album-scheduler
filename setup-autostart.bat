@echo off
echo ========================================
echo    QQ群相册备份 - 开机自启动设置工具
echo ========================================
echo.

REM 获取当前脚本的完整路径
set "SCRIPT_DIR=%~dp0"
set "STARTUP_SCRIPT=%SCRIPT_DIR%startup.bat"

echo 当前程序路径: %SCRIPT_DIR%
echo 启动脚本: %STARTUP_SCRIPT%
echo.

echo 请选择操作:
echo [1] 添加开机自启动
echo [2] 移除开机自启动
echo [3] 查看当前状态
echo [4] 退出
echo.
set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" goto ADD
if "%choice%"=="2" goto REMOVE
if "%choice%"=="3" goto STATUS
if "%choice%"=="4" goto END

echo 无效选项，请重新运行
goto END

:ADD
echo.
echo 正在添加开机自启动任务...
echo.

REM 创建计划任务
schtasks /create /tn "QQAlbumBackup" /tr "\"%STARTUP_SCRIPT%\"" /sc onstart /ru "%USERNAME%" /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ✓ 开机自启动已成功添加！
    echo.
    echo 说明:
    echo - 程序将在每次开机时自动运行
    echo - 运行模式：后台静默模式
    echo - 备份时机：开机后立即执行一次，然后按定时计划执行
    echo - 查看日志：logs 文件夹
    echo.
) else (
    echo.
    echo ✗ 添加失败！请以管理员身份运行此脚本
    echo.
)
goto END

:REMOVE
echo.
echo 正在移除开机自启动任务...
echo.

schtasks /delete /tn "QQAlbumBackup" /f

if %errorlevel% equ 0 (
    echo.
    echo ✓ 开机自启动已成功移除！
    echo.
) else (
    echo.
    echo ✗ 移除失败或任务不存在
    echo.
)
goto END

:STATUS
echo.
echo 正在查询任务状态...
echo.

schtasks /query /tn "QQAlbumBackup" /fo list

if %errorlevel% neq 0 (
    echo.
    echo 未找到开机自启动任务
    echo.
)
goto END

:END
echo.
pause
