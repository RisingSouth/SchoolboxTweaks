// Background service worker.
//
// Handles things a content script can't do on its own: fetching the
// bulletin PDF and Seat layout files, and opening the Options page
// (chrome.runtime.openOptionsPage() is extension-process-only). The
// fetches exist because both
// my.careywa.au/storage/fetch.php and my.careywa.au/send.php
// redirect to a signed Cloudflare R2 URL that sends no
// Access-Control-Allow-Origin header at all. A content script's
// fetch() is bound by the same CORS rules as the page itself, so no
// fetch() option from content.js can get around that - it's not a
// credentials problem, R2 just isn't configured for browser-side
// CORS on this bucket. A background service worker is a different
// context: with the right host_permissions (see manifest.json), its
// fetches aren't subject to CORS at all.
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

  if (message.type === "FETCH_PDF_BYTES") {
    (async () => {
      try {
        const res = await fetch(message.url);
        if (!res.ok) {
          throw new Error(`PDF fetch returned HTTP ${res.status}`);
        }
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Chunked to avoid blowing the call stack on
        // String.fromCharCode with a large PDF's worth of bytes in
        // one call.
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + chunkSize)
          );
        }

        sendResponse({ ok: true, base64: btoa(binary) });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true; // keep the message channel open for the async response
  }

  if (message.type === "OPEN_OPTIONS_PAGE") {
    // chrome.runtime.openOptionsPage() only works from an extension
    // process (background/popup/options), never from a content
    // script - this is the relay for the nav dropdown's Settings row.
    chrome.runtime.openOptionsPage();
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
