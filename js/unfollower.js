export class UnfollowerScanner {
    constructor({ userId, csrfToken, fetchFollowingPage, verifyFollowedBy, getProfileStats, unfollowUser, onProgress, onResult, onComplete, onUnfollowProgress, config }) {
        this.userId = userId;
        this.csrfToken = csrfToken;
        this.fetchFollowingPage = fetchFollowingPage;
        this.verifyFollowedBy = verifyFollowedBy;
        this.getProfileStats = getProfileStats;
        this.unfollowUser = unfollowUser;
        this.skipped = [];
        this.following = [];
        this.unfollowers = [];
        this.isPaused = false;
        this.isScanning = false;
        this.stopScan = false;

        this.onProgress = onProgress || (() => {});
        this.onResult = onResult || (() => {});
        this.onComplete = onComplete || (() => {});
        this.onUnfollowProgress = onUnfollowProgress || (() => {});

        this.config = config || {
            timeBetweenRequests: 1800,
            timeAfterFiveRequests: 12000,
            timeBetweenUnfollows: 4000,
            timeAfterFiveUnfollows: 180000
        };
    }


    async _sleep(ms) {
        let remaining = ms;
        while (remaining > 0) {
            const chunk = Math.min(remaining, 20000);
            await new Promise(resolve => setTimeout(resolve, chunk));
            remaining -= chunk;
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getPlatformInfo) {
                    await chrome.runtime.getPlatformInfo();
                }
            } catch (e) { /* yoksay */ }
        }
    }

    _getNaturalDelay(baseTime) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        let delay = baseTime + z * (baseTime * 0.15);
        delay = Math.max(baseTime * 0.6, Math.min(baseTime * 1.4, delay));
        return Math.floor(delay);
    }

    
    async _fetchUsers(type, expectedTotal = 0) {
        if (typeof this.fetchFollowingPage !== 'function') {
            throw new Error('Takip listesi sağlayıcısı tanımlı değil.');
        }

        let users = [];
        const seenIds = new Set();
        let hasNextPage = true;
        let maxId = null;
        let requestCount = 0;
        const maxRetries = 3;
        let total = expectedTotal > 0 ? expectedTotal : 0;

        while (hasNextPage && !this.stopScan) {
            if (this.isPaused) {
                await this._sleep(1000);
                continue;
            }

            let retryCount = 0;
            let success = false;
            let result = null;

            while (retryCount < maxRetries && !success && !this.stopScan) {
                try {
                    result = await this.fetchFollowingPage(maxId);

                    if (!result || !result.ok) {
                        const status = result ? result.status : null;
                        if (status === 429 || (status && status >= 500)) {
                            throw new Error(`HTTP ${status}`);
                        }
                        const message = result && (result.message || result.error)
                            ? (result.message || result.error)
                            : 'bilinmeyen hata';
                        throw new Error(String(message).slice(0, 200));
                    }

                    success = true;
                } catch (error) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        this.onProgress({ type: 'error', message: `Tarama hatası (${type}): ${error.message}` });
                        hasNextPage = false;
                        break;
                    }
                    const backoff = Math.pow(2, retryCount) * 1000;
                    this.onProgress({
                        type: 'warning',
                        message: `Hız sınırı aşıldı, ${backoff / 1000} saniye bekleniyor...`
                    });
                    await this._sleep(backoff);
                }
            }

            if (!success || this.stopScan) break;

            const data = result.data || {};
            const pageUsers = Array.isArray(data.users) ? data.users : [];

            for (const item of pageUsers) {
                const rawId = item.pk || item.id || item.pk_id;
                if (!rawId) continue;
                const id = String(rawId);
                if (seenIds.has(id)) continue;
                seenIds.add(id);
                users.push({
                    id: id,
                    username: item.username,
                    full_name: item.full_name,
                    profile_pic_url: item.profile_pic_url,
                    is_verified: !!item.is_verified
                });
            }

            if (total <= 0) total = users.length;
            if (users.length > total) total = users.length;

            this.onProgress({
                type: type,
                scanned: users.length,
                total: total,
                percentage: total > 0 ? Math.min(100, Math.round((users.length / total) * 100)) : 0
            });

            const nextMaxId = data.next_max_id ? String(data.next_max_id) : null;
            const apiHasMore = data.has_more === true;

            if (!apiHasMore || !nextMaxId || nextMaxId === maxId) {
                hasNextPage = false;
            } else {
                maxId = nextMaxId;
            }

            requestCount++;
            const baseDelay = (requestCount % 5 === 0)
                ? this.config.timeAfterFiveRequests
                : this.config.timeBetweenRequests;

            if (hasNextPage && !this.stopScan) {
                await this._sleep(this._getNaturalDelay(baseDelay));
            }
        }
        return users;
    }

    
    async _getProfileStats(userId) {
        if (typeof this.getProfileStats !== 'function') return null;
        try {
            return await this.getProfileStats(userId);
        } catch (error) {
            this.onProgress({
                type: 'warning',
                message: `Profil istatistikleri alınamadı: ${error.message}`
            });
            return null;
        }
    }


    async _verifyFollowBack(user) {
        if (typeof this.verifyFollowedBy !== 'function') {
            throw new Error('Arkadaşlık doğrulama sağlayıcısı tanımlı değil.');
        }

        const maxRetries = 4;
        for (let attempt = 1; attempt <= maxRetries && !this.stopScan; attempt++) {
            try {
                const status = await this.verifyFollowedBy(user.id);
                if (!status || typeof status.followed_by !== 'boolean') {
                    throw new Error('followed_by alanı yok');
                }
                this.consecutiveFailures = 0;
                return status.followed_by;
            } catch (error) {
                const rateLimited = error.status === 429 || /HTTP 429/.test(error.message || '');
                if (attempt >= maxRetries) {
                    this.consecutiveFailures = (this.consecutiveFailures || 0) + 1;
                    this.skipped.push(user);
                    this.onProgress({
                        type: 'warning',
                        message: `Doğrulama atlandı (@${user.username || user.id}): ${error.message}`
                    });
                    return null;
                }
                
                const wait = rateLimited ? 30000 * attempt : 2000 * attempt;
                if (rateLimited) {
                    this.onProgress({
                        type: 'warning',
                        message: `Hız sınırı (429), ${Math.round(wait / 1000)} sn bekleniyor...`
                    });
                }
                await this._sleep(wait);
            }
        }
        return null;
    }

        async _verifyFriendships(candidates) {
        const found = [];
        const total = candidates.length;
        let requestCount = 0;

        for (let i = 0; i < candidates.length; i++) {
            if (this.stopScan) break;

            while (this.isPaused && !this.stopScan) {
                await this._sleep(1000);
            }
            if (this.stopScan) break;

            const user = candidates[i];
            const followedBy = await this._verifyFollowBack(user);


            if (followedBy === null && (this.consecutiveFailures || 0) >= 5) {
                this.onProgress({
                    type: 'error',
                    message: 'Instagram isteklerinizi geçici olarak sınırlıyor. Taramayı durdurdum; birkaç saat sonra tekrar deneyin.'
                });
                this.stopScan = true;
                break;
            }

            if (followedBy === false) {
                found.push(user);
                
                this.onResult([user], true);
            }

            this.onProgress({
                type: 'verify',
                scanned: i + 1,
                total: total,
                percentage: total > 0 ? Math.round(((i + 1) / total) * 100) : 100
            });

            requestCount++;
            const baseDelay = (requestCount % 5 === 0)
                ? this.config.timeAfterFiveRequests
                : this.config.timeBetweenRequests;

            if (i + 1 < candidates.length && !this.stopScan) {
                await this._sleep(this._getNaturalDelay(baseDelay));
            }
        }

        return found;
    }

    async scan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.isPaused = false;
        this.stopScan = false;
        this.skipped = [];
        this.consecutiveFailures = 0;

        this.onProgress({ type: 'start' });

        try {
            
            const profileStats = await this._getProfileStats(this.userId);
            if (this.stopScan) return;

            
            const expectedFollowing = profileStats && typeof profileStats.following === 'number'
                ? profileStats.following
                : 0;
            this.following = await this._fetchUsers('following', expectedFollowing);
            if (this.stopScan) return;

            
            this.onProgress({ type: 'verify_start' });
            this.unfollowers = await this._verifyFriendships(this.following);
            if (this.stopScan) return;

            this.onResult(this.unfollowers, false);
            this.onComplete({
                success: true,
                summary: {
                    followers: profileStats && profileStats.followers != null ? profileStats.followers : '—',
                    following: this.following.length,
                    unfollowers: this.unfollowers.length,
                    skipped: this.skipped.length
                }
            });
        } catch (error) {
            this.onProgress({ type: 'error', message: error.message });
        } finally {
            this.isScanning = false;
        }
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    stop() { this.stopScan = true; }

    async unfollow(usersToUnfollow) {
        if (typeof this.unfollowUser !== 'function') {
            this.onUnfollowProgress({ success: false, message: 'Takipten çıkarma sağlayıcısı tanımlı değil.' });
            return;
        }

        this.stopScan = false;

        for (let i = 0; i < usersToUnfollow.length; i++) {
            if (this.stopScan) break;
            const user = usersToUnfollow[i];
            let blocked = false;

            try {
                await this.unfollowUser(user.id);
                this.onUnfollowProgress({
                    success: true,
                    user: user,
                    progress: { current: i + 1, total: usersToUnfollow.length }
                });
            } catch (error) {
                blocked = !!error.blocked;
                this.onUnfollowProgress({
                    success: false,
                    user: user,
                    message: error.message,
                    blocked: blocked,
                    progress: { current: i + 1, total: usersToUnfollow.length }
                });
            }

            
            if (blocked) break;

            if (i + 1 < usersToUnfollow.length) {
                const baseDelay = ((i + 1) % 5 === 0)
                    ? this.config.timeAfterFiveUnfollows
                    : this.config.timeBetweenUnfollows;
                await this._sleep(this._getNaturalDelay(baseDelay));
            }
        }
    }
}
