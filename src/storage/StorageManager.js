const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class StorageManager {
    constructor(config, logger) {
        this.basePath = config.basePath || './backups';
        this.organizeBy = config.organizeBy || 'group';
        this.keepStructure = config.keepStructure !== false;
        this.logger = logger;

        // Ensure base directory exists
        fs.ensureDirSync(this.basePath);
    }

    /**
     * Sanitize filename to remove invalid characters
     */
    sanitizeFilename(filename) {
        // Remove or replace invalid characters
        return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }

    /**
     * Generate album directory name
     */
    generateAlbumName(albumTitle) {
        const sanitized = this.sanitizeFilename(albumTitle);

        // If sanitization removed everything, generate a hash-based name
        if (!sanitized || sanitized.length === 0) {
            const hash = crypto.createHash('md5').update(albumTitle).digest('hex').substring(0, 6);
            return `相册_${hash}`;
        }

        return sanitized;
    }

    /**
     * Get directory path for a group
     */
    getGroupPath(groupId, groupName = null) {
        const dirName = groupName ? `${groupId}_${this.sanitizeFilename(groupName)}` : groupId;
        return path.join(this.basePath, dirName);
    }

    /**
     * Get directory path for an album
     */
    getAlbumPath(groupId, albumTitle, groupName = null) {
        const groupPath = this.getGroupPath(groupId, groupName);
        const albumName = this.generateAlbumName(albumTitle);
        return path.join(groupPath, albumName);
    }

    /**
     * Get file path for a photo
     */
    getPhotoPath(groupId, albumTitle, photoName, extension = '.jpg', groupName = null) {
        const albumPath = this.getAlbumPath(groupId, albumTitle, groupName);
        const sanitizedName = this.sanitizeFilename(photoName);
        return path.join(albumPath, sanitizedName + extension);
    }

    /**
     * Load backup index for an album
     */
    async loadBackupIndex(albumPath) {
        const indexPath = path.join(albumPath, '.backup_index.json');

        try {
            if (await fs.pathExists(indexPath)) {
                return await fs.readJson(indexPath);
            }
        } catch (error) {
            this.logger.warn(`无法读取备份索引: ${error.message}`, { albumPath });
        }

        return {
            lastBackup: null,
            files: {},
        };
    }

    /**
     * Save backup index for an album
     */
    async saveBackupIndex(albumPath, index) {
        const indexPath = path.join(albumPath, '.backup_index.json');

        try {
            await fs.ensureDir(albumPath);
            await fs.writeJson(indexPath, index, { spaces: 2 });
        } catch (error) {
            this.logger.error(`保存备份索引失败: ${error.message}`, { albumPath });
        }
    }

    /**
     * Check if a file already exists
     */
    async fileExists(filePath) {
        return await fs.pathExists(filePath);
    }

    /**
     * Record downloaded file in index
     */
    async recordDownload(albumPath, fileName, metadata = {}) {
        const index = await this.loadBackupIndex(albumPath);

        index.files[fileName] = {
            downloadedAt: new Date().toISOString(),
            size: metadata.size || null,
            ...metadata,
        };

        index.lastBackup = new Date().toISOString();

        await this.saveBackupIndex(albumPath, index);
    }

    /**
     * Check if file is already backed up
     */
    async isBackedUp(albumPath, fileName) {
        const index = await this.loadBackupIndex(albumPath);
        return !!index.files[fileName];
    }

    /**
     * Get backup statistics for a group
     */
    async getGroupStats(groupId, groupName = null) {
        const groupPath = this.getGroupPath(groupId, groupName);

        if (!await fs.pathExists(groupPath)) {
            return {
                albums: 0,
                totalFiles: 0,
                totalSize: 0,
            };
        }

        const albums = await fs.readdir(groupPath);
        let totalFiles = 0;
        let totalSize = 0;

        for (const album of albums) {
            const albumPath = path.join(groupPath, album);
            if (!(await fs.stat(albumPath)).isDirectory()) continue;

            const files = await fs.readdir(albumPath);
            for (const file of files) {
                if (file === '.backup_index.json') continue;

                const filePath = path.join(albumPath, file);
                const stats = await fs.stat(filePath);

                if (stats.isFile()) {
                    totalFiles++;
                    totalSize += stats.size;
                }
            }
        }

        return {
            albums: albums.length,
            totalFiles,
            totalSize,
        };
    }
}

module.exports = StorageManager;
