#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');

const Logger = require('./utils/Logger');
const QQAuth = require('./auth/QQAuth');
const LoginHelper = require('./auth/LoginHelper');
const StorageManager = require('./storage/StorageManager');
const BackupScheduler = require('./scheduler/BackupScheduler');

// Parse command line arguments
program
    .name('qq-album-scheduler')
    .description('QQ群相册定时备份工具')
    .version('1.0.0')
    .option('-c, --config <path>', '配置文件路径', './config.json')
    .option('-m, --manual', '手动执行一次备份（不启动定时任务）')
    .option('-g, --group <groupId>', '仅备份指定群组')
    .option('-d, --dry-run', '测试模式（不实际下载）')
    .option('--daemon', '后台运行模式')
    .option('--login', '强制重新登录（即使已有认证信息）')
    .parse(process.argv);

const options = program.opts();

/**
 * Load configuration
 */
function loadConfig(configPath) {
    try {
        if (!fs.existsSync(configPath)) {
            console.error(`❌ 配置文件不存在: ${configPath}`);
            console.log(`💡 请复制 config.example.json 到 config.json 并填写配置`);
            process.exit(1);
        }

        const config = fs.readJsonSync(configPath);
        return config;
    } catch (error) {
        console.error(`❌ 读取配置文件失败: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Validate configuration
 */
function validateConfig(config) {
    if (!config.groups || config.groups.length === 0) {
        console.error('❌ 配置文件中没有群组');
        process.exit(1);
    }

    const enabledGroups = config.groups.filter(g => g.enabled !== false);
    if (enabledGroups.length === 0) {
        console.error('❌ 没有启用的群组');
        process.exit(1);
    }

    return true;
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 QQ群相册定时备份工具 v1.0.0\n');

    // Load configuration
    const config = loadConfig(options.config);
    validateConfig(config);

    // Initialize logger
    const logger = new Logger(config.logging || {});

    // Check if we need to login
    const needLogin = options.login ||
        !process.env.QQ_COOKIES ||
        !process.env.QQ_P_SKEY ||
        !process.env.QQ_UIN;

    let auth;

    if (needLogin) {
        logger.info('🔐 未检测到有效的认证信息，启动自动登录流程...\n');

        const loginHelper = new LoginHelper(logger);

        try {
            const credentials = await loginHelper.interactiveLogin('.env');

            // Update environment variables
            process.env.QQ_COOKIES = credentials.cookies;
            process.env.QQ_P_SKEY = credentials.pSkey;
            process.env.QQ_UIN = credentials.qqNumber;

            // Initialize auth with new credentials
            auth = new QQAuth({
                cookies: credentials.cookies,
                pSkey: credentials.pSkey,
                uin: credentials.qqNumber,
            });

        } catch (error) {
            logger.error(`❌ 自动登录失败: ${error.message}`);
            logger.info('💡 您也可以手动配置认证信息:');
            logger.info('   1. 复制 .env.example 到 .env');
            logger.info('   2. 登录 https://qzone.qq.com/ 并复制 Cookie');
            logger.info('   3. 填写 QQ_COOKIES, QQ_P_SKEY, QQ_UIN');
            process.exit(1);
        }
    } else {
        // Initialize authentication with existing credentials
        auth = new QQAuth({
            cookies: process.env.QQ_COOKIES,
            pSkey: process.env.QQ_P_SKEY,
            uin: process.env.QQ_UIN,
        });

        if (!auth.isValid()) {
            logger.error('❌ QQ认证信息无效');
            logger.info('💡 请运行以下命令重新登录:');
            logger.info('   node src/index.js --login');
            process.exit(1);
        }
    }

    logger.info('✅ 认证信息已加载', { uin: auth.getUin() });

    // Initialize storage manager
    const storageConfig = config.storage || {};
    const storage = new StorageManager(storageConfig, logger);
    logger.info(`📁 备份目录: ${path.resolve(storageConfig.basePath || './backups')}`);

    // If single group mode
    if (options.group) {
        const groupId = options.group;
        const group = config.groups.find(g => g.id === groupId);

        if (!group) {
            logger.error(`群组 ${groupId} 不在配置文件中`);
            process.exit(1);
        }

        config.groups = [group];
        config.schedule = { enabled: false };
    }

    // If dry-run mode
    if (options.dryRun) {
        logger.info('🧪 测试模式：不会实际下载文件');
        config.download = config.download || {};
        config.download.skipExisting = true;
    }

    // Initialize scheduler
    const scheduler = new BackupScheduler(config, auth, storage, logger);

    // Handle graceful shutdown
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info(`\n收到 ${signal} 信号，正在关闭...`);

        scheduler.stop();

        const status = scheduler.getStatus();
        if (status.running) {
            logger.info('等待当前备份任务完成...');
            scheduler.downloadManager.pause();
        }

        logger.info('👋 程序已退出');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Execute based on mode
    if (options.manual || options.group || options.dryRun) {
        // Manual mode - execute once and exit
        logger.info('📦 执行手动备份...\n');
        await scheduler.executeBackup();
        logger.info('\n✅ 备份完成');
        process.exit(0);
    } else {
        // Scheduler mode
        const started = scheduler.start();

        if (!started) {
            logger.error('❌ 启动定时任务失败');
            process.exit(1);
        }

        logger.info('⏰ 定时备份已启动');
        logger.info(`📅 执行计划: ${config.schedule.description || config.schedule.cron}`);
        logger.info('💡 提示: 按 Ctrl+C 停止程序\n');

        // Keep process alive
        if (options.daemon) {
            // Daemon mode - detach from terminal
            process.stdin.pause();
        } else {
            // Interactive mode - show status
            setInterval(() => {
                const status = scheduler.getStatus();
                if (status.running) {
                    logger.debug('状态检查', status);
                }
            }, 60000); // Every minute
        }
    }
}

// Run main function
main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
