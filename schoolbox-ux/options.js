document.addEventListener("DOMContentLoaded", () => {
  const groupsContainer = document.getElementById("groups");
  const masterToggle = document.getElementById("master-toggle");
  const saveButton = document.getElementById("save-button");
  const saveStatus = document.getElementById("save-status");

  // Local, unsaved copy of the settings being edited - nothing
  // touches chrome.storage until Save is clicked, per the "batch
  // changes, one reload" decision (reloading every open Schoolbox
  // tab on every single checkbox click would be disruptive if
  // you're configuring several tweaks at once).
  let pendingTweaksEnabled = true;
  let pendingToggles = buildDefaultTweakToggles();
  const checkboxesById = {};

  function setUnsaved() {
    saveStatus.textContent = "Unsaved changes";
    saveButton.disabled = false;
  }

  function applyMasterDisabledState() {
    document
      .querySelectorAll(".group-card")
      .forEach((card) => card.classList.toggle("is-disabled", !pendingTweaksEnabled));
    Object.values(checkboxesById).forEach((checkbox) => {
      checkbox.disabled = !pendingTweaksEnabled;
    });
  }

  function renderGroups() {
    TWEAK_GROUPS.forEach((group) => {
      const card = document.createElement("section");
      card.className = "group-card";

      const heading = document.createElement("h2");
      heading.textContent = group.name;
      card.appendChild(heading);

      group.tweaks.forEach((tweak) => {
        const row = document.createElement("div");
        row.className = "tweak-row";

        const text = document.createElement("div");
        const name = document.createElement("p");
        name.className = "tweak-name";
        name.textContent = tweak.label;
        const desc = document.createElement("p");
        desc.className = "tweak-desc";
        desc.textContent = tweak.description;
        text.appendChild(name);
        text.appendChild(desc);

        const switchLabel = document.createElement("label");
        switchLabel.className = "switch";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!pendingToggles[tweak.id];
        const slider = document.createElement("span");
        slider.className = "slider";
        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);

        checkbox.addEventListener("change", () => {
          pendingToggles[tweak.id] = checkbox.checked;
          setUnsaved();
        });

        checkboxesById[tweak.id] = checkbox;

        row.appendChild(text);
        row.appendChild(switchLabel);
        card.appendChild(row);
      });

      groupsContainer.appendChild(card);
    });
  }

  chrome.storage.sync.get(
    { tweaksEnabled: true, tweakToggles: {} },
    (result) => {
      pendingTweaksEnabled = result.tweaksEnabled;
      pendingToggles = mergeTweakTogglesWithDefaults(result.tweakToggles);

      masterToggle.checked = pendingTweaksEnabled;
      renderGroups();
      applyMasterDisabledState();
    }
  );

  masterToggle.addEventListener("change", () => {
    pendingTweaksEnabled = masterToggle.checked;
    applyMasterDisabledState();
    setUnsaved();
  });

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    saveStatus.textContent = "Saving…";

    chrome.storage.sync.set(
      { tweaksEnabled: pendingTweaksEnabled, tweakToggles: pendingToggles },
      () => {
        saveStatus.textContent = "Saved";

        // Reload every open Schoolbox tab so the change is visible
        // immediately, same reasoning as the popup's single toggle -
        // reloading only after the write's callback confirms it
        // landed avoids a tab coming back up before storage commits.
        chrome.tabs.query({ url: "https://my.careywa.au/*" }, (tabs) => {
          tabs.forEach((tab) => chrome.tabs.reload(tab.id));
        });
      }
    );
  });
});
