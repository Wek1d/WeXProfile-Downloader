// js/unfollower.js

export class UnfollowerScanner {
    constructor({ userId, csrfToken, onProgress, onResult, onComplete, onUnfollowProgress }) {
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

        // *** DÜZELTME: Anti-ban için bekleme süreleri artırıldı. ***
        this.config = {
            timeBetweenRequests: 1500,       // Temel bekleme 1.5 saniye
            timeAfterFiveRequests: 10000,    // 5 istekten sonra 10 saniye bekle
            timeBetweenUnfollows: 4000       // Takip bırakma arası 4 saniye
        };
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // *** YENİ: İnsan gibi davranmak için rastgele bekleme süresi üreten fonksiyon. ***
    _getRandomizedDelay(baseTime) {
        // baseTime'ın %70'i ile %130'u arasında rastgele bir süre döndürür.
        const min = baseTime * 0.7;
        const max = baseTime * 1.3;
        return Math.floor(Math.random() * (max - min + 1) + min);
    }


    async _fetchUsers(type) {
        let users = [];
        let hasNextPage = true;
        let endCursor = null;
        let requestCount = 0;

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

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const edge = data.data.user[type === 'followers' ? 'edge_followed_by' : 'edge_follow'];
                
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
                // *** DÜZELTME: Her istekten sonra rastgele sürelerde bekleniyor. ***
                const sleepTime = requestCount % 5 === 0 
                    ? this._getRandomizedDelay(this.config.timeAfterFiveRequests) 
                    : this._getRandomizedDelay(this.config.timeBetweenRequests);
                await this._sleep(sleepTime);

            } catch (error) {
                this.onProgress({ type: 'error', message: `Tarama sırasında hata (${type}): ${error.message}` });
                hasNextPage = false;
            }
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
            // *** DÜZELTME: Takip bırakma sonrası rastgele bekleme. ***
            await this._sleep(this._getRandomizedDelay(this.config.timeBetweenUnfollows));
        }
    }
}