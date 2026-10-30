// Background service worker.
//
// Handles things a content script can't do on its own: fetching Seat
// layout files, and opening the Options page
// (chrome.runtime.openOptionsPage() is extension-process-only). The
// fetch exists because my.careywa.au/send.php redirects to a signed
// Cloudflare R2 URL that sends no Access-Control-Allow-Origin header
// at all. A content script's fetch() is bound by the same CORS rules
// as the page itself, so no fetch() option from content.js can get
// around that - it's not a credentials problem, R2 just isn't
// configured for browser-side CORS on this bucket. A background
// service worker is a different context: with the right
// host_permissions (see manifest.json), its fetches aren't subject to
// CORS at all.
//
// (Previously also opened the Class List/Markbook links via
// chrome.tabs.create() to dodge Schoolbox's PWA link-capturing on
// target="_blank" clicks - dropped when those links went back to
// plain same-tab navigation, which the capture doesn't appear to
// intercept.)
//
// Goes through chrome.runtime.sendMessage rather than the content
// script fetching directly, since fetch() from that context is
// still bound by the page's own CORS rules.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "OPEN_OPTIONS_PAGE") {
    // chrome.runtime.openOptionsPage() only works from an extension
    // process (background/popup/options), never from a content
    // script - this is the relay for the nav dropdown's Settings row.
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (message.type === "OPEN_TAB") {
    // Opens a URL in a new tab on the content script's behalf
    // (content scripts can't call chrome.tabs). Only the Veracross
    // portal is allowed - this isn't a general-purpose "open
    // anything" relay.
    try {
      const url = new URL(message.url);
      if (
        url.protocol === "https:" &&
        url.hostname === "portals-app.veracross.au"
      ) {
        chrome.tabs.create({ url: url.href });
      }
    } catch (e) {
      // Malformed URL - ignore.
    }
    return false;
  }

  if (message.type === "FETCH_TEXT") {
    (async () => {
      try {
        const res = await fetch(message.url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Fetch returned HTTP ${res.status}`);
        }
        const text = await res.text();
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  return false;
});
