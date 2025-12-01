const cron = require('node-cron');
const QQAlbumAPI = require('../api/QQAlbumAPI');
const DownloadManager = require('../download/DownloadManager');

class BackupScheduler {
    constructor(config, auth, storage, logger) {
        this.config = config;
        this.auth = auth;
        this.storage = storage;
        this.logger = logger;
        this.api = new QQAlbumAPI(auth, logger);
        this.downloadManager = new DownloadManager(storage, config.download, logger);
        this.cronJob = null;
        this.isRunning = false;
    }

    /**
     * Backup a single group
     */
    async backupGroup(group) {
        const { id: groupId, name: groupName } = group;

        this.logger.info(`开始备份群组: ${groupName || groupId}`, { groupId });

        try {
            // Get album list
            const albums = await this.api.getAlbumList(groupId);

            if (albums.length === 0) {
                this.logger.info(`群组 ${groupName || groupId} 没有相册`);
                return;
            }

            // Process each album
            for (const album of albums) {
                this.logger.info(`处理相册: ${album.title}`, {
                    albumId: album.id,
                    photoCount: album.photoCount,
                });

                try {
                    // Get all photos in the album
                    const photos = await this.api.getAllPhotos(groupId, album.id, album.photoCount);

                    if (photos.length === 0) {
                        this.logger.warn(`相册 ${album.title} 没有照片`);
                        continue;
                    }

                    const albumPath = this.storage.getAlbumPath(groupId, album.title, groupName);

                    // Add download tasks
                    for (const photo of photos) {
                        this.downloadManager.addTask({
                            groupId,
                            groupName,
                            albumTitle: album.title,
                            albumPath,
                            photo,
                        });
                    }

                } catch (error) {
                    this.logger.error(`处理相册失败: ${album.title}`, {
                        error: error.message,
                        albumId: album.id,
                    });
                }
            }

            // Start downloading
            this.logger.info(`开始下载群组 ${groupName || groupId} 的照片`, {
                queueSize: this.downloadManager.queue.length,
            });

            await this.downloadManager.start();

            this.logger.info(`群组 ${groupName || groupId} 备份完成`);

        } catch (error) {
            this.logger.error(`备份群组失败: ${groupName || groupId}`, {
                error: error.message,
                groupId,
            });
        }
    }

    /**
     * Execute backup for all enabled groups
     */
    async executeBackup() {
        if (this.isRunning) {
            this.logger.warn('备份任务正在运行中，跳过此次执行');
            return;
        }

        this.isRunning = true;
        this.logger.startBackup();

        try {
            const enabledGroups = this.config.groups.filter(g => g.enabled !== false);

            this.logger.info(`准备备份 ${enabledGroups.length} 个群组`);

            for (const group of enabledGroups) {
                await this.backupGroup(group);
            }

            this.logger.endBackup();

        } catch (error) {
            this.logger.error(`备份任务异常: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start scheduled backups
     */
    start() {
        if (!this.config.schedule?.enabled) {
            this.logger.info('定时备份未启用');
            return false;
        }

        const cronExpression = this.config.schedule.cron;

        if (!cron.validate(cronExpression)) {
            this.logger.error(`无效的 cron 表达式: ${cronExpression}`);
            return false;
        }

        this.logger.info(`启动定时备份: ${this.config.schedule.description || cronExpression}`);

        this.cronJob = cron.schedule(cronExpression, () => {
            this.logger.info('定时任务触发');
            this.executeBackup();
        });

        return true;
    }

    /**
     * Stop scheduled backups
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.logger.info('定时备份已停止');
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            scheduled: !!this.cronJob,
            running: this.isRunning,
            download: this.downloadManager.getStatus(),
            stats: this.logger.getStats(),
        };
    }
}

module.exports = BackupScheduler;
