// Runs in the page's own world (MAIN) at document_start, on assessment
// status pages only. Schoolbox's page ends with an inline script that
// dispatches ACTIVITY_STATUS_PAGE_INIT with detail.pageItemLimit = 25;
// all rows are already in the HTML and activityStatusPage.js only pages
// them client-side (hides rows past the limit). Registering before that
// dispatch lets us raise the limit by mutating the shared detail object.
// main-world-bridge.js runs at document_idle - too late for this - hence
// a separate script.
//
// NOT independently confirmed against a live page: whether the bundle
// reads detail.pageItemLimit after dispatch (works) or copies it first.
// status-grid.js has a fallback that un-hides rows either way.
(function () {
  const LIMIT = 50;
  document.addEventListener(
    "ACTIVITY_STATUS_PAGE_INIT",
    (event) => {
      try {
        if (document.documentElement.getAttribute("data-sbux-status-limit") === "off") return;
        const d = event && event.detail;
        if (d && typeof d.pageItemLimit === "number" && d.pageItemLimit < LIMIT) {
          d.pageItemLimit = LIMIT;
          document.documentElement.setAttribute("data-sbux-status-limit-applied", String(LIMIT));
        }
      } catch (err) {}
    },
    true
  );
})();
