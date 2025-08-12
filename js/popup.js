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
  
  function setVersionFromManifest() {
    if (versionEl) {
        const manifest = chrome.runtime.getManifest();
        versionEl.textContent = `v${manifest.version}`;
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

    usernameEl.innerHTML = `@${data.username}`;
    if (data.isVerified) usernameEl.innerHTML += ' <i class="fas fa-check-circle verified-badge"></i>';
    if (data.isPrivate) usernameEl.innerHTML += ` <span class="private-badge">${currentSettings.language === 'tr' ? 'Gizli' : 'Private'}</span>`;

    fullNameEl.textContent = data.fullName;
    // Biyografi: biography_with_entities > biography > fallback
    let bio = data.biography_with_entities?.raw_text || data.biography || '';
    if (!bio) bio = (currentSettings.language === 'tr' ? 'Biyografi yok.' : 'No biography.');
    bioEl.textContent = bio;
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
    unfinderList.removeEventListener('change', updateSelectedCount);
    unfinderList.addEventListener('change', updateSelectedCount);
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
  downloadJsonBtn.addEventListener('click', openExportModal);
  
  clearHistoryBtn.addEventListener('click', async () => {
    const url = chrome.runtime.getURL(`_locales/${currentSettings.language}/messages.json`);
    const res = await fetch(url);
    const msgs = await res.json();
    if (confirm(msgs.clearHistoryConfirm.message)) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, () => window.location.reload());
    }
  });

  usernameEl.addEventListener('click', () => {
    const usernameToCopy = usernameEl.textContent.split(' ')[0].replace('@','');
    navigator.clipboard.writeText(usernameToCopy);
  });

  startScanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startUnfollowScan' });
    startScanBtn.style.display = 'none';
    pauseScanBtn.style.display = 'flex';
    unfinderProgressBarContainer.style.display = 'block';
  });
  
  pauseScanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'pauseScan' });
    pauseScanBtn.style.display = 'none';
    resumeScanBtn.style.display = 'flex';
  });
  
  resumeScanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resumeScan' });
    resumeScanBtn.style.display = 'none';
    pauseScanBtn.style.display = 'flex';
  });
  
  unfollowSelectedBtn.addEventListener('click', () => {
    const selectedUsers = [];
    unfinderList.querySelectorAll('.unfinder-item-checkbox:checked').forEach(checkbox => {
      const userId = checkbox.closest('.unfinder-item').dataset.userId;
      const user = unfollowerData.find(u => u.id === userId);
      if (user) selectedUsers.push(user);
    });
    if (selectedUsers.length > 0) {
      chrome.runtime.sendMessage({ action: 'unfollowSelected', users: selectedUsers });
      unfollowSelectedBtn.disabled = true;
    }
  });

  // --- YENİ: JSON Modal ve Grafik Paneli için DOM ekle ---
  // Modal ve panel HTML'i ekle
  const modalHtml = `
    <div id="exportModal" class="wex-modal" style="display:none;">
      <div class="wex-modal-content">
        <div class="wex-modal-header">
          <span class="wex-modal-title">Veri Dışa Aktar</span>
          <button class="wex-modal-close">&times;</button>
        </div>
        <div class="wex-modal-body">
          <label><input type="radio" name="exportFormat" value="json" checked> JSON</label>
          <label><input type="radio" name="exportFormat" value="csv"> CSV</label>
          <label><input type="radio" name="exportFormat" value="txt"> TXT</label>
        </div>
        <div class="wex-modal-footer">
          <button class="wex-modal-download-btn btn btn-primary">İndir</button>
        </div>
      </div>
    </div>
    <div id="chartPanel" class="wex-modal" style="display:none;">
      <div class="wex-modal-content wex-chart-content">
        <div class="wex-modal-header">
          <span class="wex-modal-title">Takipçi Değişim Grafiği</span>
          <button class="wex-modal-close">&times;</button>
        </div>
        <div class="wex-modal-body">
          <div class="wex-chart-toolbar">
            <select id="chartRangeSelect">
              <option value="daily">Günlük</option>
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
            </select>
            <button id="exportChartBtn" class="btn btn-secondary" style="margin-left:8px;"><i class="fas fa-image"></i> PNG</button>
          </div>
          <div id="chartSummary" style="margin:8px 0 4px 0;"></div>
          <canvas id="followerChart" height="180"></canvas>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // --- Grafik butonunu footer'a ekle ---
  const graphBtn = document.createElement('button');
  graphBtn.id = 'chartBtn';
  graphBtn.className = 'btn-icon-footer';
  graphBtn.title = 'Takipçi Değişim Grafiği';
  graphBtn.innerHTML = '<i class="fas fa-chart-line"></i>';
  downloadJsonBtn.parentNode.insertBefore(graphBtn, downloadJsonBtn.nextSibling);

  // --- Tarama ayarları formunu ayarlar popup'ına ekle ---
  const settingsBody = document.querySelector('.settings-body');
  const scanSettingsGroup = document.createElement('div');
  scanSettingsGroup.className = 'setting-group';
  scanSettingsGroup.innerHTML = `
    <label style="margin-bottom:6px;font-weight:600;">Tarama Ayarları</label>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="flex:1;">Arama döngüleri arası (ms)</span>
        <input type="number" id="scanDelay" min="500" max="999999" style="width:80px;">
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="flex:1;">5 döngüden sonra bekleme (ms)</span>
        <input type="number" id="scanDelayAfterFive" min="4000" max="999999" style="width:80px;">
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="flex:1;">Unfollow arası (ms)</span>
        <input type="number" id="unfollowDelay" min="1000" max="999999" style="width:80px;">
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="flex:1;">5 unfollowdan sonra bekleme (ms)</span>
        <input type="number" id="unfollowDelayAfterFive" min="70000" max="999999" style="width:80px;">
      </div>
      <div style="font-size:12px;color:#ed4956;margin-top:4px;">⚠️ Değerleri düşürmek ban riskini artırır.</div>
    </div>
  `;
  settingsBody.appendChild(scanSettingsGroup);

  // --- Tarama ayarları input referansları ---
  const scanDelayInput = document.getElementById('scanDelay');
  const scanDelayAfterFiveInput = document.getElementById('scanDelayAfterFive');
  const unfollowDelayInput = document.getElementById('unfollowDelay');
  const unfollowDelayAfterFiveInput = document.getElementById('unfollowDelayAfterFive');

  // --- Tarama ayarlarını yükle ---
  function loadScanTimings() {
    chrome.storage.sync.get(['scanTimings'], (data) => {
      const timings = data.scanTimings || {
        scanDelay: 1800,
        scanDelayAfterFive: 12000,
        unfollowDelay: 4000,
        unfollowDelayAfterFive: 180000
      };
      scanDelayInput.value = timings.scanDelay;
      scanDelayAfterFiveInput.value = timings.scanDelayAfterFive;
      unfollowDelayInput.value = timings.unfollowDelay;
      unfollowDelayAfterFiveInput.value = timings.unfollowDelayAfterFive;
    });
  }
  loadScanTimings();

  // --- Tarama ayarları değişince kaydet ---
  [scanDelayInput, scanDelayAfterFiveInput, unfollowDelayInput, unfollowDelayAfterFiveInput].forEach(input => {
    input.addEventListener('change', () => {
      const timings = {
        scanDelay: Number(scanDelayInput.value),
        scanDelayAfterFive: Number(scanDelayAfterFiveInput.value),
        unfollowDelay: Number(unfollowDelayInput.value),
        unfollowDelayAfterFive: Number(unfollowDelayAfterFiveInput.value)
      };
      chrome.storage.sync.set({ scanTimings: timings }, () => {
        chrome.runtime.sendMessage({ action: 'setScanTimings', timings });
      });
    });
  });

  // --- Modal ve panel referansları ---
  const exportModal = document.getElementById('exportModal');
  const chartPanel = document.getElementById('chartPanel');
  const chartCloseBtns = document.querySelectorAll('.wex-modal-close');
  const exportDownloadBtn = exportModal.querySelector('.wex-modal-download-btn');
  const chartRangeSelect = document.getElementById('chartRangeSelect');
  const exportChartBtn = document.getElementById('exportChartBtn');
  const chartSummary = document.getElementById('chartSummary');
  let chartInstance = null;

  // --- Modal Theme ---
  function applyModalTheme() {
    const theme = currentSettings.themeTemplate || 'default';
    const dark = currentSettings.darkMode;
    [exportModal, chartPanel].forEach(modal => {
      if (!modal) return;
      modal.setAttribute('data-theme', dark ? 'dark' : 'light');
      modal.setAttribute('data-theme-template', theme);
    });
  }

  // --- Modal Aç/Kapat ---
  function openExportModal() { applyModalTheme(); exportModal.style.display = 'flex'; }
  function closeExportModal() { exportModal.style.display = 'none'; }
  function openChartPanel() { applyModalTheme(); chartPanel.style.display = 'flex'; renderChart(); }
  function closeChartPanel() { chartPanel.style.display = 'none'; if (chartInstance) { chartInstance.destroy(); chartInstance = null; } }
  chartCloseBtns.forEach(btn => btn.onclick = () => { closeExportModal(); closeChartPanel(); });
  [exportModal, chartPanel].forEach(modal => {
    modal.onclick = e => { if (e.target === modal) { closeExportModal(); closeChartPanel(); } };
  });

  // --- Export Modal: Download Button ---
  exportDownloadBtn.addEventListener('click', async () => {
    const format = exportModal.querySelector('input[name="exportFormat"]:checked').value;
    chrome.runtime.sendMessage({ action: 'getProfileData' }, (response) => {
      if (!response?.success) return;
      const data = response.data;
      const username = data.username || 'profile';
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'')
      let blob, filename;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `${username}_${dateStr}.json`;
      } else if (format === 'csv') {
        const csv = [
          'username,fullName,followers,following,posts,isPrivate,isVerified',
          `"${data.username}","${data.fullName}",${data.followers},${data.following},${data.posts},${data.isPrivate},${data.isVerified}`
        ].join('\n');
        blob = new Blob([csv], { type: 'text/csv' });
        filename = `${username}_${dateStr}.csv`;
      } else {
        // TXT: More info than before
        const txt = [
          `Kullanıcı: ${data.username}`,
          `Ad: ${data.fullName}`,
          `Takipçi: ${data.followers}`,
          `Takip: ${data.following}`,
          `Gönderi: ${data.posts}`,
          `Gizli: ${data.isPrivate ? 'Evet' : 'Hayır'}`,
          `Onaylı: ${data.isVerified ? 'Evet' : 'Hayır'}`,
          `Biyografi: ${data.biography || '-'}`,
          `Profil ID: ${data.id}`,
          `Tarih: ${dateStr}`
        ].join('\n');
        blob = new Blob([txt], { type: 'text/plain' });
        filename = `${username}_${dateStr}.txt`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      closeExportModal();
    });
  });

  // --- Grafik Butonu: Panel Aç ---
  graphBtn.addEventListener('click', openChartPanel);

  // --- Chart Panel: Chart.js ---
  async function renderChart() {
    chrome.storage.local.get('profileHistory', ({ profileHistory }) => {
      if (!profileHistory) {
        chartSummary.innerHTML = "Takipçi geçmişi yok.";
        if (chartInstance) chartInstance.destroy();
        return;
      }
      chrome.storage.local.get('cachedProfile', ({ cachedProfile }) => {
        let userId = cachedProfile?.id;
        if (!userId) {
          const userIds = Object.keys(profileHistory);
          if (!userIds.length) {
            chartSummary.innerHTML = "Takipçi geçmişi yok.";
            if (chartInstance) chartInstance.destroy();
            return;
          }
          userId = userIds[userIds.length-1];
        }
        // --- DÜZELTME: profileHistory[userId] artık dizi olmalı ---
        let entries = [];
        if (Array.isArray(profileHistory[userId])) {
          entries = profileHistory[userId].map(entry => ({
            date: new Date(entry.timestamp),
            followers: entry.followers
          }));
        } else if (profileHistory[userId]) {
          // Eski tekil kayıt desteği
          entries = [{
            date: new Date(profileHistory[userId].timestamp),
            followers: profileHistory[userId].followers
          }];
        }
        entries.sort((a, b) => a.date - b.date);
        if (!entries.length) {
          chartSummary.innerHTML = "Takipçi geçmişi yok.";
          if (chartInstance) chartInstance.destroy();
          return;
        }
        // Range filter
        const range = chartRangeSelect.value;
        let filtered = [];
        if (range === 'daily') filtered = entries.slice(-30);
        else if (range === 'weekly') filtered = entries.filter((_,i) => i%7===0).slice(-12);
        else filtered = entries.filter((_,i) => i%30===0).slice(-12);
        // Chart data
        const labels = filtered.map(e => e.date.toLocaleDateString());
        const values = filtered.map(e => e.followers);
        const totalChange = values.length > 1 ? values[values.length-1] - values[0] : 0;
        const percent = values.length > 1 ? ((values[values.length-1] - values[0]) / values[0] * 100).toFixed(1) : 0;
        chartSummary.innerHTML = `Toplam değişim: <b style="color:${totalChange>=0?'#4CAF50':'#ed4956'}">${totalChange>=0?'+':''}${totalChange}</b> (${percent}%)`;
        const pointBg = values.map((v,i,arr) => {
          if (i===0) return '#ccc';
          return v>arr[i-1] ? '#4CAF50' : v<arr[i-1] ? '#ed4956' : '#aaa';
        });
        const theme = currentSettings.themeTemplate || 'default';
        const dark = currentSettings.darkMode;
        const color = dark ? '#fff' : '#222';
        const lineColor = totalChange>=0 ? '#4CAF50' : '#ed4956';
        const ctx = document.getElementById('followerChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Takipçi',
              data: values,
              borderColor: lineColor,
              backgroundColor: 'rgba(76,175,80,0.08)',
              pointBackgroundColor: pointBg,
              pointRadius: 5,
              pointStyle: values.map((v,i,arr) => i===0 ? 'circle' : v>arr[i-1] ? 'triangle' : v<arr[i-1] ? 'rectRot' : 'circle'),
              fill: true,
              tension: 0.3
            }]
          },
          options: {
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true }
            },
            layout: { padding: 16 },
            scales: {
              x: { ticks: { color }, grid: { color: '#8882' } },
              y: { ticks: { color }, grid: { color: '#8882' } }
            }
          }
        });
      });
    });
  }
  // Grafik select kutusuna class ekle (daha belirgin ve temaya uygun)
  chartRangeSelect.classList.add('wex-chart-range-select');
  chartRangeSelect.style.fontSize = '15px';
  chartRangeSelect.style.fontWeight = '600';
  chartRangeSelect.style.borderRadius = '8px';
  chartRangeSelect.style.padding = '7px 16px';
  chartRangeSelect.style.background = 'var(--card-bg)';
  chartRangeSelect.style.color = 'var(--text-color)';
  chartRangeSelect.style.border = '1.5px solid var(--border-color)';
  chartRangeSelect.style.marginRight = '8px';

  chartRangeSelect.addEventListener('change', renderChart);
  exportChartBtn.addEventListener('click', () => {
    if (!chartInstance) return;
    const url = chartInstance.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
  });

  // --- Scan Settings eski kodlarını kaldır ---
  // (scanSettingsBtn ve scanSettingsModal ile ilgili kodlar tamamen kaldırıldı)

  // --- Grafik panelindeki seçim kutusunu temaya uygun yap ---
  // (CSS kısmı popup.css'de, burada sadece class ekle)
  chartRangeSelect.classList.add('wex-chart-range-select');

  // --- Tarama ayarlarını ayarlardan kaldır ---
  // (scanSettingsGroup'u settingsBody'den kaldır)
  settingsBody.removeChild(scanSettingsGroup);

  // --- UnfinderView'da geri tuşunun soluna ayarlar butonu ekle ---
  const unfinderHeaderActions = unfinderView.querySelector('.header-actions');
  const unfinderSettingsBtn = document.createElement('button');
  unfinderSettingsBtn.id = 'unfinderSettingsBtn';
  unfinderSettingsBtn.className = 'settings-btn';
  unfinderSettingsBtn.title = 'Unfollower Tarama Ayarları';
  unfinderSettingsBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
  unfinderHeaderActions.insertBefore(unfinderSettingsBtn, unfinderHeaderActions.firstChild);

  // --- Unfinder ayar panelini oluştur ve ekle ---
  const unfinderSettingsPanel = document.createElement('div');
  unfinderSettingsPanel.id = 'unfinderSettingsPanel';
  unfinderSettingsPanel.className = 'unfinder-settings-panel';
  unfinderSettingsPanel.style.display = 'none';
  unfinderSettingsPanel.innerHTML = `
    <div class="unfinder-settings-inner">
      <div class="unfinder-settings-title"><i class="fas fa-sliders-h"></i> Tarama Ayarları</div>
      <div class="unfinder-settings-fields">
        <label title="Her arama döngüsü sonrası bekleme süresi (ms)">
          Arama döngüleri arası (ms)
          <input type="number" id="scanDelay" min="500" max="999999">
        </label>
        <label title="5 arama döngüsünden sonra ekstra bekleme süresi (ms)">
          5 döngüden sonra bekleme (ms)
          <input type="number" id="scanDelayAfterFive" min="4000" max="999999">
        </label>
        <label title="Her unfollow işlemi sonrası bekleme süresi (ms)">
          Unfollow arası (ms)
          <input type="number" id="unfollowDelay" min="1000" max="999999">
        </label>
        <label title="5 unfollowdan sonra ekstra bekleme süresi (ms)">
          5 unfollowdan sonra bekleme (ms)
          <input type="number" id="unfollowDelayAfterFive" min="70000" max="999999">
        </label>
      </div>
      <div class="unfinder-settings-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Değerleri düşürmek ban riskini artırır.</span>
      </div>
      <div class="unfinder-settings-actions">
        <button id="unfinderSettingsSaveBtn" class="btn btn-primary"><i class="fas fa-save"></i> Kaydet</button>
        <button id="unfinderSettingsCancelBtn" class="btn btn-secondary"><i class="fas fa-times"></i> Kapat</button>
      </div>
    </div>
  `;
  unfinderView.querySelector('.app-container').appendChild(unfinderSettingsPanel);

  // --- Unfinder ayar paneli aç/kapat fonksiyonu ---
  unfinderSettingsBtn.addEventListener('click', () => {
    unfinderSettingsPanel.style.display = unfinderSettingsPanel.style.display === 'none' ? 'block' : 'none';
    loadScanTimings();
  });
  document.getElementById('unfinderSettingsCancelBtn').addEventListener('click', () => {
    unfinderSettingsPanel.style.display = 'none';
  });

  // --- Unfinder ayarlarını yükle ---
  function loadScanTimings() {
    chrome.storage.sync.get(['scanTimings'], (data) => {
      const timings = data.scanTimings || {
        scanDelay: 1800,
        scanDelayAfterFive: 12000,
        unfollowDelay: 4000,
        unfollowDelayAfterFive: 180000
      };
      document.getElementById('scanDelay').value = timings.scanDelay;
      document.getElementById('scanDelayAfterFive').value = timings.scanDelayAfterFive;
      document.getElementById('unfollowDelay').value = timings.unfollowDelay;
      document.getElementById('unfollowDelayAfterFive').value = timings.unfollowDelayAfterFive;
    });
  }

  // --- Unfinder ayarlarını kaydet ---
  document.getElementById('unfinderSettingsSaveBtn').addEventListener('click', () => {
    const timings = {
      scanDelay: Number(document.getElementById('scanDelay').value),
      scanDelayAfterFive: Number(document.getElementById('scanDelayAfterFive').value),
      unfollowDelay: Number(document.getElementById('unfollowDelay').value),
      unfollowDelayAfterFive: Number(document.getElementById('unfollowDelayAfterFive').value)
    };
    chrome.storage.sync.set({ scanTimings: timings }, () => {
      chrome.runtime.sendMessage({ action: 'setScanTimings', timings });
      unfinderSettingsPanel.style.display = 'none';
    });
  });

  // --- WeXUnfollower başlığı temaya uygun olsun ---
  function updateUnfinderHeaderTheme() {
    const theme = currentSettings.themeTemplate || 'default';
    const dark = currentSettings.darkMode;
    const header = unfinderView.querySelector('.header h1');
    if (!header) return;
    let gradient;
    if (theme === 'blue') gradient = 'linear-gradient(90deg,#42a5f5,#2196f3,#0d47a1)';
    else if (theme === 'green') gradient = 'linear-gradient(90deg,#81c784,#4caf50,#1b5e20)';
    else if (theme === 'purple') gradient = 'linear-gradient(90deg,#9575cd,#673ab7,#311b92)';
    else if (theme === 'pink') gradient = 'linear-gradient(90deg,#ff80ab,#ff4081,#d81b60)';
    else gradient = 'linear-gradient(90deg,#f09433 0%,#e6683c 30%,#dc2743 60%,#bc1888 100%)';
    header.style.background = gradient;
    header.style.webkitBackgroundClip = 'text';
    header.style.webkitTextFillColor = 'transparent';
    header.style.backgroundClip = 'text';
    header.style.color = 'transparent';
  }
  // applySettings çağrıldığında da güncelle
  const origApplySettings = applySettings;
  applySettings = function(settings) {
    origApplySettings(settings);
    updateUnfinderHeaderTheme();
  };

  // --- Profil linki algılama fonksiyonunu güncelle (daha esnek) ---
  // Bu kod popup.js'de değil, background.js'de olmalı. Ama burada örnek:
  // function getInstagramUsername(link) {
  //   try {
  //     const url = new URL(link);
  //     const pathSegments = url.pathname.split('/').filter(Boolean);
  //     const forbidden = ['p', 'reels', 'stories', 'tv', 'explore', 'direct', 'accounts', 'about', 'developer', 'directory', 'privacy', 'terms', 'api'];
  //     if (pathSegments.length === 1 && !forbidden.includes(pathSegments[0])) return pathSegments[0];
  //     if (pathSegments.length > 1 && !forbidden.includes(pathSegments[0]) && pathSegments[1] === '') return pathSegments[0];
  //     throw new Error("Geçerli bir profil sayfası değil.");
  //   } catch(e) { throw new Error("Geçersiz URL formatı."); }
  // }
});