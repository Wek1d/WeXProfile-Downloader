// Service Worker'lar olay bazlı çalışır ve sürekli aktif kalmaz.
// Bu yüzden verileri ve durumu global değişkenler yerine chrome.storage'da tutmak daha güvenilirdir.

// O anki aktif veri çekme işleminin Promise'ini tutar.
// Bu, service worker aktifken ardışık tıklamaları yönetmek için hala kullanışlıdır.
let currentProfileFetchPromise = null;
let currentProfileFetchUrl = null;

// KURAL ID'Sİ: User-Agent değiştiren kuralımız için sabit bir ID.
const USER_AGENT_RULE_ID = 1;

// --- MANIFEST V3 İÇİN YENİ FONKSİYON ---
// declarativeNetRequest API'ını kullanarak User-Agent'ı dinamik olarak değiştiren kuralı günceller.
async function updateUserAgentRule(userAgentString) {
  const rule = {
    id: USER_AGENT_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'user-agent', operation: 'set', value: userAgentString }]
    },
    // Bu kural sadece Instagram API'ına yapılan isteklere uygulanacak.
    condition: {
      urlFilter: 'i.instagram.com/api/v1/users/',
      resourceTypes: ['xmlhttprequest'] // fetch istekleri için
    }
  };

  try {
    // Mevcut kuralı kaldırıp yenisini ekliyoruz. Bu anlık bir değişiklik sağlar.
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [USER_AGENT_RULE_ID],
      addRules: [rule]
    });
  } catch (error) {
    console.error("User-Agent kuralı güncellenirken hata:", error);
  }
}


// Uzantı yüklendiğinde sağ tık menüsünü oluştur
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wexProfileDownload",
    title: "WeXProfile ile Profil Bilgilerini Göster",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });
  chrome.storage.sync.set({ darkMode: true });
});

// Sağ tık menüsüne tıklanınca
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wexProfileDownload" && tab.url.includes("instagram.com")) {
    handleProfileAnalysis(tab.url, tab.id, true);
  }
});

// MANIFEST V3 Değişikliği: chrome.browserAction -> chrome.action
// Eklenti ikonuna tıklanınca
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url.includes("instagram.com")) {
      handleProfileAnalysis(tabs[0].url, tabs[0].id, false);
    } else {
      sendNotification("Hata", "Lütfen bir Instagram profil sayfasında kullanın.");
    }
  });
});

// Profil analizini başlat
async function handleProfileAnalysis(url, tabId, isContextMenuClick) {
  if (currentProfileFetchPromise && currentProfileFetchUrl === url) {
    console.log("Aynı URL için zaten veri çekiliyor, mevcut işlemi bekliyor.");
    return currentProfileFetchPromise;
  }

  currentProfileFetchUrl = url;
  currentProfileFetchPromise = fetchProfileData(url)
    .then(async (data) => {
      // MANIFEST V3 İYİLEŞTİRMESİ: Veriyi global değişken yerine chrome.storage'a kaydet.
      await chrome.storage.local.set({ cachedProfile: data, cacheUrl: url });

      // MANIFEST V3 Değişikliği: chrome.browserAction -> chrome.action
      chrome.action.setPopup({ tabId: tabId, popup: "popup.html" }, () => {
        if (chrome.runtime.lastError) {
          console.error("Popup setleme hatası:", chrome.runtime.lastError.message);
        } else if (isContextMenuClick) {
          sendNotification("Bilgi", "Profil bilgileri hazır! Detayları görmek için lütfen WeXProfile eklenti ikonuna tıklayın.");
        }
      });
      return data;
    })
    .catch(async (error) => {
      console.error("WeXProfile Error:", error);
      sendNotification("Hata", `Profil bilgileri alınırken bir hata oluştu: ${error.message}`);
      // Hata durumunda önbelleği temizle
      await chrome.storage.local.remove(['cachedProfile', 'cacheUrl']);
      currentProfileFetchUrl = null;
      throw error;
    })
    .finally(() => {
      // İşlem bitince bu URL için çalışan promise'i temizle, böylece tekrar tetiklenebilir.
      if (currentProfileFetchUrl === url) {
          currentProfileFetchPromise = null;
          currentProfileFetchUrl = null;
      }
    });
  
  return currentProfileFetchPromise;
}

// Instagram URL'sinden kullanıcı adını al
function getInstagramUsername(link) {
  return new Promise((resolve, reject) => {
    const regex = /(?<=instagram\.com\/)[A-Za-z0-9_.]+/;
    const match = link.match(regex);
    if (match && match[0] && !match[0].includes('/')) {
      resolve(match[0]);
    } else {
      reject(new Error("URL'den Instagram kullanıcı adı alınamadı."));
    }
  });
}

// Resim URL'sini alıp Base64 Data URL'ine dönüştüren yardımcı fonksiyon
async function fetchImageAsDataURL(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to Data URL:", error);
    return null;
  }
}

// Instagram kullanıcı bilgilerini API'den al
async function getInstagramUserInfo(username) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0';

  // MANIFEST V3 Değişikliği: fetch'ten önce User-Agent kuralını ayarla
  await updateUserAgentRule(userAgent);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram API yanıtı başarısız oldu: ${res.status} - ${text}`);
  }
  const out = await res.json();

  if (out.data && out.data.user) {
    const user = out.data.user;
    const profilePicDataURL = await fetchImageAsDataURL(user.profile_pic_url);
    
    // Kanka burası önemli: Artık kullanıcı ID'sini de kaydediyoruz.
    // Böylece HD fotoğraf için tekrar API isteği yapmaya gerek kalmayacak.
    return {
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
  } else {
    throw new Error("API yanıtında kullanıcı bilgileri bulunamadı.");
  }
}

// Profil verilerini getir
async function fetchProfileData(url) {
  const username = await getInstagramUsername(url);
  return getInstagramUserInfo(username);
}

// Instagram HD profil fotoğrafı URL'sini doğrudan API'den alan fonksiyon
async function getHdProfilePhotoUrl(instagramUserId) {
  const url = `https://i.instagram.com/api/v1/users/${instagramUserId}/info/`;
  const userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0.0';

  // MANIFEST V3 Değişikliği: fetch'ten önce User-Agent kuralını ayarla
  await updateUserAgentRule(userAgent);
  
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram API yanıtı başarısız oldu: ${res.status} - ${text}`);
  }
  const out = await res.json();
  
  if (out.user && out.user.hd_profile_pic_url_info && out.user.hd_profile_pic_url_info.url) {
    return out.user.hd_profile_pic_url_info.url;
  } else {
    throw new Error("API yanıtında HD profil fotoğrafı URL'si bulunamadı.");
  }
}

// OPTİMİZASYON: Bu fonksiyonlar artık async ve chrome.storage'dan veri okuyor.
// HD profil fotoğrafını yeni sekmede aç
async function openHdProfilePhoto() {
  const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
  if (cachedProfile && cachedProfile.id) {
    try {
      const hdUrl = await getHdProfilePhotoUrl(cachedProfile.id);
      chrome.tabs.create({ url: hdUrl });
    } catch (error) {
      console.error("WeXProfile Error opening HD photo:", error);
      sendNotification("Hata", `HD profil fotoğrafı açılırken bir hata oluştu: ${error.message}`);
    }
  } else {
    sendNotification("Hata", "Önbellekte profil verisi bulunamadı veya kullanıcı ID'si eksik.");
  }
}

// Profil fotoğrafını indir
async function downloadProfilePhoto() {
  const { cachedProfile } = await chrome.storage.local.get('cachedProfile');
  if (cachedProfile && cachedProfile.id && cachedProfile.username) {
    try {
      const hdUrl = await getHdProfilePhotoUrl(cachedProfile.id);
      chrome.downloads.download({
        url: hdUrl,
        filename: `instagram_${cachedProfile.username}_hd.jpg`,
        conflictAction: 'uniquify',
        saveAs: true
      });
    } catch (error) {
      console.error("WeXProfile Error downloading HD photo:", error);
      sendNotification("Hata", `Profil fotoğrafı indirilirken bir hata oluştu: ${error.message}`);
    }
  } else {
    sendNotification("Hata", "Önbellekte profil verisi bulunamadı veya kullanıcı adı eksik.");
  }
}

// KALDIRILDI: chrome.webRequest.onBeforeSendHeaders...
// Bu blok Manifest V3'te çalışmadığı için tamamen kaldırıldı ve yerine
// updateUserAgentRule ve declarativeNetRequest API'ı kullanıldı.

// Bildirim gönder
function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: title,
    message: message,
    priority: 2
  });
}

// Popup'tan gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getProfileData':
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTabUrl = tabs[0] ? tabs[0].url : null;
        if (!activeTabUrl || !activeTabUrl.includes("instagram.com")) {
          sendResponse({ success: false, error: "Lütfen bir Instagram profil sayfasında kullanın." });
          return;
        }

        try {
          let dataToReturn;
          // Senaryo 1: Devam eden bir fetch işlemi varsa bekle.
          if (currentProfileFetchPromise && currentProfileFetchUrl === activeTabUrl) {
            console.log("getProfileData: Devam eden fetch bekleniyor.");
            dataToReturn = await currentProfileFetchPromise;
          } else {
            // Senaryo 2: chrome.storage'daki önbelleği kontrol et.
            const { cachedProfile, cacheUrl } = await chrome.storage.local.get(['cachedProfile', 'cacheUrl']);
            if (cachedProfile && cacheUrl === activeTabUrl) {
              console.log("getProfileData: Önbellekteki veri kullanılıyor.");
              dataToReturn = cachedProfile;
            } else {
              // Senaryo 3: Hiçbiri yoksa yeni veri çek.
              console.log("getProfileData: Yeni veri çekiliyor.");
              dataToReturn = await handleProfileAnalysis(activeTabUrl, tabs[0].id, false);
            }
          }
          sendResponse({ success: true, data: dataToReturn });
        } catch (error) {
          console.error("getProfileData mesajında hata:", error);
          sendResponse({ success: false, error: error.message });
        }
      });
      return true; // Asenkron yanıt için true döndür.

    case 'openHdPhoto':
      openHdProfilePhoto(); // Bu artık async ama cevabı beklemesine gerek yok.
      sendResponse({ success: true });
      break;

    case 'downloadPhoto':
      downloadProfilePhoto(); // Bu da async ama cevabı beklemesine gerek yok.
      sendResponse({ success: true });
      break;

    case 'toggleDarkMode':
      chrome.storage.sync.set({ darkMode: request.value }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'getDarkMode':
      chrome.storage.sync.get(['darkMode'], (result) => {
        sendResponse({ success: true, value: result.darkMode });
      });
      return true;

    default:
      sendResponse({ success: false, error: "Bilinmeyen eylem" });
  }
});