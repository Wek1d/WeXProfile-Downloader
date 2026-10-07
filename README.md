<p align="center">
  <img src="icon.png" alt="WeXProfile Downloader Logo" width="150" />
</p>

<h1 align="center">WeXProfile Downloader</h1>

<p align="center">
  The ultimate <strong>browser extension</strong> for viewing, analyzing, and downloading high-resolution Instagram profile photos.
  <br/>
  Supports <strong>private accounts</strong>, <strong>unfollower detection</strong>, and <strong>one-click unfollow</strong> right from your browser.
</p>

<p align="center">
  <a href="https://wek1d.github.io/WeXProfile-Downloader/">View Website</a> •
  <a href="https://github.com/Wek1d/WeXProfile-Downloader">GitHub</a> •
  <a href="https://github.com/Wek1d/WeXProfile-Downloader/issues">Issues</a>
</p>

<p align="center">
  <a href="https://github.com/Wek1d/WeXProfile-Downloader/releases">
    <img src="https://img.shields.io/github/downloads/Wek1d/WeXProfile-Downloader/total?style=flat-square&logo=github&color=blue" alt="Total Downloads"/>
  </a>
  <a href="https://chromewebstore.google.com/detail/wexprofile-downloader/ohbajlehmgjdhhfaejpeobfipomhjfoh">
    <img src="https://img.shields.io/chrome-web-store/users/ohbajlehmgjdhhfaejpeobfipomhjfoh?style=flat-square&color=blue&label=Chrome%20Users""/>
  </a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/wexprofile-downloader/ijlpgfcingilmdaioiepclimhkccoaok">
    <img src="https://img.shields.io/badge/Edge-Available-0078D7?style=flat-square&logo=microsoft-edge" alt="Microsoft Edge"/>
  </a>
  <a href="https://chromewebstore.google.com/detail/wexprofile-downloader/ohbajlehmgjdhhfaejpeobfipomhjfoh">
  <img src="https://img.shields.io/badge/Chrome-Available-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store"/>
</a>
  <a href="https://addons.mozilla.org/addon/wexprofile-downloader/">
    <img src="https://img.shields.io/badge/Firefox-Available-FF7139?style=flat-square&logo=firefox" alt="Firefox"/>
  </a>
  <a href="https://github.com/Wek1d/WeXProfile-Downloader/releases">
    <img src="https://img.shields.io/github/v/release/Wek1d/WeXProfile-Downloader?style=flat-square&logo=github" alt="Latest Release"/>
  </a>
</p>

---

## Overview
https://github.com/user-attachments/assets/9229aecc-c273-49a7-b32a-b2373d78275c

WeXProfile is a powerful **browser extension** that brings advanced Instagram analytics and download tools directly into your browser.  
It allows you to view and download HD profile photos, analyze user statistics, and even detect unfollowers with **one-click unfollow** support — all while keeping your data fully private.

### Project Stats
| Category | Details |
| :--- | :--- |
| **Total Downloads** | ![GitHub All Releases](https://img.shields.io/github/downloads/Wek1d/WeXProfile-Downloader/total?style=flat-square&color=blue) |
| **Current Version** | v3.3.9 |
| **License** | MIT |
| **Main Tech** | Vanilla JavaScript / Manifest V3 |

## Key Features

### Profile Analysis
- **HD Profile Picture Downloads** - Get full resolution profile photos with a smarter 3-step fallback system
- **Complete Profile Metadata** - Username, bio, post count, followers, following
- **Follower Tracking** - Monitor changes over time with interactive charts
- **Data Export** - Save profile data in JSON, CSV, or TXT formats

### Unfollower Detection
- **Smart Scanning** - Identify users who don't follow you back
- **Quick Profile View** - Click any username to open their profile in a background tab without closing the popup 🚀
- **Context Menu Integration** - Right-click to quickly open profiles in a new tab without interrupting your workflow
- **Scan Persistence** - Results are saved locally, so closing the popup doesn't wipe your scan
- **Bulk Unfollow** - Remove multiple followers safely with rate limiting
- **Customizable Speeds** - Adjust delays to ensure account safety

### Customization
- **Modern UI** - Frosted glass effects, theme-aware progress bars, and hidden global scrollbars for a clean look
- **5 Color Themes** - Default, Blue, Green, Purple, Pink
- **9 Font Options** - From Poppins to Inter
- **Dark/Light Mode** - Full theme support

---


## Installation

### Microsoft Edge
1. Visit the [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/wexprofile-downloader/ijlpgfcingilmdaioiepclimhkccoaok)
2. Click **Get**
3. Install and navigate to Instagram

### Google Chrome
1. Visit the [Chrome Web Store](https://chromewebstore.google.com/detail/wexprofile-downloader/ohbajlehmgjdhhfaejpeobfipomhjfoh)
2. Click **Add to Chrome**
3. Install and navigate to Instagram

### Firefox
1. Visit [Mozilla Add-ons](https://addons.mozilla.org/addon/wexprofile-downloader/)
2. Click **Add to Firefox**
3. Install and navigate to Instagram

### Manual Installation (Opera, Brave, Arc, or any Chromium browser)
1. Download the [latest release](https://github.com/Wek1d/WeXProfile-Downloader/releases/latest)
2. Extract the ZIP file
3. Open your browser's extensions page (`chrome://extensions`)
4. Enable **Developer mode**
5. Click **Load unpacked** and select the extracted folder

---

## Usage

### Find Unfollowers
1. Click the Unfollower icon.
2. Click **Start Scan**.
3. **New:** Click a username or use the **right-click context menu** to open their profile in a new tab instantly.
4. Select users to remove and click **Unfollow Selected**.

---


## Changelog
### Version 3.4.0 (Latest)
- **Rate limit fix (issue #347):** Replaced the sequential per-user friendship check with Instagram's batch endpoint `POST /api/v1/friendships/show_many/`. Instead of one request per followed account (which got blocked after ~40 calls), the scanner now verifies 30 accounts per request — roughly 95% fewer network calls.
- **Accurate detection:** Unfollower status is now read directly from Instagram's canonical `followed_by` field. This eliminates the false positives that appeared on large or private accounts, where the viewer wasn't guaranteed to appear in the top 12 of a user's following list.
- **Faster scans:** 1,000 accounts verified in roughly 30 seconds. The full followers list is no longer paginated — follower count is fetched with a single lightweight request instead.
- **Live streaming results:** Unfollowers appear on screen as each batch is verified, rather than waiting for the entire scan to finish.
- **Notification restraint:** Notifications are no longer shown when the active tab isn't an Instagram page.
- **Soft-block resilience:** HTTP 429 and 5xx responses now trigger exponential backoff (respecting `Retry-After` headers) instead of halting the scan.

### Version 3.3.9 
- **Removed:** The automatic update-check feature (which pinged the GitHub API to compare versions) has been fully removed, along with the in-popup update banner. This was a leftover from manual-install days and is no longer needed since the extension is distributed through the Chrome Web Store and Edge Add-ons.
- **Permissions Cleanup:** Removed the unused `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` permissions, along with the `api.github.com` host permission, since neither was actually used by any feature. This addresses a Chrome Web Store policy flag regarding unused permissions.
- **Smaller Footprint:** Slightly reduced background script size and simplified the settings message flow as a result of the above cleanup.

### Version 3.3.8
- **New Feature:** Added an "Open in new tab" option to the right-click context menu for smoother profile navigation.
- **Improved Localization:** Added new translation keys for better multi-language support across the UI.
- **Maintenance:** Updated underlying `npm` dependencies for improved security and background performance.
- **Documentation:** Added a live Chrome Web Store downloads badge to the website and documentation.
- **Fixed:** Resolved minor bugs related to current version display tracking.

### Version 3.3.7
- **Stability Fix:** Fully optimized and stabilized the background communication layer after the recent Instagram API structural changes.
- **Code Optimization:** Cleaned up redundant logic and refactored core loops, resulting in a significantly lighter extension footprint and faster execution.
- **Performance Improvements:** Fixed intermittent lag and potential memory leaks during long-running unfollower scans.

### Version 3.3.6 
- **New Feature:** Clicking a username in the unfollower list now opens their profile in a **background tab**, keeping the extension popup open for a smoother workflow.
- **Improved UI:** Added a **frosted glass backdrop** to the scan settings panel and removed global scrollbars for a cleaner aesthetic.
- **Improved UI:** The progress bar now dynamically follows the active color theme.
- **Fixed:** Unfollower action buttons were mismatched in width; now perfectly aligned.
- **Fixed:** Rescan button appearance is now consistent across all themes.
- **Fixed:** Scan results now render correctly even if the language hasn't finished loading.
- **Technical:** Optimized Instagram API request patterns.

[View all releases](https://github.com/Wek1d/WeXProfile-Downloader/releases)

---

## Safety & Privacy
- **Zero Data Collection:** Everything stays on your device.
- **Minimal Permissions:** Only requests permissions it actually uses; unused ones are removed promptly.
- **Rate Limiting:** Built-in protection with randomized, human-like behavior.
- **Open Source:** Full code transparency.

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/Wek1d">Wek1d</a></strong>
</p>