// Runs after the page's own scripts, once the DOM is ready.
// Use this for anything CSS can't do: reordering elements,
// renaming labels, adding buttons, moving nodes around.

(function () {
  "use strict";

  // Populated from chrome.storage.sync before applyTweaks() first
  // runs (see the bottom of this file) - defaults to everything on
  // so a fresh install/update behaves exactly like before individual
  // toggles existed.
  let tweakToggles = buildDefaultTweakToggles();

  // Each tweak's own top-level call is gated here, in one place,
  // rather than inside each function - a single choke point is much
  // harder to let drift out of sync with tweak-config.js than
  // editing 14 separate function bodies would be. Toggling a tweak
  // off just means its call is skipped this pass; each function's
  // own "have I already done this?" guard doesn't need to know
  // anything changed.
  function applyTweaks() {
    if (tweakToggles.dashboardLinks) addClassListAndMarkbookLinks();
    if (tweakToggles.classHomeQuickActions) addQuickActionsOnClassHomepage();
    if (tweakToggles.classHomeSeat) addSeatWidgetOnClassHomepage();
    if (tweakToggles.markbookHeading) hideRedundantHeading();
    if (tweakToggles.markbookFilters) addFilterToggleOnMarkbook();
    if (tweakToggles.markbookSort) addSortableMarkbookColumns();
    if (tweakToggles.markbookShading) addAssessmentTypeShading();
    if (tweakToggles.classesGridQuickLinks) addQuickLinksOnClassesPage();
    if (tweakToggles.classListFlagFilter) addPastoralFlagFilter();
    if (tweakToggles.classListPmiBadge) addPmiBadges();
    if (tweakToggles.classListAttentionTags) addStudentAttentionTags();
    if (tweakToggles.classListColumnReorg) reorganiseClassListColumns();
    if (tweakToggles.dashboardRelief) addCheckForReliefButton();
    if (tweakToggles.dashboardDuties) addMyDutiesToTimetable();
    if (tweakToggles.courseImportUnitDates) addUnitDateCopyButton();
    if (tweakToggles.courseImportLessonCascade) addLessonDateCascade();

    // Pure-CSS tweak (see styles.css) - toggled via a body class
    // rather than a call to skip, since there's no DOM to build.
    document.body.classList.toggle(
      "my-tweak-full-height-table",
      !!tweakToggles.markbookFullHeight
    );
  }

  // The Class List page's pastoral-flags row for each student is a
  // <div data-test="pastoral-flags-{studentId}"> of <sbx-label>
  // children - the "pastoral-flags-" prefix is also used by the
  // individual flags' own data-test values (e.g.
  // "pastoral-flags-9-21"), but those live on <sbx-label> elements,
  // never on a <div>, so this selector only ever matches the
  // per-student row container.
  function isClassListPage() {
    return (
      !!document.querySelector("#contact-table") &&
      !!document.querySelector('div[data-test^="pastoral-flags-"]')
    );
  }

  // Adds a button to the end of Schoolbox's own top navigation bar,
  // matching the same markup/classes as the built-in items (Classes,
  // Timetable, etc.) so it inherits their styling and hover states
  // rather than needing custom CSS. Since it targets the generic
  // #top-menu structure rather than anything Carey-specific, this
  // would work the same way on any Schoolbox site. Clicking it opens
  // a small dropdown with the same "other apps" links as the toolbar
  // popup.
  function addNavBarButton() {
    if (document.getElementById("my-nav-button")) return;

    const navList = document.querySelector("#top-menu");
    if (!navList) return;

    const li = document.createElement("li");
    li.id = "my-nav-button";
    li.style.position = "relative";

    const link = document.createElement("a");
    link.href = "#";
    link.className = "sbx-button--has-icon u-width-100";
    link.title = "Schoolbox UX tweaks";

    const icon = document.createElement("sbx-icon");
    icon.setAttribute("name", "settings");
    icon.setAttribute("size", "1.30rem");
    icon.setAttribute("color", "currentColor");

    const label = document.createElement("span");
    label.textContent = "UX tweaks";

    link.appendChild(icon);
    link.appendChild(label);
    li.appendChild(link);
    navList.appendChild(li);

    link.addEventListener("click", (event) => {
      event.preventDefault();
      toggleNavPanel(li);
    });
  }

  function toggleNavPanel(li) {
    const existingPanel = document.getElementById("my-nav-panel");
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    chrome.storage.sync.get({ tweaksEnabled: true }, (result) => {
      const rect = li.getBoundingClientRect();

      const panel = document.createElement("div");
      panel.id = "my-nav-panel";
      panel.className = "my-nav-panel";
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.right = `${window.innerWidth - rect.right}px`;

      const toggleRow = document.createElement("div");
      toggleRow.className = "my-nav-panel-row";

      const toggleLabel = document.createElement("span");
      toggleLabel.textContent = "Enable tweaks";

      const switchLabel = document.createElement("label");
      switchLabel.className = "my-nav-switch";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = result.tweaksEnabled;

      const slider = document.createElement("span");
      slider.className = "my-nav-slider";

      checkbox.addEventListener("change", () => {
        // This panel only ever exists on a Schoolbox page already, so
        // no domain check is needed here the way the popup's version
        // needs one - reload once the write actually lands, same
        // reasoning as the popup toggle.
        chrome.storage.sync.set({ tweaksEnabled: checkbox.checked }, () => {
          window.location.reload();
        });
      });

      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(slider);
      toggleRow.appendChild(toggleLabel);
      toggleRow.appendChild(switchLabel);
      panel.appendChild(toggleRow);

      // chrome.runtime.openOptionsPage() can't be called from a
      // content script (extension-process-only API), so this goes
      // through background.js the same way the PDF/Seat fetches do.
      const settingsRow = document.createElement("button");
      settingsRow.type = "button";
      settingsRow.className = "my-nav-panel-row my-nav-settings-row";
      settingsRow.textContent = "Settings";
      settingsRow.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
      });
      panel.appendChild(settingsRow);

      buildDutiesSection(panel);

      const folderButton = document.createElement("button");
      folderButton.type = "button";
      folderButton.className = "my-nav-folder-row";

      const folderIcon = document.createElement("span");
      folderIcon.textContent = "📁";

      const folderLabel = document.createElement("span");
      folderLabel.className = "my-nav-folder-label";
      folderLabel.textContent = "Other apps";

      const chevron = document.createElement("span");
      chevron.className = "my-nav-chevron";
      chevron.textContent = "▾";

      folderButton.appendChild(folderIcon);
      folderButton.appendChild(folderLabel);
      folderButton.appendChild(chevron);
      panel.appendChild(folderButton);

      const appsList = document.createElement("div");
      appsList.className = "my-nav-apps-list";
      appsList.hidden = true;

      const links = [
        { name: "Markflow", url: "https://markflow.com.au" },
        { name: "Observe", url: "https://www.observenotes.com" },
        { name: "Seat", url: "https://risingsouth.github.io/seatingchart/" },
      ];

      links.forEach((linkInfo) => {
        const a = document.createElement("a");
        a.href = linkInfo.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "my-nav-panel-link";

        const name = document.createElement("span");
        name.className = "my-nav-panel-link-name";
        name.textContent = linkInfo.name;

        const arrow = document.createElement("span");
        arrow.className = "my-nav-panel-link-arrow";
        arrow.textContent = "↗";

        a.appendChild(name);
        a.appendChild(arrow);
        appsList.appendChild(a);
      });

      folderButton.addEventListener("click", () => {
        const isHidden = appsList.hidden;
        appsList.hidden = !isHidden;
        chevron.classList.toggle("my-nav-chevron--open", isHidden);
      });

      panel.appendChild(appsList);

      const footer = document.createElement("div");
      footer.className = "my-nav-panel-footer";
      footer.textContent = "v1.2";
      panel.appendChild(footer);

      document.body.appendChild(panel);
    });
  }

  // #filter_panel isn't unique to the Markbook - other report pages
  // (Assessment Calendar, Pastoral Care Report) appear to reuse the
  // same id for a different, much larger container. Checking the
  // URL as well stops the Markbook-only tweaks below from firing on
  // those pages and hiding their whole content.
  function isMarkbookPage() {
    return /\/learning\/markbook\//.test(window.location.pathname);
  }

  // The page heading ("Class Markbook for HDC - Y08 - Product
  // Design") just restates what the breadcrumb trail already says
  // (HDC - Y08 - Product Design > Class Markbook), so it's hidden
  // rather than merged into the breadcrumb row - that merge broke
  // the breadcrumb's own layout, so plain removal is simpler and
  // safer.
  function hideRedundantHeading() {
    if (!isMarkbookPage()) return;
    if (!document.querySelector("#filter_panel")) return;

    const heading = document.querySelector("h1");
    if (!heading) return;

    const headingRow = heading.closest(".row");
    if (headingRow) {
      headingRow.style.display = "none";
    } else {
      heading.style.display = "none";
    }
  }

  // The Markbook's filter panel (six dropdowns: Learning Activities,
  // Academic Period, Unit, Activity Status, Weighting, Work Type) is
  // shown in full every time, even though most days you don't touch
  // it. This hides that whole panel by default and adds a small
  // "Filters" button to bring it back when you actually need it.
  function addFilterToggleOnMarkbook() {
    if (!isMarkbookPage()) return;
    if (document.querySelector(".my-filter-toggle")) return;

    const panel = document.querySelector("#filter_panel");
    if (!panel) return;

    // The toolbar row (Show Display Marks, Show Drafts, the "..."
    // menu) is rendered by a Vue component that loads a moment after
    // the rest of the page. If it isn't there yet, wait rather than
    // falling back to a different spot - applyTweaks() re-runs as the
    // page finishes rendering, so this will succeed once it appears.
    const legend = document.querySelector(".legend");
    const toolbarRow = legend ? legend.parentElement : null;
    if (!toolbarRow) return;

    panel.style.display = "none";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "my-filter-toggle";
    toggle.textContent = "Filters";
    toggle.addEventListener("click", () => {
      const isHidden = panel.style.display === "none";
      panel.style.display = isHidden ? "" : "none";
      toggle.classList.toggle("my-filter-toggle--active", isHidden);
    });

    toolbarRow.insertBefore(toggle, toolbarRow.firstChild);
  }

  // Lets you click a Markbook column header to sort student rows by
  // that column's values. Handles percentages, fractions like
  // "16 / 20", and blank "–" cells (blanks always sort to the end).
  function addSortableMarkbookColumns() {
    if (!isMarkbookPage()) return;

    const table = document.querySelector(".diagonal-headings-table");
    if (!table || table.classList.contains("my-sortable-ready")) return;

    const headerRow = table.querySelector("tr.rotate-headers");
    const tbody = table.querySelector("tbody");
    if (!headerRow || !tbody) return;

    table.classList.add("my-sortable-ready");

    const headers = Array.from(headerRow.children);
    headers.forEach((th, index) => {
      // Skip the blank corner cell above the student name column -
      // there's nothing meaningful to sort by there.
      if (index === 0) return;

      th.classList.add("my-sortable-header");
      th.addEventListener("click", () => {
        sortMarkbookByColumn(tbody, index, th, headers);
      });
    });
  }

  function sortMarkbookByColumn(tbody, columnIndex, clickedHeader, headers) {
    const rows = Array.from(tbody.querySelectorAll("tr")).filter(
      (row) => !row.classList.contains("sub-row")
    );

    const nextDirection =
      clickedHeader.dataset.sortDirection === "asc" ? "desc" : "asc";
    headers.forEach((h) => delete h.dataset.sortDirection);
    clickedHeader.dataset.sortDirection = nextDirection;

    const valueFor = (row) => {
      const cell = row.children[columnIndex];
      return cell ? parseMarkbookCellValue(cell.textContent) : null;
    };

    rows.sort((a, b) => {
      const valueA = valueFor(a);
      const valueB = valueFor(b);
      // Blank cells always sort last, regardless of direction.
      if (valueA === null && valueB === null) return 0;
      if (valueA === null) return 1;
      if (valueB === null) return -1;
      return nextDirection === "asc" ? valueA - valueB : valueB - valueA;
    });

    rows.forEach((row) => tbody.appendChild(row));
  }

  // Turns a Markbook cell's text into a sortable number. Handles
  // plain numbers/percentages ("76.1 %"), fractions ("16 / 20"), and
  // blanks ("–") which return null so they sort to the end.
  function parseMarkbookCellValue(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed === "–" || trimmed === "-") return null;

    const fraction = trimmed.match(
      /(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/
    );
    if (fraction) {
      const numerator = parseFloat(fraction[1]);
      const denominator = parseFloat(fraction[2]);
      return denominator ? numerator / denominator : null;
    }

    const number = trimmed.match(/-?\d+(?:\.\d+)?/);
    return number ? parseFloat(number[0]) : null;
  }

  // Shades each assessment-type bucket's own column (e.g. "Project",
  // "Theory Test" - the ones whose subtitle reads "Reported Grade")
  // with a solid tint, and forces that column's text to black so it
  // stays readable regardless of Schoolbox's own grade-based text
  // colour (green/orange/red). Child task columns are left alone.
  function addAssessmentTypeShading() {
    if (!isMarkbookPage()) return;

    const table = document.querySelector(".diagonal-headings-table");
    if (!table || table.classList.contains("my-shaded-ready")) return;

    const headerRow = table.querySelector("tr.rotate-headers");
    const averageRow = table.querySelector("tr.average-headers");
    const tbody = table.querySelector("tbody");
    if (!headerRow || !tbody) return;

    const hasAssessmentColumn = headerRow.querySelector(
      'th[data-test^="markbook-assessment-"]'
    );
    if (!hasAssessmentColumn) return;

    table.classList.add("my-shaded-ready");

    // One base colour per bucket, cycled through. Add more if a
    // class has more than six assessment-type buckets.
    const palette = [
      "59, 130, 189", // blue
      "122, 163, 74", // sage green
      "217, 155, 61", // amber
      "147, 112, 178", // purple
      "58, 143, 137", // teal
      "196, 112, 128", // rose
    ];

    const dataRows = [averageRow]
      .concat(
        Array.from(tbody.querySelectorAll("tr")).filter(
          (row) => !row.classList.contains("sub-row")
        )
      )
      .filter(Boolean);

    let colorIndex = -1;

    Array.from(headerRow.children).forEach((th, columnIndex) => {
      const isAssessmentColumn = th.matches(
        '[data-test^="markbook-assessment-"]'
      );
      if (!isAssessmentColumn) return;

      const metaLabel = th.querySelector(".meta");
      const label = metaLabel ? metaLabel.textContent.trim() : "";
      if (label !== "Reported Grade") return;

      colorIndex = (colorIndex + 1) % palette.length;
      const color = `rgba(${palette[colorIndex]}, 0.22)`;

      dataRows.forEach((row) => {
        const cell = row.children[columnIndex];
        if (cell) {
          cell.style.backgroundColor = color;
          cell.classList.add("my-bucket-shaded");
        }
      });
    });
  }

  // On a class homepage, Schoolbox already has a "Class Actions" menu
  // with all the links a teacher needs (Class List, Markbook, etc) —
  // it's just tucked inside a small dropdown that takes two clicks to
  // reach. This copies the most-used ones out and shows them as plain
  // buttons right under the class name, so they're always visible.
  function addQuickActionsOnClassHomepage() {
    if (document.querySelector(".my-quick-actions")) return;

    const dropdown = document.querySelector("#tab-control");
    if (!dropdown) return;

    // Which menu items to surface. Add or remove labels here to change
    // which buttons show up — the text must match exactly what's in
    // the dropdown.
    const wantedLabels = [
      "Class List",
      "Class Markbook",
      "Assessment Calendar",
      "Pastoral Care Report",
    ];

    const links = Array.from(dropdown.querySelectorAll("a")).filter((a) =>
      wantedLabels.includes(a.textContent.trim())
    );
    if (!links.length) return;

    const bar = document.createElement("div");
    bar.className = "my-quick-actions";

    links.forEach((link) => {
      const button = document.createElement("a");
      button.href = link.getAttribute("href");
      button.textContent = link.textContent.trim();
      button.className = "my-quick-action-button";
      bar.appendChild(button);
    });

    // Place it right after the row containing the class name heading.
    const heading = document.querySelector("h1.u-restrict-length");
    const titleRow = heading ? heading.closest(".row") : null;
    if (titleRow && titleRow.parentNode) {
      titleRow.parentNode.insertBefore(bar, titleRow.nextSibling);
    } else {
      const content = document.querySelector("#content") || document.body;
      content.insertBefore(bar, content.firstChild);
    }
  }

  // ---------------------------------------------------------------
  // Class homepage: embedded seating chart ("Seat")
  //
  // Adds a "Seating chart" button next to the existing quick-actions
  // row that opens Seat (risingsouth.github.io) inline in an iframe.
  // Seat detects being embedded (window.self !== window.top) and,
  // instead of its own localStorage, talks to this extension via
  // postMessage - one room per Schoolbox class, keyed by the class's
  // numeric id (already available from the Class List quick-action
  // link, so no separate lookup is needed).
  //
  // SAVE and LOAD are both driven directly by Schoolbox's own state -
  // no browser-local memory of "the current file" anywhere, so this
  // works identically for any staff member on any device, not just
  // whoever saved last.
  //
  // Confirmed directly from a real Manage Files page's HTML (not
  // guessed, not inferred from the compiled Vue component): the file
  // list is NOT a separate request at all - it's server-rendered
  // straight into that page's HTML, already sorted newest-first, one
  // <a title="{description}" href="/send.php?id={id}"> per file. So
  // finding "the current Seat layout for this class" is just: fetch
  // that class's Manage Files page, parse it, find the link whose
  // title matches, read the id out of its href. Same fetch-a-page-
  // and-parse-it technique already used for the bulletin PDF.
  //
  // Delete shape and the real hide mechanism (a separate PATCH to the
  // file's own visibilityUrl with a JSON body, confirmed the create
  // request's own hidden field does nothing) were both confirmed from
  // the real Manage Files component source.
  // ---------------------------------------------------------------

  const SEAT_URL = "https://risingsouth.github.io/seatingchart/";
  const SEAT_LAYOUT_DESCRIPTION = "Seat Layout — do not delete";
  const SEAT_FOLDER_URL_PREFIX = "/resources/folder/files/";

  // Relies on the :files array already being newest-first (confirmed
  // directly from a real raw response) - if a save is ever seen to
  // load stale, this ordering assumption is the first thing to
  // re-check.
  // The raw fetched HTML is the pre-hydration server template, not
  // the rendered page - there are no real <a> tags for files anywhere
  // in it (those only get built by Vue, client-side, after the page
  // loads and its JS runs, which a plain fetch() never triggers).
  // Confirmed directly from the real raw response: the whole file
  // list is already sitting there as JSON in the <view-all-files>
  // custom element's :files attribute, which is what this reads.
  function findSeatLayoutFile(classId) {
    return fetch(SEAT_FOLDER_URL_PREFIX + classId, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((res) => {
        console.log("[my-seat] folder fetch status", res.status, SEAT_FOLDER_URL_PREFIX + classId);
        return res.ok ? res.text() : null;
      })
      .then((html) => {
        if (!html) {
          console.log("[my-seat] folder fetch returned no HTML");
          return null;
        }
        const doc = new DOMParser().parseFromString(html, "text/html");
        const el = doc.querySelector("view-all-files");
        const filesAttr = el && el.getAttribute(":files");
        console.log("[my-seat] view-all-files element found?", !!el, "has :files attr?", !!filesAttr);
        if (!filesAttr) return null;

        let files;
        try {
          files = JSON.parse(filesAttr);
        } catch (e) {
          console.log("[my-seat] :files JSON.parse failed", e);
          return null;
        }

        const match = files.find((f) => f.name === SEAT_LAYOUT_DESCRIPTION);
        console.log("[my-seat] matching file found?", !!match, match && match.id);
        return match ? String(match.id) : null;
      })
      .catch((err) => {
        console.log("[my-seat] findSeatLayoutFile error", err);
        return null;
      });
  }

  // /send.php?id=X redirects to a signed, CORS-less R2 URL - the
  // same wall the bulletin PDF fetch hit (see background.js) - so
  // this has to go through the background worker rather than a
  // direct content-script fetch().
  function loadSeatLayout(classId) {
    return findSeatLayoutFile(classId).then((fileId) => {
      if (!fileId) {
        console.log("[my-seat] no existing file id, loading blank");
        return null;
      }
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "FETCH_TEXT", url: `${location.origin}/send.php?id=${fileId}` },
          (response) => {
            console.log("[my-seat] background file fetch ok?", response && response.ok);
            if (!response || !response.ok) {
              resolve(null);
              return;
            }
            try {
              resolve(JSON.parse(response.text));
            } catch (e) {
              console.log("[my-seat] JSON.parse failed", e, response.text.slice(0, 200));
              resolve(null);
            }
          }
        );
      });
    });
  }

  function uploadSeatLayout(classId, room) {
    return findSeatLayoutFile(classId).then((previousFileId) => {
      const formData = new FormData();
      formData.append("description", SEAT_LAYOUT_DESCRIPTION);
      formData.append("category", classId);
      formData.append("comment", "");
      formData.append(
        "file",
        new Blob([JSON.stringify(room)], { type: "text/plain" }),
        "seat-layout.txt"
      );

      return fetch("/cms/fileForm.php?ajax=1", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.id) return false;

          const hidePromise = data.visibilityUrl
            ? fetch(data.visibilityUrl, {
                method: "PATCH",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hidden: true }),
              }).catch(() => null)
            : Promise.resolve(null);

          return hidePromise.then(() => {
            if (previousFileId && previousFileId !== String(data.id)) {
              fetch(
                "/cms/fileForm.php?" +
                  new URLSearchParams({ ajax: "1", delete: previousFileId }),
                {
                  method: "DELETE",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                }
              ).catch(() => null);
            }
            return true;
          });
        })
        .catch(() => false);
    });
  }

  function addSeatWidgetOnClassHomepage() {
    if (!window.location.pathname.startsWith("/homepage/")) return;
    if (document.querySelector(".my-seat-toggle")) return;

    const bar = document.querySelector(".my-quick-actions");
    if (!bar) return;

    const classListLink = Array.from(bar.querySelectorAll("a")).find(
      (a) => a.textContent.trim() === "Class List"
    );
    const hrefMatch =
      classListLink &&
      classListLink.getAttribute("href").match(/\/learning\/class\/(\d+)/);
    if (!hrefMatch) return;
    const classId = hrefMatch[1];

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "my-quick-action-button my-seat-toggle";
    toggle.textContent = "Seating chart";
    bar.appendChild(toggle);

    const container = document.createElement("div");
    container.className = "my-seat-container";
    container.hidden = true;
    bar.insertAdjacentElement("afterend", container);

    let iframe = null;

    toggle.addEventListener("click", () => {
      const opening = container.hidden;
      container.hidden = !opening;
      if (!opening || iframe) return;

      iframe = document.createElement("iframe");
      iframe.className = "my-seat-iframe";
      iframe.src = SEAT_URL;
      container.appendChild(iframe);

      window.addEventListener("message", (event) => {
        if (!iframe || event.source !== iframe.contentWindow) return;
        console.log("[my-seat] message from iframe", event.data);
        if (!event.data || typeof event.data !== "object") return;

        if (event.data.type === "SEAT_READY") {
          console.log("[my-seat] SEAT_READY received for class", classId);
          loadSeatLayout(classId).then((room) => {
            console.log("[my-seat] replying SEAT_LOAD", room);
            if (iframe) {
              iframe.contentWindow.postMessage(
                { type: "SEAT_LOAD", room },
                "*"
              );
            }
          });
        } else if (event.data.type === "SEAT_SAVE") {
          uploadSeatLayout(classId, event.data.room).then((ok) => {
            if (iframe) {
              iframe.contentWindow.postMessage(
                { type: "SEAT_SAVE_RESULT", ok },
                "*"
              );
            }
          });
        }
      });
    });
  }

  // On the "My Classes" grid (/learning/classes), each card's own
  // "Class Actions" dropdown already has direct numeric-ID links for
  // Class List and Markbook - unlike the timetable boxes, no
  // code-to-ID redirect fetch is needed here. This just copies those
  // two links out as small buttons under the class name/code.
  function addQuickLinksOnClassesPage() {
    if (!window.location.pathname.startsWith("/learning/classes")) return;

    document.querySelectorAll(".v-card").forEach((card) => {
      const listItem = card.querySelector(".list-item");
      if (!listItem || listItem.querySelector(".my-quick-links")) return;

      const dropdown = card.querySelector("ul.f-dropdown");
      if (!dropdown) return;

      const wantedLabels = [
        "Class List",
        "Class Markbook",
        "Pastoral Care Report",
      ];
      const links = Array.from(dropdown.querySelectorAll("a")).filter((a) =>
        wantedLabels.includes(a.textContent.trim())
      );
      if (!links.length) return;

      const bar = document.createElement("div");
      bar.className = "my-quick-actions my-quick-links";

      links.forEach((link) => {
        const button = document.createElement("a");
        button.href = link.getAttribute("href");
        const text = link.textContent.trim();
        button.textContent =
          text === "Class Markbook"
            ? "Markbook"
            : text === "Pastoral Care Report"
            ? "Pastoral Care"
            : text;
        button.className = "my-quick-action-button my-quick-action-button--small";
        bar.appendChild(button);
      });

      listItem.appendChild(bar);
    });
  }

  // For each class box on the timetable, work out the class's real ID
  // number and add "Class List" and "Markbook" links.
  //
  // Why this is needed: the timetable only shows a link like
  // /homepage/code/08DESH%252001, which is based on the class CODE.
  // The class list / markbook pages need a different link, based on
  // the class's numeric ID (e.g. /learning/class/5708).
  //
  // Originally this asked Schoolbox for the code-based link in the
  // background and read where the redirect landed. That's dead now -
  // confirmed against a real class box (10COMH 01) that the code-based
  // link no longer server-redirects at all; fetch()'s res.url comes
  // back identical to the request URL even though a real browser tab
  // does land on the right class page, meaning whatever navigation
  // happens now is client-side JS a background fetch() can never see.
  //
  // Fixed by reading the numeric id from a source already sitting on
  // the same page instead: the dashboard's own calendar widget tags
  // every real class event with a group:{id} that matches this exact
  // numeric id (see getTodaysClassEntries()), and its title text
  // includes the same class code shown in each timetable box - e.g.
  // "...Computing (10COMH 01), MU.9" for group:5875, confirmed
  // directly against /learning/class/5875. Matching box code to
  // calendar code needs no network request at all.
  //
  // Only works for TODAY's classes, since the calendar widget only
  // ever lists today - fine for the dashboard (which only ever shows
  // today), gated accordingly below. If .timetable-subject boxes for
  // other days exist anywhere else on the site (e.g. the full
  // /timetable page), this can't help them - but the old approach
  // was already broken there too, this isn't a regression.
  //
  // Same-tab, plain links (no target, no click override). The PWA
  // link-capturing gotcha only bites when a click opens a NEW
  // browsing context (target="_blank" was routed into the installed
  // app's own window instead of a tab) - a normal same-tab navigation
  // doesn't create a new window for Chrome to redirect, so it isn't
  // caught by that capture path. NOT yet independently confirmed on
  // this specific link - worth a quick click-test after reload.
  function addClassListAndMarkbookLinks() {
    if (!isDashboardPage()) return;

    const classEntries = getTodaysClassEntries();
    if (!classEntries.length) return;

    const codeToId = new Map();
    classEntries.forEach(({ id, label }) => {
      const codeMatch = label.match(/\(([^)]+)\)/);
      if (!codeMatch) return;
      codeToId.set(normaliseClassCode(codeMatch[1]), id);
    });

    document.querySelectorAll(".timetable-subject").forEach((box) => {
      if (box.querySelector(".my-added-links")) return;

      const codeEl = box.querySelector(":scope > div");
      if (!codeEl) return;

      const classId = codeToId.get(normaliseClassCode(codeEl.textContent));
      if (!classId) return;

      const wrapper = document.createElement("div");
      wrapper.className = "my-added-links";

      const classListLink = document.createElement("a");
      classListLink.href = `/learning/class/${classId}`;
      classListLink.textContent = "Class List";

      const separator = document.createTextNode(" | ");

      const markbookLink = document.createElement("a");
      markbookLink.href = `/learning/markbook/class/${classId}`;
      markbookLink.textContent = "Markbook";

      wrapper.appendChild(classListLink);
      wrapper.appendChild(separator);
      wrapper.appendChild(markbookLink);
      box.appendChild(wrapper);
    });
  }

  // Defaults to "hideSymbols" - the less destructive of the two modes,
  // since it never removes a student from the list, just declutters
  // their flags. Only overridden if the teacher has turned on "Remember
  // my choices" and a different mode was saved last time.
  let flagFilterMode = "hideSymbols";

  // Guards against addPastoralFlagFilter() re-entering while its
  // chrome.storage.sync.get() lookup is still in flight - the
  // MutationObserver can call this several times a second, and without
  // this a slow storage read could end up building the bar twice.
  let flagFilterBuilding = false;

  // On the Class List page, every pastoral flag's title is
  // "Category: Specific reason" (e.g. "Curriculum: Concern",
  // "PMI Request: Late"). This reads the category off every flag
  // already on the page - no hardcoded list to keep in sync if
  // Carey adds new flag types - and shows a toggle pill per
  // category. Which pills are solid vs outlined mirrors their
  // on/off state directly, rather than relying on a checkbox that's
  // easy to miss at this size. Unticked categories are always
  // hidden outright (not dimmed); the mode switch only decides
  // whether a student whose remaining flags are all hidden drops
  // out of the list too ("Hide students") or just shows an empty
  // flags area ("Hide symbols").
  //
  // "Remember my choices" is opt-in and off by default - ticking it
  // saves the current mode and excluded categories to
  // chrome.storage.sync, so the same choices come back on every class
  // and every device signed into the same Chrome profile. Categories
  // are stored as an *excluded* list rather than an included one, so a
  // category this class doesn't have yet (or a brand new flag type)
  // still defaults to included rather than silently vanishing.
  function addPastoralFlagFilter() {
    if (!isClassListPage()) return;
    if (document.querySelector(".my-flag-filter-wrap")) return;
    if (flagFilterBuilding) return;

    const flagRows = document.querySelectorAll(
      'div[data-test^="pastoral-flags-"]'
    );
    if (!flagRows.length) return;

    const categories = new Set();
    flagRows.forEach((row) => {
      Array.from(row.children).forEach((label) => {
        if (label.tagName.toLowerCase() !== "sbx-label") return;
        const title = label.getAttribute("title") || "";
        const category = title.split(":")[0].trim();
        if (category) categories.add(category);
      });
    });
    if (!categories.size) return;

    const sortedCategories = Array.from(categories).sort();

    flagFilterBuilding = true;
    chrome.storage.sync.get(
      {
        flagFilterRemember: false,
        flagFilterMode: "hideSymbols",
        flagFilterExcludedCategories: [],
      },
      (saved) => {
        flagFilterBuilding = false;
        // A second mutation-observer pass may have already built the
        // bar while this lookup was in flight.
        if (document.querySelector(".my-flag-filter-wrap")) return;

        flagFilterMode = saved.flagFilterRemember
          ? saved.flagFilterMode
          : "hideSymbols";

        const checkedCategories = new Set(sortedCategories);
        if (saved.flagFilterRemember) {
          saved.flagFilterExcludedCategories.forEach((category) =>
            checkedCategories.delete(category)
          );
        }

        buildPastoralFlagFilterBar(
          sortedCategories,
          checkedCategories,
          saved.flagFilterRemember
        );
      }
    );
  }

  function buildPastoralFlagFilterBar(
    sortedCategories,
    checkedCategories,
    rememberInitial
  ) {
    const wrap = document.createElement("div");
    wrap.className = "my-flag-filter-wrap";

    const modeRow = document.createElement("div");
    modeRow.className = "my-flag-filter-mode-row";

    const modeLabel = document.createElement("span");
    modeLabel.textContent = "When unticked:";
    modeRow.appendChild(modeLabel);

    const modeSwitch = document.createElement("div");
    modeSwitch.className = "my-flag-filter-mode-switch";

    const modeOptions = [
      { value: "hideStudents", label: "Hide students" },
      { value: "hideSymbols", label: "Hide symbols" },
    ];

    const modeButtons = modeOptions.map(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "my-flag-filter-mode-button";
      button.classList.toggle(
        "my-flag-filter-mode-button--active",
        value === flagFilterMode
      );
      button.addEventListener("click", () => {
        flagFilterMode = value;
        modeButtons.forEach((btn, i) => {
          btn.classList.toggle(
            "my-flag-filter-mode-button--active",
            modeOptions[i].value === flagFilterMode
          );
        });
        applyPastoralFlagFilter(checkedCategories, sortedCategories.length);
        saveFlagFilterState();
      });
      modeSwitch.appendChild(button);
      return button;
    });

    modeRow.appendChild(modeSwitch);

    const rememberWrap = document.createElement("span");
    rememberWrap.className = "my-flag-filter-remember";

    // Same custom switch as the nav dropdown's "Enable tweaks" toggle -
    // Schoolbox's own site CSS does something to plain
    // <input type="checkbox"> that leaves it invisible (rendering with
    // no visible box at all, still clickable, just nothing to see).
    // This pattern hides the native input entirely (opacity/width/
    // height zero) and draws its own slider span instead, so it never
    // depends on Schoolbox's checkbox styling in the first place.
    const rememberSwitch = document.createElement("label");
    rememberSwitch.className = "my-nav-switch";

    const rememberCheckbox = document.createElement("input");
    rememberCheckbox.type = "checkbox";
    rememberCheckbox.checked = rememberInitial;

    const rememberSlider = document.createElement("span");
    rememberSlider.className = "my-nav-slider";

    function saveFlagFilterState() {
      if (!rememberCheckbox.checked) return;
      const excluded = sortedCategories.filter(
        (category) => !checkedCategories.has(category)
      );
      chrome.storage.sync.set({
        flagFilterRemember: true,
        flagFilterMode,
        flagFilterExcludedCategories: excluded,
      });
    }

    rememberCheckbox.addEventListener("change", () => {
      if (rememberCheckbox.checked) {
        // Captures whatever's currently selected the moment this is
        // ticked on, rather than waiting for the next pill click.
        saveFlagFilterState();
      } else {
        chrome.storage.sync.set({ flagFilterRemember: false });
      }
    });

    rememberSwitch.appendChild(rememberCheckbox);
    rememberSwitch.appendChild(rememberSlider);
    rememberWrap.appendChild(rememberSwitch);
    rememberWrap.appendChild(document.createTextNode("Remember my choices"));
    modeRow.appendChild(rememberWrap);

    wrap.appendChild(modeRow);

    const bar = document.createElement("div");
    bar.className = "my-flag-filter-bar";

    const pillButtons = sortedCategories.map((category) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "my-flag-filter-pill";
      pill.classList.toggle(
        "my-flag-filter-pill--active",
        checkedCategories.has(category)
      );
      pill.textContent = category;
      pill.addEventListener("click", () => {
        if (checkedCategories.has(category)) {
          checkedCategories.delete(category);
          pill.classList.remove("my-flag-filter-pill--active");
        } else {
          checkedCategories.add(category);
          pill.classList.add("my-flag-filter-pill--active");
        }
        applyPastoralFlagFilter(checkedCategories, sortedCategories.length);
        saveFlagFilterState();
      });
      bar.appendChild(pill);
      return pill;
    });

    const selectAllButton = document.createElement("button");
    selectAllButton.type = "button";
    selectAllButton.className = "my-flag-filter-text-button";
    selectAllButton.textContent = "Select all";
    selectAllButton.addEventListener("click", () => {
      sortedCategories.forEach((category) => checkedCategories.add(category));
      pillButtons.forEach((pill) =>
        pill.classList.add("my-flag-filter-pill--active")
      );
      applyPastoralFlagFilter(checkedCategories, sortedCategories.length);
      saveFlagFilterState();
    });
    bar.appendChild(selectAllButton);

    const deselectAllButton = document.createElement("button");
    deselectAllButton.type = "button";
    deselectAllButton.className = "my-flag-filter-text-button";
    deselectAllButton.textContent = "Deselect all";
    deselectAllButton.addEventListener("click", () => {
      checkedCategories.clear();
      pillButtons.forEach((pill) =>
        pill.classList.remove("my-flag-filter-pill--active")
      );
      applyPastoralFlagFilter(checkedCategories, sortedCategories.length);
      saveFlagFilterState();
    });
    bar.appendChild(deselectAllButton);

    wrap.appendChild(bar);

    // Placed right after the breadcrumb, which sits outside the
    // class-list Vue app's own root (#email-class-lists) - inserting
    // inside that root risks Vue wiping it out on its own re-renders,
    // the same trap noted elsewhere in this file for Markbook widgets.
    const breadcrumb = document.querySelector("ul.breadcrumb");
    if (breadcrumb && breadcrumb.parentNode) {
      breadcrumb.parentNode.insertBefore(wrap, breadcrumb.nextSibling);
    } else {
      const content = document.querySelector("#content") || document.body;
      content.insertBefore(wrap, content.firstChild);
    }

    // Reflects the restored state in the page immediately, in case the
    // remembered mode/categories differ from a fresh "all checked,
    // hide symbols" default.
    applyPastoralFlagFilter(checkedCategories, sortedCategories.length);
  }

  function applyPastoralFlagFilter(checkedCategories, totalCategoryCount) {
    const allChecked = checkedCategories.size === totalCategoryCount;
    const hideEmptyRows = flagFilterMode === "hideStudents";

    document
      .querySelectorAll('div[data-test^="pastoral-flags-"]')
      .forEach((flagRow) => {
        let anyVisible = false;

        Array.from(flagRow.children).forEach((label) => {
          if (label.tagName.toLowerCase() !== "sbx-label") return;
          const title = label.getAttribute("title") || "";
          const category = title.split(":")[0].trim();
          const matches = checkedCategories.has(category);
          label.style.display = matches ? "" : "none";
          if (matches) anyVisible = true;
        });

        const studentRow = flagRow.closest("tr");
        if (!studentRow) return;

        studentRow.style.display =
          !hideEmptyRows || allChecked || anyVisible ? "" : "none";
      });
  }

  // YM/HOY issues are logged as two separate flags - "Given" and
  // "Removed" - so the number that actually matters day to day (how
  // many a student is currently sitting on) takes mental arithmetic
  // to see at a glance. This computes Given minus Removed and shows
  // it as a small badge on the student's portrait, leaving the two
  // original flags untouched for anyone who wants the raw history.
  // Removed is clamped so it can never push the count below zero -
  // if Schoolbox's own data is ever out of sync (e.g. a removal
  // logged before its matching "given" ages off), showing "0"
  // reads as reassuring; showing "-3" reads as a bug in this
  // extension.
  const PMI_GIVEN_TITLE = "YM/HOY: Personal Management Issue Given";
  const PMI_REMOVED_TITLE = "YM/HOY: Personal Management Issue Removed";

  // Shared by addPmiBadges() and addStudentAttentionTags() - both
  // need to hang something off the student's portrait, so whichever
  // one runs first creates the wrapper and the other just reuses it,
  // rather than each wrapping the <img> a second time.
  function getAvatarWrap(studentRow) {
    const existing = studentRow.querySelector(".my-pmi-avatar-wrap");
    if (existing) return existing;

    const portrait = studentRow.querySelector('img[src*="/portrait.php"]');
    if (!portrait) return null;

    const wrapper = document.createElement("span");
    wrapper.className = "my-pmi-avatar-wrap";
    portrait.parentNode.insertBefore(wrapper, portrait);
    wrapper.appendChild(portrait);
    return wrapper;
  }

  function addPmiBadges() {
    if (!isClassListPage()) return;

    document
      .querySelectorAll('div[data-test^="pastoral-flags-"]')
      .forEach((flagRow) => {
        if (flagRow.dataset.myPmiBadged) return;

        const studentRow = flagRow.closest("tr");
        if (!studentRow) return;

        const wrapper = getAvatarWrap(studentRow);
        if (!wrapper) return;

        let given = 0;
        let removed = 0;
        Array.from(flagRow.children).forEach((label) => {
          if (label.tagName.toLowerCase() !== "sbx-label") return;
          const title = label.getAttribute("title");
          const count = parseInt(label.getAttribute("text"), 10) || 0;
          if (title === PMI_GIVEN_TITLE) given = count;
          if (title === PMI_REMOVED_TITLE) removed = count;
        });

        const current = Math.max(0, given - removed);

        const badge = document.createElement("span");
        badge.className =
          current > 0
            ? "my-pmi-badge my-pmi-badge--active"
            : "my-pmi-badge my-pmi-badge--zero";
        badge.textContent = String(current);
        badge.title = `Current PMI level: ${current} (Given ${given}, Removed ${removed})`;
        wrapper.appendChild(badge);

        flagRow.dataset.myPmiBadged = "true";
      });
  }

  // Three flags get pulled out and made hard to miss, rather than
  // sitting at the same visual weight as every other pill:
  //   - the standalone "Medical Alert" icon (life-threat conditions)
  //   - "Medical: Risk Management Plan"
  //   - "Curriculum: IEP" / "Curriculum: Adjustment" (merged into one
  //     "Learning support" tag - the IEP/Adjustment distinction still
  //     shows in the ordinary flag pills below for anyone who needs it)
  //
  // A student can have more than one of these at once (this class
  // has a real example). The ring colour and row tint only ever
  // reflect the single most severe tier present - layering two
  // colours on top of each other would just dilute whichever one
  // actually needs the teacher's attention first. The text tags
  // underneath stack regardless, most severe first, so nothing gets
  // silently dropped just because a more urgent flag exists.
  const RISK_PLAN_TITLE = "Medical: Risk Management Plan";
  const LEARNING_SUPPORT_TITLES = ["Curriculum: IEP", "Curriculum: Adjustment"];

  function addStudentAttentionTags() {
    if (!isClassListPage()) return;

    document
      .querySelectorAll('div[data-test^="pastoral-flags-"]')
      .forEach((flagRow) => {
        if (flagRow.dataset.myAttentionTagged) return;

        const studentRow = flagRow.closest("tr");
        if (!studentRow) return;

        const medicalAlertIcon = studentRow.querySelector(
          'sbx-icon[title^="Medical Alert:"]'
        );
        const flagLabels = Array.from(flagRow.children).filter(
          (el) => el.tagName.toLowerCase() === "sbx-label"
        );
        const hasRiskPlan = flagLabels.some(
          (label) => label.getAttribute("title") === RISK_PLAN_TITLE
        );
        const hasLearningSupport = flagLabels.some((label) =>
          LEARNING_SUPPORT_TITLES.includes(label.getAttribute("title"))
        );

        if (!medicalAlertIcon && !hasRiskPlan && !hasLearningSupport) return;
        flagRow.dataset.myAttentionTagged = "true";

        const wrapper = getAvatarWrap(studentRow);
        if (wrapper) {
          if (medicalAlertIcon) {
            wrapper.classList.add("my-avatar-ring--danger");
          } else if (hasRiskPlan) {
            wrapper.classList.add("my-avatar-ring--warning");
          }
        }
        if (medicalAlertIcon) {
          studentRow.classList.add("my-row-tint--danger");
        }

        const tags = document.createElement("div");
        tags.className = "my-attention-tags";

        if (medicalAlertIcon) {
          const description = (
            medicalAlertIcon.getAttribute("title") || ""
          ).replace(/^Medical Alert:\s*/, "");
          const tag = document.createElement("div");
          tag.className = "my-attention-tag my-attention-tag--danger";
          tag.textContent = description || "Medical alert";
          tags.appendChild(tag);
        }

        if (hasRiskPlan) {
          const tag = document.createElement("div");
          tag.className = "my-attention-tag my-attention-tag--warning";
          tag.textContent = "Risk management plan on file";
          tags.appendChild(tag);
        }

        if (hasLearningSupport) {
          const tag = document.createElement("div");
          tag.className = "my-attention-tag my-attention-tag--info";
          tag.textContent = "Learning support";
          tags.appendChild(tag);
        }

        // Locates the name row via the student row's own structure,
        // not via flagRow's current parent - reorganiseClassListColumns()
        // moves flagRow into a different column entirely, and this
        // needs to keep working regardless of where flagRow ends up.
        const nameContainer = studentRow.querySelector(".u-flex-col.u-gap-s");
        const nameRow = nameContainer ? nameContainer.firstElementChild : null;
        if (nameRow) {
          nameRow.after(tags);
        } else if (nameContainer) {
          nameContainer.insertBefore(tags, nameContainer.firstChild);
        }
      });
  }

  // The Class List table ships four columns that carry little
  // day-to-day value: Differentiation Profile, Year Level, and House
  // sit blank for nearly every student in this class, and Last
  // Visited isn't what a teacher is scanning for. Meanwhile the
  // pastoral flags get crammed into the Name column, making it by
  // far the widest, busiest cell on the page. This hides Year
  // Level, House, and Last Visited outright, and moves the flag
  // pills into the Differentiation Profile column instead of
  // removing that one too - it's already empty, so repurposing it
  // gives the flags room without shrinking anything else.
  //
  // Column positions are found by header text/data-test rather than
  // hardcoded indexes, since a school with different columns enabled
  // (or House/Year Level turned off entirely) would shift everything
  // over - this stays correct either way, or simply does nothing for
  // any column it can't find.
  function reorganiseClassListColumns() {
    if (!isClassListPage()) return;

    const table = document.querySelector("#contact-table");
    if (!table) return;

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) return;

    const headers = Array.from(headerRow.children);
    const findIndex = (matcher) => headers.findIndex(matcher);

    const flagsColumnIndex = findIndex(
      (th) => th.textContent.trim() === "Differentiation Profile"
    );
    const hiddenColumnIndexes = [
      findIndex(
        (th) =>
          th.dataset.test === "class-list-year-level-column" ||
          th.textContent.trim() === "Year Level"
      ),
      findIndex(
        (th) =>
          th.dataset.test === "class-list-house-column" ||
          th.textContent.trim() === "House"
      ),
      findIndex((th) => th.textContent.trim() === "Last Visited"),
    ].filter((index) => index !== -1);

    if (flagsColumnIndex === -1 && !hiddenColumnIndexes.length) return;

    if (!table.classList.contains("my-columns-reorganised")) {
      table.classList.add("my-columns-reorganised");
      if (flagsColumnIndex !== -1) {
        headers[flagsColumnIndex].textContent = "Pastoral flags";
      }
      hiddenColumnIndexes.forEach((index) => {
        headers[index].style.display = "none";
      });
    }

    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.classList.contains("sub-row")) return;

      hiddenColumnIndexes.forEach((index) => {
        const cell = row.children[index];
        if (cell) cell.style.display = "none";
      });

      if (flagsColumnIndex === -1) return;
      const targetCell = row.children[flagsColumnIndex];
      const flagRow = row.querySelector('div[data-test^="pastoral-flags-"]');
      // Checked every pass rather than flagged as "done" once - if
      // Vue ever re-renders this cell back to its own empty content,
      // this puts the flags back on the next mutation instead of
      // silently losing them for the rest of the session.
      if (targetCell && flagRow && flagRow.parentElement !== targetCell) {
        targetCell.appendChild(flagRow);
      }
    });
  }

  function isDashboardPage() {
    return !!document.querySelector(".Component_Dashboard_GreetingController");
  }

  // The dashboard's own calendar widget marks today's row with
  // "fc-day-today" and tags every real timetabled period (not
  // all-day events, not personal lesson-plan reminders) with
  // "type1 source8" plus a data-calendar-event-relation="group:{id}"
  // attribute. That group id lines up with the same numeric class id
  // used elsewhere on the site (e.g. /learning/class/{id}) - this is
  // inferred from one matching example rather than confirmed for
  // every class type, so it's worth spot-checking against a couple
  // of real classes before trusting this fully.
  function getTodaysClassEntries() {
    const table = document.querySelector(".fc-list-table");
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll("tbody > tr"));
    const todayIndex = rows.findIndex((row) =>
      row.classList.contains("fc-day-today")
    );
    if (todayIndex === -1) return [];

    const entries = [];
    const seen = new Set();

    for (let i = todayIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.classList.contains("fc-list-day")) break;
      if (!row.classList.contains("type1") || !row.classList.contains("source8"))
        continue;

      const relation = row.dataset.calendarEventRelation || "";
      const match = relation.match(/^group:(\d+)$/);
      if (!match) continue;

      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);

      const titleEl = row.querySelector(".fc-event-title");
      const label = titleEl
        ? titleEl.textContent.trim().replace(/\s+/g, " ")
        : `Class ${id}`;
      entries.push({ id, label });
    }

    return entries;
  }

  // ---------------------------------------------------------------
  // Dashboard: "Check for relief" button
  //
  // Reads the day's daily bulletin PDF (posted to the news feed most
  // mornings, sometimes reissued later the same day) and looks for
  // cover assignments made to the current user, then marks the
  // matching period(s) on the dashboard's own timetable table.
  //
  // Deliberately manual rather than automatic - no auto-fetch, no
  // polling, no staleness-detection against reissued bulletins (the
  // dashboard's own <time> timestamp doesn't move when a post is
  // edited in place, so there's no reliable signal to auto-detect a
  // reissue). Click again any time to re-check.
  //
  // v1 only covers ONE direction: classes the current user has been
  // assigned to cover. It does not yet detect the reverse case (the
  // user's own class being covered by someone else) - that lives in
  // a different, far less structured part of the bulletin (a
  // multi-name table rather than the clean repeated per-person
  // blocks this relies on) and needs a confirmed real example before
  // it's worth attempting.
  // ---------------------------------------------------------------

  // Only covers periods that actually appear as timetable columns
  // (teaching sessions + homeroom). Duty slots like BSH/RH/LH/ASH/
  // AS2H never have a matching column, so they're intentionally left
  // out here - there's nothing on the dashboard timetable to mark.
  const RELIEF_PERIOD_START_TIMES = {
    HH: "8:30am",
    "1H": "8:45am",
    "2H": "9:45am",
    "3H": "11:00am",
    "4H": "12:00pm",
    "5H": "1:30pm",
    "6H": "2:30pm",
  };

  let pdfjsLibPromise = null;

  // Dynamic import() of a web_accessible_resources URL is supported
  // in content scripts. Loaded lazily - most dashboard visits never
  // click the button, so there's no reason to pull in an 860KB+2.2MB
  // library until it's actually needed.
  function loadPdfJsLib() {
    if (!pdfjsLibPromise) {
      pdfjsLibPromise = import(
        chrome.runtime.getURL("vendor/pdfjs/pdf.mjs")
      ).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
          "vendor/pdfjs/pdf.worker.mjs"
        );
        return lib;
      });
    }
    return pdfjsLibPromise;
  }

  // The dashboard news feed lists "Daily bulletin ..." as an ordinary
  // post, most recent first. Rather than trying to parse the date out
  // of the title text, this just takes the first (topmost) match -
  // reliable as long as there's only ever one bulletin post visible
  // near the top of the feed at a time, which matches what's been
  // observed so far.
  //
  // Deliberately NOT anchored to the start of the title: when a
  // bulletin is reissued the same day, Schoolbox prepends "UPDATED:
  // [time] - " to the title (confirmed directly: "UPDATED: 9:20am -
  // Daily bulletin Sep 14, 2026 Mon"), which an anchored ^ match would
  // miss entirely - the button would wrongly report no bulletin found
  // on exactly the days it matters most (a reissue).
  function findTodaysBulletinLink() {
    const link = Array.from(
      document.querySelectorAll("#news-component a")
    ).find((a) => /Daily bulletin/i.test(a.textContent));
    const href = link ? link.href : null;
    console.log("Schoolbox UX tweaks: found bulletin link", href);
    return href;
  }

  // ASSUMPTION, not yet confirmed against the live article markup:
  // that the bulletin's PDF attachment shows up as a plain <a
  // href="....pdf"> somewhere on the fetched article page. If
  // Schoolbox wraps attachments in something less direct (a download
  // button, a JS-driven link, etc.) this will come back empty and
  // the button will report "No attachment found" - worth checking
  // against a real bulletin post and adjusting this selector if so.
  async function findBulletinPdfUrl(newsUrl) {
    console.log("Schoolbox UX tweaks: fetching bulletin article", newsUrl);
    const res = await fetch(newsUrl, { credentials: "include" });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pdfLink = doc.querySelector('a[href$=".pdf"]');
    const pdfUrl = pdfLink
      ? new URL(pdfLink.getAttribute("href"), newsUrl).href
      : null;
    console.log("Schoolbox UX tweaks: found PDF attachment", pdfUrl);
    return pdfUrl;
  }

  // The R2 redirect target sends no Access-Control-Allow-Origin header
  // at all - not a credentials issue, this bucket just isn't
  // configured for browser-side CORS. A content script's fetch() is
  // bound by the same CORS rules as the page itself, so there's no
  // fetch() option here that gets around it. The background service
  // worker (background.js) is a different context: with the
  // host_permissions declared in manifest.json, its fetches aren't
  // subject to CORS at all. So this hands the actual network request
  // off to it and gets the bytes back as base64 over
  // chrome.runtime.sendMessage (structured message passing doesn't
  // reliably carry raw ArrayBuffers).
  function fetchPdfBytes(pdfUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "FETCH_PDF_BYTES", url: pdfUrl },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response || !response.ok) {
            reject(
              new Error(response?.error || "Background PDF fetch failed")
            );
            return;
          }
          const binary = atob(response.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          resolve(bytes);
        }
      );
    });
  }

  // Reconstructs rough text lines from pdf.js's flat item list by
  // bucketing items that share a y-position (rounded to absorb minor
  // baseline differences within the same visual line, e.g. mixed
  // bold/regular text), then ordering each bucket left-to-right.
  // This is a heuristic - it hasn't been verified against the real
  // bulletin PDF's actual internal layout, and may need the rounding
  // tolerance adjusted if rows come out split or merged incorrectly.
  async function extractPdfText(pdfUrl) {
    const pdfjsLib = await loadPdfJsLib();
    console.log("Schoolbox UX tweaks: fetching bulletin PDF", pdfUrl);
    const bytes = await fetchPdfBytes(pdfUrl);
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;

    const lines = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      const rows = new Map();
      content.items.forEach((item) => {
        const y = Math.round(item.transform[5] / 2) * 2;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push(item);
      });

      Array.from(rows.keys())
        .sort((a, b) => b - a)
        .forEach((y) => {
          const rowText = rows
            .get(y)
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map((item) => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (rowText) lines.push(rowText);
        });
    }
    return lines.join("\n");
  }

  // window.schoolboxUser is set by Schoolbox's own inline <script> in
  // the page's JS world, which this (isolated-world) content script
  // can't see directly. main-world-bridge.js copies the two fields
  // needed onto a DOM attribute instead, since the DOM - unlike JS
  // globals - genuinely is shared between the two worlds.
  function getSchoolboxUserMatchName() {
    const raw = document.documentElement.getAttribute("data-schoolbox-user");
    if (!raw) return null;
    try {
      const user = JSON.parse(raw);
      if (!user.lastname || !user.firstname) return null;
      return `${user.lastname}, ${user.firstname}`;
    } catch (err) {
      return null;
    }
  }

  // Matches the bulletin's repeated per-person blocks:
  //   "Southwood, Gus (SOUTAN01) , you have been assigned the
  //   following cover today :
  //   Period Room Class name Class code Class teacher
  //   HH L.1 Homeroom (House) 10DJERAN.01 Southwood, Gus"
  // matchName comes from getSchoolboxUserMatchName() rather than
  // hardcoding, so this works correctly for whoever is signed in.
  function parseCoveringAssignments(text, matchName) {
    const escapedName = matchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockRegex = new RegExp(
      escapedName +
        "\\s*\\([A-Z0-9]+\\)\\s*,\\s*you have been assigned the following cover today\\s*:([\\s\\S]*?)(?=" +
        escapedName +
        "\\s*\\(|$)",
      "g"
    );
    const rowRegex =
      /(HH|[1-6]H)\s+(\S+)\s+(.+?)\s+([A-Z0-9]+\.[0-9]+)\s+(.+)/;

    const results = [];
    let match;
    while ((match = blockRegex.exec(text))) {
      const rowMatch = match[1].match(rowRegex);
      if (!rowMatch) continue;
      results.push({
        periodCode: rowMatch[1].trim(),
        room: rowMatch[2].trim(),
        className: rowMatch[3].trim(),
        classCode: rowMatch[4].trim(),
      });
    }
    return results;
  }

  function getDesktopTimetableTable() {
    return document.querySelector("table.timetable[data-timetable]");
  }

  // Combined periods (two classes running at the same time, e.g. an
  // ATAR unit split across two columns) share one start time, so more
  // than one column can legitimately match here. Returns every match
  // - callers that care which specific one to mark disambiguate using
  // the assignment's class code instead of assuming index 0.
  function findColumnIndexesForPeriodCode(table, periodCode) {
    const startTime = RELIEF_PERIOD_START_TIMES[periodCode];
    if (!startTime) return [];

    const headerCells = Array.from(table.querySelectorAll("thead th"));
    const indexes = [];
    headerCells.forEach((th, index) => {
      const timeEl = th.querySelector("time.meta");
      if (!timeEl) return;
      const start = timeEl.textContent.split("–")[0].trim().toLowerCase();
      if (start === startTime.toLowerCase()) indexes.push(index);
    });
    return indexes;
  }

  // The bulletin writes class codes with a dot ("10DJERAN.01"); the
  // dashboard timetable writes them with a space ("10DJERAN 01").
  // Normalising both the same way lets them compare equal.
  function normaliseClassCode(code) {
    return code.replace(/[.\s]+/g, " ").trim().toLowerCase();
  }

  // Non-destructive by design: rather than overwriting the cell's
  // existing content (which would lose the "Mark Attendance" link
  // and the original class info), this adds a red border to the
  // whole cell plus a small overlay banner naming the class being
  // covered. Re-running (e.g. clicking the button twice) is safe -
  // already-marked cells are skipped.
  function markCoveringCell(cell, assignment) {
    const subject = cell.querySelector(".timetable-subject");
    if (!subject || subject.classList.contains("my-relief-cover")) return;

    subject.classList.add("my-relief-cover");

    const banner = document.createElement("div");
    banner.className = "my-relief-cover-banner";
    banner.textContent = `Covering: ${assignment.className} (${assignment.classCode}), ${assignment.room}`;
    subject.insertBefore(banner, subject.firstChild);
  }

  // When a period has only one column, this is trivial. When it has
  // more than one (a combined/split period, like two ATAR units both
  // starting 9:45am), the class code in the assignment picks out
  // which specific column is actually being covered. If none of the
  // candidates' codes match - the covered class isn't one of the
  // user's own displayed classes at all - every candidate column gets
  // marked instead of silently guessing wrong or dropping it.
  function markCoveringAssignment(table, assignment) {
    const columnIndexes = findColumnIndexesForPeriodCode(
      table,
      assignment.periodCode
    );
    if (!columnIndexes.length) return false;

    const row = table.querySelector("tbody tr");
    if (!row) return false;

    const targetCode = normaliseClassCode(assignment.classCode);
    const matchingIndex = columnIndexes.find((index) => {
      const cell = row.children[index];
      if (!cell) return false;
      const codeEl = cell.querySelector(".timetable-subject > div");
      return codeEl && normaliseClassCode(codeEl.textContent) === targetCode;
    });

    const indexesToMark =
      matchingIndex !== undefined ? [matchingIndex] : columnIndexes;

    let marked = false;
    indexesToMark.forEach((index) => {
      const cell = row.children[index];
      if (cell) {
        markCoveringCell(cell, assignment);
        marked = true;
      }
    });
    return marked;
  }

  function resetReliefButton(button) {
    button.disabled = false;
    button.classList.remove("my-relief-checked");
    button.textContent = "Check for relief";
  }

  // Keyed by today's date so a stored result from yesterday is simply
  // never read back - no separate cleanup needed, it just becomes
  // irrelevant once the date rolls over.
  function getReliefStorageKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `reliefCheck-${y}-${m}-${d}`;
  }

  // Only the assignments themselves are stored - not the button's
  // rendered text, not the applied count. Re-marking the table from
  // the same assignments on restore reuses the exact same code path
  // (and the same idempotency guard) as a live check, rather than
  // keeping a second, parallel way of rendering the same information.
  function saveReliefCheckResult(assignments, checkedAtMs) {
    chrome.storage.local.set({
      [getReliefStorageKey()]: { assignments, checkedAtMs },
    });
  }

  function formatReliefButtonLabel(appliedCount, checkedAtMs) {
    const timeLabel = new Date(checkedAtMs).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return appliedCount
      ? `Checked at ${timeLabel} — ${appliedCount} cover${
          appliedCount === 1 ? "" : "s"
        } found`
      : `Checked at ${timeLabel} — no cover today`;
  }

  // Runs once, right after the button is first created - restores
  // today's already-checked state (if any) purely from local storage,
  // no fetch involved. This is why the button doesn't look like it's
  // "forgotten" a check after a page refresh: the check itself only
  // ever happens on click, but its result now survives a reload.
  function restoreReliefCheckResult(button) {
    chrome.storage.local.get(getReliefStorageKey(), (result) => {
      const stored = result[getReliefStorageKey()];
      if (!stored) return;

      const table = getDesktopTimetableTable();
      let appliedCount = 0;
      if (table) {
        stored.assignments.forEach((assignment) => {
          if (markCoveringAssignment(table, assignment)) appliedCount++;
        });
      }

      button.textContent = formatReliefButtonLabel(
        appliedCount,
        stored.checkedAtMs
      );
      button.classList.add("my-relief-checked");
    });
  }

  async function checkForRelief(button) {
    button.disabled = true;
    button.textContent = "Checking…";

    try {
      const bulletinUrl = findTodaysBulletinLink();
      if (!bulletinUrl) {
        button.textContent = "No bulletin found today";
        setTimeout(() => resetReliefButton(button), 4000);
        return;
      }

      const matchName = getSchoolboxUserMatchName();
      if (!matchName) {
        button.textContent = "Couldn't read your name";
        setTimeout(() => resetReliefButton(button), 4000);
        return;
      }

      const pdfUrl = await findBulletinPdfUrl(bulletinUrl);
      if (!pdfUrl) {
        button.textContent = "No attachment found";
        setTimeout(() => resetReliefButton(button), 4000);
        return;
      }

      const text = await extractPdfText(pdfUrl);
      const assignments = parseCoveringAssignments(text, matchName);

      const table = getDesktopTimetableTable();
      let appliedCount = 0;
      if (table) {
        assignments.forEach((assignment) => {
          if (markCoveringAssignment(table, assignment)) appliedCount++;
        });
      }

      const checkedAtMs = Date.now();
      button.textContent = formatReliefButtonLabel(appliedCount, checkedAtMs);
      button.classList.add("my-relief-checked");
      button.disabled = false;

      // Saved regardless of whether any cover was found - a confirmed
      // "no cover today" is still a completed check, and should
      // survive a refresh the same way a positive result does.
      saveReliefCheckResult(assignments, checkedAtMs);
    } catch (err) {
      console.error("Schoolbox UX tweaks: relief check failed", err);
      button.textContent = "Check failed — try again";
      setTimeout(() => resetReliefButton(button), 4000);
      button.disabled = false;
    }
  }

  function addCheckForReliefButton() {
    if (!isDashboardPage()) return;
    if (document.querySelector(".my-relief-check-button")) return;

    const header = document.querySelector("[data-timetable-header]");
    if (!header) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "my-relief-check-button";
    button.textContent = "Check for relief";
    button.addEventListener("click", () => checkForRelief(button));

    header.insertAdjacentElement("afterend", button);
    restoreReliefCheckResult(button);
  }

  // ---------------------------------------------------------------
  // Dashboard: "My duties"
  //
  // Recurring, teacher-defined duties (yard duty, gate duty, etc.),
  // stored once and shown every matching day of the week - managed
  // from the "My duties" section of the nav dropdown panel. Two
  // shapes:
  //  - "session" duties land on an existing timetable column (same
  //    period-code/start-time lookup already built for relief-check)
  //    as a small banner, non-destructively, the same way the relief
  //    banner does.
  //  - "gap" duties (before school / recess / lunch / after school)
  //    have no existing column to attach to, so this inserts one -
  //    but only for a gap that actually has a duty today, so a normal
  //    day with no duties doesn't lose width to four dashed, empty
  //    columns.
  //
  // v1 only handles the desktop table
  // (table.timetable[data-timetable]). The small-screen stacked
  // table (.timetable-small, a different row-per-period markup)
  // isn't covered yet - duties won't show on narrow viewports until
  // that's added separately.
  // ---------------------------------------------------------------

  const DUTY_DAY_NAMES = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
  };

  // afterSlot is the ordinal position (into RELIEF_PERIOD_START_TIMES'
  // own key order) of the last session column that comes before this
  // gap; -1 means "before every session column". Ordinal rather than
  // time-based so it still lands in the right place even on a
  // timetable that skips a period entirely (e.g. no 3H column shown
  // at all) - it just finds the boundary between "slot <= afterSlot"
  // and "slot > afterSlot" among whatever columns actually exist.
  const DUTY_GAP_PERIODS = [
    { code: "BSH", label: "Before school", afterSlot: -1 },
    { code: "RH", label: "Recess", afterSlot: 2 },
    { code: "LH", label: "Lunch", afterSlot: 4 },
    { code: "ASH", label: "After school", afterSlot: 6 },
  ];

  const DUTY_SESSION_CODES = Object.keys(RELIEF_PERIOD_START_TIMES);

  function dutySessionSlot(code) {
    return DUTY_SESSION_CODES.indexOf(code);
  }

  function dutyPeriodLabel(code) {
    const gap = DUTY_GAP_PERIODS.find((g) => g.code === code);
    if (gap) return gap.label;
    if (code === "HH") return "Homeroom";
    return `Session ${code.charAt(0)}`;
  }

  // Reads each header cell's start time the same way
  // findColumnIndexesForPeriodCode() does, to work out where each
  // existing session column sits ordinally. Re-run fresh every time
  // a gap column is about to be inserted (see addDutyGapColumns)
  // rather than cached once, since inserting one gap shifts every
  // index after it.
  function getExistingSessionColumns(table) {
    const startTimeToCode = {};
    Object.entries(RELIEF_PERIOD_START_TIMES).forEach(([code, time]) => {
      startTimeToCode[time.toLowerCase()] = code;
    });

    const headerCells = Array.from(table.querySelectorAll("thead th"));
    return headerCells
      .map((th, index) => {
        const timeEl = th.querySelector("time.meta");
        if (!timeEl) return null;
        const start = timeEl.textContent.split("–")[0].trim().toLowerCase();
        const code = startTimeToCode[start];
        if (!code) return null;
        return { index, slot: dutySessionSlot(code) };
      })
      .filter(Boolean);
  }

  // Inserts a gap column only for codes with an active duty today
  // (activeGapCodes) - the previous design always inserted all four,
  // even empty, to keep the timetable a consistent shape day to day;
  // dropped after Gus found that consistency ended up squashing every
  // other column on a normal day with no duties. Also removes any gap
  // column that's no longer active, so a duty deleted from the "My
  // duties" panel (or a re-render as the day rolls over) collapses the
  // column straight back rather than leaving an orphaned "–" behind.
  // Both header and body cells are added/removed together so they
  // never drift out of alignment. Safe to call repeatedly.
  function addDutyGapColumns(table, activeGapCodes) {
    const headerRow = table.querySelector("thead tr");
    const bodyRow = table.querySelector("tbody tr");
    if (!headerRow || !bodyRow) return;

    DUTY_GAP_PERIODS.forEach((gap) => {
      if (activeGapCodes.has(gap.code)) return;
      const th = headerRow.querySelector(`th[data-my-gap-code="${gap.code}"]`);
      const td = bodyRow.querySelector(`td[data-my-gap-code="${gap.code}"]`);
      if (th) th.remove();
      if (td) td.remove();
    });

    DUTY_GAP_PERIODS.forEach((gap) => {
      if (!activeGapCodes.has(gap.code)) return;
      if (headerRow.querySelector(`th[data-my-gap-code="${gap.code}"]`))
        return;

      const sessionColumns = getExistingSessionColumns(table);
      const nextColumn = sessionColumns.find((c) => c.slot > gap.afterSlot);

      const th = document.createElement("th");
      th.className = "my-gap-header";
      th.dataset.myGapCode = gap.code;
      th.textContent = gap.label;

      const td = document.createElement("td");
      td.className = "my-gap-cell";
      td.dataset.myGapCode = gap.code;
      td.textContent = "–";

      if (nextColumn) {
        const headerCells = Array.from(headerRow.children);
        const bodyCells = Array.from(bodyRow.children);
        headerRow.insertBefore(th, headerCells[nextColumn.index]);
        bodyRow.insertBefore(td, bodyCells[nextColumn.index]);
      } else {
        headerRow.appendChild(th);
        bodyRow.appendChild(td);
      }
    });
  }

  // Non-destructive, the same approach as markCoveringCell(): adds a
  // small banner rather than replacing the cell's own content, so the
  // "Class List | Markbook" links and "Mark Attendance" link
  // underneath stay intact.
  function renderSessionDuty(table, duty) {
    const columnIndexes = findColumnIndexesForPeriodCode(table, duty.code);
    if (!columnIndexes.length) return;

    const row = table.querySelector("tbody tr");
    if (!row) return;

    columnIndexes.forEach((index) => {
      const cell = row.children[index];
      const subject = cell && cell.querySelector(".timetable-subject");
      if (!subject) return;
      if (subject.querySelector(`[data-my-duty-id="${duty.id}"]`)) return;

      const banner = document.createElement("div");
      banner.className = "my-duty-banner";
      banner.dataset.myDutyId = duty.id;
      banner.textContent = duty.label;
      subject.appendChild(banner);
    });
  }

  function renderGapDuty(table, duty) {
    const cell = table.querySelector(`td[data-my-gap-code="${duty.code}"]`);
    if (!cell) return;
    if (cell.dataset.myDutyId === duty.id) return;

    cell.textContent = "";
    cell.dataset.myDutyId = duty.id;
    cell.classList.add("my-gap-cell--filled");

    const label = document.createElement("div");
    label.className = "my-gap-cell-label";
    label.textContent = duty.label;
    cell.appendChild(label);
  }

  // Removes session banners for duties that no longer exist (deleted,
  // or edited - edits replace the id) rather than leaving stale ones
  // behind.
  function clearStaleSessionBanners(table, currentDutyIds) {
    table.querySelectorAll(".my-duty-banner").forEach((banner) => {
      if (!currentDutyIds.has(banner.dataset.myDutyId)) banner.remove();
    });
  }

  function addMyDutiesToTimetable() {
    if (!isDashboardPage()) return;

    const table = getDesktopTimetableTable();
    if (!table) return;

    const today = new Date().getDay();

    chrome.storage.sync.get({ myDuties: [] }, (result) => {
      const todaysDuties =
        today >= 1 && today <= 5
          ? result.myDuties.filter((d) => d.day === today)
          : [];

      // Only the gap codes with an actual duty today get a column -
      // see addDutyGapColumns() for why this changed from "always all
      // four".
      const activeGapCodes = new Set(
        todaysDuties
          .filter((d) => DUTY_GAP_PERIODS.some((g) => g.code === d.code))
          .map((d) => d.code)
      );
      addDutyGapColumns(table, activeGapCodes);

      const currentDutyIds = new Set(todaysDuties.map((d) => d.id));

      todaysDuties.forEach((duty) => {
        const isGap = DUTY_GAP_PERIODS.some((g) => g.code === duty.code);
        if (isGap) {
          renderGapDuty(table, duty);
        } else {
          renderSessionDuty(table, duty);
        }
      });

      clearStaleSessionBanners(table, currentDutyIds);
    });
  }

  // Builds the "My duties" collapsible section of the nav dropdown
  // panel: the current list (with delete) plus a small add-duty form.
  // Called from toggleNavPanel() once per panel open, mirroring the
  // "Other apps" folder's collapsible pattern already used there.
  function buildDutiesSection(panel) {
    const dutiesFolderButton = document.createElement("button");
    dutiesFolderButton.type = "button";
    dutiesFolderButton.className = "my-nav-folder-row";

    const dutiesIcon = document.createElement("span");
    dutiesIcon.textContent = "🗓";

    const dutiesLabel = document.createElement("span");
    dutiesLabel.className = "my-nav-folder-label";
    dutiesLabel.textContent = "My duties";

    const dutiesChevron = document.createElement("span");
    dutiesChevron.className = "my-nav-chevron";
    dutiesChevron.textContent = "▾";

    dutiesFolderButton.appendChild(dutiesIcon);
    dutiesFolderButton.appendChild(dutiesLabel);
    dutiesFolderButton.appendChild(dutiesChevron);
    panel.appendChild(dutiesFolderButton);

    const dutiesBody = document.createElement("div");
    dutiesBody.className = "my-duties-panel-body";
    dutiesBody.hidden = true;

    const dutiesList = document.createElement("div");
    dutiesList.className = "my-duties-list";
    dutiesBody.appendChild(dutiesList);

    const addForm = document.createElement("div");
    addForm.className = "my-duty-add-form";

    const addRow = document.createElement("div");
    addRow.className = "my-duty-add-row";

    const daySelect = document.createElement("select");
    Object.entries(DUTY_DAY_NAMES).forEach(([value, name]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = name;
      daySelect.appendChild(opt);
    });

    const periodSelect = document.createElement("select");

    const sessionGroup = document.createElement("optgroup");
    sessionGroup.label = "Sessions";
    DUTY_SESSION_CODES.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = dutyPeriodLabel(code);
      sessionGroup.appendChild(opt);
    });

    const gapGroup = document.createElement("optgroup");
    gapGroup.label = "Between sessions";
    DUTY_GAP_PERIODS.forEach((gap) => {
      const opt = document.createElement("option");
      opt.value = gap.code;
      opt.textContent = gap.label;
      gapGroup.appendChild(opt);
    });

    periodSelect.appendChild(sessionGroup);
    periodSelect.appendChild(gapGroup);

    addRow.appendChild(daySelect);
    addRow.appendChild(periodSelect);
    addForm.appendChild(addRow);

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "my-duty-label-input";
    labelInput.placeholder = "e.g. Yard duty — MU quad";
    addForm.appendChild(labelInput);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "my-duty-add-button";
    addButton.textContent = "Add duty";
    addForm.appendChild(addButton);

    dutiesBody.appendChild(addForm);
    panel.appendChild(dutiesBody);

    function refreshDutiesList() {
      chrome.storage.sync.get({ myDuties: [] }, (res) => {
        dutiesList.textContent = "";

        if (!res.myDuties.length) {
          const empty = document.createElement("div");
          empty.className = "my-duties-empty";
          empty.textContent = "No duties added yet.";
          dutiesList.appendChild(empty);
          return;
        }

        res.myDuties
          .slice()
          .sort((a, b) => a.day - b.day)
          .forEach((duty) => {
            const row = document.createElement("div");
            row.className = "my-duty-row";

            const text = document.createElement("span");
            text.className = "my-duty-row-text";
            text.textContent = `${DUTY_DAY_NAMES[duty.day]} · ${dutyPeriodLabel(
              duty.code
            )} · ${duty.label}`;
            text.title = text.textContent;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "my-duty-row-delete";
            deleteButton.textContent = "✕";
            deleteButton.title = "Delete this duty";
            deleteButton.addEventListener("click", () => {
              chrome.storage.sync.get({ myDuties: [] }, (r2) => {
                const updated = r2.myDuties.filter((d) => d.id !== duty.id);
                chrome.storage.sync.set({ myDuties: updated }, () => {
                  refreshDutiesList();
                  addMyDutiesToTimetable();
                });
              });
            });

            row.appendChild(text);
            row.appendChild(deleteButton);
            dutiesList.appendChild(row);
          });
      });
    }

    addButton.addEventListener("click", () => {
      const label = labelInput.value.trim();
      if (!label) return;

      const duty = {
        id: `duty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        day: Number(daySelect.value),
        code: periodSelect.value,
        label,
      };

      chrome.storage.sync.get({ myDuties: [] }, (res) => {
        const updated = res.myDuties.concat(duty);
        chrome.storage.sync.set({ myDuties: updated }, () => {
          labelInput.value = "";
          refreshDutiesList();
          addMyDutiesToTimetable();
        });
      });
    });

    dutiesFolderButton.addEventListener("click", () => {
      const isHidden = dutiesBody.hidden;
      dutiesBody.hidden = !isHidden;
      dutiesChevron.classList.toggle("my-nav-chevron--open", isHidden);
      if (isHidden) refreshDutiesList();
    });
  }

  // Shared by both course-import date helpers below. Sets a Schoolbox
  // date input's value and dispatches a native "change" event so any
  // jQuery .on("change", ...) handler still fires. Deliberately does
  // NOT call the picker's own adtp.syncDatesOnElement() - that call's
  // exact shape on these two steps hasn't been confirmed (only ever
  // seen invoked from the Learning Activities step's own "Use Unit
  // Date" link), so this is the plain, confirmed-safe way to set a
  // value rather than a guessed one. If a set date doesn't visually
  // sync its own calendar popup, that's the next thing to check
  // against real evidence, not something to guess a fix for.
  function setDateInputValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Schoolbox's date inputs are "dd/mm/yyyy" or "dd/mm/yyyy h:mmam/pm".
  // Only the date portion is ever touched here - a time suffix, if
  // present, is carried over unchanged from whatever was already in
  // the field being written to.
  function parseDdMmYyyy(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((value || "").trim());
    if (!match) return null;
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  function addDaysToDate(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDdMmYyyy(date, previousValue) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const datePart = `${day}/${month}/${year}`;

    const timeMatch = /^(\d{2}\/\d{2}\/\d{4})(.*)$/.exec(
      (previousValue || "").trim()
    );
    const timeSuffix = timeMatch ? timeMatch[2] : "";
    return datePart + timeSuffix;
  }

  // Course import wizard, Units step (/course/import/units). In every
  // real example seen, all five units want the exact same Open/Close
  // pair (the full term span) - this adds a "Copy to all units" button
  // next to the first unit's own fields rather than making someone
  // retype the same pair four more times. Only appears while this step
  // is the active one (Schoolbox disables the whole fieldset, and every
  // input inside it, once you move past it).
  function addUnitDateCopyButton() {
    const fieldset = document.querySelector('fieldset[data-mage="part-2"]');
    if (!fieldset || fieldset.disabled) return;
    if (fieldset.querySelector(".my-unit-copy-dates")) return;

    const rows = fieldset.querySelectorAll('[data-type="unit_row"]');
    if (rows.length < 2) return;

    const firstRow = rows[0];
    const firstOpen = firstRow.querySelector('input[data-role="open_date"]');
    const firstClose = firstRow.querySelector('input[data-role="due_date"]');
    if (!firstOpen || !firstClose) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "my-unit-copy-dates";
    button.textContent = "Copy to all units";

    const anchor = firstClose.closest(".columns") || firstClose.parentElement;
    if (!anchor) return;
    anchor.insertAdjacentElement("afterend", button);

    button.addEventListener("click", () => {
      rows.forEach((row, index) => {
        if (index === 0) return;
        const openInput = row.querySelector('input[data-role="open_date"]');
        const closeInput = row.querySelector('input[data-role="due_date"]');
        setDateInputValue(openInput, firstOpen.value);
        setDateInputValue(closeInput, firstClose.value);
      });
    });
  }

  // Course import wizard, Learning Activities step (#import_assessments).
  // Within a project group Schoolbox itself labels "Learning Activity"
  // (e.g. "Weekly Outline") - as opposed to a "Reported Grade" group of
  // real assessment tasks, whose dates are rarely weekly and shouldn't
  // be auto-shifted - every lesson after the first gets a small "wks
  // after previous" number next to its Lesson Plan Date. Changing that
  // number, or editing a row's own date directly, recomputes every row
  // after it: each date input's own "change" handler just pushes the
  // next row forward by the next row's own gap, so one edit ripples
  // down the whole chain without needing separate override state to
  // track - the field being edited directly *is* the source of truth.
  function addLessonDateCascade() {
    const groups = document.querySelectorAll(
      '#import_assessments ul.information-list.threaded[data-project]'
    );

    groups.forEach((group) => {
      if (group.dataset.myCascadeDone === "true") return;

      const parentItem = group.closest("li[data-assessment]");
      const metaLabel = parentItem
        ? parentItem.querySelector(":scope > .small-12.columns .pipe.meta")
        : null;
      if (!metaLabel || metaLabel.textContent.trim() !== "Learning Activity") {
        return;
      }

      const children = Array.from(
        group.querySelectorAll(":scope > li[data-parent-project]")
      );
      if (children.length < 2) return;

      group.dataset.myCascadeDone = "true";

      const dueInputs = children.map((child) =>
        child.querySelector('input[data-role="due_date"]')
      );
      const gapInputs = [null];

      for (let index = 1; index < children.length; index++) {
        const dueInput = dueInputs[index];
        if (!dueInput) {
          gapInputs.push(null);
          continue;
        }

        const wrap = document.createElement("span");
        wrap.className = "my-lesson-gap-wrap";

        const gapLabel = document.createElement("label");
        gapLabel.className = "my-lesson-gap-label";
        gapLabel.textContent = "wks after prev";

        const gapInput = document.createElement("input");
        gapInput.type = "number";
        gapInput.min = "1";
        gapInput.max = "8";
        gapInput.value = "1";
        gapInput.className = "my-lesson-gap";

        wrap.appendChild(gapLabel);
        wrap.appendChild(gapInput);
        // Placed after the whole .input-group (date field + calendar
        // button), not right after the date input itself - inserting
        // it inline there squeezed it between the input and the
        // calendar icon inside a narrow (large-3) column, which wrapped
        // the label across three lines. Its own row below has room.
        const inputGroup = dueInput.closest(".input-group") || dueInput;
        inputGroup.insertAdjacentElement("afterend", wrap);

        gapInputs.push(gapInput);
      }

      function cascadeFrom(index) {
        const nextIndex = index + 1;
        if (nextIndex >= dueInputs.length) return;
        const currentInput = dueInputs[index];
        const nextInput = dueInputs[nextIndex];
        const nextGapInput = gapInputs[nextIndex];
        if (!currentInput || !nextInput || !nextGapInput) return;

        const currentDate = parseDdMmYyyy(currentInput.value);
        if (!currentDate) return;

        const gapWeeks = parseInt(nextGapInput.value, 10) || 1;
        const nextDate = addDaysToDate(currentDate, gapWeeks * 7);
        setDateInputValue(
          nextInput,
          formatDdMmYyyy(nextDate, nextInput.value)
        );
      }

      for (let index = 1; index < children.length; index++) {
        const gapInput = gapInputs[index];
        if (gapInput) {
          gapInput.addEventListener("input", () => cascadeFrom(index - 1));
        }
        const dueInput = dueInputs[index];
        if (dueInput) {
          dueInput.addEventListener("change", () => cascadeFrom(index));
        }
      }
    });
  }

  // The nav button is the only in-page way back to the toggle once
  // tweaks are switched off - if it lived inside applyTweaks() like
  // everything else, turning tweaks off would hide the one thing that
  // lets you turn them back on again, short of digging out the
  // toolbar icon instead. So it runs unconditionally, with its own
  // observer, entirely outside the tweaksEnabled gate below.
  addNavBarButton();
  const navButtonObserver = new MutationObserver(() => addNavBarButton());
  navButtonObserver.observe(document.body, { childList: true, subtree: true });

  // Everything below only runs if the popup's toggle has tweaks
  // enabled (defaults to on). Checking storage first means a
  // disabled extension leaves the rest of the page completely
  // untouched.
  chrome.storage.sync.get(
    { tweaksEnabled: true, tweakToggles: {} },
    (result) => {
      if (!result.tweaksEnabled) return;

      tweakToggles = mergeTweakTogglesWithDefaults(result.tweakToggles);

      // Run once on load.
      applyTweaks();

      // Schoolbox loads some markbook widgets (the toolbar row, the
      // table itself) via Vue a moment after the rest of the page, so
      // a single run-once misses them. Each tweak function already
      // checks whether it's already applied, so re-running this is
      // harmless - it just lets the ones that needed to wait catch up
      // once their target appears.
      const observer = new MutationObserver(() => applyTweaks());
      observer.observe(document.body, { childList: true, subtree: true });
    }
  );
})();
