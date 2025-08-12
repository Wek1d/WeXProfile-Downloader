// background.js

import { UnfollowerScanner } from './unfollower.js';

let currentProfileFetchPromise = null;
let currentProfileFetchUrl = null;
let currentScanner = null;
let scanTimings = null;

const USER_AGENT_RULE_ID_API = 1;
const USER_AGENT_RULE_ID_GQL = 2;
const PROFILE_HISTORY_KEY = 'profileHistory';
const HISTORY_LIMIT = 500;
const CACHE_TTL = 5 * 60 * 1000;

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.163 Mobile Safari/537.36 Instagram 388.0.0.34.75 Android (35/15; 450dpi; 1080x2340; samsung; SM-A556E; a55x; s5e8845; es_ES; 760368464; IABMV/1)",
  "Mozilla/5.0 (Linux; Android 14; SM-A245M Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/137.0.7151.115 Mobile Safari/537.36 Instagram 388.0.0.30.75 Android (34/14; 450dpi; 1080x2128; samsung; SM-A245M; a24; mt6789; pt_BR; 759386708) Android. phone.",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0",
  "Instagram 388.0.0.30.75 Android (33/13; 450dpi; 1080x2301; samsung; SM-A135M; a13; exynos850; pt_BR; 759386703)",
  "Mozilla/5.0 (Linux; Android 14; CLK-LX2 Build/HONORCLK-L42; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.143 Mobile Safari/537.36 Instagram 388.0.0.34.75 Android (34/14; 480dpi; 1080x2304; HONOR; CLK-LX2; HNCLK-Q; qcom; pt_BR; 760368464; IABMV/1) Android. mobile.",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];
const GITHUB_REPO_URL = 'https://api.github.com/repos/Wek1d/WeXProfile-Downloader/releases/latest';

async function getCookie(name) {
  try {
    const cookie = await chrome.cookies.get({ url: "https://www.instagram.com", name });
    return cookie ? cookie.value : null;
  } catch (e) {
    console.error("Cookie alınamadı:", e);
    return null;
  }
}

async function updateUserAgentRules(userAgentString) {
  const apiRule = {
    id: USER_AGENT_RULE_ID_API,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'user-agent', operation: 'set', value: userAgentString }] },
    condition: { urlFilter: 'i.instagram.com/api/v1/', resourceTypes: ['xmlhttprequest'] }
  };
  const gqlRule = {
    id: USER_AGENT_RULE_ID_GQL,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'user-agent', operation: 'set', value: userAgentString }] },
    condition: { urlFilter: 'www.instagram.com/graphql/query/', resourceTypes: ['xmlhttprequest'] }
  };
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [USER_AGENT_RULE_ID_API, USER_AGENT_RULE_ID_GQL],
      addRules: [apiRule, gqlRule]
    });
  } catch (error) {
    console.error("WeXProfile Hata: User-Agent kuralları güncellenemedi.", error);
  }
}

async function checkUpdates() {
    try {
        const response = await fetch(GITHUB_REPO_URL);
        if (!response.ok) { return; }
        const data = await response.json();
        const latestVersion = data.tag_name.replace('v', '');
        const currentVersion = chrome.runtime.getManifest().version;
        if (compareVersions(latestVersion, currentVersion) > 0) {
            chrome.storage.local.set({ hasUpdate: true, latestVersion: data.tag_name });
        } else {
            chrome.storage.local.set({ hasUpdate: false });
        }
    } catch (error) {
        chrome.storage.local.set({ hasUpdate: false });
    }
}
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wexProfileDownload",
    title: "WeXProfile ile Profil Bilgilerini Göster",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });
  chrome.storage.sync.set({
    darkMode: true,
    fontFamily: "'Poppins', sans-serif",
    themeTemplate: 'default',
    buttonStyle: 'modern',
    showFollowerChange: true,
    language: 'tr'
  });
  chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: {} });
  checkUpdates();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wexProfileDownload" && tab.url.includes("instagram.com")) {
    handleProfileAnalysis(tab.url, tab.id, true);
  }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.url.includes("instagram.com")) {
            chrome.action.setPopup({ tabId: currentTab.id, popup: "popup.html" });
        } else {
            sendNotification("Hata", "Lütfen bir Instagram sayfasında kullanın.");
        }
    });
});

async function handleProfileAnalysis(url, tabId, isContextMenuClick) {
  if (currentProfileFetchPromise && currentProfileFetchUrl === url) {
    return currentProfileFetchPromise;
  }
  currentProfileFetchUrl = url;

  currentProfileFetchPromise = fetchProfileData(url)
    .then(async (data) => {
      await chrome.storage.local.set({
          cachedProfile: data,
          cacheUrl: url,
          cacheTimestamp: Date.now()
      });
      if (isContextMenuClick) {
        sendNotification("Bilgi", "Profil bilgileri hazır! Detayları görmek için WeXProfile ikonuna tıklayın.");
      }
      return data;
    })
    .catch(async (error) => {
      console.error("WeXProfile Hata: Profil analizi başarısız oldu.", error.message);
      sendNotification("Hata", `${error.message}`);
      await chrome.storage.local.remove(['cachedProfile', 'cacheUrl', 'cacheTimestamp']);
      throw error;
    })
    .finally(() => {
      if (currentProfileFetchUrl === url) {
        currentProfileFetchPromise = null;
        currentProfileFetchUrl = null;
      }
    });
  return currentProfileFetchPromise;
}

function getInstagramUsername(link) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(link);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      // Daha fazla forbidden segment ekle
      const forbiddenSegments = [
        'p', 'reels', 'stories', 'tv', 'explore', 'direct', 'accounts', 'about', 'developer', 'directory', 'privacy', 'terms', 'api'
      ];
      // Sadece bir segment ve forbidden değilse kullanıcı adı
      if (pathSegments.length === 1 && !forbiddenSegments.includes(pathSegments[0])) {
        resolve(pathSegments[0]);
        return;
      }
      // /username/ şeklinde ise de kabul et
      if (pathSegments.length === 2 && !forbiddenSegments.includes(pathSegments[0]) && pathSegments[1] === '') {
        resolve(pathSegments[0]);
        return;
      }
      reject(new Error("Geçerli bir profil sayfası değil. Lütfen bir kullanıcı profilini ziyaret edin."));
    } catch(e) {
      reject(new Error("Geçersiz URL formatı."));
    }
  });
}

async function fetchImageAsDataURL(imageUrl) {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return imageUrl || null; 
  }
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`Resim çekilemedi: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`WeXProfile Hata: Resim Data URL'e dönüştürülemedi (${imageUrl}).`, error);
    return null; 
  }
}

async function updateProfileHistoryAndGetDataWithChanges(newUserData) {
    const { [PROFILE_HISTORY_KEY]: history = {} } = await chrome.storage.local.get(PROFILE_HISTORY_KEY);
    const userId = newUserData.id;
    let oldEntries = history[userId];
    let lastEntry = null;
    if (Array.isArray(oldEntries) && oldEntries.length > 0) {
        lastEntry = oldEntries[oldEntries.length - 1];
    } else if (oldEntries && oldEntries.timestamp) {
        lastEntry = oldEntries;
        oldEntries = [oldEntries];
    } else {
        oldEntries = [];
    }
    newUserData.followerChange = 0;
    newUserData.followingChange = 0;
    if (lastEntry) {
        newUserData.followerChange = newUserData.followers - lastEntry.followers;
        newUserData.followingChange = newUserData.following - lastEntry.following;
    }
    // Yeni kaydı sona ekle
    oldEntries.push({
        followers: newUserData.followers,
        following: newUserData.following,
        timestamp: Date.now()
    });
    // Limit aşılırsa en eskiyi çıkar
    if (oldEntries.length > HISTORY_LIMIT) {
        oldEntries = oldEntries.slice(-HISTORY_LIMIT);
    }
    history[userId] = oldEntries;
    await chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: history });
    return newUserData;
}

async function fetchWithUARetry(url, options = {}, userAgentIndex = 0) {
    if (userAgentIndex >= USER_AGENTS.length) {
        throw new Error("Tüm User-Agent denemeleri başarısız oldu. Lütfen bir süre sonra tekrar deneyin.");
    }
    await updateUserAgentRules(USER_AGENTS[userAgentIndex]);
    try {
        const response = await fetch(url, options);
        if ([401, 403, 429].includes(response.status)) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.message || `API ${response.status} hatası verdi.`;
            console.warn(`WeXProfile Uyarı: User-Agent #${userAgentIndex + 1} ile istek başarısız oldu. (${message}). Bir sonraki deneniyor...`);
            return fetchWithUARetry(url, options, userAgentIndex + 1);
        }
        if (!response.ok) {
           const text = await response.text();
           throw new Error(`Instagram API yanıtı başarısız: ${response.status} - ${text}`);
        }
        return await response.json();
    } catch (error) {
        console.warn(`WeXProfile Uyarı: User-Agent #${userAgentIndex + 1} ile ağ hatası. Bir sonraki deneniyor...`, error);
        return fetchWithUARetry(url, options, userAgentIndex + 1);
    }
}

async function getInstagramUserInfo(username) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  const out = await fetchWithUARetry(url);
  if (out.data && out.data.user) {
    const user = out.data.user;
    const profilePicDataURL = await fetchImageAsDataURL(user.profile_pic_url);
    // Biyografi için hem biography_with_entities hem biography kontrolü
    let biography = '';
    if (user.biography_with_entities && user.biography_with_entities.raw_text) {
      biography = user.biography_with_entities.raw_text;
    } else if (user.biography) {
      biography = user.biography;
    }
    let userData = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      biography: biography,
      biography_with_entities: user.biography_with_entities, // popup.js'de de kullanılabilir
      followers: user.edge_followed_by?.count || 0,
      following: user.edge_follow?.count || 0,
      posts: user.edge_owner_to_timeline_media?.count || 0,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      profilePicUrlForPreview: profilePicDataURL
    };
    return await updateProfileHistoryAndGetDataWithChanges(userData);
  } else {
    throw new Error("API yanıtında beklenen kullanıcı verisi bulunamadı.");
  }
}

async function fetchProfileData(url) {
  const username = await getInstagramUsername(url);
  return getInstagramUserInfo(username);
}

async function getHdProfilePhotoUrl(instagramUserId) {
  const url = `https://i.instagram.com/api/v1/users/${instagramUserId}/info/`;
  try {
    const out = await fetchWithUARetry(url);
    if (out.user?.hd_profile_pic_url_info?.url) {
      return out.user.hd_profile_pic_url_info.url;
    } else {
      throw new Error("API yanıtında HD profil fotoğrafı URL'si bulunamadı.");
    }
  } catch (error) {
    console.error("WeXProfile Hata: HD fotoğraf URL'si alınamadı.", error);
    throw error;
  }
}

async function openHdProfilePhoto() {
  const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
  if (cachedProfile?.id) {
    try {
      const hdUrl = await getHdProfilePhotoUrl(cachedProfile.id);
      chrome.tabs.create({ url: hdUrl });
    } catch (error) {
      console.error("HD fotoğraf açılırken hata:", error);
      sendNotification("Hata", `HD fotoğraf açılamadı: ${error.message}`);
    }
  } else {
    sendNotification("Hata", "Önbellekte profil verisi bulunamadı.");
  }
}

async function downloadProfilePhoto() {
  const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
  if (cachedProfile?.id && cachedProfile?.username) {
    try {
      const hdUrl = await getHdProfilePhotoUrl(cachedProfile.id);
      chrome.downloads.download({
        url: hdUrl,
        filename: `instagram_${cachedProfile.username}_hd.jpg`,
        conflictAction: 'uniquify',
        saveAs: true
      });
    } catch (error) {
      console.error("HD fotoğraf indirilirken hata:", error);
      sendNotification("Hata", `Fotoğraf indirilemedi: ${error.message}`);
    }
  } else {
    sendNotification("Hata", "Önbellekte profil verisi bulunamadı.");
  }
}

async function downloadJSON() {
  const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
  if (cachedProfile) {
      try {
        const jsonString = JSON.stringify(cachedProfile, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(jsonString);

        chrome.downloads.download({
            url: dataUri,
            filename: `instagram_${cachedProfile.username}_profile.json`,
            conflictAction: 'uniquify',
            saveAs: true
        });
      } catch (error) {
        console.error("WeXProfile Hata: JSON indirilirken bir hata oluştu.", error);
        sendNotification("Hata", "JSON verisi indirilemedi.");
      }
  } else {
    sendNotification("Hata", "JSON indirilemedi: Önbellekte veri yok.");
  }
}


function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: `WeXProfile: ${title}`,
    message: message,
    priority: 2
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'getProfileData':
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];
          const activeUrl = activeTab.url;
          if (!activeUrl || !activeUrl.includes("instagram.com")) {
            throw new Error("Lütfen bir Instagram sayfasında kullanın.");
          }

          const { cachedProfile, cacheUrl, cacheTimestamp } = await chrome.storage.local.get(['cachedProfile', 'cacheUrl', 'cacheTimestamp']);

          if (cachedProfile && cacheUrl === activeUrl && (Date.now() - cacheTimestamp < CACHE_TTL)) {
            sendResponse({ success: true, data: cachedProfile });
            return;
          }

          const dataToReturn = await handleProfileAnalysis(activeUrl, activeTab.id, false);
          sendResponse({ success: true, data: dataToReturn });

        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'openHdPhoto': await openHdProfilePhoto(); sendResponse({ success: true }); break;
      case 'downloadPhoto': await downloadProfilePhoto(); sendResponse({ success: true }); break;
      case 'downloadJSON': await downloadJSON(); sendResponse({ success: true }); break;
      case 'clearHistory':
        await chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: {} });
        sendNotification("Bilgi", "Takipçi değişim geçmişi başarıyla temizlendi.");
        sendResponse({ success: true });
        break;
      case 'getSettingsAndUpdates':
        const settings = await chrome.storage.sync.get(['darkMode', 'fontFamily', 'themeTemplate', 'buttonStyle', 'showFollowerChange', 'language']);
        const updateInfo = await chrome.storage.local.get(['hasUpdate', 'latestVersion']);
        sendResponse({ success: true, settings, updateInfo });
        break;
      case 'setSettings': await chrome.storage.sync.set(request.settings); sendResponse({ success: true }); break;
      case 'openGithub': chrome.tabs.create({ url: 'https://github.com/Wek1d/WeXProfile-Downloader' }); sendResponse({ success: true }); break;
      case 'checkUpdatesNow': await checkUpdates(); sendResponse({ success: true }); break;
      case 'setScanTimings':
        scanTimings = request.timings;
        chrome.storage.sync.set({ scanTimings });
        break;
      case 'startUnfollowScan':
        if (currentScanner?.isScanning) return;
        const userId = await getCookie('ds_user_id');
        const csrfToken = await getCookie('csrftoken');
        if (!userId || !csrfToken) {
          sendNotification("Hata", "Giriş yapılamadı. Lütfen Instagram'a giriş yaptığınızdan emin olun.");
          return;
        }
        // Tarama hızına göre delay ayarları
        let config;
        // Use scanTimings from storage if available
        if (!scanTimings) {
          const syncData = await chrome.storage.sync.get(['scanTimings']);
          scanTimings = syncData.scanTimings;
        }
        if (scanTimings) {
          config = {
            timeBetweenRequests: scanTimings.scanDelay,
            timeAfterFiveRequests: scanTimings.scanDelayAfterFive,
            timeBetweenUnfollows: scanTimings.unfollowDelay,
            timeAfterFiveUnfollows: scanTimings.unfollowDelayAfterFive
          };
        } else {
          config = { timeBetweenRequests: 1800, timeAfterFiveRequests: 12000, timeBetweenUnfollows: 4000, timeAfterFiveUnfollows: 180000 };
        }
        currentScanner = new UnfollowerScanner({
            userId, csrfToken,
            onProgress: (p) => chrome.runtime.sendMessage({ action: 'scanProgress', data: p }),
            onResult: async (users) => {
              for (const user of users) {
                user.profile_pic_url = await fetchImageAsDataURL(user.profile_pic_url);
              }
              chrome.runtime.sendMessage({ action: 'scanResult', data: users });
            },
            onComplete: (c) => chrome.runtime.sendMessage({ action: 'scanComplete', data: c }),
            onUnfollowProgress: (l) => chrome.runtime.sendMessage({ action: 'unfollowProgress', data: l }),
            config // hız ayarı iletilecek
        });
        currentScanner.scan();
        break;

      case 'stopScan': if(currentScanner) currentScanner.stop(); break;
      case 'pauseScan': if(currentScanner) currentScanner.pause(); break;
      case 'resumeScan': if(currentScanner) currentScanner.resume(); break;
      case 'unfollowSelected': if(currentScanner && request.users) { currentScanner.unfollow(request.users); } break;

      default:
        sendResponse({ success: false, error: "Bilinmeyen eylem" });
    }
  })();
  return true;
});