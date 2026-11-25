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

  // The version the user last acknowledged (see chrome.storage.sync
  // lastSeenVersion). Read once at load, so "New" pills stay put for
  // this visit even after the banner is dismissed.
  let lastSeenVersion = "0";

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
      .querySelectorAll(".group-card:not(.whats-new-card)")
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

  // Banner at the top while there's an unseen update, plus the full
  // changelog card at the bottom. Dismissing only writes
  // lastSeenVersion - it doesn't touch the pending settings, so it
  // never marks the page as having unsaved changes.
  function renderWhatsNew() {
    const banner = document.getElementById("whats-new-banner");
    const unseen = getUnseenChangelog(lastSeenVersion);
    if (unseen.length) {
      const newCount = TWEAK_GROUPS.reduce(
        (n, g) => n + g.tweaks.filter((t) => isTweakNew(t, lastSeenVersion)).length,
        0
      );
      banner.textContent = "";
      const text = document.createElement("span");
      text.textContent =
        "New since you last looked: version " +
        unseen[0].version +
        (newCount ? " adds " + newCount + " features, marked New below." : ".");
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => {
        chrome.storage.sync.set({ lastSeenVersion: chrome.runtime.getManifest().version });
        banner.hidden = true;
      });
      banner.appendChild(text);
      banner.appendChild(dismiss);
      banner.hidden = false;
    }

    const card = document.getElementById("whats-new");
    const heading = document.createElement("h2");
    heading.textContent = "What's new";
    card.appendChild(heading);
    CHANGELOG.forEach((entry) => {
      const v = document.createElement("p");
      v.className = "tweak-name";
      v.textContent = "Version " + entry.version;
      card.appendChild(v);
      const ul = document.createElement("ul");
      ul.className = "whats-new-list";
      entry.items.forEach((item) => {
        const li = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = item.title + ": ";
        li.appendChild(strong);
        li.appendChild(document.createTextNode(item.text));
        ul.appendChild(li);
      });
      card.appendChild(ul);
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
        if (isTweakNew(tweak, lastSeenVersion)) {
          const pill = document.createElement("span");
          pill.className = "new-pill";
          pill.textContent = "New";
          name.appendChild(pill);
        }
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


  // Sent mail record viewer. Reads and writes chrome.storage.local
  // directly (not part of the Save bar): entries are the user's own
  // private log, so Delete/Clear take effect straight away.
  const sentSection = document.getElementById("sent-mail");
  let sentLog = [];
  let sentFilter = "";
  let confirmingClear = false;

  function loadSentMail() {
    chrome.storage.local.get({ [SENT_MAIL_KEY]: [] }, (stored) => {
      sentLog = pruneSentMailLog(stored[SENT_MAIL_KEY]);
      if (sentLog.length !== (stored[SENT_MAIL_KEY] || []).length) {
        chrome.storage.local.set({ [SENT_MAIL_KEY]: sentLog });
      }
      renderSentMail();
    });
  }

  function saveSentMail(list) {
    sentLog = list;
    chrome.storage.local.set({ [SENT_MAIL_KEY]: list }, renderSentMail);
  }

  function formatSentTime(ts) {
    return new Date(ts).toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  function recipientLabel(r) {
    return r.name ? r.name + " <" + r.email + ">" : r.email;
  }

  function entryMatches(entry, q) {
    if (!q) return true;
    const hay = [entry.subject, entry.preview || ""]
      .concat(["to", "cc", "bcc"].flatMap((f) => (entry[f] || []).map((r) => r.name + " " + r.email)))
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function csvCell(v) {
    return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  }

  function exportSentMailCsv() {
    const rows = [["Sent", "Subject", "Message start", "Field", "Name", "Email"]];
    sentLog.forEach((e) => {
      ["to", "cc", "bcc"].forEach((f) => {
        (e[f] || []).forEach((r) => {
          rows.push([new Date(e.ts).toISOString(), e.subject, e.preview || "", f.toUpperCase(), r.name, r.email]);
        });
      });
    });
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sent-mail-record.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderSentMail() {
    sentSection.textContent = "";

    const heading = document.createElement("h2");
    heading.textContent = "Sent mail record";
    sentSection.appendChild(heading);

    const desc = document.createElement("p");
    desc.className = "tweak-desc";
    desc.textContent =
      "Who each email you sent from Schoolbox was addressed to, with its subject and the first 10 words of the message. Kept only in this browser (not synced) and deleted automatically after " +
      SENT_MAIL_RETENTION_DAYS +
      " days. Emails sent from other places, such as Gmail, aren't included.";
    sentSection.appendChild(desc);

    if (!sentLog.length) {
      const empty = document.createElement("p");
      empty.className = "sent-empty";
      empty.textContent = "Nothing recorded yet. Emails you send from Schoolbox will appear here.";
      sentSection.appendChild(empty);
      return;
    }

    const bar = document.createElement("div");
    bar.className = "sent-toolbar";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search subject, message start, name or email";
    search.value = sentFilter;
    search.setAttribute("aria-label", "Search sent mail record");
    search.addEventListener("input", () => {
      sentFilter = search.value.trim().toLowerCase();
      renderSentList();
    });
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export CSV";
    exportBtn.addEventListener("click", exportSentMailCsv);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "sent-danger";
    clearBtn.textContent = confirmingClear ? "Delete everything?" : "Clear all";
    clearBtn.addEventListener("click", () => {
      if (!confirmingClear) {
        confirmingClear = true;
        renderSentMail();
        return;
      }
      confirmingClear = false;
      saveSentMail([]);
    });
    bar.appendChild(search);
    bar.appendChild(exportBtn);
    bar.appendChild(clearBtn);
    if (confirmingClear) {
      const keep = document.createElement("button");
      keep.type = "button";
      keep.textContent = "Keep";
      keep.addEventListener("click", () => {
        confirmingClear = false;
        renderSentMail();
      });
      bar.appendChild(keep);
    }
    sentSection.appendChild(bar);

    const list = document.createElement("div");
    list.id = "sent-list";
    sentSection.appendChild(list);
    renderSentList();
  }

  function renderSentList() {
    const list = document.getElementById("sent-list");
    if (!list) return;
    list.textContent = "";
    const shown = sentLog.filter((e) => entryMatches(e, sentFilter));
    if (!shown.length) {
      const none = document.createElement("p");
      none.className = "sent-empty";
      none.textContent = "No matches.";
      list.appendChild(none);
      return;
    }
    shown.forEach((entry) => {
      const details = document.createElement("details");
      details.className = "sent-entry";

      const summary = document.createElement("summary");
      const subj = document.createElement("span");
      subj.className = "sent-subject";
      subj.textContent = entry.subject;
      const meta = document.createElement("span");
      meta.className = "sent-meta";
      const n = ["to", "cc", "bcc"].reduce((c, f) => c + (entry[f] || []).length, 0);
      meta.textContent = formatSentTime(entry.ts) + " · " + n + (n === 1 ? " recipient" : " recipients");
      summary.appendChild(subj);
      summary.appendChild(meta);
      details.appendChild(summary);

      if (entry.preview) {
        const prev = document.createElement("p");
        prev.className = "sent-preview";
        prev.textContent = entry.preview;
        details.appendChild(prev);
      }

      ["to", "cc", "bcc"].forEach((f) => {
        const people = entry[f] || [];
        if (!people.length) return;
        const label = document.createElement("p");
        label.className = "sent-field";
        label.textContent = f.toUpperCase() + " (" + people.length + ")";
        details.appendChild(label);
        const ul = document.createElement("ul");
        ul.className = "sent-people";
        people.forEach((r) => {
          const li = document.createElement("li");
          li.textContent = recipientLabel(r);
          ul.appendChild(li);
        });
        details.appendChild(ul);
      });

      const actions = document.createElement("div");
      actions.className = "sent-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy addresses";
      copy.addEventListener("click", () => {
        const emails = ["to", "cc", "bcc"].flatMap((f) => (entry[f] || []).map((r) => r.email));
        navigator.clipboard.writeText(emails.join(", ")).then(() => {
          copy.textContent = "Copied";
          setTimeout(() => (copy.textContent = "Copy addresses"), 1500);
        });
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "sent-danger";
      del.textContent = "Delete";
      del.addEventListener("click", () => saveSentMail(sentLog.filter((e) => e.id !== entry.id)));
      actions.appendChild(copy);
      actions.appendChild(del);
      details.appendChild(actions);

      list.appendChild(details);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SENT_MAIL_KEY]) loadSentMail();
  });

  chrome.storage.sync.get(
    { tweaksEnabled: true, tweakToggles: {}, gradeCutoffs: {}, lastSeenVersion: "0" },
    (result) => {
      lastSeenVersion = result.lastSeenVersion;
      pendingTweaksEnabled = result.tweaksEnabled;
      pendingToggles = mergeTweakTogglesWithDefaults(result.tweakToggles);
      pendingCutoffs = mergeGradeCutoffsWithDefaults(result.gradeCutoffs);

      masterToggle.checked = pendingTweaksEnabled;
      renderWhatsNew();
      renderGroups();
      renderGradeScales();
      loadSentMail();
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
