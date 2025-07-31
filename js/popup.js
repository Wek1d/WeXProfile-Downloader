document.addEventListener('DOMContentLoaded', function() {
  // Elementleri seç
  const profilePic = document.getElementById('profilePic');
  const usernameEl = document.getElementById('username');
  const fullNameEl = document.getElementById('fullName');
  const bioEl = document.getElementById('bio');
  const postsCountEl = document.getElementById('postsCount');
  const followersCountEl = document.getElementById('followersCount');
  const followingCountEl = document.getElementById('followingCount');
  const openHdBtn = document.getElementById('openHdBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const themeToggle = document.getElementById('themeToggle');
  const loader = document.querySelector('.loader');
  const profileContainer = document.querySelector('.profile-container');

  // Tema kontrolü
  let darkMode = true;

  // Sayfa yüklendiğinde temayı ayarla
  chrome.storage.sync.get(['darkMode'], function(result) {
    darkMode = result.darkMode !== false;
    updateTheme();
  });

  // Tema değiştirme butonu
  themeToggle.addEventListener('click', function() {
    darkMode = !darkMode;
    chrome.storage.sync.set({ darkMode: darkMode });
    updateTheme();
  });

  function updateTheme() {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }

  // Profil verilerini al
  chrome.runtime.sendMessage({ action: 'getProfileData' }, function(response) {
    if (response.success) {
      const data = response.data;
      displayProfileData(data);
    } else {
      showError(response.error || "Profil verileri alınamadı. Lütfen bir Instagram sayfasında olduğunuzdan ve uzantı ikonuna tıkladığınızdan emin olun.");
    }
  });

  // Profil verilerini göster
  function displayProfileData(data) {
    // Yükleyiciyi başlat
    loader.style.display = 'block';
    profilePic.classList.remove('loaded'); // Resmi gizle

    usernameEl.textContent = `@${data.username}`;
    fullNameEl.textContent = data.fullName;

    if (data.isVerified) {
      const verifiedBadge = document.createElement('i');
      verifiedBadge.className = 'fas fa-check-circle verified-badge';
      usernameEl.appendChild(verifiedBadge);
    }

    if (data.isPrivate) {
      const privateBadge = document.createElement('span');
      privateBadge.className = 'private-badge';
      privateBadge.textContent = 'Gizli';
      usernameEl.appendChild(privateBadge);
    }

    bioEl.textContent = data.biography || "Biyografi yok";

    postsCountEl.textContent = formatNumber(data.posts);
    followersCountEl.textContent = formatNumber(data.followers);
    followingCountEl.textContent = formatNumber(data.following);

    // Artık Base64 Data URL'si bekliyoruz, doğrudan src'ye atayabiliriz
    const imageDataURL = data.profilePicUrlForPreview; 
    
    if (imageDataURL) {
      profilePic.src = imageDataURL; // BASE64 DATA URL'ini doğrudan atıyoruz
      profilePic.classList.add('loaded'); // Resmi görünür yap
      loader.style.display = 'none'; // Yükleyiciyi gizle
      console.log("Profil resmi başarıyla yüklendi (Base64).");
    } else {
      // Data URL yoksa veya çekilemediyse boş bırakıyoruz
      profilePic.src = ''; 
      profilePic.classList.remove('loaded');
      loader.style.display = 'none';
      console.warn("Profil resmi Data URL'si bulunamadı veya yüklenemedi.");
    }

    openHdBtn.addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: 'openHdPhoto' });
    });

    downloadBtn.addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: 'downloadPhoto' }, function(response) {
        if (!response || !response.success) {
          showError("İndirme işlemi başlatılamadı. Lütfen tekrar deneyin.");
        }
      });
    });
  }

  // Hata göster
  function showError(message) {
    loader.style.display = 'none';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <i class="fas fa-exclamation-circle" style="color: var(--error-color); font-size: 24px; margin-bottom: 10px;"></i>
      <p>${message}</p>
    `;
    errorDiv.style.textAlign = 'center';
    errorDiv.style.padding = '20px';
    errorDiv.style.color = 'var(--error-color)';
    profileContainer.innerHTML = '';
    profileContainer.appendChild(errorDiv);

    openHdBtn.disabled = true;
    downloadBtn.disabled = true;
  }

  // Sayıları formatla (1000 -> 1K)
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Animasyon efekti
  setTimeout(() => {
    document.querySelector('.app-container').style.opacity = '1';
  }, 100);
});