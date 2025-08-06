// popup.js

document.addEventListener('DOMContentLoaded', function() {
  // Element referansları
  const profilePic = document.getElementById('profilePic');
  const usernameEl = document.getElementById('username');
  const fullNameEl = document.getElementById('fullName');
  const bioEl = document.getElementById('bio');
  const postsCountEl = document.getElementById('postsCount');
  const followersCountEl = document.getElementById('followersCount');
  const followingCountEl = document.getElementById('followingCount');
  const followersChangeEl = document.getElementById('followersChange');
  const followingChangeEl = document.getElementById('followingChange');
  const openHdBtn = document.getElementById('openHdBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  const themeToggle = document.getElementById('themeToggle');
  const settingsBtn = document.getElementById('settingsBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const loader = document.querySelector('.loader');
  const profileContainer = document.querySelector('.profile-container');
  const appContainer = document.querySelector('.app-container');
  const githubBtn = document.getElementById('githubBtn');

  // Ayarlar popup referansları
  const settingsPopup = document.getElementById('settingsPopup');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const fontSelect = document.getElementById('fontSelect');
  const themeOptions = document.querySelectorAll('.theme-option');
  const languageSelect = document.getElementById('languageSelect');
  const buttonStyleToggle = document.getElementById('buttonStyleToggle');
  const followerChangeToggle = document.getElementById('followerChangeToggle');

  // Güncelleme referansları
  const updateNotification = document.getElementById('updateNotification');
  const latestVersionEl = document.getElementById('latestVersion');
  const updateBtn = document.getElementById('updateBtn');

  // Varsayılan ayarlar
  let currentSettings = {
    darkMode: true,
    fontFamily: "'Poppins', sans-serif",
    themeTemplate: 'default',
    buttonStyle: 'modern',
    showFollowerChange: true,
    language: 'tr'
  };
  
  // -- Fonksiyonlar --
  
  function applySettings(settings) {
    currentSettings = settings;
    
    // Tema (Açık/Koyu)
    document.body.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
    
    // Yazı Tipi
    document.body.style.setProperty('--global-font', settings.fontFamily);
    
    // Renk Teması Şablonu
    applyThemeTemplate(settings.themeTemplate, settings.darkMode);

    // Buton Stili
    appContainer.setAttribute('data-button-style', settings.buttonStyle === 'classic' ? 'classic' : 'modern');
    
    // UI elemanlarını ayarla
    fontSelect.value = settings.fontFamily;
    languageSelect.value = settings.language;
    buttonStyleToggle.checked = settings.buttonStyle === 'classic';
    followerChangeToggle.checked = settings.showFollowerChange;
    document.querySelector('.theme-option.active')?.classList.remove('active');
    document.querySelector(`.theme-option[data-theme="${settings.themeTemplate}"]`)?.classList.add('active');
  }
  
  function applyThemeTemplate(template, isDarkMode) {
    const root = document.documentElement;
    // Farklı temaların açık ve koyu mod renklerini tanımla
    const themes = {
      default: { light: ['linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', 'linear-gradient(45deg, #405DE6, #5851DB)'], dark: ['linear-gradient(45deg, #0095f6, #5851db)', 'linear-gradient(45deg, #385185, #1e1e1e)'] },
      blue: { light: ['linear-gradient(45deg, #0095f6, #0076a8)', 'linear-gradient(45deg, #0076a8, #005f7f)'], dark: ['linear-gradient(45deg, #42a5f5, #2196f3)', 'linear-gradient(45deg, #2196f3, #0d47a1)'] },
      green: { light: ['linear-gradient(45deg, #4CAF50, #2E7D32)', 'linear-gradient(45deg, #2E7D32, #1B5E20)'], dark: ['linear-gradient(45deg, #81c784, #4caf50)', 'linear-gradient(45deg, #4caf50, #1b5e20)'] },
      purple: { light: ['linear-gradient(45deg, #673AB7, #4527A0)', 'linear-gradient(45deg, #4527A0, #311B92)'], dark: ['linear-gradient(45deg, #9575cd, #673ab7)', 'linear-gradient(45deg, #673ab7, #311b92)'] },
      pink: { light: ['linear-gradient(45deg, #ff69b4, #ff1493)', 'linear-gradient(45deg, #ff1493, #c71585)'], dark: ['linear-gradient(45deg, #ff80ab, #ff4081)', 'linear-gradient(45deg, #ff4081, #d81b60)'] }
    };

    const selectedTheme = themes[template] || themes.default;
    const [primary, secondary] = isDarkMode ? selectedTheme.dark : selectedTheme.light;

    root.style.setProperty('--primary-gradient', primary);
    root.style.setProperty('--secondary-gradient', secondary);
  }

  async function localizeHtml(lang = 'tr') {
    try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Dil dosyası yüklenemedi: ${lang}. Varsayılan (tr) kullanılıyor.`);
            if (lang !== 'tr') return localizeHtml('tr'); // Hata durumunda Türkçe'ye dön
            return;
        }
        const messages = await response.json();
        
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            if (messages[key]) {
                element.textContent = messages[key].message;
            }
        });
        // Title'ları da güncelle
        usernameEl.title = messages.copyUsernameTitle.message;
        themeToggle.title = messages.changeThemeTitle.message;
        settingsBtn.title = messages.settingsTitle.message;
        clearHistoryBtn.title = messages.clearHistoryTitle.message;
        downloadJsonBtn.title = messages.downloadJsonTitle.message;
        githubBtn.title = messages.githubTitle.message;
    } catch(e) {
        console.error("Dil dosyası işlenirken hata oluştu:", e);
    }
  }
  
  function saveSettings() {
    chrome.runtime.sendMessage({ action: 'setSettings', settings: currentSettings });
  }

  function displayProfileData(data) {
    loader.style.display = 'block';
    profilePic.classList.remove('loaded');

    // Önceki badge'leri temizle
    usernameEl.innerHTML = `@${data.username}`; 
    fullNameEl.textContent = data.fullName;

    usernameEl.addEventListener('click', () => {
        navigator.clipboard.writeText(data.username).then(async () => {
            const originalText = usernameEl.title;
            const copiedText = (await getMessage('copiedText')) || "Kopyalandı!";
            usernameEl.title = copiedText;
            setTimeout(() => { usernameEl.title = originalText; }, 1500);
        });
    });

    if (data.isVerified) {
      const verifiedBadge = document.createElement('i');
      verifiedBadge.className = 'fas fa-check-circle verified-badge';
      usernameEl.appendChild(verifiedBadge);
    }
    if (data.isPrivate) {
      const privateBadge = document.createElement('span');
      privateBadge.className = 'private-badge';
      privateBadge.textContent = "Gizli"; // Bu sabit kalabilir, localize edilebilir.
      usernameEl.appendChild(privateBadge);
    }

    bioEl.textContent = data.biography || "Biyografi yok.";
    postsCountEl.textContent = formatNumber(data.posts);
    followersCountEl.textContent = formatNumber(data.followers);
    followingCountEl.textContent = formatNumber(data.following);

    if (currentSettings.showFollowerChange) {
      displayChange(followersChangeEl, data.followerChange);
      displayChange(followingChangeEl, data.followingChange);
    } else {
      followersChangeEl.style.display = 'none';
      followingChangeEl.style.display = 'none';
    }


    if (data.profilePicUrlForPreview) {
      profilePic.src = data.profilePicUrlForPreview;
      profilePic.onload = () => {
        profilePic.classList.add('loaded');
        loader.style.display = 'none';
      };
      profilePic.onerror = () => {
        loader.style.display = 'none';
        showError("Profil fotoğrafı yüklenemedi.");
      }
    } else {
      loader.style.display = 'none';
      showError("Profil fotoğrafı verisi alınamadı.");
    }
    
    // Butonları tekrar etkinleştir
    openHdBtn.disabled = false;
    downloadBtn.disabled = false;
    downloadJsonBtn.disabled = false;
  }
  
  function displayChange(element, change) {
    element.textContent = '';
    element.className = 'change-indicator';
    element.style.display = 'inline-block'; // Görünür yap
    if (change !== 0) {
      const sign = change > 0 ? '+' : '';
      element.textContent = `${sign}${formatNumber(change)}`;
      element.classList.add(change > 0 ? 'positive' : 'negative');
    } else {
        element.style.display = 'none'; // Değişim yoksa gizle
    }
  }

  function showError(message) {
    loader.style.display = 'none';
    profileContainer.innerHTML = `
      <div class="error-message" style="text-align: center; padding: 20px; color: var(--error-color); font-size: 14px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 28px; margin-bottom: 12px; display: block;"></i>
        <p>${message}</p>
      </div>`;
    // Butonları devre dışı bırak
    openHdBtn.disabled = true;
    downloadBtn.disabled = true;
    downloadJsonBtn.disabled = true;
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString('tr-TR');
  }

  async function getMessage(key) {
      const url = chrome.runtime.getURL(`_locales/${currentSettings.language}/messages.json`);
      const response = await fetch(url);
      const messages = await response.json();
      return messages[key]?.message;
  }
  
  // -- Olay Dinleyicileri --

  // Ayarları ve güncellemeleri yükle
  chrome.runtime.sendMessage({ action: 'getSettingsAndUpdates' }, (response) => {
    if (response && response.success) {
      applySettings(response.settings);
      localizeHtml(response.settings.language);

      if (response.updateInfo.hasUpdate) {
        latestVersionEl.textContent = response.updateInfo.latestVersion;
        updateNotification.style.display = 'flex';
      }
    }
  });

  // Popup açıldığında profil verisini çek
  chrome.runtime.sendMessage({ action: 'getProfileData' }, function(response) {
    if (chrome.runtime.lastError) {
        showError("Beklenmedik bir hata oluştu: " + chrome.runtime.lastError.message);
        return;
    }
    if (response && response.success) {
      displayProfileData(response.data);
    } else {
      showError(response.error || "Profil verileri alınamadı. Sayfayı yenileyip tekrar deneyin.");
    }
  });

  themeToggle.addEventListener('click', function() {
    currentSettings.darkMode = !currentSettings.darkMode;
    saveSettings();
    applySettings(currentSettings);
  });
  
  settingsBtn.addEventListener('click', () => settingsPopup.style.display = 'flex');
  closeSettingsBtn.addEventListener('click', () => settingsPopup.style.display = 'none');
  
  fontSelect.addEventListener('change', (e) => {
    currentSettings.fontFamily = e.target.value;
    saveSettings();
    applySettings(currentSettings);
  });

  languageSelect.addEventListener('change', (e) => {
    currentSettings.language = e.target.value;
    saveSettings();
    localizeHtml(currentSettings.language);
  });
  
  buttonStyleToggle.addEventListener('change', (e) => {
    currentSettings.buttonStyle = e.target.checked ? 'classic' : 'modern';
    saveSettings();
    applySettings(currentSettings);
  });

  followerChangeToggle.addEventListener('change', (e) => {
    currentSettings.showFollowerChange = e.target.checked;
    saveSettings();
    // Veriyi yeniden render etmeye gerek yok, sadece göstergeyi gizle/göster
    const displayValue = e.target.checked ? 'inline-block' : 'none';
    followersChangeEl.style.display = displayValue;
    followingChangeEl.style.display = displayValue;
    // Eğer o an değişim 0 ise zaten gizlidir, bu yüzden tekrar render etmeye gerek yok.
    // Eğer render gerekirse `getProfileData` tekrar çağrılabilir.
  });
  
  themeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSettings.themeTemplate = btn.dataset.theme;
      saveSettings();
      applySettings(currentSettings);
    });
  });

  githubBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openGithub' }));
  updateBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openGithub' }));
  
  openHdBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openHdPhoto' }));
  downloadBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadPhoto' }));
  downloadJsonBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadJSON' }));

  clearHistoryBtn.addEventListener('click', async () => {
    const confirmationMessage = (await getMessage('clearHistoryConfirm')) || "Emin misiniz?";
    if (confirm(confirmationMessage)) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, (response) => {
        if (response && response.success) {
          window.location.reload();
        }
      });
    }
  });

  // Popup açıldığında güncelleme kontrolünü tekrar tetikle
  chrome.runtime.sendMessage({ action: 'checkUpdatesNow' });
});