# QQ群相册定时备份工具

一个基于 Node.js 的自动化工具，用于定时备份多个 QQ 群相册。支持增量备份、并发下载、失败重试等功能。

## ✨ 功能特性

- 🕐 **定时备份** - 使用 cron 表达式设置自动备份时间
- 📦 **多群组支持** - 同时备份多个 QQ 群的相册
- 🔄 **增量备份** - 智能跳过已下载的文件，节省带宽和存储
- ⚡ **并发下载** - 支持多线程并发下载，提高效率
- 🔁 **失败重试** - 自动重试失败的下载任务
- 📊 **详细日志** - 完整的操作日志和统计信息
- 💾 **备份索引** - 维护备份历史记录，支持断点续传
- 🎬 **视频支持** - 自动下载相册中的照片和视频

## 📋 前置要求

- Node.js >= 14.0.0
- npm 或 yarn
- 有效的 QQ 账号和访问群相册的权限

## 🚀 安装

### 1. 克隆或下载项目

```bash
cd qq-album-scheduler
```

### 2. 安装依赖

```bash
npm install
```

### 3. 首次运行 - 自动登录

**推荐方式：自动登录**

首次运行时，程序会自动打开浏览器供您登录：

```bash
npm start
```

或手动触发登录：

```bash
node src/index.js --login
```

登录流程：
1. 程序自动打开浏览器
2. 在浏览器中登录您的QQ账号（支持扫码或账号密码）
3. 登录成功后，程序自动获取并保存认证信息到 `.env` 文件
4. 浏览器自动关闭，程序继续运行

> 💡 **提示**: 认证信息会自动保存，下次运行无需重新登录

**替代方式：手动配置（高级用户）**

如果您prefer手动配置或自动登录失败，可以：

1. 复制 `.env.example` 到 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 手动获取QQ认证信息：
   - 使用浏览器登录 [QQ空间](https://qzone.qq.com/)
   - 打开浏览器开发者工具（F12）
   - 切换到 "Network" 标签
   - 刷新页面，找到任意请求
   - 在请求头中找到 `Cookie` 字段，复制完整内容到 `QQ_COOKIES`
   - 在 Cookie 中找到 `p_skey=xxx` 的值，复制到 `QQ_P_SKEY`
   - 在 Cookie 中找到 `p_uin=oXXXXXXXX` 的值，提取数字部分到 `QQ_UIN`

3. 编辑 `.env` 文件填写获取的信息

### 4. 配置群组信息

复制 `config.example.json` 到 `config.json` 并配置要备份的群组：

```bash
cp config.example.json config.json
```

编辑 `config.json`，添加您要备份的QQ群：

```json
{
  "groups": [
    {
      "id": "123456789",
      "name": "我的群组1",
      "enabled": true
    }
  ],
  "schedule": {
    "enabled": true,
    "cron": "0 2 * * *",
    "description": "每天凌晨2点执行备份"
  }
}
```

> 💡 **如何获取群号**: 在QQ中打开群资料卡，群号显示在群名称下方

## 📖 使用方法

### 首次登录

第一次使用时，运行程序会自动打开浏览器进行登录：

```bash
npm start
```

后续如需重新登录（如Cookie过期）：

```bash
node src/index.js --login
```

### 定时备份模式

启动定时备份服务：

```bash
npm start
```

或直接运行：

```bash
node src/index.js
```

后台运行（守护进程模式）：

```bash
npm run start:daemon
```

### 手动备份模式

执行一次性备份：

```bash
npm run backup
```

或：

```bash
node src/index.js --manual
```

### 备份指定群组

只备份某个群组：

```bash
node src/index.js --group 123456789
```

### 测试模式

测试配置是否正确（不实际下载）：

```bash
npm test
```

或：

```bash
node src/index.js --dry-run
```

## ⚙️ 配置说明

### 定时计划 (schedule)

使用 cron 表达式配置执行时间：

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期几 (0-7, 0和7都表示周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

常用示例：

- `0 2 * * *` - 每天凌晨2点
- `0 */6 * * *` - 每6小时
- `0 0 * * 0` - 每周日午夜
- `0 0 1 * *` - 每月1号午夜

### 下载设置 (download)

```json
{
  "download": {
    "maxConcurrent": 3,      // 最大并发下载数
    "retryAttempts": 3,      // 失败重试次数
    "retryDelay": 2000,      // 重试延迟（毫秒）
    "timeout": 30000         // 下载超时时间（毫秒）
  }
}
```

### 存储设置 (storage)

```json
{
  "storage": {
    "basePath": "./backups",     // 备份根目录
    "organizeBy": "group",       // 按群组组织
    "keepStructure": true        // 保持目录结构
  }
}
```

### 增量备份 (incremental)

```json
{
  "incremental": {
    "enabled": true,        // 启用增量备份
    "skipExisting": true    // 跳过已存在的文件
  }
}
```

### 日志设置 (logging)

```json
{
  "logging": {
    "level": "info",        // 日志级别: debug, info, warn, error
    "console": true,        // 控制台输出
    "file": true,           // 文件输出
    "maxFiles": "14d"       // 日志保留时间
  }
}
```

## 📁 目录结构

备份文件组织结构：

```
backups/
├── 123456789_我的群组1/
│   ├── 相册名称1/
│   │   ├── .backup_index.json
│   │   ├── photo1.jpg
│   │   ├── photo2.jpg
│   │   └── video1.mp4
│   └── 相册名称2/
│       └── ...
└── 987654321_我的群组2/
    └── ...
```

## 📊 日志文件

日志保存在 `logs/` 目录：

- `qq-album-YYYY-MM-DD.log` - 完整日志
- `error-YYYY-MM-DD.log` - 仅错误日志

## 🔧 故障排除

### 认证失败

**问题**: 提示 "❌ QQ认证信息未配置或无效"

**解决方法**:
1. 确认 `.env` 文件中的 Cookie 是最新的
2. 重新登录 QQ 空间获取新的 Cookie
3. 确保 Cookie 包含 `p_skey` 和 `p_uin` 字段

### 无访问权限

**问题**: 下载时提示 "无访问权限"

**解决方法**:
1. 确认你的 QQ 账号在该群中
2. 确认你有查看该群相册的权限
3. 群管理员可能限制了相册访问

### 下载速度慢

**解决方法**:
1. 增加并发下载数 (`maxConcurrent`)
2. 检查网络连接
3. 避免在高峰时段运行

### 下载失败

**解决方法**:
1. 检查网络连接
2. 增加重试次数 (`retryAttempts`)
3. 增加超时时间 (`timeout`)
4. 查看错误日志了解具体原因

## 📝 注意事项

1. **Cookie 有效期**: QQ Cookie 会过期，建议定期更新
2. **存储空间**: 确保有足够的磁盘空间存储备份
3. **网络稳定**: 建议在网络稳定的环境运行
4. **备份频率**: 不建议设置过高的备份频率，避免对 QQ 服务器造成压力
5. **隐私保护**: `.env` 和 `config.json` 包含敏感信息，不要上传到公开仓库

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

本项目参考了以下开源项目：
- [QQ-Group-Albums-Downloader](https://github.com/ShunCai/QQ-Group-Albums-Downloader)
- [QQGroupAlbumDownload](https://github.com/lihengdao/QQGroupAlbumDownload)
