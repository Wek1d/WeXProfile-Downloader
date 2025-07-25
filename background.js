// Global değişkenler
let currentModifyUserAgent = '';
let cachedProfileData = null;
let currentProfileUrl = '';

// Kanka, bu iki yeni değişken çok önemli!
// O anki aktif veri çekme işleminin Promise'ini tutar.
let currentProfileFetchPromise = null;
// Bu Promise'in hangi URL için başladığını tutar.
let currentProfileFetchUrl = null;


// Uzantı yüklendiğinde sağ tık menüsünü oluştur
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wexProfileDownload",
    title: "WeXProfile ile Profil Bilgilerini Göster",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.instagram.com/*"]
  });

  // Varsayılan ayarları kaydet
  chrome.storage.sync.set({ darkMode: true });
});

// Sağ tık menüsüne tıklanınca
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wexProfileDownload" && tab.url.includes("instagram.com")) {
    // Sağ tık menüsünden tetiklendiğinde de yeni veri çekme işlemini başlat
    handleProfileAnalysis(tab.url, tab.id, true);
  }
});

// Browser action (eklenti ikonuna) tıklanınca
chrome.browserAction.onClicked.addListener((tab) => {
  // Aktif sekmeyi sorgula
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url.includes("instagram.com")) {
      // Eklenti ikonundan geldiğinde de yeni veri çekme işlemini başlat
      handleProfileAnalysis(tabs[0].url, tabs[0].id, false);
    } else {
      sendNotification("Hata", "Lütfen bir Instagram profil sayfasında kullanın.");
    }
  });
});

// Profil analizini başlat
// isContextMenuClick: Bu çağrının sağ tık menüsünden mi geldiğini belirler
async function handleProfileAnalysis(url, tabId, isContextMenuClick) {
  currentProfileUrl = url; // Aktif URL'yi global değişkene kaydet

  // Eğer bu URL için zaten bir çekim devam ediyorsa, mevcut Promise'i döndür
  if (currentProfileFetchPromise && currentProfileFetchUrl === url) {
    console.log("Aynı URL için zaten veri çekiliyor, mevcut işlemi bekliyor.");
    return currentProfileFetchPromise;
  }

  // Yeni bir çekim başlat, Promise'ini sakla
  currentProfileFetchUrl = url; // Yeni çekimin URL'sini kaydet
  currentProfileFetchPromise = fetchProfileData(url)
    .then(data => {
      cachedProfileData = data; // Çekilen veriyi cache'le
      // Popup'ı ayarla (popup zaten açıksa güncellenir)
      chrome.browserAction.setPopup({ tabId: tabId, popup: "popup.html" }, () => {
        if (chrome.runtime.lastError) {
          console.error("Popup setleme hatası:", chrome.runtime.lastError.message);
          // sendNotification("Hata", "Popup açılamadı. Lütfen tekrar deneyin."); // Gereksiz bildirim
        } else {
          if (isContextMenuClick) {
            // Sağ tık ile başlatıldığında kullanıcıya bildirim gönder
            sendNotification("Bilgi", "Profil bilgileri hazır! Detayları görmek için lütfen WeXProfile eklenti ikonuna tıklayın.");
          }
        }
      });
      return data; // Zincirleme için veriyi döndür
    })
    .catch(error => {
      console.error("WeXProfile Error:", error);
      sendNotification("Hata", `Profil bilgileri alınırken bir hata oluştu: ${error.message}`);
      cachedProfileData = null; // Hata durumunda önbelleği temizle
      currentProfileUrl = ''; // Hata durumunda URL'yi temizle
      currentProfileFetchUrl = null; // Hata durumunda Fetch URL'yi temizle
      throw error; // Hatayı yay
    })
    .finally(() => {
      // İşlem bittiğinde Promise'i temizleme,
      // çünkü popup'tan gelen getProfileData isteği onu bekleyebilir.
      // currentProfileFetchPromise sadece yeni bir çekim başladığında veya
      // hata durumunda null/yeni atanmalı.
    });
  
  return currentProfileFetchPromise; // Başlatılan Promise'i döndür
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
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to Data URL:", error);
    return null; // Hata durumunda null döndür
  }
}

// Instagram kullanıcı bilgilerini API'den al (genel profil bilgileri ve küçük önizleme için)
async function getInstagramUserInfo(username) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  currentModifyUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Instagram API yanıtı başarısız oldu: ${res.status} - ${text}`);
    }
    const out = await res.json();

    if (out.data && out.data.user) {
      const user = out.data.user;
      
      // Popup önizlemesi için küçük profil resmini Base64 olarak çek
      const profilePicDataURL = await fetchImageAsDataURL(user.profile_pic_url); // KÜÇÜK RESMİ BASE64 OLARAK ÇEKİYORUZ!

      const profileData = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        biography: user.biography,
        followers: user.edge_followed_by?.count || 0,
        following: user.edge_follow?.count || 0,
        posts: user.edge_owner_to_timeline_media?.count || 0,
        isPrivate: user.is_private,
        isVerified: user.is_verified,
        profilePicUrlForPreview: profilePicDataURL // ARTIK BU BİR BASE64 DATA URL'İ
      };
      return profileData; // Promise olarak döndürmek yerine direkt değeri döndürüyoruz (async/await)
    } else {
      throw new Error("API yanıtında kullanıcı bilgileri bulunamadı.");
    }
  } catch (err) {
    throw err;
  }
}

// Profil verilerini getir (bu fonksiyon artık async)
async function fetchProfileData(url) {
  const username = await getInstagramUsername(url);
  return getInstagramUserInfo(username); // Bu zaten async bir fonksiyon döndürüyor
}

// Instagram kullanıcı ID'sini API'den alan fonksiyon (HD fotoğraf çekmek için gerekli)
function getInstagramUserIdFromApi(username) {
  return new Promise((resolve, reject) => {
    let url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    currentModifyUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0';

    fetch(url)
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => { throw new Error(`Instagram API yanıtı başarısız oldu: ${res.status} - ${text}`); });
        }
        return res.json();
      })
      .then(out => {
        if (out.data && out.data.user && out.data.user.id) {
          resolve(out.data.user.id);
        } else {
          reject(new Error("API yanıtında kullanıcı ID'si bulunamadı. Profil gizli olabilir veya yanlış URL."));
        }
      })
      .catch(err => reject(err));
  });
}

// Instagram HD profil fotoğrafı URL'sini doğrudan API'den alan fonksiyon (EN YÜKSEK ÇÖZÜNÜRLÜK İÇİN)
function getHdProfilePhotoUrl(instagram_user_id) {
  return new Promise((resolve, reject) => {
    let url = `https://i.instagram.com/api/v1/users/${instagram_user_id}/info/`;
    currentModifyUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0.0';

    fetch(url)
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => { throw new Error(`Instagram API yanıtı başarısız oldu: ${res.status} - ${text}`); });
        }
        return res.json();
      })
      .then(out => {
        console.log("Instagram HD API Response:", out);
        if (out.user && out.user.hd_profile_pic_url_info && out.user.hd_profile_pic_url_info.url) {
          resolve(out.user.hd_profile_pic_url_info.url);
        } else {
          reject(new Error("API yanıtında HD profil fotoğrafı URL'si bulunamadı."));
        }
      })
      .catch(err => reject(err));
  });
}

// HD profil fotoğrafını yeni sekmede aç (Her zaman en yüksek çözünürlüklü olanı çeker)
function openHdProfilePhoto() {
  if (cachedProfileData && cachedProfileData.username) {
    getInstagramUserIdFromApi(cachedProfileData.username)
      .then(getHdProfilePhotoUrl)
      .then(hdUrl => {
        chrome.tabs.create({ url: hdUrl });
      })
      .catch(error => {
        console.error("WeXProfile Error opening HD photo:", error);
        sendNotification("Hata", `HD profil fotoğrafı açılırken bir hata oluştu: ${error.message}`);
      });
  } else {
    sendNotification("Hata", "Profil verisi bulunamadı veya kullanıcı adı eksik.");
  }
}

// Profil fotoğrafını indir (Her zaman en yüksek çözünürlüklü olanı çeker)
function downloadProfilePhoto() {
  if (cachedProfileData && cachedProfileData.username) {
    getInstagramUserIdFromApi(cachedProfileData.username)
      .then(getHdProfilePhotoUrl)
      .then(hdUrl => {
        chrome.downloads.download({
          url: hdUrl,
          filename: `instagram_${cachedProfileData.username}_hd.jpg`,
          conflictAction: 'uniquify',
          saveAs: true
        });
      })
      .catch(error => {
        console.error("WeXProfile Error downloading HD photo:", error);
        sendNotification("Hata", `Profil fotoğrafı indirilirken bir hata oluştu: ${error.message}`);
      });
  } else {
    sendNotification("Hata", "Profil verisi bulunamadı veya kullanıcı adı eksik.");
  }
}

// User-Agent değiştirme
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (details.url.includes('i.instagram.com/api/v1/users/') && currentModifyUserAgent) {
      for (var i = 0; i < details.requestHeaders.length; ++i) {
        if (details.requestHeaders[i].name.toLowerCase() === 'user-agent') {
          details.requestHeaders[i].value = currentModifyUserAgent;
          break;
        }
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['https://i.instagram.com/api/v1/users/*'] },
  ['blocking', 'requestHeaders']
);

// Bildirim gönder
function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png", // Varsayılan ikon yolu
    title: title,
    message: message,
    priority: 2
  });
}

// Popup'tan gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getProfileData':
      // Kanka, işte burası kritik yer, iyi dinle!
      chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
        const activeTabUrl = tabs[0] ? tabs[0].url : null;
        
        if (activeTabUrl && activeTabUrl.includes("instagram.com")) {
          try {
            let dataToReturn;
            // Senaryo 1: Eğer o anki URL için zaten bir veri çekme işlemi devam ediyorsa
            if (currentProfileFetchPromise && currentProfileFetchUrl === activeTabUrl) {
              console.log("getProfileData: Aynı URL için devam eden fetch bekleniyor.");
              dataToReturn = await currentProfileFetchPromise; // Mevcut işlemin bitmesini bekle
            } 
            // Senaryo 2: Devam eden bir fetch yok, ama önbellekteki veri mevcut URL'ye aitse
            else if (cachedProfileData && currentProfileUrl === activeTabUrl) {
              console.log("getProfileData: Önbellekteki güncel veri kullanılıyor.");
              dataToReturn = cachedProfileData;
            }
            // Senaryo 3: Yeni veri çekmek gerekiyor (ya hiç veri yok, ya da farklı bir URL'ye ait eski veri var)
            else {
              console.log("getProfileData: Yeni veri çekiliyor.");
              // handleProfileAnalysis çağırarak yeni bir çekim başlat ve promise'ini bekle
              dataToReturn = await handleProfileAnalysis(activeTabUrl, tabs[0].id, false); 
            }
            sendResponse({ success: true, data: dataToReturn });
          } catch (error) {
            console.error("getProfileData mesajında hata:", error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: "Lütfen bir Instagram profil sayfasında kullanın." });
        }
      });
      return true; // Asenkron yanıt için true döndür
    case 'openHdPhoto':
      openHdProfilePhoto();
      sendResponse({ success: true });
      break;
    case 'downloadPhoto':
      downloadProfilePhoto();
      sendResponse({ success: true });
      break;
    case 'toggleDarkMode':
      chrome.storage.sync.set({ darkMode: request.value }, () => {
        sendResponse({ success: true });
      });
      return true;
    case 'getDarkMode':
      chrome.storage.sync.get(['darkMode'], function(result) {
        sendResponse({ success: true, value: result.darkMode });
      });
      return true;
    default:
      sendResponse({ success: false, error: "Bilinmeyen eylem" });
  }
});