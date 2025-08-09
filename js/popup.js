// js/popup.js

document.addEventListener('DOMContentLoaded', function() {
  // --- Element Referansları ---
  const profileView = document.getElementById('profileView');
  const unfinderView = document.getElementById('unfinderView');
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
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const loader = document.querySelector('.loader');
  const profileContainer = document.querySelector('.profile-container');
  const githubBtn = document.getElementById('githubBtn');
  const updateNotification = document.getElementById('updateNotification');
  const latestVersionEl = document.getElementById('latestVersion');
  const updateBtn = document.getElementById('updateBtn');
  const versionEl = document.querySelector('.version');
  const unfollowerBtn = document.getElementById('unfollowerBtn');
  const backToProfileBtn = document.getElementById('backToProfileBtn');
  const themeToggle = document.getElementById('themeToggle');
  const settingsBtn = document.getElementById('settingsBtn');
  const unfinderStatusText = document.getElementById('unfinder-status-text');
  const unfinderProgressBarContainer = document.getElementById('unfinder-progress-bar');
  const unfinderProgressBar = unfinderProgressBarContainer.querySelector('.progress-bar');
  const unfinderList = document.getElementById('unfinder-list');
  const startScanBtn = document.getElementById('startScanBtn');
  const pauseScanBtn = document.getElementById('pauseScanBtn');
  const resumeScanBtn = document.getElementById('resumeScanBtn');
  const unfollowSelectedBtn = document.getElementById('unfollowSelectedBtn');
  const unfollowSelectedCountEl = document.getElementById('unfollow-selected-count');
  const settingsPopup = document.getElementById('settingsPopup');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const fontSelect = document.getElementById('fontSelect');
  const themeOptions = document.querySelectorAll('.theme-option');
  const languageSelect = document.getElementById('languageSelect');
  const buttonStyleToggle = document.getElementById('buttonStyleToggle');
  const followerChangeToggle = document.getElementById('followerChangeToggle');

  let currentSettings = {};
  let unfollowerData = [];
  
  // --- Fonksiyonlar ---
  
  // Modern toast notification
  function showToast(message, type = "info") {
    let toast = document.getElementById('wex-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wex-toast';
      toast.style.position = 'fixed';
      toast.style.top = '18px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = type === "error" ? "linear-gradient(90deg,#ed4956,#a02d37)" : "linear-gradient(90deg,#405DE6,#5851DB)";
      toast.style.color = "#fff";
      toast.style.padding = '10px 22px';
      toast.style.borderRadius = '24px';
      toast.style.fontWeight = '600';
      toast.style.fontSize = '15px';
      toast.style.zIndex = '9999';
      toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 1700);
  }

  function setVersionFromManifest() {
    if (versionEl) {
        versionEl.textContent = `v3.2.1`;
    }
  }

  function switchView(viewToShow) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    viewToShow.classList.add('active-view');
  }

  function applySettings(settings) {
    currentSettings = settings;
    document.body.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
    document.body.style.setProperty('--global-font', settings.fontFamily);
    // DÜZELTME: Buton stilini tüm body'e uygulayarak popup içindeki her şeyin etkilenmesini sağla
    document.body.setAttribute('data-button-style', settings.buttonStyle === 'classic' ? 'classic' : 'modern');
    applyThemeTemplate(settings.themeTemplate, settings.darkMode);
    
    // Ayar menüsündeki elemanları güncelle
    fontSelect.value = settings.fontFamily;
    languageSelect.value = settings.language;
    buttonStyleToggle.checked = settings.buttonStyle === 'classic';
    followerChangeToggle.checked = settings.showFollowerChange;
    
    const currentActiveTheme = document.querySelector('.theme-option.active');
    if (currentActiveTheme) {
      currentActiveTheme.classList.remove('active');
    }
    const newActiveTheme = document.querySelector(`.theme-option[data-theme="${settings.themeTemplate}"]`);
    if (newActiveTheme) {
      newActiveTheme.classList.add('active');
    }
  }
  
  function applyThemeTemplate(template, isDarkMode) {
    const themes = {
      default: { light: ['linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', 'linear-gradient(45deg, #405DE6, #5851DB)', '#dc2743'], dark: ['linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', 'linear-gradient(45deg, #405DE6, #5851DB)', '#dc2743'] },
      blue: { light: ['linear-gradient(45deg, #0095f6, #0076a8)', 'linear-gradient(45deg, #0076a8, #005f7f)', '#0095f6'], dark: ['linear-gradient(45deg, #42a5f5, #2196f3)', 'linear-gradient(45deg, #2196f3, #0d47a1)', '#2196f3'] },
      green: { light: ['linear-gradient(45deg, #4CAF50, #2E7D32)', 'linear-gradient(45deg, #2E7D32, #1B5E20)', '#4CAF50'], dark: ['linear-gradient(45deg, #81c784, #4caf50)', 'linear-gradient(45deg, #4caf50, #1b5e20)', '#4caf50'] },
      purple: { light: ['linear-gradient(45deg, #673AB7, #4527A0)', 'linear-gradient(45deg, #4527A0, #311B92)', '#673AB7'], dark: ['linear-gradient(45deg, #9575cd, #673ab7)', 'linear-gradient(45deg, #673ab7, #311b92)', '#673ab7'] },
      pink: { light: ['linear-gradient(45deg, #ff69b4, #ff1493)', 'linear-gradient(45deg, #ff1493, #c71585)', '#ff1493'], dark: ['linear-gradient(45deg, #ff80ab, #ff4081)', 'linear-gradient(45deg, #ff4081, #d81b60)', '#ff4081'] }
    };
    const root = document.documentElement;
    const selected = themes[template] || themes.default;
    const [primary, secondary, checkColor] = isDarkMode ? selected.dark : selected.light;
    root.style.setProperty('--primary-gradient', primary);
    root.style.setProperty('--secondary-gradient', secondary);
    root.style.setProperty('--primary-color-for-check', checkColor);
  }

  async function localizeHtml(lang = 'tr') {
    try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Dil dosyası yüklenemedi: ${response.statusText}`);
        const messages = await response.json();
        document.querySelectorAll('[data-i18n]').forEach(el => {
            if (messages[el.dataset.i18n]) {
              const msg = messages[el.dataset.i18n].message;
              const span = el.querySelector('span');
              if (el.tagName === 'BUTTON' && span && !span.id) { // id'li span'lar hariç (unfollow-selected-count)
                  span.textContent = msg;
              } else {
                  el.textContent = msg;
              }
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
          if (messages[el.dataset.i18nTitle]) {
            el.title = messages[el.dataset.i18nTitle].message;
          }
        });

    } catch(e) { console.error("Dil hatası:", e); }
  }
  
  function saveSettings() {
    chrome.runtime.sendMessage({ action: 'setSettings', settings: currentSettings });
  }

  function displayProfileData(data) {
    loader.style.display = 'block';
    profilePic.style.opacity = '0';

    // Biyografi linkli ise düzgün göster
    let bioHtml = data.biography || (currentSettings.language === 'tr' ? 'Biyografi yok.' : 'No biography.');
    if (bioHtml && typeof bioHtml === "string") {
      // Linkleri otomatik algıla
      bioHtml = bioHtml.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#405DE6;text-decoration:underline;">$1</a>');
    }
    usernameEl.innerHTML = `@${data.username}`; 
    if (data.isVerified) usernameEl.innerHTML += ' <i class="fas fa-check-circle verified-badge"></i>';
    if (data.isPrivate) usernameEl.innerHTML += ` <span class="private-badge">${currentSettings.language === 'tr' ? 'Gizli' : 'Private'}</span>`;

    fullNameEl.textContent = data.fullName;
    bioEl.innerHTML = bioHtml;
    postsCountEl.textContent = formatNumber(data.posts);
    followersCountEl.textContent = formatNumber(data.followers);
    followingCountEl.textContent = formatNumber(data.following);
    
    followersChangeEl.style.display = 'none';
    followingChangeEl.style.display = 'none';
    if (currentSettings.showFollowerChange) {
      displayChange(followersChangeEl, data.followerChange);
      displayChange(followingChangeEl, data.followingChange);
    }

    profilePic.src = data.profilePicUrlForPreview || '';
    profilePic.onload = () => { profilePic.style.opacity = '1'; loader.style.display = 'none'; };
    profilePic.onerror = () => { loader.style.display = 'none'; showError(currentSettings.language === 'tr' ? "Profil fotoğrafı yüklenemedi." : "Failed to load profile picture."); }
  }
  
  function displayChange(element, change) {
    element.textContent = '';
    element.className = 'change-indicator';
    if (change !== 0) {
      element.style.display = 'inline-block';
      element.textContent = `${change > 0 ? '+' : ''}${formatNumber(change)}`;
      element.classList.add(change > 0 ? 'positive' : 'negative');
    } else {
      element.style.display = 'none';
    }
  }

  function showError(message) {
    loader.style.display = 'none';
    profileContainer.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><p>${message}</p></div>`;
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return num;
    const lang = currentSettings.language || 'tr';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString(lang + '-' + lang.toUpperCase());
  }

  function updateSelectedCount() {
    const count = unfinderList.querySelectorAll('.unfinder-item-checkbox:checked').length;
    unfollowSelectedCountEl.textContent = count;
    unfollowSelectedBtn.disabled = count === 0;
  }
  
  // --- Olay Dinleyicileri ve Başlatma ---
  
  setVersionFromManifest();

  chrome.runtime.sendMessage({ action: 'getSettingsAndUpdates' }, (response) => {
    if (response?.success) {
      applySettings(response.settings);
      localizeHtml(response.settings.language);
      if (response.updateInfo.hasUpdate) {
        latestVersionEl.textContent = response.updateInfo.latestVersion;
        updateNotification.style.display = 'flex';
      }
    }
  });

  chrome.runtime.sendMessage({ action: 'getProfileData' }, (response) => {
    if (chrome.runtime.lastError) showError("Hata: " + chrome.runtime.lastError.message);
    else if (response?.success) displayProfileData(response.data);
    else showError(response.error || "Profil verisi alınamadı.");
  });

  unfollowerBtn.addEventListener('click', () => switchView(unfinderView));
  backToProfileBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopScan' });
    switchView(profileView);
  });

  settingsBtn.addEventListener('click', () => { settingsPopup.style.display = 'flex'; });
  closeSettingsBtn.addEventListener('click', () => { settingsPopup.style.display = 'none'; });
  
  window.addEventListener('click', (e) => {
    if (e.target === settingsPopup) {
      settingsPopup.style.display = 'none';
    }
  });
  
  themeToggle.addEventListener('click', () => {
    currentSettings.darkMode = !currentSettings.darkMode;
    saveSettings();
    applySettings(currentSettings);
  });
  
  fontSelect.addEventListener('change', (e) => { currentSettings.fontFamily = e.target.value; saveSettings(); applySettings(currentSettings); });
  languageSelect.addEventListener('change', (e) => { currentSettings.language = e.target.value; saveSettings(); localizeHtml(currentSettings.language).then(() => window.location.reload()); });
  buttonStyleToggle.addEventListener('change', (e) => { currentSettings.buttonStyle = e.target.checked ? 'classic' : 'modern'; saveSettings(); applySettings(currentSettings); });
  followerChangeToggle.addEventListener('change', (e) => { currentSettings.showFollowerChange = e.target.checked; saveSettings(); window.location.reload(); });
  
  themeOptions.forEach(btn => btn.addEventListener('click', () => {
    document.querySelector('.theme-option.active')?.classList.remove('active');
    btn.classList.add('active');
    currentSettings.themeTemplate = btn.dataset.theme;
    saveSettings();
    applySettings(currentSettings);
  }));

  githubBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openGithub' }));
  updateBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openGithub' }));
  openHdBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openHdPhoto' }));
  downloadBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadPhoto' }));
  downloadJsonBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadJSON' }));
  
  clearHistoryBtn.addEventListener('click', async () => {
    const url = chrome.runtime.getURL(`_locales/${currentSettings.language}/messages.json`);
    const res = await fetch(url);
    const msgs = await res.json();
    if (confirm(msgs.clearHistoryConfirm.message)) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, () => window.location.reload());
    }
  });

  // Ayarlarda dil veya takipçi değişimini göster değişince sayfa yenilemeden uygula
  languageSelect.addEventListener('change', (e) => {
    currentSettings.language = e.target.value;
    saveSettings();
    localizeHtml(currentSettings.language).then(() => {
      chrome.runtime.sendMessage({ action: 'getProfileData' }, (response) => {
        if (chrome.runtime.lastError) showError("Hata: " + chrome.runtime.lastError.message);
        else if (response?.success) displayProfileData(response.data);
        else showError(response.error || "Profil verisi alınamadı.");
      });
      showToast(currentSettings.language === 'tr' ? "Dil değiştirildi" : "Language changed");
    });
  });
  followerChangeToggle.addEventListener('change', (e) => {
    currentSettings.showFollowerChange = e.target.checked;
    saveSettings();
    chrome.runtime.sendMessage({ action: 'getProfileData' }, (response) => {
      if (chrome.runtime.lastError) showError("Hata: " + chrome.runtime.lastError.message);
      else if (response?.success) displayProfileData(response.data);
      else showError(response.error || "Profil verisi alınamadı.");
    });
    showToast(currentSettings.language === 'tr' ? "Ayar kaydedildi" : "Setting saved");
  });

  // Kullanıcı adı ve biyografi tıklanınca panoya kopyala + toast göster
  usernameEl.addEventListener('click', () => {
    const usernameToCopy = usernameEl.textContent.split(' ')[0].replace('@','');
    navigator.clipboard.writeText(usernameToCopy);
    showToast(currentSettings.language === 'tr' ? "Kullanıcı adı kopyalandı" : "Username copied");
  });
  bioEl.addEventListener('click', () => {
    // Sadece düz metni kopyala
    const temp = document.createElement('div');
    temp.innerHTML = bioEl.innerHTML;
    const text = temp.textContent || temp.innerText || "";
    if (text.trim()) {
      navigator.clipboard.writeText(text.trim());
      showToast(currentSettings.language === 'tr' ? "Biyografi kopyalandı" : "Bio copied");
    }
  });

  // --- RAM ve ban optimizasyonları ---
  // Unfinder listesi event listener'ı sadece bir kez ekle
  let unfinderListChangeListenerAdded = false;
  function renderUnfollowerList(users) {
    unfinderList.innerHTML = '';
    unfollowerData = users;
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'unfinder-item';
        item.dataset.userId = user.id;
        item.innerHTML = `
            <img src="${user.profile_pic_url || 'icon.png'}" class="unfinder-item-pic" onerror="this.src='icon.png'">
            <div class="unfinder-item-info">
                <div class="username">${user.username} ${user.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}</div>
                <div class="fullname">${user.full_name}</div>
            </div>
            <input type="checkbox" class="unfinder-item-checkbox">
        `;
        unfinderList.appendChild(item);
    });
    if (!unfinderListChangeListenerAdded) {
      unfinderList.addEventListener('change', updateSelectedCount);
      unfinderListChangeListenerAdded = true;
    }
    updateSelectedCount();
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'scanProgress':
        const { type, scanned, total, percentage, message } = request.data;
        const lang = currentSettings.language;
        if (type === 'error') {
          unfinderStatusText.textContent = message;
        } else {
          const typeTR = type === 'following' ? (lang === 'tr' ? 'Takip edilenler' : 'Following') : (lang === 'tr' ? 'Takipçiler' : 'Followers');
          const scanningTR = lang === 'tr' ? 'taranıyor' : 'scanning';
          unfinderStatusText.textContent = `${typeTR} ${scanningTR}... (${scanned}/${total})`;
          unfinderProgressBar.style.width = `${percentage}%`;
        }
        break;
      case 'scanResult':
        renderUnfollowerList(request.data);
        break;
      case 'scanComplete':
        const { summary } = request.data;
        unfinderStatusText.textContent = `${currentSettings.language === 'tr' ? 'Tarama bitti!' : 'Scan finished!'} ${summary.unfollowers} ${currentSettings.language === 'tr' ? 'kişi seni geri takip etmiyor.' : 'people don\'t follow you back.'}`;
        pauseScanBtn.style.display = 'none';
        resumeScanBtn.style.display = 'none';
        unfollowSelectedBtn.style.display = 'flex';
        updateSelectedCount();
        break;
      case 'unfollowProgress':
        const { success, user, progress } = request.data;
        const item = unfinderList.querySelector(`.unfinder-item[data-user-id="${user.id}"]`);
        if (item) {
          item.classList.add(success ? 'unfollowed-success' : 'unfollowed-fail');
          const checkbox = item.querySelector('.unfinder-item-checkbox');
          if (checkbox) checkbox.disabled = true;
        }
        unfinderStatusText.textContent = `${currentSettings.language === 'tr' ? 'Takipten çıkılıyor' : 'Unfollowing'}... (${progress.current}/${progress.total})`;
        if (progress.current === progress.total) {
          unfinderStatusText.textContent = currentSettings.language === 'tr' ? 'İşlem tamamlandı!' : 'Operation complete!';
          unfollowSelectedBtn.disabled = false;
        }
        break;
    }
    return true;
  });
});