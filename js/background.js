// Service Worker'lar olay bazlı çalışır ve sürekli aktif kalmaz.
// Bu yüzden verileri ve durumu global değişkenler yerine chrome.storage'da tutmak daha güvenilirdir.

let currentProfileFetchPromise = null;
let currentProfileFetchUrl = null;

const USER_AGENT_RULE_ID = 1;
const PROFILE_HISTORY_KEY = 'profileHistory';
const HISTORY_LIMIT = 100;
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Instagram 271.0.0.0.0'
];
const GITHUB_REPO_URL = 'https://api.github.com/repos/Wek1d/WeXProfile-Downloader/releases/latest';

async function updateUserAgentRule(userAgentString) {
  const rule = {
    id: USER_AGENT_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'user-agent', operation: 'set', value: userAgentString }]
    },
    condition: {
      urlFilter: 'i.instagram.com/api/v1/users/',
      resourceTypes: ['xmlhttprequest']
    }
  };
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [USER_AGENT_RULE_ID],
      addRules: [rule]
    });
  } catch (error) {
    console.error("User-Agent kuralı güncellenirken hata:", error);
  }
}

async function checkUpdates() {
  try {
    const response = await fetch(GITHUB_REPO_URL);
    if (!response.ok) {
      console.error('GitHub API\'den sürüm bilgisi alınamadı:', response.statusText);
      return;
    }
    const data = await response.json();
    const latestVersion = data.tag_name;
    const currentVersion = chrome.runtime.getManifest().version;

    if (compareVersions(latestVersion, currentVersion) > 0) {
      chrome.storage.local.set({ hasUpdate: true, latestVersion: latestVersion });
    } else {
      chrome.storage.local.set({ hasUpdate: false });
    }
  } catch (error) {
    console.error('Güncelleme kontrolü sırasında hata:', error);
    chrome.storage.local.set({ hasUpdate: false });
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
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
    title: chrome.i18n.getMessage("contextMenuTitle"),
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });
  chrome.storage.sync.set({
    darkMode: true,
    fontFamily: 'Poppins, sans-serif',
    themeTemplate: 'default'
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
    if (tabs[0] && tabs[0].url.includes("instagram.com")) {
      handleProfileAnalysis(tabs[0].url, tabs[0].id, false);
    } else {
      sendNotification(chrome.i18n.getMessage("errorTitle"), chrome.i18n.getMessage("notInstagramPageError"));
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
      await chrome.storage.local.set({ cachedProfile: data, cacheUrl: url });
      chrome.action.setPopup({ tabId: tabId, popup: "popup.html" }, () => {
        if (chrome.runtime.lastError) {
          console.error("Popup setleme hatası:", chrome.runtime.lastError.message);
        } else if (isContextMenuClick) {
          sendNotification(chrome.i18n.getMessage("infoTitle"), chrome.i18n.getMessage("profileReadyNotification"));
        }
      });
      return data;
    })
    .catch(async (error) => {
      console.error("WeXProfile Error:", error);
      sendNotification(chrome.i18n.getMessage("errorTitle"), `${chrome.i18n.getMessage("profileFetchError")}: ${error.message}`);
      await chrome.storage.local.remove(['cachedProfile', 'cacheUrl']);
      currentProfileFetchUrl = null;
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
    const profileRegex = /(?<=instagram\.com\/)[A-Za-z0-9_.]+(?=\/|$)/;
    const match = link.match(profileRegex);
    if (match && match[0] && !['p', 'reels', 'stories', 'tv'].includes(match[0])) {
      resolve(match[0]);
    } else {
      reject(new Error(chrome.i18n.getMessage("notProfilePageError")));
    }
  });
}

async function fetchImageAsDataURL(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Resim çekilemedi: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Resim Data URL'e dönüştürülürken hata:", error);
    return null;
  }
}

async function updateProfileHistoryAndGetDataWithChanges(newUserData) {
  const storageData = await chrome.storage.local.get(PROFILE_HISTORY_KEY);
  let history = storageData[PROFILE_HISTORY_KEY] || {};

  const userId = newUserData.id;
  const oldUserData = history[userId];

  if (oldUserData) {
    newUserData.followerChange = newUserData.followers - oldUserData.followers;
    newUserData.followingChange = newUserData.following - oldUserData.following;
  } else {
    newUserData.followerChange = 0;
    newUserData.followingChange = 0;
  }

  history[userId] = {
    followers: newUserData.followers,
    following: newUserData.following,
    timestamp: Date.now()
  };

  const historyKeys = Object.keys(history);
  if (historyKeys.length > HISTORY_LIMIT) {
    const oldestKey = historyKeys.sort((a, b) => history[a].timestamp - history[b].timestamp)[0];
    delete history[oldestKey];
  }

  await chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: history });

  return newUserData;
}

async function getInstagramUserInfo(username, userAgentIndex = 0) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  await updateUserAgentRule(USER_AGENTS[userAgentIndex]);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (userAgentIndex < USER_AGENTS.length - 1) {
        console.warn(`API isteği ${userAgentIndex + 1}. User-Agent ile başarısız oldu. Tekrar deneniyor...`);
        return getInstagramUserInfo(username, userAgentIndex + 1);
      }
      const text = await res.text();
      throw new Error(`Instagram API yanıtı başarısız: ${res.status} - ${text}`);
    }
    const out = await res.json();

    if (out.data && out.data.user) {
      const user = out.data.user;
      const profilePicDataURL = await fetchImageAsDataURL(user.profile_pic_url);

      let userData = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        biography: user.biography,
        followers: user.edge_followed_by?.count || 0,
        following: user.edge_follow?.count || 0,
        posts: user.edge_owner_to_timeline_media?.count || 0,
        isPrivate: user.is_private,
        isVerified: user.is_verified,
        profilePicUrlForPreview: profilePicDataURL
      };
      return await updateProfileHistoryAndGetDataWithChanges(userData);
    } else {
      throw new Error("API yanıtında kullanıcı bilgileri bulunamadı.");
    }
  } catch (error) {
    if (userAgentIndex < USER_AGENTS.length - 1) {
      console.warn(`API isteği ${userAgentIndex + 1}. User-Agent ile başarısız oldu. Tekrar deneniyor...`);
      return getInstagramUserInfo(username, userAgentIndex + 1);
    }
    throw error;
  }
}

async function fetchProfileData(url) {
  const username = await getInstagramUsername(url);
  return getInstagramUserInfo(username);
}

async function getHdProfilePhotoUrl(instagramUserId, userAgentIndex = 0) {
  const url = `https://i.instagram.com/api/v1/users/${instagramUserId}/info/`;
  await updateUserAgentRule(USER_AGENTS[userAgentIndex]);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (userAgentIndex < USER_AGENTS.length - 1) {
        console.warn(`HD fotoğraf isteği ${userAgentIndex + 1}. User-Agent ile başarısız oldu. Tekrar deneniyor...`);
        return getHdProfilePhotoUrl(instagramUserId, userAgentIndex + 1);
      }
      throw new Error(`Instagram API yanıtı başarısız: ${res.status}`);
    }
    const out = await res.json();

    if (out.user?.hd_profile_pic_url_info?.url) {
      return out.user.hd_profile_pic_url_info.url;
    } else {
      throw new Error("API yanıtında HD profil fotoğrafı URL'si bulunamadı.");
    }
  } catch (error) {
    if (userAgentIndex < USER_AGENTS.length - 1) {
      console.warn(`HD fotoğraf isteği ${userAgentIndex + 1}. User-Agent ile başarısız oldu. Tekrar deneniyor...`);
      return getHdProfilePhotoUrl(instagramUserId, userAgentIndex + 1);
    }
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
      sendNotification(chrome.i18n.getMessage("errorTitle"), `${chrome.i18n.getMessage("openHdPhotoError")}: ${error.message}`);
    }
  } else {
    sendNotification(chrome.i18n.getMessage("errorTitle"), chrome.i18n.getMessage("noCachedDataError"));
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
      sendNotification(chrome.i18n.getMessage("errorTitle"), `${chrome.i18n.getMessage("downloadPhotoError")}: ${error.message}`);
    }
  } else {
    sendNotification(chrome.i18n.getMessage("errorTitle"), chrome.i18n.getMessage("noCachedDataError"));
  }
}

// Hata veren downloadJSON fonksiyonu Data URI kullanarak yeniden yazıldı.
async function downloadJSON(filename, data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const reader = new FileReader();
    reader.onload = function() {
      const dataUrl = reader.result;
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: true
      });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("JSON indirilirken hata:", error);
    sendNotification(chrome.i18n.getMessage("errorTitle"), `${chrome.i18n.getMessage("downloadJsonError")}: ${error.message}`);
  }
}

function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: title,
    message: message,
    priority: 2
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getProfileData':
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTabUrl = tabs[0]?.url;
        if (!activeTabUrl?.includes("instagram.com")) {
          sendResponse({ success: false, error: chrome.i18n.getMessage("notInstagramPageError") });
          return;
        }
        try {
          let dataToReturn;
          if (currentProfileFetchPromise && currentProfileFetchUrl === activeTabUrl) {
            dataToReturn = await currentProfileFetchPromise;
          } else {
            const { cachedProfile, cacheUrl } = await chrome.storage.local.get(['cachedProfile', 'cacheUrl']);
            if (cachedProfile && cacheUrl === activeTabUrl) {
              dataToReturn = cachedProfile;
            } else {
              dataToReturn = await handleProfileAnalysis(activeTabUrl, tabs[0].id, false);
            }
          }
          sendResponse({ success: true, data: dataToReturn });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      return true;

    case 'openHdPhoto':
      openHdProfilePhoto();
      sendResponse({ success: true });
      break;

    case 'downloadPhoto':
      downloadProfilePhoto();
      sendResponse({ success: true });
      break;

    case 'downloadJSON':
      chrome.storage.local.get('cachedProfile', async (result) => {
        if (result.cachedProfile) {
          await downloadJSON(`instagram_${result.cachedProfile.username}_profile.json`, result.cachedProfile);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: chrome.i18n.getMessage("noCachedDataError") });
        }
      });
      return true;

    case 'clearHistory':
      chrome.storage.local.set({ [PROFILE_HISTORY_KEY]: {} }, () => {
        console.log("Takipçi geçmişi temizlendi.");
        sendNotification(chrome.i18n.getMessage("infoTitle"), chrome.i18n.getMessage("historyCleared"));
        sendResponse({ success: true });
      });
      return true;

    case 'getSettingsAndUpdates':
      chrome.storage.sync.get(['darkMode', 'fontFamily', 'themeTemplate'], (settings) => {
        chrome.storage.local.get(['hasUpdate', 'latestVersion'], (updateInfo) => {
          sendResponse({ success: true, settings, updateInfo });
        });
      });
      return true;

    case 'setSettings':
      chrome.storage.sync.set(request.settings, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'openGithub':
      chrome.tabs.create({ url: 'https://github.com/Wek1d/WeXProfile-Downloader?tab=readme-ov-file' });
      sendResponse({ success: true });
      return true;

    case 'checkUpdatesNow':
      checkUpdates();
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ success: false, error: chrome.i18n.getMessage("unknownActionError") });
  }
});