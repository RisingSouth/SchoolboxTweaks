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

  // Grade-column cutoffs being edited ({scaleId: [A, B, C, D]}), plus
  // the inputs and any validation errors per scale. Same rule as
  // everything else here: nothing is written until Save is clicked,
  // and Save is blocked while any scale's cutoffs are invalid.
  const gradeSection = document.getElementById("grade-scales");
  let pendingCutoffs = mergeGradeCutoffsWithDefaults(null);
  const cutoffInputsByScale = {};
  const cutoffErrorsByScale = {};
  let isDirty = false;

  function hasGradeErrors() {
    return Object.keys(cutoffErrorsByScale).some((id) => cutoffErrorsByScale[id]);
  }

  function refreshSaveButton() {
    saveButton.disabled = !isDirty || hasGradeErrors();
  }

  function setUnsaved() {
    isDirty = true;
    saveStatus.textContent = hasGradeErrors()
      ? "Fix the grade cutoffs to save"
      : "Unsaved changes";
    refreshSaveButton();
  }

  function applyMasterDisabledState() {
    document
      .querySelectorAll(".group-card")
      .forEach((card) => card.classList.toggle("is-disabled", !pendingTweaksEnabled));
    Object.values(checkboxesById).forEach((checkbox) => {
      checkbox.disabled = !pendingTweaksEnabled;
    });
    gradeSection.querySelectorAll("input, button").forEach((el) => {
      el.disabled = !pendingTweaksEnabled;
    });
  }

  function renderGradeScales() {
    const heading = document.createElement("h2");
    heading.textContent = "Grade scales";
    gradeSection.appendChild(heading);

    const desc = document.createElement("p");
    desc.className = "tweak-desc";
    desc.textContent =
      "Cutoffs for the Markbook's Grade column. A weighted average at or above a cutoff earns that letter; anything below D is an E. Highest first (A > B > C > D).";
    gradeSection.appendChild(desc);

    const table = document.createElement("div");
    table.className = "grade-table";

    const headRow = document.createElement("div");
    headRow.className = "grade-row grade-row--head";
    headRow.appendChild(document.createElement("span"));
    ["A", "B", "C", "D"].forEach((letter) => {
      const cell = document.createElement("span");
      cell.textContent = letter;
      headRow.appendChild(cell);
    });
    table.appendChild(headRow);

    GRADE_SCALES.forEach((scale) => {
      const row = document.createElement("div");
      row.className = "grade-row";

      const name = document.createElement("span");
      name.className = "grade-scale-name";
      name.textContent = scale.label;
      row.appendChild(name);

      cutoffInputsByScale[scale.id] = [];
      for (let i = 0; i < 4; i++) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.5";
        input.min = "0";
        input.max = "100";
        input.className = "grade-input";
        input.setAttribute("aria-label", `${scale.label} ${["A", "B", "C", "D"][i]} cutoff`);
        input.value = pendingCutoffs[scale.id][i];
        input.addEventListener("input", () => onCutoffInput(scale.id));
        cutoffInputsByScale[scale.id].push(input);
        row.appendChild(input);
      }
      table.appendChild(row);
    });
    gradeSection.appendChild(table);

    const footer = document.createElement("div");
    footer.className = "grade-footer";

    const error = document.createElement("span");
    error.id = "grade-error";
    error.className = "grade-error";
    footer.appendChild(error);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "grade-reset";
    reset.textContent = "Reset to defaults";
    reset.addEventListener("click", () => {
      pendingCutoffs = mergeGradeCutoffsWithDefaults(null);
      GRADE_SCALES.forEach((scale) => {
        cutoffInputsByScale[scale.id].forEach((input, i) => {
          input.value = pendingCutoffs[scale.id][i];
          input.classList.remove("is-invalid");
        });
        cutoffErrorsByScale[scale.id] = "";
      });
      showGradeError();
      setUnsaved();
    });
    footer.appendChild(reset);
    gradeSection.appendChild(footer);
  }

  function onCutoffInput(scaleId) {
    const values = cutoffInputsByScale[scaleId].map((input) => parseFloat(input.value));
    pendingCutoffs[scaleId] = values;

    const valid = isValidGradeCutoffs(values);
    cutoffErrorsByScale[scaleId] = valid
      ? ""
      : `${GRADE_SCALES.find((s) => s.id === scaleId).label}: enter numbers from 0 to 100, highest first (A > B > C > D).`;
    cutoffInputsByScale[scaleId].forEach((input) =>
      input.classList.toggle("is-invalid", !valid)
    );

    showGradeError();
    setUnsaved();
  }

  function showGradeError() {
    const first = Object.keys(cutoffErrorsByScale).find((id) => cutoffErrorsByScale[id]);
    document.getElementById("grade-error").textContent = first
      ? cutoffErrorsByScale[first]
      : "";
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
    { tweaksEnabled: true, tweakToggles: {}, gradeCutoffs: {} },
    (result) => {
      pendingTweaksEnabled = result.tweaksEnabled;
      pendingToggles = mergeTweakTogglesWithDefaults(result.tweakToggles);
      pendingCutoffs = mergeGradeCutoffsWithDefaults(result.gradeCutoffs);

      masterToggle.checked = pendingTweaksEnabled;
      renderGroups();
      renderGradeScales();
      applyMasterDisabledState();
    }
  );

  masterToggle.addEventListener("change", () => {
    pendingTweaksEnabled = masterToggle.checked;
    applyMasterDisabledState();
    setUnsaved();
  });

  saveButton.addEventListener("click", () => {
    // Belt and braces: the button is already disabled while invalid.
    if (hasGradeErrors()) return;

    isDirty = false;
    saveButton.disabled = true;
    saveStatus.textContent = "Saving…";

    chrome.storage.sync.set(
      {
        tweaksEnabled: pendingTweaksEnabled,
        tweakToggles: pendingToggles,
        gradeCutoffs: pendingCutoffs,
      },
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
