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
  <a href="https://microsoftedge.microsoft.com/addons/detail/wexprofile-downloader/ijlpgfcingilmdaioiepclimhkccoaok">
    <img src="https://img.shields.io/badge/Edge-Available-0078D7?style=flat-square&logo=microsoft-edge" alt="Microsoft Edge"/>
  </a>
  <a href="https://addons.mozilla.org/addon/wexprofile-downloader/">
    <img src="https://img.shields.io/badge/Firefox-Available-FF7139?style=flat-square&logo=firefox" alt="Firefox"/>
  </a>
  <a href="https://github.com/Wek1d/WeXProfile-Downloader/releases">
    <img src="https://img.shields.io/github/v/release/Wek1d/WeXProfile-Downloader?style=flat-square&logo=github" alt="Latest Release"/>
  </a>
  <a href="https://github.com/Wek1d/WeXProfile-Downloader/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Wek1d/WeXProfile-Downloader?style=flat-square" alt="License"/>
  </a>
</p>

---

## Overview
https://github.com/user-attachments/assets/9229aecc-c273-49a7-b32a-b2373d78275c

WeXProfile is a powerful **browser extension** that brings advanced Instagram analytics and download tools directly into your browser.  
It allows you to view and download HD profile photos, analyze user statistics, and even detect unfollowers with **one-click unfollow** support — all while keeping your data fully private.

**Now with scan result persistence, smarter HD photo fetching, and a cleaner unfollower UI!** 🚀  
Compatible with Microsoft Edge, Firefox, and all Chromium-based browsers.

## Key Features

### Profile Analysis
- **HD Profile Picture Downloads** - Get full resolution profile photos with a smarter 3-step fallback system
- **Complete Profile Metadata** - Username, bio, post count, followers, following
- **Follower Tracking** - Monitor changes over time with interactive charts
- **Account Details** - Verified status, private accounts, and more
- **Data Export** - Save profile data in JSON, CSV, or TXT formats

### Unfollower Detection
- **Smart Scanning** - Identify users who don't follow you back
- **Scan Persistence** - Results are saved locally, so closing the popup doesn't wipe your scan
- **Bulk Unfollow** - Remove multiple followers safely with rate limiting
- **Select All** - Quickly select or deselect all results with one click
- **Progress Tracking** - Real-time status updates during scanning
- **Configurable Speeds** - Adjust delays to ensure account safety
- **Control** - Pause, resume, or stop scans at any time

### Customization
- **5 Color Themes** - Default, Blue, Green, Purple, Pink
- **9 Font Options** - Poppins, Montserrat, Roboto, Lato, Ubuntu, Open Sans, Nunito, Inter, Yu Gothic
- **Button Styles** - Modern (rounded) or Classic (sharp)
- **Dark/Light Mode** - Full theme support
- **Persistent Settings** - Settings no longer reset on browser updates or restarts

### Privacy & Security
- **Zero Data Collection** - Everything stays on your device
- **No External Servers** - No cloud sync or data sharing
- **Rate Limiting** - Built-in protection against bans
- **Randomized Behavior** - Human-like patterns
- **Open Source** - Full code transparency

---

## Installation

### Microsoft Edge (Recommended)
1. Visit the [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/wexprofile-downloader/ijlpgfcingilmdaioiepclimhkccoaok)
2. Click **Get**
3. Install and navigate to Instagram

### Firefox
1. Visit [Mozilla Add-ons](https://addons.mozilla.org/addon/wexprofile-downloader/)
2. Click **Add to Firefox**
3. Approve and navigate to Instagram

### Manual Installation (Chrome, Opera, Brave, Edge)
1. Download the [latest release](https://github.com/Wek1d/WeXProfile-Downloader/releases/latest)
2. Extract the ZIP file
3. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the extracted folder

---

## Usage

### View Profile Information
1. Visit any Instagram profile
2. Click the WeXProfile icon
3. View stats, bio, and download options

### Download HD Photos
- Click **Open in New Tab** to view full resolution
- Click **Download** to save to your computer

### Track Followers
- View daily, weekly, or monthly charts
- Export history in multiple formats
- See changes at a glance

### Find Unfollowers
1. Click the Unfollower icon
2. Click **Start Scan**
3. Select users to remove (or use Select All)
4. Click **Unfollow Selected**

> **Note:** Results are automatically saved. If you close the popup mid-scan or after it finishes, your results will still be there when you reopen it.

---

## Languages

WeXProfile supports 6 languages out of the box:

- English
- Turkish  
- Spanish
- French
- German
- Italian

Want to add another language? Check out [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## System Requirements

- Microsoft Edge (Chromium-based)
- Firefox
- Google Chrome
- Opera
- Brave
- Any Chromium-based browser

**Note:** You must be logged into Instagram to use WeXProfile.

---

## Safety & Limitations

### Usage Recommendations
- Unfollow no more than 50 users per day
- Use the default delays to stay safe
- Don't run continuous scans for extended periods
- Take breaks between scans

### Important Notes
- Not affiliated with Instagram or Meta
- Instagram may change their API without notice
- Excessive unfollowing could trigger rate limits
- Use at your own risk and responsibility

---

## Technical Details

### Technology Stack
- Manifest V3
- Vanilla JavaScript (no frameworks)
- Chart.js for graphs
- CSS3 with animations
- Instagram's GraphQL API

### Browser Permissions
We request only necessary permissions:
- `tabs` - Detect Instagram pages
- `storage` - Save your settings and history
- `downloads` - Download profile pictures
- `cookies` - Access your Instagram session
- `notifications` - Show update alerts

---

## Project Structure

```
WeXProfile-Downloader/
├── js/
│   ├── background.js        # Background worker
│   ├── popup.js             # Popup logic
│   └── unfollower.js        # Unfollower detection
├── css/
│   └── popup.css            # Styling
├── _locales/                # Language files
│   ├── en/messages.json
│   ├── tr/messages.json
│   └── ... (other languages)
├── manifest.json            # Extension config
├── popup.html               # Popup interface
├── icon.png                 # Extension icon
├── docs/                    # Website (GitHub Pages)
│   └── index.html
└── README.md
```

---

## Contributing

We welcome contributions! Ways to help:

### Report Bugs
Open an [issue](https://github.com/Wek1d/WeXProfile-Downloader/issues) with details about the problem.

### Suggest Features
Share your ideas in the issues section.

### Add Translations
Add a new `_locales/[lang]/messages.json` file for your language.

### Improve Code
Fork the repo, make changes, and submit a PR.

### Code Style
- Use vanilla JavaScript (no frameworks)
- Keep functions small and focused
- Comment complex logic
- Test in multiple browsers

### Development Setup
```bash
git clone https://github.com/Wek1d/WeXProfile-Downloader.git
cd WeXProfile-Downloader

# Load unpacked in browser for testing
# Make your changes
# Test thoroughly

git checkout -b feature/your-feature
git commit -m "Add your feature"
git push origin feature/your-feature
```

---

## Changelog

### Version 3.3.3 (Latest)
- **Fixed:** Settings (theme, language, font, etc.) were resetting after browser updates or restarts. Now only resets on a fresh install — updates preserve your preferences.
- **Fixed:** Checkbox ticks in the unfollower list were being clipped and only half-visible. Rebuilt with a proper border-based checkmark that renders correctly at all sizes.
- **Fixed:** Duplicate `i18nMessages` and `t()` declarations in popup.js that could cause translation inconsistencies in edge cases.
- **Improved:** Scan results now persist in local storage. Closing and reopening the popup no longer wipes your unfollower list.
- **Improved:** HD photo fetching now tries three sources in order — `hd_profile_pic_url_info`, `hd_profile_pic_versions` (largest available), and a CDN resolution upgrade attempt. Falls back gracefully if none work.
- **Improved:** "Select All" in the unfollower list is now a modern pill/chip button instead of a plain checkbox. Clicking any row also toggles selection.
- **Improved:** Copying a username now shows a small toast notification instead of silently copying.
- **Fixed:** `popup.html` had a hardcoded version number (`v3.2.3`) that didn't match the actual build. Now reads from the manifest dynamically.

### Version 3.3.2
- UI Cleanup: Removed background shimmer from the unfollower tab for a cleaner look
- UX Enhancement: Added a press effect to the Start Scan button
- Link Update: GitHub icon now links directly to the Releases page
- Version Sync: Version numbers aligned across manifest.json, package.json, and popup footer

### Version 3.3.1
- Updated Chart.js to latest version
- New animations across the extension

### Version 3.2.8
- **Safety First**: Increased and randomized all unfollower delays (70-130% of base time) for safer, more human-like behavior
- **New Default Timings**: Updated default scan delays (scan delay 2100ms, after 5 requests 15000ms)
- **i18n Race Condition Fix**: Translations now always load before the UI renders
- **Placeholder Fix**: `usernameLoadingPlaceholder` added to all 6 language files
- **Technical**: Refactored `DOMContentLoaded` logic for proper i18n initialization

### Version 3.2.6
- **Localization Stability**: Fixed i18n race conditions in popup and context menu
- **Context Menu Fixes**: Right-click menu now properly displays translated text
- **Safety Improvements**: Increased randomized delays for unfollower tool
- **UI Enhancements**: Follower chart dropdown now matches extension theme
- **Performance**: Direct profile photo downloads without unnecessary background data

### Version 3.2.5
- **Profile Picture Loading**: Fixed images appearing behind loader
- **Biography Handling**: Improved data collection from Instagram's API
- **Loader Animation**: More modern and visible design
- **Image Optimization**: Better loading logic with error handling
- **UI Fixes**: CSS z-index adjustments and responsive improvements

### Version 3.2.4
- **Küçük düzeltmeler ve iyileştirmeler** *(bu versiyonun notlarını yazmayı unutmuşum ama eminim çok önemli şeyler vardı! 😄)*

### Version 3.2.3
- Added customizable scan/unfollow delays
- Improved unfollower detection UI
- Fixed profile picture loading
- Enhanced dark mode
- Added chart export

[View all releases](https://github.com/Wek1d/WeXProfile-Downloader/releases)

---

## Roadmap

Planned features:
- Chrome Web Store listing
- Instagram Stories downloader (maybe)
- Post analytics
- Better unfollower filtering
- Bulk profile export
- **Even more language support** 🌍

---

## FAQ

**Q: Is WeXProfile safe?**  
A: Yes. All processing happens locally on your device. No data is sent to external servers.

**Q: Will it get my account banned?**  
A: WeXProfile includes rate limiting and randomized delays. Follow safety recommendations and use responsibly.

**Q: My settings keep resetting after browser updates**  
A: **Fixed in v3.3.3!** Settings now persist through browser and extension updates. Only a fresh install resets them.

**Q: The unfollower results disappear when I close the popup**  
A: **Fixed in v3.3.3!** Results are now saved locally and restored automatically when you reopen the popup.

**Q: Can I use it on mobile?**  
A: Not yet. It's designed for desktop browsers only.

**Q: Does it work on Instagram Business accounts?**  
A: Yes, it works on all account types.

**Q: How often should I use the unfollower tool?**  
A: We recommend scanning once per week for safety.

---

## Performance

WeXProfile is optimized for speed and efficiency:
- Lightweight (~500KB uncompressed)
- Fast profile loading
- Minimal CPU/memory usage
- Zero background processing when idle

---

## Troubleshooting

### Extension not loading
- Check that you're logged into Instagram
- Reload the page (F5)
- Restart your browser

### Download not working
- Ensure your browser allows downloads
- Check your downloads folder
- Try a different profile

### Scans too slow/fast
- Adjust delays in settings
- Default settings are safest
- Lower delays = higher ban risk

### Language not showing
- Clear browser cache
- Reinstall the extension
- Check your system language

---

## Privacy Policy

WeXProfile respects your privacy:
- No data collection
- No tracking
- No advertisements
- No external connections (except Instagram API)

All data stored locally in your browser.

---

## License

Licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## Credits

- **Unfollower Algorithm** inspired by [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers)
- **Icons** from [Font Awesome](https://fontawesome.com)
- **Fonts** from [Google Fonts](https://fonts.google.com)

---

## Support

- GitHub Issues: [Report bugs](https://github.com/Wek1d/WeXProfile-Downloader/issues)
- Discussions: [Ask questions](https://github.com/Wek1d/WeXProfile-Downloader/discussions)
- Email: yarda8512@gmail.com
- Website: [wek1d.github.io/WeXProfile-Downloader](https://wek1d.github.io/WeXProfile-Downloader/)

---

## Acknowledgments

Thanks to everyone who has used, tested, and contributed to WeXProfile. Your feedback helps make it better.

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/Wek1d">Wek1d</a></strong>
</p>

<p align="center">
  <sub>WeXProfile is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc.</sub>
</p>