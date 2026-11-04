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
        title: t("contextMenuTitle") || "Download Profile Photo (HD)"
      });
      await chrome.contextMenus.update("wexProfileOpenHd", {
        title: t("contextMenuOpenHdTitle") || "Open Profile Photo in New Tab (HD)"
      });
    } catch(e) {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: "wexProfileDownload",
          title: t("contextMenuTitle") || "Download Profile Photo (HD)",
          contexts: ["page"],
          documentUrlPatterns: ["*://*.instagram.com/*"]
        });
        chrome.contextMenus.create({
          id: "wexProfileOpenHd",
          title: t("contextMenuOpenHdTitle") || "Open Profile Photo in New Tab (HD)",
          contexts: ["page"],
          documentUrlPatterns: ["*://*.instagram.com/*"]
        });
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

const PROFILE_HISTORY_KEY = 'profileHistory';
const HISTORY_LIMIT = 500;
const CACHE_TTL = 5 * 60 * 1000;


const IG_APP_ID = '936619743392459';
const IG_ASBD_ID = '359341';
const PROFILE_QUERY_DOC_ID = '40158838120366999';
const PROFILE_QUERY_FRIENDLY_NAME = 'PolarisProfilePageContentQuery';
const HOVER_CARD_QUERY_DOC_ID = '28949219061332276';
const HOVER_CARD_QUERY_FRIENDLY_NAME = 'PolarisUserHoverCardContentV2Query';
// Takip listesi API'si yakalanan isteklerde 12'lik sayfalar döndürüyor.
const FOLLOWING_PAGE_SIZE = 12;

async function getCookie(name) {
  try {
    const cookie = await chrome.cookies.get({ url: "https://www.instagram.com", name });
    return cookie ? cookie.value : null;
  } catch (e) {
    console.error("Cookie alınamadı:", e);
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  try { await chrome.contextMenus.remove("wexProfileDownload"); } catch(e) {}
  
  const lang = details.reason === 'install'
    ? 'en'
    : (await chrome.storage.sync.get(['language'])).language || 'en';
  
  await loadMessages(lang);
  
  chrome.contextMenus.create({
    id: "wexProfileDownload",
    title: t("contextMenuTitle") || "Download Profile Photo (HD)",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });

  chrome.contextMenus.create({
    id: "wexProfileOpenHd",
    title: t("contextMenuOpenHdTitle") || "Open Profile Photo in New Tab (HD)",
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
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab.url.includes("instagram.com")) return;

  if (info.menuItemId === "wexProfileDownload") {
    sendNotification("infoTitle", "downloadingPhoto");
    try {
      const profileData = await handleProfileAnalysis(tab.url, tab.id, false);
      const hdUrl = await getHdProfilePhotoUrl(profileData.id, tab.id);
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

  if (info.menuItemId === "wexProfileOpenHd") {
    try {
      const profileData = await handleProfileAnalysis(tab.url, tab.id, false);
      const hdUrl = await getHdProfilePhotoUrl(profileData.id, tab.id);
      chrome.tabs.create({ url: hdUrl });
    } catch (error) {
      console.error("Sağ tık yeni sekme hatası:", error);
      sendNotification("errorTitle", "openHdPhotoError");
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

  currentProfileFetchPromise = fetchProfileData(url, tabId)
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
      const forbiddenSegments = ['p', 'reels', 'stories', 'tv', 'explore', 'direct', 'accounts', 'about', 'developer', 'directory', 'privacy', 'terms', 'api'];
      
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


function extractLargestImage(candidatesList) {
  if (!candidatesList || candidatesList.length === 0) return null;
  
  const sorted = candidatesList
    .filter(item => item && (item.url || item.src))
    .map(item => ({
      url: item.url || item.src,
      width: parseInt(item.width || item.height || 1),
      height: parseInt(item.height || item.width || 1)
    }))
    .sort((a, b) => (b.width * b.height) - (a.width * a.height)); 
    
  return sorted[0]?.url || null;
}


async function instagramProfileRequest(payload) {
  const wantedUsername = String(payload.username || '').toLowerCase();

  function getModule(name) {
    try {
      if (typeof window.require === 'function') {
        return window.require(name);
      }
    } catch (e) {}
    return null;
  }

  const scriptTexts = [];
  const scriptNodes = document.querySelectorAll('script[type="application/json"]');
  for (let i = 0; i < scriptNodes.length; i++) {
    try {
      scriptTexts.push(scriptNodes[i].textContent || '');
    } catch (e) {}
  }

  function findUserIdByUsername(root, wanted) {
    const stack = [root];
    let steps = 0;
    while (stack.length > 0 && steps < 500000) {
      steps++;
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (!Array.isArray(node)) {
        const uname = node.username;
        if (typeof uname === 'string' && uname.toLowerCase() === wanted) {
          const id = node.pk || node.id || node.pk_id;
          if (id && String(id) !== '0') return String(id);
        }
      }
      for (const key in node) {
        const child = node[key];
        if (child && typeof child === 'object') stack.push(child);
      }
    }
    return null;
  }

  function extractProfileIdFromHtml(html) {
    let match = html.match(/"page_logging"\s*:\s*\{[^{}]*"name"\s*:\s*"profilePage"[^{}]*"params"\s*:\s*\{[^{}]*"profile_id"\s*:\s*"(\d+)"/);
    if (match) return match[1];
    match = html.match(/"profile_id"\s*:\s*"(\d+)"/);
    if (match) return match[1];
    match = html.match(/"props"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"/);
    if (match) return match[1];
    return null;
  }

  const hasCustomVariables = payload.variables && typeof payload.variables === 'object';
  let profileId = payload.mode === 'id' && payload.profileId ? String(payload.profileId) : null;

  // Hover kartı gibi hazır değişkenlerle çalışan sorgularda profil kimliği
  // çözümlemesine gerek yoktur.
  if (!hasCustomVariables) {
  // 1) Sayfadaki ön yüklenmiş (SSR/Relay) veride kullanıcı adı eşleşmesi.
  if (!profileId && wantedUsername) {
    for (let i = 0; i < scriptTexts.length; i++) {
      const text = scriptTexts[i];
      if (text.toLowerCase().indexOf(wantedUsername) === -1) continue;
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { continue; }
      profileId = findUserIdByUsername(parsed, wantedUsername);
      if (profileId) break;
    }
  }


  if (!profileId && wantedUsername) {
    try {
      const pageResponse = await fetch(location.origin + '/' + encodeURIComponent(wantedUsername) + '/', {
        credentials: 'include',
        headers: { 'accept': 'text/html,application/xhtml+xml' }
      });
      if (pageResponse.ok) {
        profileId = extractProfileIdFromHtml(await pageResponse.text());
      }
    } catch (e) {}
  }

  // 3) Son çare: DOM'daki route verisindeki profile_id.
  if (!profileId) {
    for (let i = 0; i < scriptTexts.length && !profileId; i++) {
      const match = scriptTexts[i].match(/"profile_id"\s*:\s*"(\d+)"/);
      if (match) profileId = match[1];
    }
  }

  if (!profileId) {
    return { ok: false, error: 'profile_id_not_found' };
  }
  }

  const dtsgInitial = getModule('DTSGInitialData') || {};
  const dtsgInit = getModule('DTSGInitData') || {};
  let fbDtsg = dtsgInitial.token || dtsgInit.token || dtsgInitial.async_get_token || dtsgInit.async_get_token || '';
  fbDtsg = fbDtsg ? String(fbDtsg) : '';
  if (!fbDtsg) {
    for (let i = 0; i < scriptTexts.length && !fbDtsg; i++) {
      const match = scriptTexts[i].match(/"DTSGInitialData"\s*,\s*\[\s*\]\s*,\s*(\{[\s\S]*?\})\s*,\s*\d+\s*\]/);
      if (match) {
        try { fbDtsg = String(JSON.parse(match[1]).token || ''); } catch (e) {}
      }
    }
  }

  let lsd = '';
  const lsdData = getModule('LSD') || {};
  if (lsdData && lsdData.token) lsd = String(lsdData.token);
  if (!lsd) {
    for (let i = 0; i < scriptTexts.length && !lsd; i++) {
      const match = scriptTexts[i].match(/"LSD"\s*,\s*\[\s*\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/);
      if (match) lsd = match[1];
    }
  }

  let csrfToken = payload.csrfToken ? String(payload.csrfToken) : '';
  if (!csrfToken) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.indexOf('csrftoken=') === 0) {
        csrfToken = decodeURIComponent(cookie.slice('csrftoken='.length));
        break;
      }
    }
  }

  let av = '';
  const relayDefaults = getModule('RelayAPIConfigDefaults') || {};
  if (relayDefaults.actorID && String(relayDefaults.actorID) !== '0') {
    av = String(relayDefaults.actorID);
  }
  if (!av) {
    const currentUser = getModule('CurrentUserInitialData') || {};
    if (currentUser.ACCOUNT_ID && String(currentUser.ACCOUNT_ID) !== '0') {
      av = String(currentUser.ACCOUNT_ID);
    }
  }
  if (!av) {
    for (let i = 0; i < scriptTexts.length && !av; i++) {
      const match = scriptTexts[i].match(/"actorID"\s*:\s*"(\d{5,})"/);
      if (match) av = match[1];
    }
  }

  if (!fbDtsg || !lsd || !csrfToken) {
    return {
      ok: false,
      error: 'tokens_not_found',
      detail: { fbDtsg: !!fbDtsg, lsd: !!lsd, csrfToken: !!csrfToken }
    };
  }

  let siteData = getModule('SiteData') || {};
  if (!siteData.server_revision) {
    for (let i = 0; i < scriptTexts.length; i++) {
      const match = scriptTexts[i].match(/"SiteData"\s*,\s*\[\s*\]\s*,\s*(\{[\s\S]*?\})\s*,\s*\d+\s*\]/);
      if (!match) continue;
      try {
        siteData = JSON.parse(match[1]);
        if (siteData.server_revision) break;
      } catch (e) {}
    }
  }

  const variables = hasCustomVariables ? payload.variables : {
    enable_integrity_filters: true,
    id: String(profileId),
    __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
    __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
    __relay_internal__pv__PolarisProfileInformTreatmentBannerEnabledrelayprovider: false,
    __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
    __relay_internal__pv__PolarisProfileRingsGradientEnabledrelayprovider: true,
    __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true,
    __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true
  };

  const body = new URLSearchParams();
  if (av) body.set('av', av);
  body.set('__d', 'www');
  body.set('__user', '0');
  body.set('__a', '1');
  body.set('__req', Math.random().toString(36).slice(2, 4));
  if (siteData.haste_session) body.set('__hs', String(siteData.haste_session));
  body.set('dpr', String(Math.round(window.devicePixelRatio || 1)));
  body.set('__ccg', 'EXCELLENT');
  if (siteData.server_revision) body.set('__rev', String(siteData.server_revision));
  if (siteData.hsi) body.set('__hsi', String(siteData.hsi));
  body.set('__comet_req', String(siteData.comet_env || 7));
  body.set('fb_dtsg', fbDtsg);
  let jazoestSum = 0;
  for (let i = 0; i < fbDtsg.length; i++) jazoestSum += fbDtsg.charCodeAt(i);
  body.set('jazoest', '2' + jazoestSum);
  body.set('lsd', lsd);
  if (siteData.__spin_r) body.set('__spin_r', String(siteData.__spin_r));
  if (siteData.__spin_b) body.set('__spin_b', String(siteData.__spin_b));
  if (siteData.__spin_t) body.set('__spin_t', String(siteData.__spin_t));
  body.set('fb_api_caller_class', 'RelayModern');
  body.set('fb_api_req_friendly_name', payload.friendlyName);
  body.set('server_timestamps', 'true');
  body.set('variables', JSON.stringify(variables));
  body.set('doc_id', payload.docId);

  let response;
  try {
    response = await fetch(location.origin + '/api/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrftoken': csrfToken,
        'x-fb-lsd': lsd,
        'x-ig-app-id': payload.appId,
        'x-asbd-id': payload.asbdId,
        'x-fb-friendly-name': payload.friendlyName,
        'x-ig-max-touch-points': '0'
      },
      body: body.toString()
    });
  } catch (e) {
    return { ok: false, error: 'network_error', message: String((e && e.message) || e) };
  }

  const responseText = await response.text();
  let responseJson = null;
  try { responseJson = JSON.parse(responseText); } catch (e) {}

  const hasGraphQLErrors = !!(responseJson && responseJson.errors &&
    (!Array.isArray(responseJson.errors) || responseJson.errors.length > 0));

  if (!response.ok || !responseJson || hasGraphQLErrors) {
    return {
      ok: false,
      status: response.status,
      error: hasGraphQLErrors ? 'graphql_error' : 'http_error',
      message: hasGraphQLErrors
        ? JSON.stringify(responseJson.errors).slice(0, 500)
        : responseText.slice(0, 300)
    };
  }

  return { ok: true, status: response.status, data: responseJson, profileId: profileId ? String(profileId) : null };
}


async function instagramPageFetch(payload) {
  const method = (payload.method || 'GET').toUpperCase();
  const headers = Object.assign({}, payload.headers || {});

  function getModule(name) {
    try {
      if (typeof window.require === 'function') {
        return window.require(name);
      }
    } catch (e) {}
    return null;
  }

  let csrfToken = payload.csrfToken ? String(payload.csrfToken) : '';
  if (!csrfToken) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.indexOf('csrftoken=') === 0) {
        csrfToken = decodeURIComponent(cookie.slice('csrftoken='.length));
        break;
      }
    }
  }
  if (csrfToken && !headers['x-csrftoken']) {
    headers['x-csrftoken'] = csrfToken;
  }


  if (!headers['x-ig-www-claim']) {
    let claim = '';
    try {
      const claimModule = getModule('PolarisWWWClaim');
      if (claimModule && typeof claimModule.getWWWClaim === 'function') {
        claim = claimModule.getWWWClaim() || '';
      }
    } catch (e) {}
    if (!claim) {
      try {
        const storageModule = getModule('PolarisIGWebStorage');
        const storage = storageModule && typeof storageModule.getStorageForUser === 'function'
          ? storageModule.getStorageForUser()
          : null;
        if (storage && typeof storage.getItem === 'function') {
          claim = storage.getItem('www-claim-v2') || '';
        }
      } catch (e) {}
    }
    if (!claim) {
      try {
        const meta = document.querySelector('meta[name="ig-www-claim"]');
        if (meta && meta.content) claim = meta.content;
      } catch (e) {}
    }
    if (claim) headers['x-ig-www-claim'] = String(claim);
  }


  if (!headers['x-web-session-id']) {
    try {
      const sessionModule = getModule('WebSession');
      if (sessionModule && typeof sessionModule.getId === 'function') {
        const sessionId = sessionModule.getId();
        if (sessionId) headers['x-web-session-id'] = String(sessionId);
      }
    } catch (e) {}
  }


  let requestBody = payload.body || undefined;
  if (payload.form && typeof payload.form === 'object') {
    let fbDtsg = '';
    const dtsgInitial = getModule('DTSGInitialData') || {};
    const dtsgInit = getModule('DTSGInitData') || {};
    fbDtsg = String(dtsgInitial.token || dtsgInit.token || dtsgInitial.async_get_token || dtsgInit.async_get_token || '');
    if (!fbDtsg) {
      const nodes = document.querySelectorAll('script[type="application/json"]');
      for (let i = 0; i < nodes.length && !fbDtsg; i++) {
        const m = (nodes[i].textContent || '').match(/"DTSGInitialData"\s*,\s*\[\s*\]\s*,\s*(\{[\s\S]*?\})\s*,\s*\d+\s*\]/);
        if (m) {
          try { fbDtsg = String(JSON.parse(m[1]).token || ''); } catch (e) {}
        }
      }
    }
    if (!fbDtsg) {
      return { ok: false, error: 'tokens_not_found', message: 'fb_dtsg bulunamadi' };
    }
    const form = new URLSearchParams();
    for (const key in payload.form) form.set(key, String(payload.form[key]));
    let jazoestSum = 0;
    for (let i = 0; i < fbDtsg.length; i++) jazoestSum += fbDtsg.charCodeAt(i);
    form.set('jazoest', '2' + jazoestSum);
    form.set('fb_dtsg', fbDtsg);
    requestBody = form.toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
    const siteData = getModule('SiteData') || {};
    if (siteData.server_revision && !headers['x-instagram-ajax']) {
      headers['x-instagram-ajax'] = String(siteData.server_revision);
    }
  }

  let response;
  try {
    response = await fetch(payload.url, {
      method: method,
      credentials: 'include',
      headers: headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : requestBody
    });
  } catch (e) {
    return { ok: false, error: 'network_error', message: String((e && e.message) || e) };
  }

  const responseText = await response.text();
  let responseJson = null;
  try { responseJson = JSON.parse(responseText); } catch (e) {}

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'http_error',
      message: responseText.slice(0, 300),
      data: responseJson
    };
  }

  if (!responseJson) {
    return {
      ok: false,
      status: response.status,
      error: 'invalid_json',
      message: responseText.slice(0, 300)
    };
  }

  return { ok: true, status: response.status, data: responseJson };
}

async function resolveInstagramTabId(preferredTabId) {
  if (preferredTabId) return preferredTabId;

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = activeTabs[0];
  if (activeTab && activeTab.url && activeTab.url.includes('instagram.com')) {
    return activeTab.id;
  }

  const instagramTabs = await chrome.tabs.query({ url: ['https://*.instagram.com/*', 'https://instagram.com/*'] });
  if (instagramTabs.length > 0) {
    return instagramTabs[0].id;
  }

  throw new Error(t('notInstagramPageError') || 'Instagram sayfası bulunamadı.');
}

async function runProfileQuery(tabId, payload) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: instagramProfileRequest,
      args: [payload]
    });
  } catch (error) {
    throw new Error(`Instagram sayfasına erişilemedi: ${error.message}`);
  }

  const result = results && results[0] ? results[0].result : null;
  if (!result) {
    throw new Error('Instagram sayfasından yanıt alınamadı.');
  }
  return result;
}

async function queryProfileUser(tabId, mode, identifier) {
  const csrfToken = await getCookie('csrftoken');
  const result = await runProfileQuery(tabId, {
    mode,
    username: mode === 'username' ? identifier : '',
    profileId: mode === 'id' ? String(identifier) : '',
    docId: PROFILE_QUERY_DOC_ID,
    friendlyName: PROFILE_QUERY_FRIENDLY_NAME,
    appId: IG_APP_ID,
    asbdId: IG_ASBD_ID,
    csrfToken: csrfToken || ''
  });

  if (!result.ok) {
    const status = result.status ? ` (HTTP ${result.status})` : '';
    const code = result.error ? ` [${result.error}]` : '';
    const detail = result.message ? `: ${result.message}` : '';
    const extra = result.detail ? ` ${JSON.stringify(result.detail)}` : '';
    throw new Error(`Instagram profil sorgusu başarısız${status}${code}${detail}${extra}`);
  }

  const user = result.data && result.data.data && result.data.data.user;
  if (!user) {
    throw new Error("API yanıtında beklenen kullanıcı verisi bulunamadı.");
  }
  return user;
}

async function runPageFetch(tabId, payload) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: instagramPageFetch,
      args: [payload]
    });
  } catch (error) {
    throw new Error(`Instagram sayfasına erişilemedi: ${error.message}`);
  }

  const result = results && results[0] ? results[0].result : null;
  if (!result) {
    throw new Error('Instagram sayfasından yanıt alınamadı.');
  }
  return result;
}


async function fetchFollowingPage(tabId, userId, maxId) {
  const csrfToken = await getCookie('csrftoken');
  let url = `https://www.instagram.com/api/v1/friendships/${encodeURIComponent(userId)}/following/?count=${FOLLOWING_PAGE_SIZE}`;
  if (maxId) {
    url += `&max_id=${encodeURIComponent(maxId)}`;
  }

  return runPageFetch(tabId, {
    url,
    method: 'GET',
    csrfToken: csrfToken || '',
    headers: {
      'accept': '*/*',
      'x-ig-app-id': IG_APP_ID,
      'x-asbd-id': IG_ASBD_ID,
      'x-requested-with': 'XMLHttpRequest'
    }
  });
}


async function queryUserFriendship(tabId, userId) {
  const csrfToken = await getCookie('csrftoken');
  const result = await runProfileQuery(tabId, {
    mode: 'variables',
    variables: { userID: String(userId) },
    docId: HOVER_CARD_QUERY_DOC_ID,
    friendlyName: HOVER_CARD_QUERY_FRIENDLY_NAME,
    appId: IG_APP_ID,
    asbdId: IG_ASBD_ID,
    csrfToken: csrfToken || ''
  });

  if (!result.ok) {
    const status = result.status ? ` (HTTP ${result.status})` : '';
    const code = result.error ? ` [${result.error}]` : '';
    const detail = result.message ? `: ${result.message}` : '';
    const err = new Error(`Arkadaşlık durumu sorgusu başarısız${status}${code}${detail}`);
    err.status = result.status || null;
    throw err;
  }

  const userDict = result.data &&
    result.data.data &&
    result.data.data.xig_user_by_igid_v2 &&
    result.data.data.xig_user_by_igid_v2.user_dict;
  const friendshipStatus = userDict && userDict.friendship_status;

  if (!friendshipStatus) {
    throw new Error('API yanıtında friendship_status bulunamadı.');
  }
  return friendshipStatus;
}


async function unfollowUserViaPage(tabId, userId) {
  const resolvedTabId = await resolveInstagramTabId(tabId);
  const csrfToken = await getCookie('csrftoken');
  const result = await runPageFetch(resolvedTabId, {
    url: `https://www.instagram.com/api/v1/friendships/destroy/${encodeURIComponent(userId)}/`,
    method: 'POST',
    csrfToken: csrfToken || '',
    form: { container_module: 'profile', user_id: String(userId) },
    headers: {
      'accept': '*/*',
      'x-ig-app-id': IG_APP_ID,
      'x-asbd-id': IG_ASBD_ID,
      'x-requested-with': 'XMLHttpRequest'
    }
  });

  const data = result.data || null;
  const apiMessage = data && (data.message || data.feedback_message || data.status);
  if (!result.ok || (data && data.status && data.status !== 'ok')) {
    const err = new Error(
      `${result.status ? 'HTTP ' + result.status : (result.error || 'hata')}${apiMessage ? ': ' + String(apiMessage).slice(0, 120) : ''}`
    );
    err.status = result.status || null;
    err.blocked = result.status === 429 || /feedback_required|spam|checkpoint|challenge/i.test(JSON.stringify(data || result.message || ''));
    throw err;
  }
  return true;
}

async function getProfileStatsForUser(tabId, userId) {
  const user = await queryProfileUser(tabId, 'id', String(userId));
  return {
    id: String(user.id || user.pk || userId),
    username: user.username,
    followers: user.follower_count ?? null,
    following: user.following_count ?? null,
    posts: user.media_count ?? null
  };
}

async function getInstagramUserInfo(username, tabId) {
  const resolvedTabId = await resolveInstagramTabId(tabId);
  const user = await queryProfileUser(resolvedTabId, 'username', username);

  if (user.username && user.username.toLowerCase() !== username.toLowerCase()) {
    throw new Error('Profil kimliği doğrulanamadı: yanıt farklı bir kullanıcıya ait.');
  }

  const profilePicDataURL = await fetchImageAsDataURL(user.profile_pic_url);
  const biography = user.biography || (user.biography_with_entities && user.biography_with_entities.raw_text) || '';
  const hdProfilePicUrl =
    (user.hd_profile_pic_url_info && user.hd_profile_pic_url_info.url) ||
    user.profile_pic_url_hd ||
    user.profile_pic_url;

  const userData = {
    id: user.id || user.pk,
    username: user.username,
    fullName: user.full_name,
    biography: biography,
    biography_with_entities: user.biography_with_entities,
    followers: user.follower_count ?? 0,
    following: user.following_count ?? 0,
    posts: user.media_count ?? 0,
    isPrivate: user.is_private,
    isVerified: user.is_verified,
    profilePicUrlForPreview: profilePicDataURL,
    hdProfilePicUrl: hdProfilePicUrl
  };
  return await updateProfileHistoryAndGetDataWithChanges(userData);
}

async function fetchProfileData(url, tabId) {
  const username = await getInstagramUsername(url);
  return getInstagramUserInfo(username, tabId);
}

async function getHdProfilePhotoUrl(instagramUserId, tabId) {
  const userId = String(instagramUserId);

  try {
    const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
    if (cachedProfile && String(cachedProfile.id) === userId && cachedProfile.hdProfilePicUrl && !cachedProfile.hdProfilePicUrl.includes("320x320")) {
      return cachedProfile.hdProfilePicUrl; 
    }
  } catch (e) {
    console.error("Önbellek okunamadı:", e);
  }

  try {
    const resolvedTabId = await resolveInstagramTabId(tabId);
    const user = await queryProfileUser(resolvedTabId, 'id', userId);

    let photoCandidates = [];
    if (user.hd_profile_pic_url_info) photoCandidates.push(user.hd_profile_pic_url_info);
    if (user.hd_profile_pic_versions) photoCandidates = photoCandidates.concat(user.hd_profile_pic_versions);
    if (user.image_versions2 && user.image_versions2.candidates) {
      photoCandidates = photoCandidates.concat(user.image_versions2.candidates);
    }

    const bestHdUrl = extractLargestImage(photoCandidates) ||
      user.profile_pic_url_hd ||
      (user.hd_profile_pic_url_info && user.hd_profile_pic_url_info.url) ||
      user.profile_pic_url;

    if (!bestHdUrl) throw new Error("Kullanıcı verisinde fotoğraf URL'si yok");

    try {
      const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
      if (cachedProfile && String(cachedProfile.id) === userId) {
        cachedProfile.hdProfilePicUrl = bestHdUrl;
        await chrome.storage.local.set({ cachedProfile });
      }
    } catch (e) {}

    return bestHdUrl;
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
    iconUrl: chrome.runtime.getURL("icon.png"),
    title: `WeXProfile: ${t(titleKey)}`,
    message: t(messageKey),
    priority: 2
  });
}


async function keepAliveSleep(ms) {
  let remaining = ms;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 20000);
    await new Promise(r => setTimeout(r, chunk));
    remaining -= chunk;
    try { await chrome.runtime.getPlatformInfo(); } catch (e) {}
  }
}

async function standaloneUnfollow(users) {
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
    let blocked = false;
    try {
      await unfollowUserViaPage(null, user.id);

      const { unfollowedIds = [] } = await chrome.storage.local.get('unfollowedIds');
      if (!unfollowedIds.includes(user.id)) unfollowedIds.push(user.id);
      await chrome.storage.local.set({ unfollowedIds });

      chrome.runtime.sendMessage({
        action: 'unfollowProgress',
        data: { success: true, user, progress: { current: i + 1, total: users.length } }
      }).catch(() => {});
    } catch (error) {
      blocked = !!error.blocked;
      chrome.runtime.sendMessage({
        action: 'unfollowProgress',
        data: { success: false, user, message: error.message, blocked, progress: { current: i + 1, total: users.length } }
      }).catch(() => {});
    }


    if (blocked) break;

    if (i + 1 < users.length) {
      const base = ((i + 1) % 5 === 0) ? delayAfterFive : delayBetween;
      await keepAliveSleep(getNaturalDelay(base));
    }
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
      case 'getSettings':
        const settings = await chrome.storage.sync.get(['darkMode', 'fontFamily', 'themeTemplate', 'buttonStyle', 'showFollowerChange', 'language']);
        sendResponse({ success: true, settings });
        break;
      case 'setSettings': await chrome.storage.sync.set(request.settings); sendResponse({ success: true }); break;
      case 'openGithub': chrome.tabs.create({ url: 'https://github.com/Wek1d/WeXProfile-Downloader' }); sendResponse({ success: true }); break;
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

        let scanTabId;
        try {
          scanTabId = await resolveInstagramTabId();
        } catch (error) {
          sendNotification("errorTitle", "notInstagramPageError");
          chrome.runtime.sendMessage({ action: 'scanProgress', data: { type: 'error', message: error.message } }).catch(() => {});
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
            fetchFollowingPage: (maxId) => fetchFollowingPage(scanTabId, userId, maxId),
            verifyFollowedBy: (targetUserId) => queryUserFriendship(scanTabId, targetUserId),
            getProfileStats: (targetUserId) => getProfileStatsForUser(scanTabId, targetUserId),
            unfollowUser: (targetUserId) => unfollowUserViaPage(null, targetUserId),
            onProgress: (p) => chrome.runtime.sendMessage({ action: 'scanProgress', data: p }),
            onResult: async (users, incremental = false) => {

              for (const user of users) {
                if (user.profile_pic_url && !user.profile_pic_url.startsWith('data:')) {
      user.profile_pic_url = await fetchImageAsDataURL(user.profile_pic_url);
    }
  }

  if (incremental) {
    const { lastScanResult = [] } = await chrome.storage.local.get('lastScanResult');
    const existingIds = new Set(lastScanResult.map(u => u.id));
    const newUsers = users.filter(u => !existingIds.has(u.id));
    const merged = [...lastScanResult, ...newUsers];
    await chrome.storage.local.set({ lastScanResult: merged });
    chrome.runtime.sendMessage({ action: 'scanResult', data: merged });
  } else {
    await chrome.storage.local.set({ lastScanResult: users });
    chrome.runtime.sendMessage({ action: 'scanResult', data: users });
  }
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
            standaloneUnfollow(request.users);
          }
        }
        break;

      default:
        sendResponse({ success: false, error: t("unknownActionError") });
    }
  })();
  return true;
});