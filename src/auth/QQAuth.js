const CryptoJS = require('crypto-js');

class QQAuth {
    constructor(config) {
        this.cookies = config.cookies || process.env.QQ_COOKIES || '';
        this.pSkey = config.pSkey || process.env.QQ_P_SKEY || '';
        this.uin = config.uin || process.env.QQ_UIN || '';
        this.gTk = null;

        if (this.pSkey) {
            this.gTk = this.generateGTk(this.pSkey);
        }
    }

    /**
     * Generate g_tk from p_skey
     * Algorithm from QQ web client
     */
    generateGTk(skey) {
        let hash = 5381;
        for (let i = 0; i < skey.length; i++) {
            hash += (hash << 5) + skey.charCodeAt(i);
        }
        return hash & 0x7fffffff;
    }

    /**
     * Get authentication headers for requests
     */
    getHeaders() {
        return {
            'Cookie': this.cookies,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://h5.qzone.qq.com/',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
        };
    }

    /**
     * Get g_tk parameter for API requests
     */
    getGTk() {
        return this.gTk;
    }

    /**
     * Get QQ UIN
     */
    getUin() {
        return this.uin;
    }

    /**
     * Validate if authentication is properly configured
     */
    isValid() {
        return !!(this.cookies && this.gTk && this.uin);
    }

    /**
     * Update authentication credentials
     */
    updateCredentials(cookies, pSkey, uin) {
        if (cookies) this.cookies = cookies;
        if (pSkey) {
            this.pSkey = pSkey;
            this.gTk = this.generateGTk(pSkey);
        }
        if (uin) this.uin = uin;
    }
}

module.exports = QQAuth;
