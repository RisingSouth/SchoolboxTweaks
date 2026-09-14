// Background service worker.
//
// Handles two things a content script can't do on its own:
//
// 1. Fetching the bulletin PDF. my.careywa.au/storage/fetch.php
//    redirects to a signed Cloudflare R2 URL that sends no
//    Access-Control-Allow-Origin header at all. A content script's
//    fetch() is bound by the same CORS rules as the page itself, so
//    no fetch() option from content.js can get around that - it's
//    not a credentials problem, R2 just isn't configured for
//    browser-side CORS on this bucket. A background service worker
//    is a different context: with the right host_permissions (see
//    manifest.json), its fetches aren't subject to CORS at all.
//
// 2. Opening the "Class List" / "Markbook" links in a normal browser
//    tab. Schoolbox is set up as an installable PWA (registered
//    service worker, app manifest tags on its own pages), and Chrome
//    can intercept a same-origin navigation - even from a plain
//    target="_blank" anchor click - and route it into the installed
//    app's window instead of a browser tab. chrome.tabs.create()
//    opens a tab directly at the browser level rather than through a
//    page navigation, which link-capturing has no hook into.
//
// Both go through chrome.runtime.sendMessage rather than the
// content script doing it directly, since neither capability is
// available from that context.

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

  if (message.type === "OPEN_IN_NEW_TAB") {
    chrome.tabs.create({ url: message.url, active: true });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
