const axios = require('axios');

class QQAlbumAPI {
    constructor(auth, logger) {
        this.auth = auth;
        this.logger = logger;
        this.baseDelay = 1000; // Base delay between requests
    }

    /**
     * Delay helper function
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get list of albums for a group
     */
    async getAlbumList(groupId) {
        const url = `https://h5.qzone.qq.com/proxy/domain/u.photo.qzone.qq.com/cgi-bin/upp/qun_list_album_v2`;

        const params = {
            g_tk: this.auth.getGTk(),
            qunId: groupId,
            uin: this.auth.getUin(),
            start: 0,
            num: 1000, // Max per request
            getMemberRole: 1,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            source: 'qzone',
            platform: 'qzone',
            callback: 'shine2_Callback',
            callbackFun: 'shine2',
        };

        try {
            this.logger.debug(`获取群组 ${groupId} 的相册列表`);

            const response = await axios.get(url, {
                params,
                headers: this.auth.getHeaders(),
                timeout: 30000,
            });

            // Parse JSONP response
            const jsonpData = response.data;

            // Check for permission errors
            if (jsonpData.indexOf('对不起，您') !== -1) {
                throw new Error('无访问权限');
            }

            // Extract JSON from JSONP
            const jsonData = new Function('', 'const shine2_Callback=a=>a;return ' + jsonpData)();

            if (jsonData.code !== 0) {
                throw new Error(`API错误: ${jsonData.message || jsonData.code}`);
            }

            const albums = (jsonData.data?.album || [])
                .filter(album => album.photocnt > 0)
                .map(album => ({
                    id: album.id,
                    title: album.title,
                    photoCount: album.photocnt,
                    createTime: album.createtime,
                }));

            this.logger.info(`群组 ${groupId} 共有 ${albums.length} 个相册`);

            return albums;
        } catch (error) {
            this.logger.error(`获取相册列表失败: ${error.message}`, { groupId });
            throw error;
        }
    }

    /**
     * Get photos from an album (with pagination)
     */
    async getPhotoList(groupId, albumId, start = 0, num = 36) {
        const url = `https://h5.qzone.qq.com/groupphoto/inqq?g_tk=${this.auth.getGTk()}`;

        const postData = `qunId=${groupId}&albumId=${albumId}&uin=${this.auth.getUin()}&start=${start}&num=${num}&getCommentCnt=0&getMemberRole=0&hostUin=${this.auth.getUin()}&getalbum=0&platform=qzone&inCharset=utf-8&outCharset=utf-8&source=qzone&cmd=qunGetPhotoList&qunid=${groupId}&albumid=${albumId}&attach_info=start_count%3D${start}`;

        try {
            const response = await axios.post(url, postData, {
                headers: {
                    ...this.auth.getHeaders(),
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                timeout: 30000,
            });

            const data = response.data;

            if (data.code !== 0) {
                throw new Error(`API错误: ${data.message || data.code}`);
            }

            const photoList = (data.data?.photolist || []).map(photo => {
                // Find the best quality photo URL
                const picList = [];
                for (const key in photo.photourl) {
                    picList.push(photo.photourl[key]);
                }

                // Find original photo (width=0, height=0)
                const originPic = picList.find(p => p.width === 0 && p.height === 0);

                // If no original, sort by dimensions
                if (!originPic) {
                    picList.sort((a, b) => {
                        if (a.width !== b.width) return b.width - a.width;
                        if (a.height !== b.height) return b.height - a.height;
                        return b.enlarge_rate - a.enlarge_rate;
                    });
                }

                const photoUrl = (originPic || picList[0])?.url;
                const videoUrl = photo.videodata?.actionurl || null;

                return {
                    photoUrl,
                    videoUrl: videoUrl === '' ? null : videoUrl,
                    name: photo.sloc,
                    uploadTime: photo.uploadtime,
                };
            });

            return photoList;
        } catch (error) {
            this.logger.error(`获取照片列表失败: ${error.message}`, { groupId, albumId, start });
            throw error;
        }
    }

    /**
     * Get all photos from an album (handles pagination automatically)
     */
    async getAllPhotos(groupId, albumId, totalCount) {
        const allPhotos = [];
        const batchSize = 36;
        let start = 0;

        while (start < totalCount) {
            try {
                const photos = await this.getPhotoList(groupId, albumId, start, batchSize);
                allPhotos.push(...photos);

                this.logger.debug(`获取照片 ${start + 1}-${Math.min(start + photos.length, totalCount)}/${totalCount}`, {
                    albumId,
                });

                start += batchSize;

                // Add delay to avoid rate limiting
                if (start < totalCount) {
                    await this.delay(this.baseDelay);
                }
            } catch (error) {
                this.logger.error(`获取照片批次失败，跳过`, { start, albumId });
                break;
            }
        }

        return allPhotos;
    }
}

module.exports = QQAlbumAPI;
