# 开机自启动配置指南

## 功能说明

开机自启动功能让程序在系统启动时自动运行，并执行以下操作：
1. **开机备份**: 启动后立即执行一次备份（检查并备份新增内容）
2. **定时任务**: 然后按照配置的定时计划继续运行

## Windows 配置方法

### 方法1：使用自动化脚本（推荐）

1. **右键以管理员身份运行** `setup-autostart.bat`

2. 选择 `[1] 添加开机自启动`

3. 完成！程序将在每次登录后自动运行（默认延迟 30 秒，等待网络与桌面加载）

**管理命令**：
- 移除自启动：运行脚本选择 `[2]`
- 查看状态：运行脚本选择 `[3]`

### 方法2：手动配置 Windows 计划任务

1. 按 `Win + R`，输入 `taskschd.msc` 打开任务计划程序

2. 点击"创建任务"

3. **常规**标签：
   - 名称：`QQAlbumBackup`
   - 勾选"使用最高权限运行"
   - 配置：Windows 10/11

4. **触发器**标签：
   - 新建触发器
   - 开始任务：**登录时**（选择指定用户）
   - 延迟任务时间：30秒（可选，等待网络就绪）
   - 如果确实需要在无人登录时运行，可选择“启动时”并改用 `SYSTEM` 账户

5. **操作**标签：
   - 新建操作
   - 操作：**启动程序**
   - 程序：`C:\Users\你的用户名\Desktop\toys\群相册拯救计划\qq-album-scheduler\startup.bat`

6. **条件**标签：
   - 取消勾选"只有在计算机使用交流电源时才启动此任务"

7. **设置**标签：
   - 勾选"如果任务失败，重新启动间隔"
   
8. 点击"确定"保存

## 配置选项

在 `config.json` 中控制开机是否备份：

```json
{
  "schedule": {
    "enabled": true,
    "cron": "0 2 * * *",
    "description": "每天凌晨2点执行备份",
    "backupOnBoot": true  // true=开机备份, false=不备份
  }
}
```

**建议设置**：
- `backupOnBoot: true` - 推荐，确保开机后同步最新内容
- `backupOnBoot: false` - 如果只想按定时执行

## Linux/Mac 配置方法

### systemd 服务（Linux）

1. 创建服务文件 `/etc/systemd/system/qq-album-backup.service`：

```ini
[Unit]
Description=QQ Album Backup Service
After=network.target

[Service]
Type=simple
User=你的用户名
WorkingDirectory=/path/to/qq-album-scheduler
ExecStart=/usr/bin/node /path/to/qq-album-scheduler/src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. 启用并启动服务：

```bash
sudo systemctl enable qq-album-backup
sudo systemctl start qq-album-backup
sudo systemctl status qq-album-backup
```

### LaunchAgent (Mac)

1. 创建 `~/Library/LaunchAgents/com.qq.albumbackup.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.qq.albumbackup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/qq-album-scheduler/src/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/path/to/qq-album-scheduler</string>
</dict>
</plist>
```

2. 加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.qq.albumbackup.plist
```

## 验证和日志

### 验证自启动是否成功

**Windows**:
```cmd
# 查看任务状态
schtasks /query /tn "QQAlbumBackup" /fo list

# 手动测试运行
schtasks /run /tn "QQAlbumBackup"
```

**Linux**:
```bash
systemctl status qq-album-backup
journalctl -u qq-album-backup -f
```

### 查看日志

程序日志位于 `logs/` 目录：
- `qq-album-YYYY-MM-DD.log` - 完整日志
- `startup.log` - 启动记录（Windows）

## 注意事项

1. **网络依赖**: 确保系统启动时网络已连接
2. **权限**: Windows需要管理员权限设置计划任务
3. **路径**: 确保所有路径使用绝对路径
4. **日志**: 定期检查日志文件，清理旧日志
5. **测试**: 设置后重启电脑验证是否正常运行

## 故障排除

**问题：任务未运行**
- 检查任务计划程序中任务状态
- 查看 `startup.log` 是否有记录
- 确认 Node.js 在系统 PATH中
- 如果 `Last Result` 为 `0x1` 且触发器是“启动时”，说明任务在登录前执行被拒绝；改用“登录时”触发或切换到 SYSTEM 账户

**问题：权限错误**
- 确保以管理员身份运行设置脚本
- 检查任务是否勾选"使用最高权限运行"

**问题：网络未就绪**
- 增加触发器延迟时间（如60秒）
- 或使用"网络连接时"作为触发条件

## 取消自启动

**Windows**：
```cmd
# 运行 setup-autostart.bat 选择 [2]
# 或手动执行：
schtasks /delete /tn "QQAlbumBackup" /f
```

**Linux**：
```bash
sudo systemctl disable qq-album-backup
sudo systemctl stop qq-album-backup
```

**Mac**：
```bash
launchctl unload ~/Library/LaunchAgents/com.qq.albumbackup.plist
rm ~/Library/LaunchAgents/com.qq.albumbackup.plist
```
