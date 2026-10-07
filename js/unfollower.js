export class UnfollowerScanner {
    constructor({ userId, csrfToken, onProgress, onResult, onComplete, onUnfollowProgress, config }) {
        this.userId = userId;
        this.csrfToken = csrfToken;
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

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    
    async _fetchUsers(type) {
        let users = [];
        let hasNextPage = true;
        let endCursor = null;
        let requestCount = 0;
        const maxRetries = 3;

        const queryHashes = {
            followers: 'c76146de99bb02f6415203be841dd25a',
            following: 'd04b0a864b4b54837c0d870b0e77e076'
        };
        const queryHash = queryHashes[type];

        while (hasNextPage && !this.stopScan) {
            if (this.isPaused) {
                await this._sleep(1000);
                continue;
            }

            const variables = {
                id: this.userId,
                include_reel: true,
                fetch_mutual: false,
                first: 50
            };
            if (endCursor) variables.after = endCursor;

            const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${JSON.stringify(variables)}`;

            let retryCount = 0;
            let success = false;
            let responseData;

            while (retryCount < maxRetries && !success && !this.stopScan) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'x-csrftoken': this.csrfToken,
                            'x-instagram-ajax': '1',
                            'x-requested-with': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    });

                    if (response.status === 429 || response.status >= 500) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            const backoff = Math.pow(2, retryCount) * 1000;
                            this.onProgress({
                                type: 'warning',
                                message: `Hız sınırı aşıldı, ${backoff / 1000} saniye bekleniyor...`
                            });
                            await this._sleep(backoff);
                            continue;
                        } else {
                            throw new Error(`HTTP ${response.status} - maksimum deneme sayısı aşıldı`);
                        }
                    }

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    responseData = await response.json();
                    success = true;
                } catch (error) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        this.onProgress({ type: 'error', message: `Tarama hatası (${type}): ${error.message}` });
                        hasNextPage = false;
                        break;
                    }
                    await this._sleep(2000 * retryCount);
                }
            }

            if (!success || this.stopScan) break;

            const edge = responseData.data.user[type === 'followers' ? 'edge_followed_by' : 'edge_follow'];

            users.push(...edge.edges.map(e => ({
                id: e.node.id,
                username: e.node.username,
                full_name: e.node.full_name,
                profile_pic_url: e.node.profile_pic_url,
                is_verified: e.node.is_verified
            })));

            const total = edge.count;
            this.onProgress({
                type: type,
                scanned: users.length,
                total: total,
                percentage: Math.round((users.length / total) * 100)
            });

            hasNextPage = edge.page_info.has_next_page;
            endCursor = edge.page_info.end_cursor;

            requestCount++;
            const baseDelay = (requestCount % 5 === 0)
                ? this.config.timeAfterFiveRequests
                : this.config.timeBetweenRequests;

            await this._sleep(this._getNaturalDelay(baseDelay));
        }
        return users;
    }

    
    async _getFollowersCount() {
        try {
            const response = await fetch(
                `https://www.instagram.com/api/v1/users/${this.userId}/info/`,
                {
                    headers: {
                        'x-ig-app-id': '936619743392459',
                        'x-requested-with': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                }
            );
            if (!response.ok) return null;
            const data = await response.json();
            return data.user?.follower_count ?? null;
        } catch (e) {
            return null;
        }
    }

    
    async _batchVerifyFriendships(candidates) {
        const BATCH_SIZE = 30;
        const found = [];
        const total = candidates.length;

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            if (this.stopScan) break;

            while (this.isPaused && !this.stopScan) {
                await this._sleep(1000);
            }
            if (this.stopScan) break;

            const batch = candidates.slice(i, i + BATCH_SIZE);
            const userIds = batch.map(u => u.id).join(',');
            let retries = 0;
            let batchOk = false;

            while (retries < 3 && !batchOk && !this.stopScan) {
                try {
                    const response = await fetch(
                        'https://www.instagram.com/api/v1/friendships/show_many/',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'x-csrftoken': this.csrfToken,
                                'x-instagram-ajax': '1',
                                'x-requested-with': 'XMLHttpRequest',
                                'x-ig-app-id': '936619743392459'
                            },
                            credentials: 'include',
                            body: `user_ids=${userIds}`
                        }
                    );

                    if (response.status === 429 || response.status >= 500) {
                        retries++;
                        const retryAfter = response.headers.get('Retry-After');
                        const waitMs = retryAfter
                            ? parseInt(retryAfter) * 1000
                            : Math.min(30000, Math.pow(2, retries) * 2000);
                        this.onProgress({
                            type: 'warning',
                            message: `Hız sınırı, ${Math.round(waitMs / 1000)}s bekleniyor...`
                        });
                        await this._sleep(waitMs);
                        continue;
                    }

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();
                    const statuses = data.friendship_statuses || {};

                    for (const user of batch) {
                        const status = statuses[user.id];
                        if (status && status.followed_by === false) {
                            found.push(user);
                            // Canlı akış: her yeni bulunan kullanıcıyı hemen gönder
                            this.onResult([user], true);
                        }
                    }
                    batchOk = true;
                } catch (error) {
                    retries++;
                    if (retries >= 3) {
                        this.onProgress({
                            type: 'warning',
                            message: `Batch doğrulama atlandı: ${error.message}`
                        });
                    } else {
                        await this._sleep(2000 * retries);
                    }
                }
            }

            const processed = Math.min(i + BATCH_SIZE, total);
            this.onProgress({
                type: 'verify',
                scanned: processed,
                total: total,
                percentage: total > 0 ? Math.round((processed / total) * 100) : 100
            });

            await this._sleep(this._getNaturalDelay(600));
        }

        return found;
    }

    async scan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.isPaused = false;
        this.stopScan = false;

        this.onProgress({ type: 'start' });

        // 1. Takip edilenleri çek
        this.following = await this._fetchUsers('following');
        if (this.stopScan) { this.isScanning = false; return; }

        
        const followersCount = await this._getFollowersCount();

       
        this.onProgress({ type: 'verify_start' });
        this.unfollowers = await this._batchVerifyFriendships(this.following);
        if (this.stopScan) { this.isScanning = false; return; }

        
        this.onResult(this.unfollowers, false);
        this.onComplete({
            success: true,
            summary: {
                followers: followersCount ?? '—',
                following: this.following.length,
                unfollowers: this.unfollowers.length
            }
        });
        this.isScanning = false;
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    stop() { this.stopScan = true; }

    async unfollow(usersToUnfollow) {
        if (!this.csrfToken) {
            this.onUnfollowProgress({ success: false, message: 'CSRF token bulunamadı.' });
            return;
        }

        this.stopScan = false;

        for (let i = 0; i < usersToUnfollow.length; i++) {
            if (this.stopScan) break;
            const user = usersToUnfollow[i];

            try {
                const response = await fetch(
                    `https://www.instagram.com/web/friendships/${user.id}/unfollow/`,
                    {
                        method: 'POST',
                        headers: {
                            'x-csrftoken': this.csrfToken,
                            'x-instagram-ajax': '1',
                            'x-requested-with': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    }
                );

                if (response.ok) {
                    const responseData = await response.json();
                    if (responseData.status === 'ok') {
                        this.onUnfollowProgress({
                            success: true,
                            user: user,
                            progress: { current: i + 1, total: usersToUnfollow.length }
                        });
                    } else {
                        throw new Error(`API yanıtı başarısız: ${responseData.message || 'Bilinmeyen hata'}`);
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                this.onUnfollowProgress({
                    success: false,
                    user: user,
                    message: error.message,
                    progress: { current: i + 1, total: usersToUnfollow.length }
                });
            }

            const baseDelay = ((i + 1) % 5 === 0)
                ? this.config.timeAfterFiveUnfollows
                : this.config.timeBetweenUnfollows;
            await this._sleep(this._getNaturalDelay(baseDelay));
        }
    }
}