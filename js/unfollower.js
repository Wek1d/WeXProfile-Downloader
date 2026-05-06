export class UnfollowerScanner {
    constructor({ userId, csrfToken, onProgress, onResult, onComplete, onUnfollowProgress, config }) {
        this.userId = userId;
        this.csrfToken = csrfToken;
        this.followers = [];
        this.following = [];
        this.unfollowers = [];
        this.isPaused = false;
        this.isScanning = false;
        this.stopScan = false;

        this.onProgress = onProgress || (() => {});
        this.onResult = onResult || (() => {});
        this.onComplete = onComplete || (() => {});
        this.onUnfollowProgress = onUnfollowProgress || (() => {});

        // Varsayılan yapılandırma
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
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
        
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
            if (endCursor) {
                variables.after = endCursor;
            }

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
                            'x-requested-with': 'XMLHttpRequest',
                        },
                        credentials: 'include'
                    });

                    
                    if (response.status === 429 || response.status >= 500) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            
                            const backoff = Math.pow(2, retryCount) * 1000;
                            this.onProgress({
                                type: 'warning',
                                message: `Hız sınırı aşıldı, ${backoff/1000} saniye bekleniyor...`
                            });
                            await this._sleep(backoff);
                            continue;
                        } else {
                            throw new Error(`HTTP ${response.status} - maksimum deneme sayısı aşıldı`);
                        }
                    }

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

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
                is_verified: e.node.is_verified,
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
            
            const sleepTime = this._getNaturalDelay(baseDelay);
            await this._sleep(sleepTime);
        }
        return users;
    }

    async scan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.isPaused = false;
        this.stopScan = false;

        this.onProgress({ type: 'start', message: 'Tarama Başlatılıyor...' });
        
        this.following = await this._fetchUsers('following');
        if (this.stopScan) { this.isScanning = false; return; }
        
        this.followers = await this._fetchUsers('followers');
        if (this.stopScan) { this.isScanning = false; return; }
        
        const followerIds = new Set(this.followers.map(u => u.id));
        this.unfollowers = this.following.filter(u => !followerIds.has(u.id));

        this.onResult(this.unfollowers);
        this.onComplete({ 
            success: true, 
            summary: {
                followers: this.followers.length,
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
            
            const url = `https://www.instagram.com/web/friendships/${user.id}/unfollow/`;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'x-csrftoken': this.csrfToken,
                      'x-instagram-ajax': '1',
                      'x-requested-with': 'XMLHttpRequest'
                    },
                    credentials: 'include' 
                });
                
                if (response.ok) {
                    const responseData = await response.json();
                    if (responseData.status === 'ok') {
                        this.onUnfollowProgress({ success: true, user: user, progress: { current: i + 1, total: usersToUnfollow.length } });
                    } else {
                        throw new Error(`API yanıtı başarısız: ${responseData.message || 'Bilinmeyen hata'}`);
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                this.onUnfollowProgress({ success: false, user: user, message: error.message, progress: { current: i + 1, total: usersToUnfollow.length } });
            }
            
            const baseDelay = ((i + 1) % 5 === 0) 
                ? this.config.timeAfterFiveUnfollows 
                : this.config.timeBetweenUnfollows;
            await this._sleep(this._getNaturalDelay(baseDelay));
        }
    }
}