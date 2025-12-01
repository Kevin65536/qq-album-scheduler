# 自动登录功能说明

## 功能概述

新增了**浏览器自动登录**功能，无需手动复制Cookie，大大简化了首次使用的配置流程。

## 工作原理

1. **自动启动浏览器**: 使用Puppeteer自动打开浏览器窗口
2. **用户登录**: 用户在浏览器中正常登录QQ账号（扫码或密码）
3. **自动提取**: 登录成功后，程序自动提取Cookie和认证信息
4. **自动保存**: 将认证信息保存到`.env`文件
5. **继续运行**: 关闭浏览器，程序继续执行备份任务

## 使用方法

### 方式1：首次运行自动触发

```bash
npm start
```

如果检测到没有认证信息，会自动打开浏览器登录。

### 方式2：手动触发登录

```bash
node src/index.js --login
```

即使已有认证信息，也会强制重新登录（用于Cookie过期时）。

## 技术实现

### 新增文件

- `src/auth/LoginHelper.js` - 浏览器自动登录模块

### 核心功能

```javascript
class LoginHelper {
  async login() {
    // 1. 启动浏览器
    this.browser = await puppeteer.launch({ headless: false });
    
    // 2. 导航到QQ登录页
    await this.page.goto(loginUrl);
    
    // 3. 等待用户登录成功（检测跳转到qzone）
    await this.page.waitForFunction(
      () => window.location.href.includes('user.qzone.qq.com')
    );
    
    // 4. 提取Cookie
    const cookies = await this.page.cookies();
    
    // 5. 返回认证信息
    return { cookies, pSkey, qqNumber, gTk };
  }
  
  async saveCredentials(credentials) {
    // 保存到 .env 文件
    await fs.writeFile('.env', envContent);
  }
}
```

### 主程序集成

```javascript
async function main() {
  // 检查是否需要登录
  const needLogin = options.login || !process.env.QQ_COOKIES;
  
  if (needLogin) {
    const loginHelper = new LoginHelper(logger);
    const credentials = await loginHelper.interactiveLogin();
    
    // 更新环境变量
    process.env.QQ_COOKIES = credentials.cookies;
    process.env.QQ_P_SKEY = credentials.pSkey;
    process.env.QQ_UIN = credentials.qqNumber;
  }
  
  // 继续正常流程...
}
```

## 依赖变更

新增了Puppeteer依赖：

```json
{
  "dependencies": {
    "puppeteer": "^23.9.0"
  }
}
```

## 优势

✅ **用户友好**: 无需手动复制Cookie  
✅ **自动化**: 一键完成认证配置  
✅ **可视化**: 用户可以看到登录过程  
✅ **灵活**: 支持扫码和密码两种登录方式  
✅ **兼容**: 保留了手动配置方式作为备选  

## 注意事项

1. **首次安装Puppeteer**: 会自动下载Chromium浏览器（约200MB）
2. **超时设置**: 登录等待超时为5分钟
3. **网络要求**: 需要能访问QQ登录页面
4. **后续使用**: 认证信息保存后，下次运行无需重新登录

## 未来扩展

可能的改进方向：
- 支持二维码显示在终端（供无头服务器使用）
- 添加Cookie有效期检测和自动续期
- 支持多账号管理
