// Isolated-world, document_start: tells status-limit-main.js whether the
// "Show up to 50 students" tweak is switched off (it can't read
// chrome.storage itself). Default is on, so if this loses the race with
// the page's init event the override still applies.
chrome.storage.sync.get({ tweaksEnabled: true, tweakToggles: {} }, (r) => {
  const t = r.tweakToggles || {};
  if (!r.tweaksEnabled || t.assessmentStatusLimit === false) {
    document.documentElement.setAttribute("data-sbux-status-limit", "off");
  }
});
