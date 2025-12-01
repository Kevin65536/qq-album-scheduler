const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class LoginHelper {
    constructor(logger) {
        this.logger = logger;
        this.loginUrl = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=https%3A//qzs.qq.com/qzone/v6/portal/proxy.html&daid=5&&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=549000912&style=22&target=self&s_url=https%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&pt_qr_app=%E6%89%8B%E6%9C%BAQQ%E7%A9%BA%E9%97%B4&pt_qr_link=https%3A//z.qzone.com/download.html&self_regurl=https%3A//qzs.qq.com/qzone/v6/reg/index.html&pt_qr_help_link=https%3A//z.qzone.com/download.html&pt_no_auth=0';
        this.browser = null;
        this.page = null;
    }

    /**
     * Generate g_tk from p_skey
     */
    generateGTk(skey) {
        let hash = 5381;
        for (let i = 0; i < skey.length; i++) {
            hash += (hash << 5) + skey.charCodeAt(i);
        }
        return hash & 0x7fffffff;
    }

    /**
     * Extract QQ number from p_uin cookie
     */
    extractQQNumber(pUin) {
        const match = pUin.match(/[1-9][0-9]*/g);
        return match ? match[0] : null;
    }

    /**
     * Launch browser and wait for user login
     */
    async login() {
        try {
            this.logger.info('🌐 正在启动浏览器...');

            // Launch browser with visible UI
            this.browser = await puppeteer.launch({
                headless: false, // Show browser for user to login
                defaultViewport: {
                    width: 500,
                    height: 700,
                },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            });

            this.page = await this.browser.newPage();

            this.logger.info('📱 请在浏览器中登录QQ账号...');
            this.logger.info('💡 提示: 支持扫码登录或账号密码登录');

            // Navigate to login page
            await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

            // Wait for login success - detect when redirected to qzone
            this.logger.info('⏳ 等待登录完成...');

            await this.page.waitForFunction(
                () => window.location.href.includes('user.qzone.qq.com'),
                { timeout: 300000 } // 5 minutes timeout
            );

            this.logger.info('✅ 登录成功！正在获取认证信息...');

            // Get cookies
            const cookies = await this.page.cookies();

            // Find required cookies
            const pSkeyCookie = cookies.find(c => c.name === 'p_skey');
            const pUinCookie = cookies.find(c => c.name === 'p_uin');

            if (!pSkeyCookie || !pUinCookie) {
                throw new Error('未能获取必需的Cookie信息（p_skey 或 p_uin）');
            }

            // Extract values
            const pSkey = pSkeyCookie.value;
            const pUin = pUinCookie.value;
            const qqNumber = this.extractQQNumber(pUin);
            const gTk = this.generateGTk(pSkey);

            // Format cookie string
            const cookieString = cookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');

            this.logger.info('🎉 认证信息获取成功！', {
                qqNumber,
                gTk,
            });

            // Close browser
            await this.browser.close();
            this.browser = null;
            this.page = null;

            return {
                cookies: cookieString,
                pSkey,
                qqNumber,
                gTk,
            };

        } catch (error) {
            // Close browser on error
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }

            if (error.name === 'TimeoutError') {
                throw new Error('登录超时，请重新运行程序');
            }

            throw error;
        }
    }

    /**
     * Save credentials to .env file
     */
    async saveCredentials(credentials, envPath = '.env') {
        try {
            const envContent = `# QQ Authentication (Auto-generated on ${new Date().toISOString()})
QQ_COOKIES=${credentials.cookies}
QQ_P_SKEY=${credentials.pSkey}
QQ_UIN=${credentials.qqNumber}

# Backup Configuration
BACKUP_BASE_PATH=./backups

# Download Settings
MAX_CONCURRENT_DOWNLOADS=3
RETRY_ATTEMPTS=3

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
`;

            await fs.writeFile(envPath, envContent, 'utf-8');
            this.logger.info(`💾 认证信息已保存到 ${envPath}`);

            return true;
        } catch (error) {
            this.logger.error(`保存认证信息失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * Interactive login flow
     */
    async interactiveLogin(envPath = '.env') {
        this.logger.info('🚀 开始自动登录流程\n');

        const credentials = await this.login();

        this.logger.info('\n📋 获取到的认证信息:');
        this.logger.info(`   QQ号: ${credentials.qqNumber}`);
        this.logger.info(`   g_tk: ${credentials.gTk}`);
        this.logger.info(`   Cookie长度: ${credentials.cookies.length} 字符\n`);

        await this.saveCredentials(credentials, envPath);

        this.logger.info('✅ 登录流程完成！现在可以开始备份了。\n');

        return credentials;
    }
}

module.exports = LoginHelper;
