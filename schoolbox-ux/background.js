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

  if (message.type === "CHECK_RELIEF") {
    // Runs only when the user clicks "Check relief" on the dashboard.
    // Opens Edval's timetable in an inactive tab, polls the passive
    // edval-scrape.js content script until it reports a result (or the
    // timeout hits), saves the result, and always closes the tab.
    (async () => {
      let tabId = null;
      try {
        const tab = await chrome.tabs.create({
          url: "https://my.edval.education/timetable",
          active: false,
        });
        tabId = tab.id;

        const startedAt = Date.now();
        const deadline = startedAt + 25000;
        // A signed-in session can briefly pass through another Edval URL
        // (token refresh, redirect hop) on its way to /timetable, so a
        // single off-/timetable snapshot isn't proof of being signed out.
        // Only decide "login" after a grace period, once the tab has
        // finished loading, and only if the same off-timetable state is
        // seen on several consecutive polls.
        const LOGIN_GRACE_MS = 4000;
        const LOGIN_CONSECUTIVE_POLLS = 3;
        let offTimetablePolls = 0;
        let lastOffTimetableUrl = null;
        let result = null;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 800));

          let current = null;
          let offTimetable = false;
          try {
            current = await chrome.tabs.get(tabId);
            if (current.url) {
              const u = new URL(current.url);
              offTimetable =
                u.hostname === "my.edval.education" &&
                !u.pathname.startsWith("/timetable");
            }
          } catch (e) {}
          console.log(
            "[my-relief] poll:",
            current && current.url,
            current && current.status
          );

          if (offTimetable) {
            if (current.url === lastOffTimetableUrl) {
              offTimetablePolls++;
            } else {
              lastOffTimetableUrl = current.url;
              offTimetablePolls = 1;
            }
            if (
              Date.now() - startedAt >= LOGIN_GRACE_MS &&
              current.status === "complete" &&
              offTimetablePolls >= LOGIN_CONSECUTIVE_POLLS
            ) {
              console.log("[my-relief] login: off-/timetable path", current.url);
              result = { status: "login" };
              break;
            }
            // Not settled yet - the scraper isn't loaded on this page
            // anyway, so keep polling.
            continue;
          }
          offTimetablePolls = 0;
          lastOffTimetableUrl = null;

          try {
            const reply = await chrome.tabs.sendMessage(tabId, {
              type: "SCRAPE_RELIEF",
            });
            if (reply && reply.status === "login") {
              // Reported by edval-scrape.js (form on the page, or path
              // check). Apply the same grace period so a page that is
              // still settling isn't misread.
              if (Date.now() - startedAt >= LOGIN_GRACE_MS) {
                console.log("[my-relief] login: reported by scraper");
                result = reply;
                break;
              }
            } else if (reply && reply.status !== "loading") {
              result = reply;
              break;
            }
          } catch (e) {
            // Content script not injected yet - keep polling.
          }
        }

        if (!result) {
          sendResponse({ ok: false, error: "timeout" });
        } else if (result.status === "login") {
          sendResponse({ ok: false, error: "login" });
        } else {
          const data = {
            checkedAt: Date.now(),
            forDate: result.forDate,
            items: result.items,
            lessonCount: result.lessonCount,
          };
          await chrome.storage.local.set({ reliefResult: data });
          sendResponse({ ok: true, data });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      } finally {
        if (tabId !== null) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {}
        }
      }
    })();
    return true;
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
