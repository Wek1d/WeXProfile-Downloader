document.addEventListener('DOMContentLoaded', function() {
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
  const settingsPopup = document.getElementById('settingsPopup');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const fontSelect = document.getElementById('fontSelect');
  const themeOptions = document.querySelectorAll('.theme-option');
  const githubBtn = document.getElementById('githubBtn');
  const updateNotification = document.getElementById('updateNotification');
  const latestVersionEl = document.getElementById('latestVersion');
  const updateBtn = document.getElementById('updateBtn');

  let currentSettings = {
    darkMode: true,
    fontFamily: 'Poppins, sans-serif',
    themeTemplate: 'default'
  };

  function applySettings(settings) {
    currentSettings = settings;
    document.body.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
    document.body.style.fontFamily = settings.fontFamily;
    applyThemeTemplate(settings.themeTemplate);
  }
  
  function applyThemeTemplate(template) {
    const root = document.documentElement;
    switch (template) {
      case 'default':
        root.style.setProperty('--primary-gradient-light', 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)');
        root.style.setProperty('--secondary-gradient-light', 'linear-gradient(45deg, #405DE6, #5851DB)');
        root.style.setProperty('--primary-gradient-dark', 'linear-gradient(45deg, #0095f6, #5851db)');
        root.style.setProperty('--secondary-gradient-dark', 'linear-gradient(45deg, #385185, #1e1e1e)');
        break;
      case 'blue':
        root.style.setProperty('--primary-gradient-light', 'linear-gradient(45deg, #0095f6, #0076a8)');
        root.style.setProperty('--secondary-gradient-light', 'linear-gradient(45deg, #0076a8, #005f7f)');
        root.style.setProperty('--primary-gradient-dark', 'linear-gradient(45deg, #42a5f5, #2196f3)');
        root.style.setProperty('--secondary-gradient-dark', 'linear-gradient(45deg, #2196f3, #0d47a1)');
        break;
      case 'green':
        root.style.setProperty('--primary-gradient-light', 'linear-gradient(45deg, #4CAF50, #2E7D32)');
        root.style.setProperty('--secondary-gradient-light', 'linear-gradient(45deg, #2E7D32, #1B5E20)');
        root.style.setProperty('--primary-gradient-dark', 'linear-gradient(45deg, #81c784, #4caf50)');
        root.style.setProperty('--secondary-gradient-dark', 'linear-gradient(45deg, #4caf50, #1b5e20)');
        break;
      case 'purple':
        root.style.setProperty('--primary-gradient-light', 'linear-gradient(45deg, #673AB7, #4527A0)');
        root.style.setProperty('--secondary-gradient-light', 'linear-gradient(45deg, #4527A0, #311B92)');
        root.style.setProperty('--primary-gradient-dark', 'linear-gradient(45deg, #9575cd, #673ab7)');
        root.style.setProperty('--secondary-gradient-dark', 'linear-gradient(45deg, #673ab7, #311b92)');
        break;
      case 'pink':
        root.style.setProperty('--primary-gradient-light', 'linear-gradient(45deg, #ff69b4, #ff1493)');
        root.style.setProperty('--secondary-gradient-light', 'linear-gradient(45deg, #ff1493, #c71585)');
        root.style.setProperty('--primary-gradient-dark', 'linear-gradient(45deg, #ff80ab, #ff4081)');
        root.style.setProperty('--secondary-gradient-dark', 'linear-gradient(45deg, #ff4081, #d81b60)');
        break;
    }

    if (currentSettings.darkMode) {
      root.style.setProperty('--primary-gradient', `var(--primary-gradient-dark)`);
      root.style.setProperty('--secondary-gradient', `var(--secondary-gradient-dark)`);
    } else {
      root.style.setProperty('--primary-gradient', `var(--primary-gradient-light)`);
      root.style.setProperty('--secondary-gradient', `var(--secondary-gradient-light)`);
    }
  }

  function localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const message = chrome.i18n.getMessage(element.dataset.i18n);
      if (message) {
        element.textContent = message;
      }
    });
    usernameEl.title = chrome.i18n.getMessage("copyUsernameTitle");
    themeToggle.title = chrome.i18n.getMessage("changeThemeTitle");
    settingsBtn.title = chrome.i18n.getMessage("settingsTitle");
    clearHistoryBtn.title = chrome.i18n.getMessage("clearHistoryTitle");
    downloadJsonBtn.title = chrome.i18n.getMessage("downloadJsonTitle");
    githubBtn.title = chrome.i18n.getMessage("githubTitle");
  }

  chrome.runtime.sendMessage({ action: 'getSettingsAndUpdates' }, (response) => {
    if (response && response.success) {
      applySettings(response.settings);
      fontSelect.value = response.settings.fontFamily;
      document.querySelector(`.theme-option[data-theme="${response.settings.themeTemplate}"]`)?.classList.add('active');

      if (response.updateInfo.hasUpdate) {
        latestVersionEl.textContent = response.updateInfo.latestVersion;
        updateNotification.style.display = 'flex';
      }
    }
  });

  // Popup açıldığında güncelleme kontrolünü tekrar tetikle
  chrome.runtime.sendMessage({ action: 'checkUpdatesNow' });

  localizeHtml();

  themeToggle.addEventListener('click', function() {
    currentSettings.darkMode = !currentSettings.darkMode;
    chrome.runtime.sendMessage({ action: 'setSettings', settings: currentSettings });
    applySettings(currentSettings);
  });

  settingsBtn.addEventListener('click', () => {
    settingsPopup.style.display = 'flex';
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPopup.style.display = 'none';
  });

  fontSelect.addEventListener('change', (e) => {
    currentSettings.fontFamily = e.target.value;
    chrome.runtime.sendMessage({ action: 'setSettings', settings: currentSettings });
    applySettings(currentSettings);
  });

  themeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.theme-option.active')?.classList.remove('active');
      btn.classList.add('active');
      currentSettings.themeTemplate = btn.dataset.theme;
      chrome.runtime.sendMessage({ action: 'setSettings', settings: currentSettings });
      applySettings(currentSettings);
    });
  });

  githubBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openGithub' });
  });

  updateBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openGithub' });
  });

  chrome.runtime.sendMessage({ action: 'getProfileData' }, function(response) {
    if (response && response.success) {
      displayProfileData(response.data);
    } else {
      showError(response.error || chrome.i18n.getMessage("popupFetchError"));
    }
  });

  function displayProfileData(data) {
    loader.style.display = 'block';
    profilePic.classList.remove('loaded');

    usernameEl.textContent = `@${data.username}`;
    fullNameEl.textContent = data.fullName;

    usernameEl.addEventListener('click', () => {
        navigator.clipboard.writeText(data.username).then(() => {
            const originalText = usernameEl.title;
            usernameEl.title = chrome.i18n.getMessage("copiedText");
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
      privateBadge.textContent = chrome.i18n.getMessage("privateLabel");
      usernameEl.appendChild(privateBadge);
    }

    bioEl.textContent = data.biography || chrome.i18n.getMessage("noBioText");
    postsCountEl.textContent = formatNumber(data.posts);
    followersCountEl.textContent = formatNumber(data.followers);
    followingCountEl.textContent = formatNumber(data.following);

    displayChange(followersChangeEl, data.followerChange);
    displayChange(followingChangeEl, data.followingChange);

    const imageDataURL = data.profilePicUrlForPreview;
    if (imageDataURL) {
      profilePic.src = imageDataURL;
      profilePic.onload = () => {
        profilePic.classList.add('loaded');
        loader.style.display = 'none';
      };
      profilePic.onerror = () => {
        loader.style.display = 'none';
        showError(chrome.i18n.getMessage("imageLoadError"));
      }
    } else {
      loader.style.display = 'none';
      showError(chrome.i18n.getMessage("imageLoadError"));
    }

    openHdBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openHdPhoto' }));
    downloadBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadPhoto' }));
    downloadJsonBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'downloadJSON' }));
  }
  
  function displayChange(element, change) {
    element.textContent = '';
    element.className = 'change-indicator';
    if (change !== 0) {
      const sign = change > 0 ? '+' : '';
      element.textContent = `${sign}${formatNumber(change)}`;
      element.classList.add(change > 0 ? 'positive' : 'negative');
    }
  }

  function showError(message) {
    loader.style.display = 'none';
    profileContainer.innerHTML = `
      <div class="error-message" style="text-align: center; padding: 20px; color: var(--error-color);">
        <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
        <p>${message}</p>
      </div>`;
    openHdBtn.disabled = true;
    downloadBtn.disabled = true;
    downloadJsonBtn.disabled = true;
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 10000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  }
  
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage("clearHistoryConfirm"))) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, (response) => {
        if (response && response.success) {
          window.location.reload();
        }
      });
    }
  });
});