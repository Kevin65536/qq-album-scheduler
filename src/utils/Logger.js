const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor(config = {}) {
    const logDir = config.logDir || './logs';
    const level = config.level || 'info';
    
    // Ensure log directory exists
    fs.ensureDirSync(logDir);

    const transports = [];

    // Console transport with colors
    if (config.console !== false) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0) {
                msg += ` ${JSON.stringify(meta)}`;
              }
              return msg;
            })
          ),
        })
      );
    }

    // File transport with rotation
    if (config.file !== false) {
      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'qq-album-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: config.maxFiles || '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );

      // Separate error log
      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: config.maxFiles || '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      transports,
    });

    this.stats = {
      startTime: null,
      endTime: null,
      totalPhotos: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      groups: {},
    };
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  startBackup() {
    this.stats.startTime = new Date();
    this.stats.totalPhotos = 0;
    this.stats.downloaded = 0;
    this.stats.skipped = 0;
    this.stats.failed = 0;
    this.stats.groups = {};
    this.info('备份任务开始');
  }

  endBackup() {
    this.stats.endTime = new Date();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    this.info('备份任务完成', {
      duration: `${duration.toFixed(2)}秒`,
      total: this.stats.totalPhotos,
      downloaded: this.stats.downloaded,
      skipped: this.stats.skipped,
      failed: this.stats.failed,
    });
  }

  recordPhoto(status, groupId = null) {
    this.stats.totalPhotos++;
    
    if (status === 'downloaded') {
      this.stats.downloaded++;
    } else if (status === 'skipped') {
      this.stats.skipped++;
    } else if (status === 'failed') {
      this.stats.failed++;
    }

    if (groupId) {
      if (!this.stats.groups[groupId]) {
        this.stats.groups[groupId] = {
          total: 0,
          downloaded: 0,
          skipped: 0,
          failed: 0,
        };
      }
      this.stats.groups[groupId].total++;
      this.stats.groups[groupId][status]++;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = Logger;
