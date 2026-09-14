# Schoolbox UX Tweaks — starter extension

## 1. Set your real domain
Open `manifest.json` and replace:
```
"https://YOUR-SCHOOL.schoolbox.com/*"
```
with your actual Schoolbox URL (check the address bar when logged in).

## 2. Load it in Chrome
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder

## 3. Find what to target
1. Open Schoolbox, right-click the element you want to change
2. Click **Inspect**
3. Note its class or id in the DevTools panel
4. Use that selector in `styles.css` (visual changes) or `content.js` (structural changes)

## 4. Reload after every edit
Go back to `chrome://extensions` and click the refresh icon on the extension card, then reload the Schoolbox tab.

## 5. Toolbar popup
Click the extension's icon in Chrome's toolbar to open a small popup with an on/off switch for all the tweaks, plus a collapsed "Other apps" section with links to your other projects (edit `popup.html` to add or change these). Turning tweaks off leaves Schoolbox pages completely untouched.

## 6. Share with other staff (before publishing)
Zip this folder and send it — they follow step 2 themselves. No store account needed.

## 7. When ready to publish
Register as a Chrome Web Store developer ($5 one-off), then upload a zip of this folder from the [developer dashboard](https://chrome.google.com/webstore/devconsole).
