import { UnfollowerScanner } from './unfollower.js';


let currentLanguage = 'tr';
let i18nCache = {};


chrome.storage.sync.get(['language'], (data) => {
  currentLanguage = data.language || 'tr';
  loadMessages(currentLanguage);
});


chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && changes.language) {
    currentLanguage = changes.language.newValue;
    await loadMessages(currentLanguage);
    
    
    try {
      await chrome.contextMenus.update("wexProfileDownload", {
        title: t("contextMenuTitle") || "Show Profile Info with WeXProfile"
      });
    } catch(e) {
      
      chrome.contextMenus.create({
        id: "wexProfileDownload",
        title: t("contextMenuTitle") || "Show Profile Info with WeXProfile",
        contexts: ["page"],
        documentUrlPatterns: ["*://*.instagram.com/*"]
      });
    }
  }
});


async function loadMessages(lang) {
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    i18nCache = await response.json();
  } catch(e) {
    console.error("Dil dosyası yüklenemedi:", e);
  }
}


function t(key) {
  return i18nCache[key]?.message || key;
}

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
  // Samsung A34 - Android 13, Chrome 144, IG 413 (Nisan 2026 gerçek UA)
  "Mozilla/5.0 (Linux; Android 13; SM-A346M Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/144.0.7559.87 Mobile Safari/537.36 Instagram 413.0.0.41.84 Android (33/13; 401dpi; 1080x2340; samsung; SM-A346M; a34x; mt6877; pt_BR; 865356678; IABMV/1)",
  
  // Samsung S22 Ultra - Android 14, Chrome 142, IG 414
  "Mozilla/5.0 (Linux; Android 14; SM-S908E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.174 Mobile Safari/537.36 Instagram 414.0.0.0.51 Android (34/14; 600dpi; 1440x3088; samsung; SM-S908E; b0q; qcom; pt_BR; 865002994; IABMV/1)",
  
  // Pixel 10 Pro XL - android 16, Chrome 143, IG 413 (Nisan 2026 gerçek UA)
  "Mozilla/5.0 (Linux; Android 16; Pixel 10 Pro XL Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/143.0.7499.193 Mobile Safari/537.36 Instagram 413.0.0.41.84 Android (36/16; 390dpi; 1080x2404; Google/google; Pixel 10 Pro XL; mustang; mustang; en_US; 865356627; IABMV/1)",
  
  // iPhone 15 Pro - ios 18.1, IG 413 (Nisan 2026 gerçek UA)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 413.0.0.20.79 (iPhone15,4; iOS 18_1; es_LA; es; scale=3.00; 1179x2556; IABMV/1; 863488198) NW/1",
  
  // Windows Chrome 146 - benim tarayıcımın güncel UA'sı, API erişiminde sorun yaşanmazsa bu kalacak
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",

  //İphone 15 pro max benim iOS cihazımın gerçek UA'sı, API erişiminde sorun yaşanmazsa bu kalacak
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
  
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

chrome.runtime.onInstalled.addListener(async (details) => {
  
  try { await chrome.contextMenus.remove("wexProfileDownload"); } catch(e) {}
  
  const lang = details.reason === 'install'
    ? 'en'
    : (await chrome.storage.sync.get(['language'])).language || 'en';
  
  await loadMessages(lang);
  
  chrome.contextMenus.create({
    id: "wexProfileDownload",
    title: t("contextMenuTitle") || "Show Profile Info with WeXProfile",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });

  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      darkMode: true,
      fontFamily: "'Poppins', sans-serif",
      themeTemplate: 'default',
      buttonStyle: 'modern',
      showFollowerChange: true,
      language: 'en',
      scanTimings: {
        scanDelay: 2100,
        scanDelayAfterFive: 15000,
        unfollowDelay: 4800,
        unfollowDelayAfterFive: 200000
      }
    });
    chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: {} });
  } else if (details.reason === 'update') {
    const existing = await chrome.storage.sync.get(null);
    const defaults = {
      darkMode: true,
      fontFamily: "'Poppins', sans-serif",
      themeTemplate: 'default',
      buttonStyle: 'modern',
      showFollowerChange: true,
      language: 'en',
      scanTimings: {
        scanDelay: 2100,
        scanDelayAfterFive: 15000,
        unfollowDelay: 4800,
        unfollowDelayAfterFive: 200000
      }
    };
    const merged = {};
    for (const key of Object.keys(defaults)) {
      if (!(key in existing)) merged[key] = defaults[key];
    }
    if (Object.keys(merged).length > 0) {
      await chrome.storage.sync.set(merged);
    }
  }
  
  checkUpdates();
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "wexProfileDownload" && tab.url.includes("instagram.com")) {
    
    sendNotification("infoTitle", "downloadingPhoto");
    
    try {
      
      const profileData = await handleProfileAnalysis(tab.url, tab.id, false);
      
      
      const hdUrl = await getHdProfilePhotoUrl(profileData.id);
      
      await chrome.downloads.download({
        url: hdUrl,
        filename: `instagram_${profileData.username}_hd.jpg`,
        conflictAction: 'uniquify',
        saveAs: false  
      });
      
     
      sendNotification("infoTitle", "photoDownloaded");
      
    } catch (error) {
      console.error("Sağ tık indirme hatası:", error);
      sendNotification("errorTitle", "downloadPhotoError");
    }
  }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.url.includes("instagram.com")) {
            chrome.action.setPopup({ tabId: currentTab.id, popup: "popup.html" });
        } else {
            sendNotification("errorTitle", "notInstagramPageError");
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
        sendNotification("infoTitle", "profileReadyNotification");
      }
      return data;
    })
    .catch(async (error) => {
      console.error("WeXProfile Hata: Profil analizi başarısız oldu.", error.message);
      sendNotification("errorTitle", "profileFetchError");
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
      
      const forbiddenSegments = [
        'p', 'reels', 'stories', 'tv', 'explore', 'direct', 'accounts', 'about', 'developer', 'directory', 'privacy', 'terms', 'api'
      ];
      
      if (pathSegments.length === 1 && !forbiddenSegments.includes(pathSegments[0])) {
        resolve(pathSegments[0]);
        return;
      }
      
      if (pathSegments.length === 2 && !forbiddenSegments.includes(pathSegments[0]) && pathSegments[1] === '') {
        resolve(pathSegments[0]);
        return;
      }
      reject(new Error(t("notProfilePageError") || "Bu geçerli bir profil sayfası değil.")); 
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
   
    oldEntries.push({
        followers: newUserData.followers,
        following: newUserData.following,
        timestamp: Date.now()
    });
    
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

    let biography = '';
    if (user.biography) { 
      biography = user.biography;
    } else if (user.biography_with_entities && user.biography_with_entities.raw_text) { 
      biography = user.biography_with_entities.raw_text;
    }
    let userData = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      biography: biography,
      biography_with_entities: user.biography_with_entities, 
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
    const user = out.user;
    if (!user) throw new Error("Kullanıcı verisi yok");

    if (user.hd_profile_pic_url_info?.url) {
      return user.hd_profile_pic_url_info.url;
    }

    if (user.hd_profile_pic_versions?.length) {
      const sorted = [...user.hd_profile_pic_versions].sort(
        (a, b) => (b.width || 0) - (a.width || 0)
      );
      if (sorted[0]?.url) return sorted[0].url;
    }


    if (user.profile_pic_url) {
      const biggerUrl = user.profile_pic_url
        .replace(/\/s\d+x\d+\//, '/s1080x1080/')
        .replace(/\/vp\/[^/]+\//, '/'); 
      
      try {
        const testResp = await fetch(biggerUrl, { method: 'HEAD', mode: 'cors' });
        if (testResp.ok) return biggerUrl;
      } catch (_) { /* ignore */ }

      return user.profile_pic_url;
    }

    throw new Error("Hiçbir profil fotoğrafı URL'si bulunamadı.");
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
      sendNotification("errorTitle", "openHdPhotoError");
    }
  } else {
    sendNotification("errorTitle", "noCachedDataError");
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
      sendNotification("errorTitle", "downloadPhotoError");
    }
  } else {
    sendNotification("errorTitle", "noCachedDataError");
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
        sendNotification("errorTitle", "downloadPhotoError");
      }
    } else {
    sendNotification("errorTitle", "noCachedDataError");
  }
}


function sendNotification(titleKey, messageKey) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: `WeXProfile: ${t(titleKey)}`,
    message: t(messageKey),
    priority: 2
  });
}

async function standaloneUnfollow(users, csrfToken) {
  const syncData = await chrome.storage.sync.get(['scanTimings']);
  const timings = syncData.scanTimings || {};
  const delayBetween = timings.unfollowDelay || 4000;
  const delayAfterFive = timings.unfollowDelayAfterFive || 180000;

  function getNaturalDelay(base) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    const d = base + z * (base * 0.15);
    return Math.floor(Math.max(base * 0.6, Math.min(base * 1.4, d)));
  }

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const response = await fetch(`https://www.instagram.com/web/friendships/${user.id}/unfollow/`, {
        method: 'POST',
        headers: {
          'x-csrftoken': csrfToken,
          'x-instagram-ajax': '1',
          'x-requested-with': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      const responseData = response.ok ? await response.json() : null;
      const success = responseData?.status === 'ok';

      if (success) {
        
        const { unfollowedIds = [] } = await chrome.storage.local.get('unfollowedIds');
        if (!unfollowedIds.includes(user.id)) unfollowedIds.push(user.id);
        await chrome.storage.local.set({ unfollowedIds });
      }

      chrome.runtime.sendMessage({
        action: 'unfollowProgress',
        data: { success, user, progress: { current: i + 1, total: users.length } }
      }).catch(() => {}); 
    } catch (error) {
      chrome.runtime.sendMessage({
        action: 'unfollowProgress',
        data: { success: false, user, message: error.message, progress: { current: i + 1, total: users.length } }
      }).catch(() => {});
    }

    const base = ((i + 1) % 5 === 0) ? delayAfterFive : delayBetween;
    await new Promise(r => setTimeout(r, getNaturalDelay(base)));
  }
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
            throw new Error(t('notInstagramPageError')); 
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
        sendNotification("infoTitle", "historyCleared");
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
        await chrome.storage.local.remove(['lastScanResult', 'lastScanSummary', 'unfollowedIds']);
        const userId = await getCookie('ds_user_id');
        const csrfToken = await getCookie('csrftoken');
        if (!userId || !csrfToken) {
          sendNotification("errorTitle", "LoginUnfollow");
          return;
        }
        
        let config;
        
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
              await chrome.storage.local.set({ lastScanResult: users });
              chrome.runtime.sendMessage({ action: 'scanResult', data: users });
            },
            onComplete: (c) => {
              chrome.storage.local.set({ lastScanSummary: c.summary });
              chrome.runtime.sendMessage({ action: 'scanComplete', data: c });
            },
            onUnfollowProgress: async (l) => {
              if (l.success && l.user) {
                const { unfollowedIds = [] } = await chrome.storage.local.get('unfollowedIds');
                if (!unfollowedIds.includes(l.user.id)) unfollowedIds.push(l.user.id);
                await chrome.storage.local.set({ unfollowedIds });
              }
              chrome.runtime.sendMessage({ action: 'unfollowProgress', data: l }).catch(() => {});
            },
            config 
        });
        currentScanner.scan();
        break;

      case 'stopScan': if(currentScanner) currentScanner.stop(); break;
      case 'pauseScan': if(currentScanner) currentScanner.pause(); break;
      case 'resumeScan': if(currentScanner) currentScanner.resume(); break;
      case 'unfollowSelected':
        if (request.users && request.users.length > 0) {
          const csrfForUnfollow = await getCookie('csrftoken');
          if (!csrfForUnfollow) { sendNotification("errorTitle", "LoginUnfollow"); break; }
          
          if (currentScanner && currentScanner.csrfToken) {
            currentScanner.unfollow(request.users);
          } else {
            standaloneUnfollow(request.users, csrfForUnfollow);
          }
        }
        break;

            default:
        sendResponse({ success: false, error: t("unknownActionError") });
    }
  })();
  return true;
});