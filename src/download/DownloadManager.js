const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class DownloadManager {
    constructor(storageManager, config, logger) {
        this.storage = storageManager;
        this.logger = logger;
        this.maxConcurrent = config.maxConcurrent || 3;
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 2000;
        this.timeout = config.timeout || 30000;
        this.skipExisting = config.skipExisting !== false;

        this.queue = [];
        this.running = [];
        this.paused = false;
    }

    /**
     * Add download task to queue
     */
    addTask(task) {
        this.queue.push(task);
    }

    /**
     * Download a single file with retry logic
     */
    async downloadFile(url, filePath, retries = 0) {
        try {
            // Ensure directory exists
            await fs.ensureDir(path.dirname(filePath));

            // Check if file already exists
            if (this.skipExisting && await fs.pathExists(filePath)) {
                this.logger.debug(`文件已存在，跳过: ${path.basename(filePath)}`);
                return { status: 'skipped', size: (await fs.stat(filePath)).size };
            }

            // Download file
            const response = await axios.get(url, {
                responseType: 'stream',
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                let downloadedSize = 0;

                response.data.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                });

                writer.on('finish', () => {
                    this.logger.debug(`下载完成: ${path.basename(filePath)}`, { size: downloadedSize });
                    resolve({ status: 'downloaded', size: downloadedSize });
                });

                writer.on('error', (err) => {
                    fs.unlink(filePath).catch(() => { }); // Clean up partial file
                    reject(err);
                });

                response.data.on('error', (err) => {
                    writer.close();
                    fs.unlink(filePath).catch(() => { }); // Clean up partial file
                    reject(err);
                });
            });

        } catch (error) {
            // Retry logic
            if (retries < this.retryAttempts) {
                this.logger.warn(`下载失败，重试 ${retries + 1}/${this.retryAttempts}: ${error.message}`, {
                    file: path.basename(filePath),
                });

                await this.delay(this.retryDelay);
                return this.downloadFile(url, filePath, retries + 1);
            }

            this.logger.error(`下载失败: ${error.message}`, { file: path.basename(filePath) });
            throw error;
        }
    }

    /**
     * Process a download task
     */
    async processTask(task) {
        const { groupId, groupName, albumTitle, albumPath, photo } = task;

        try {
            // Download photo
            const photoPath = this.storage.getPhotoPath(groupId, albumTitle, photo.name, '.jpg', groupName);
            const photoResult = await this.downloadFile(photo.photoUrl, photoPath);

            if (photoResult.status === 'downloaded') {
                this.logger.recordPhoto('downloaded', groupId);
                await this.storage.recordDownload(albumPath, path.basename(photoPath), {
                    size: photoResult.size,
                    type: 'photo',
                });
            } else {
                this.logger.recordPhoto('skipped', groupId);
            }

            // Download video if exists
            if (photo.videoUrl) {
                const videoPath = this.storage.getPhotoPath(groupId, albumTitle, photo.name, '.mp4', groupName);
                const videoResult = await this.downloadFile(photo.videoUrl, videoPath);

                if (videoResult.status === 'downloaded') {
                    await this.storage.recordDownload(albumPath, path.basename(videoPath), {
                        size: videoResult.size,
                        type: 'video',
                    });
                }
            }

            return { success: true };
        } catch (error) {
            this.logger.recordPhoto('failed', groupId);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delay helper
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Process queue
     */
    async processQueue() {
        while (this.queue.length > 0 && !this.paused) {
            // Wait if max concurrent downloads reached
            while (this.running.length >= this.maxConcurrent && !this.paused) {
                await this.delay(100);
            }

            if (this.paused) break;

            const task = this.queue.shift();
            const promise = this.processTask(task);

            this.running.push(promise);

            // Remove from running when complete
            promise.finally(() => {
                const index = this.running.indexOf(promise);
                if (index > -1) {
                    this.running.splice(index, 1);
                }
            });
        }

        // Wait for all running tasks to complete
        await Promise.all(this.running);
    }

    /**
     * Start processing queue
     */
    async start() {
        this.paused = false;
        await this.processQueue();
    }

    /**
     * Pause processing
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume processing
     */
    async resume() {
        if (!this.paused) return;
        this.paused = false;
        await this.processQueue();
    }

    /**
     * Clear queue
     */
    clear() {
        this.queue = [];
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queued: this.queue.length,
            running: this.running.length,
            paused: this.paused,
        };
    }
}

module.exports = DownloadManager;
