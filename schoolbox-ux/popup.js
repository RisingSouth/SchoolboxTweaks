document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("enabled-toggle");
  const folderButton = document.getElementById("apps-folder-toggle");
  const chevron = document.getElementById("apps-chevron");
  const appsList = document.getElementById("apps-list");

  chrome.storage.sync.get({ tweaksEnabled: true }, (result) => {
    toggle.checked = result.tweaksEnabled;
  });

  toggle.addEventListener("change", () => {
    // Reload only after the write actually lands - reloading first
    // risks the page coming back up before storage has finished
    // committing the new value, silently reverting the toggle.
    chrome.storage.sync.set({ tweaksEnabled: toggle.checked }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        // Restricted to the Schoolbox domain the extension actually
        // touches - activeTab only grants access to whichever tab is
        // active when the popup opens, which won't always be Schoolbox.
        if (tab && tab.url && tab.url.startsWith("https://my.careywa.au/")) {
          chrome.tabs.reload(tab.id);
        }
      });
    });
  });

  document.getElementById("settings-button").addEventListener("click", () => {
    // The popup is itself an extension page, so unlike the nav
    // dropdown's Settings row (a content script) this can call
    // openOptionsPage() directly - no background relay needed.
    chrome.runtime.openOptionsPage();
  });

  folderButton.addEventListener("click", () => {
    const isHidden = appsList.hidden;
    appsList.hidden = !isHidden;
    chevron.classList.toggle("open", isHidden);
  });
});
