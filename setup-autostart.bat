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

REM 创建计划任务，在用户登录后30秒运行（避免开机阶段无用户会话导致的 0x1 错误）
REM 使用 ONLOGON 触发器可以在登录后立即拥有用户上下文，无需保存密码
REM 如果需要纯开机（无登录）运行，可手动改用 SYSTEM 账户创建任务
schtasks /create ^
    /tn "QQAlbumBackup" ^
    /tr "\"%STARTUP_SCRIPT%\"" ^
    /sc onlogon ^
    /ru "%USERNAME%" ^
    /rl highest ^
    /delay 0000:30 ^
    /it ^
    /f

if %errorlevel% equ 0 (
    echo.
    echo ✓ 开机自启动已成功添加！
    echo.
    echo 说明:
    echo - 程序将在每次登录后30秒自动运行（等待网络就绪与桌面加载）
    echo - 如果需要在无人登录时运行，请改用 SYSTEM 账户手动创建计划任务
    echo - 运行模式：后台静默模式
    echo - 备份时机：开机后立即执行一次，然后按定时计划执行
    echo - 查看日志：logs 文件夹 和 startup.log
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
