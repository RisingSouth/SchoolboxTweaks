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

## Pastoral note templates
On the new pastoral record page, **Templates** saves and re-applies your own notes.

- **Save:** after you save a record, a banner on the student's profile page offers "Save as template". The student's name in the note becomes a token (`[firstname]`, `[surname]`, `[fullname]`) so it fills in for the next student. You can also use **Templates → Save current note as template…** on the form.
- **Apply:** **Templates →** pick one. It sets Type, Sub-type, Title, points, tags and the General note. **Undo** restores what was there. You still press Save yourself.
- **Manage:** **Templates → Manage templates** to rename, delete, or export/import as text to share with a colleague.
- **Never saved:** the Confidential note, the date, and the student.
- **Where they live:** your Chrome profile (`chrome.storage.sync`), one item per template, up to 50, about 7KB each. Turn the feature off under *Pastoral records* in Settings. Terms are defined in `../GLOSSARY.md`.

## Timetable page

- **Class buttons**: hover or Tab to a lesson on `/timetable` for Class List, Markbook and Go to class. The lesson pop-up (click a lesson) gets a Course page button next to Go to homepage. The course is found by reading the class page once and remembering it (stored in the browser's local storage as `myClassCourseLinks`).
- **My duties**: duties added in the nav panel's My duties section also show on the Timetable week and day views. Before and after school duties appear as a line above the day.

Each has its own toggle under "Timetable page" in the settings.

## Sent mail record

When you send an email from Schoolbox Webmail, the extension notes the subject, time, the To/CC/BCC recipients and the first 10 words of the message (never the full body). It's saved only in this browser (`chrome.storage.local`, not synced) and deleted automatically after 100 days. View, search, export (CSV) or delete it at the bottom of the extension settings page. Turn it off in the Webmail group.

Limits: sends to a class or group address record that address, not its members; emails sent from Gmail (including "Open students in Gmail") aren't recorded; a send is only recorded once the next page loads without the compose form.
