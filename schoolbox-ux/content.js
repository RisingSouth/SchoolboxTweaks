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
    if (tweakToggles.markbookQuickLinks) addMarkbookQuickLinks();
    if (tweakToggles.classesGridQuickLinks) addQuickLinksOnClassesPage();
    if (tweakToggles.searchStudentActions) addStudentActionsToSearchResults();
    if (tweakToggles.classListFlagFilter) addPastoralFlagFilter();
    if (tweakToggles.classListPmiBadge) addPmiBadges();
    if (tweakToggles.classListAttentionTags) addStudentAttentionTags();
    if (tweakToggles.classListColumnReorg) reorganiseClassListColumns();
    if (tweakToggles.classListStudentCount) updateClassListStudentCount();
    if (tweakToggles.dashboardDuties) addMyDutiesToTimetable();
    if (tweakToggles.courseImportUnitDates) addUnitDateCopyButton();
    if (tweakToggles.courseImportLessonCascade) addLessonDateCascade();
    if (tweakToggles.pastoralRecordHistoryPanel) addPastoralRecordHistoryPanel();
    if (tweakToggles.pastoralPmiStepback) addPmiStepbackHelper();
    if (tweakToggles.pastoralCommendation) addCommendationHelper();

    if (tweakToggles.courseListImprovements) initCourseListPage();

    // Pure-CSS tweak (see styles.css) - toggled via a body class
    // rather than a call to skip, since there's no DOM to build.
    document.body.classList.toggle(
      "my-tweak-full-height-table",
      !!tweakToggles.markbookFullHeight
    );

    // Same pattern - the course-list CSS rules are scoped under this
    // body class so switching the toggle off leaves nothing styled
    // even if initCourseListPage() already ran once and injected its
    // elements before the toggle was flipped.
    document.body.classList.toggle(
      "my-tweak-course-list",
      !!tweakToggles.courseListImprovements
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
      footer.textContent = "v1.2.6";
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

  // Adds two small navigation shortcuts to the Markbook:
  //  - a "Go to marking" row under the unit-titles row, with one
  //    pill per assessment column that actually has gradable task
  //    cells (Learning Activities and Reported Grade columns have
  //    nothing to mark, so get an empty cell instead);
  //  - one icon per gradable cell, straight to that student's
  //    response for that assessment.
  // Vue re-renders cells (e.g. when filters change), wiping out
  // anything injected into them, so rather than tracking readiness
  // on the table as a whole (which would skip re-adding icons to
  // cells Vue has quietly replaced), each cell icon is marked with
  // .my-mb-quicklink and every cell is checked for one on every
  // pass. The actions row itself is simpler to re-check wholesale,
  // since Vue replaces it (if at all) as a single unit.
  function addMarkbookQuickLinks() {
    if (!isMarkbookPage()) return;

    const table = document.querySelector(".diagonal-headings-table");
    if (!table) return;

    const gradableCells = table.querySelectorAll('td[data-pop-out-menu="true"]');

    const gradableAssessmentIds = new Set();
    gradableCells.forEach((cell) => {
      const match = (cell.dataset.test || "").match(
        /^markbook-cell-(\d+)-(\d+)$/
      );
      if (match) gradableAssessmentIds.add(match[1]);
    });

    gradableCells.forEach((cell) => {
      if (cell.querySelector(".my-mb-quicklink")) return;

      const match = (cell.dataset.test || "").match(
        /^markbook-cell-(\d+)-(\d+)$/
      );
      if (!match) return;

      const [, assessmentId, studentId] = match;
      cell.style.position = "relative";
      cell.appendChild(
        buildMarkbookCellLink(
          `/learning/assessments/${assessmentId}/${studentId}/responses`,
          "Open this student's response"
        )
      );
    });

    addMarkbookActionsRow(table, gradableAssessmentIds);
  }

  function buildMarkbookCellLink(href, title) {
    const link = document.createElement("a");
    link.className = "my-mb-quicklink my-mb-quicklink--cell";
    link.href = href;
    link.title = title;
    link.setAttribute("aria-label", title);
    link.textContent = "↗";
    // Keep the click from also opening the cell's own pop-out menu -
    // navigation itself is left alone (no preventDefault), so
    // ctrl/cmd-click still opens a new tab as normal.
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    return link;
  }

  // Inserts a plain horizontal row ("Go to marking") directly under
  // the unit-titles row (tr.course-headers) and above tr.average-
  // headers, with one "Mark all" pill per gradable assessment
  // column - unlike the diagonal header rows above it, this row
  // isn't rotated, so it's a much more legible place for a link than
  // squeezed inside the slanted header cell itself.
  function addMarkbookActionsRow(table, gradableAssessmentIds) {
    if (table.querySelector(".my-mb-actions-row")) return;

    const courseHeadersRow = table.querySelector("tr.course-headers");
    const rotateHeadersRow = table.querySelector("tr.rotate-headers");
    const averageHeadersRow = table.querySelector("tr.average-headers");
    if (!courseHeadersRow || !rotateHeadersRow || !averageHeadersRow) return;

    const columns = Array.from(rotateHeadersRow.children);
    const leadCells = Array.from(courseHeadersRow.children).slice(0, 3);
    if (columns.length < 3 || leadCells.length < 3) return;

    const row = document.createElement("tr");
    row.className = "my-mb-actions-row";

    // Student / average / rank are merged into one labelled cell -
    // copy their classes across so any sticky-left column behaviour
    // those three th's rely on still applies to the merged one.
    const leadClasses = new Set();
    leadCells.forEach((cell) =>
      cell.classList.forEach((cls) => leadClasses.add(cls))
    );

    const leadTh = document.createElement("th");
    leadTh.colSpan = 3;
    leadTh.className = Array.from(leadClasses)
      .concat("my-mb-actions-lead")
      .join(" ");
    leadTh.textContent = "Go to marking →";
    row.appendChild(leadTh);

    for (let i = 3; i < columns.length; i++) {
      const th = document.createElement("th");

      const match = (columns[i].dataset.test || "").match(
        /^markbook-assessment-(\d+)$/
      );
      if (match && gradableAssessmentIds.has(match[1])) {
        const assessmentId = match[1];
        const titleLink = columns[i].querySelector(
          'a[href*="/learning/assessments/"]'
        );
        const title = titleLink ? titleLink.textContent.trim() : "";
        th.appendChild(buildMarkAllPill(assessmentId, title));
      }

      row.appendChild(th);
    }

    courseHeadersRow.insertAdjacentElement("afterend", row);
  }

  // Lucide's "list-checks" icon (ISC licence), inlined rather than
  // pulled in as a dependency - just a static SVG string.
  const MARK_ALL_ICON_SVG =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>' +
    '<path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>';

  function buildMarkAllPill(assessmentId, assessmentTitle) {
    const link = document.createElement("a");
    link.className = "my-mb-markall";
    link.href = buildMarkAllStudentsHref(assessmentId);
    link.setAttribute(
      "aria-label",
      assessmentTitle
        ? `Mark all students: ${assessmentTitle}`
        : "Mark all students"
    );
    link.innerHTML = `${MARK_ALL_ICON_SVG}<span>Mark all</span>`;
    return link;
  }

  // Builds the "returnUrl" query value Schoolbox's own links use to
  // bring you back to this exact Markbook view (filters and all)
  // afterwards: base64 of the path, a literal "?", then base64 of
  // the query string with its leading "?" stripped. Both halves use
  // standard base64 with the "=" padding trimmed off, matching the
  // format Schoolbox generates for its own links.
  function buildMarkAllStudentsHref(assessmentId) {
    const path = toBase64NoPad(window.location.pathname);
    const query = toBase64NoPad(window.location.search.replace(/^\?/, ""));
    return `/learning/assessments/${assessmentId}/status?returnUrl=${path}?${query}&5[4]=1`;
  }

  function toBase64NoPad(value) {
    return btoa(value).replace(/=+$/, "");
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
  // title matches, read the id out of its href.
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

  // /send.php?id=X redirects to a signed, CORS-less R2 URL (see
  // background.js) - so this has to go through the background
  // worker rather than a direct content-script fetch().
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

  // Header search dropdown: adds a row of small icon buttons under each
  // STUDENT result (add pastoral record, pastoral history, grades, due
  // work, timetable, Veracross attendance today). Every Schoolbox link is built
  // straight from the internal user id already in the result's own
  // href (/search/user/{id}) - no network request needed for those.
  //
  // Design notes:
  // - The result card is itself an <a>, and anchors can't nest, so the
  //   row is inserted as the card's next SIBLING, not a child. That
  //   also keeps us out of the card's own Vue-managed children.
  // - Vue re-renders the dropdown as you type and may reuse a card
  //   element for a different person, so the row records which id it
  //   was built for (data-student-id) and is rebuilt on any mismatch
  //   rather than assumed correct just because it exists.
  // - Only results whose meta line ends in "Students" get the row -
  //   parents and staff appear in the same list, and a pastoral link
  //   for a parent would be broken or denied.
  // - Attendance is a Veracross page keyed by the student's EXTERNAL
  //   id, which isn't in the search result. It's looked up lazily on
  //   click (one same-origin fetch of the profile page, then cached),
  //   and the tab is opened via background.js since content scripts
  //   can't call chrome.tabs.
  const searchExternalIdCache = new Map();

  function addStudentActionsToSearchResults() {
    const results = document.querySelector(".sbx-header-search__results");
    if (!results) return;

    results.querySelectorAll('a.sbx-card[href^="/search/user/"]').forEach((card) => {
      const idMatch = card.getAttribute("href").match(/^\/search\/user\/(\d+)$/);
      const meta = card.querySelector(".meta");
      const isStudent =
        !!idMatch && !!meta && /students\s*$/i.test(meta.textContent.trim());

      const next = card.nextElementSibling;
      const existing =
        next && next.classList.contains("my-search-actions") ? next : null;

      if (!isStudent) {
        if (existing) existing.remove();
        return;
      }
      if (existing && existing.dataset.studentId === idMatch[1]) return;
      if (existing) existing.remove();

      const heading = card.querySelector("h3");
      const name = heading ? heading.textContent.trim() : "student";
      const newRow = buildSearchActionRow(idMatch[1], name);
      // Used to vertically centre the buttons on the card. Skipped if
      // the dropdown isn't laid out yet (CSS falls back to a default).
      if (card.offsetHeight > 0) {
        newRow.style.setProperty("--my-card-h", `${card.offsetHeight}px`);
      }
      card.after(newRow);
    });
  }

  function buildSearchActionRow(studentId, name) {
    const row = document.createElement("div");
    row.className = "my-search-actions";
    row.dataset.studentId = studentId;

    // The row itself is a zero-height anchor sitting at the card's
    // bottom edge; the buttons live in an absolutely-positioned inner
    // box that floats up over the card's right-hand side, so they read
    // as inline with the name without being nested inside the card's
    // <a> (invalid) or inside Vue's own markup.
    const inner = document.createElement("div");
    inner.className = "my-search-actions__buttons";
    row.appendChild(inner);

    // Once a button has been pressed, keep its label shut until the
    // pointer leaves it - the user clearly knows what it does, and the
    // attendance button leaves the pointer sitting on it after opening
    // its tab.
    const suppressLabel = (event) => {
      const btn = event.target.closest(".my-search-action");
      if (btn) btn.classList.add("my-search-action--pressed");
    };
    inner.addEventListener("pointerdown", suppressLabel);
    inner.addEventListener("click", suppressLabel);
    inner.addEventListener("mouseout", (event) => {
      const btn = event.target.closest(".my-search-action");
      if (btn && !btn.contains(event.relatedTarget)) {
        btn.classList.remove("my-search-action--pressed");
      }
    });

    const linkActions = [
      {
        icon: "add",
        label: "Add pastoral record",
        short: "Add record",
        href: `/pastoral/student/${studentId}/record/insert`,
      },
      {
        icon: "pastoral",
        label: "Pastoral history",
        short: "History",
        href: `/pastoral/student/${studentId}`,
      },
      { icon: "approve", label: "Grades", short: "Grades", href: `/learning/grades/${studentId}` },
      { icon: "due-work", label: "Due work", short: "Due work", href: `/learning/due/${studentId}` },
      { icon: "timetable", label: "Timetable", short: "Timetable", href: `/timetable/${studentId}` },
    ];

    const makeIcon = (iconName) => {
      const icon = document.createElement("sbx-icon");
      icon.setAttribute("name", iconName);
      icon.setAttribute("size", "1rem");
      icon.setAttribute("color", "currentColor");
      return icon;
    };

    // Short text revealed on hover/focus (CSS animates it open) so
    // each icon says what it does without needing the native tooltip.
    const makeText = (text) => {
      const span = document.createElement("span");
      span.className = "my-search-action__text";
      span.textContent = text;
      return span;
    };

    linkActions.forEach((action) => {
      const link = document.createElement("a");
      link.className = "my-search-action";
      link.href = action.href;
      link.title = `${action.label} - ${name}`;
      link.setAttribute("aria-label", `${action.label} for ${name}`);
      link.appendChild(makeIcon(action.icon));
      link.appendChild(makeText(action.short));
      inner.appendChild(link);
    });

    const attendance = document.createElement("button");
    attendance.type = "button";
    attendance.className = "my-search-action";
    attendance.title = `Attendance today (Veracross) - ${name}`;
    attendance.setAttribute("aria-label", `Attendance today in Veracross for ${name}`);
    attendance.appendChild(makeIcon("clipboard"));
    attendance.appendChild(makeText("Attendance"));
    // Keep focus in the search box on mousedown, so the dropdown
    // doesn't get a chance to close on blur before click fires.
    attendance.addEventListener("mousedown", (event) => event.preventDefault());
    attendance.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openVeracrossAttendance(studentId, attendance, name);
    });
    inner.appendChild(attendance);

    return row;
  }

  // Pulls the student's external id (the number Veracross uses) out of
  // the raw profile page. Both patterns are in server-rendered markup
  // (an inline script's config object, and a plain hidden form field),
  // not Vue output, so a background fetch() sees them. Digits-only
  // capture, so the value is safe to put in a URL.
  function extractExternalStudentId(html, internalId) {
    const patterns = [
      new RegExp(`student:\\s*\\{"id":${internalId},"externalId":"(\\d+)"`),
      new RegExp(`name="studentExternalIds"\\s+value="(\\d+)"`),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function openVeracrossAttendance(internalId, button, name) {
    if (button.classList.contains("my-search-action--busy")) return;

    const open = (externalId) => {
      chrome.runtime.sendMessage({
        type: "OPEN_TAB",
        url: `https://portals-app.veracross.au/carey/profile/${externalId}/today`,
      });
    };

    if (searchExternalIdCache.has(internalId)) {
      open(searchExternalIdCache.get(internalId));
      return;
    }

    const fail = (reason) => {
      console.warn(`[my-search] attendance lookup failed for ${internalId}:`, reason);
      button.classList.add("my-search-action--error");
      button.title = `Couldn't find the Veracross ID for ${name}`;
      setTimeout(() => button.classList.remove("my-search-action--error"), 2500);
    };

    button.classList.add("my-search-action--busy");
    fetch(`${location.origin}/search/user/${internalId}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const externalId = extractExternalStudentId(html, internalId);
        // Logged on purpose until this has been confirmed on a few
        // different students - safe to strip back to failure-only
        // logging afterwards.
        console.log(
          `[my-search] internal ${internalId} -> external ${externalId}`
        );
        if (!externalId) {
          fail("no external id found in profile HTML");
          return;
        }
        searchExternalIdCache.set(internalId, externalId);
        open(externalId);
      })
      .catch((err) => fail(err))
      .finally(() => button.classList.remove("my-search-action--busy"));
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

    // Pill/mode-switch clicks change row visibility via inline styles,
    // not childList mutations, so the body-wide MutationObserver never
    // sees them - this call is what keeps the count in sync with those
    // clicks instead of waiting on the next unrelated DOM mutation.
    if (tweakToggles.classListStudentCount) updateClassListStudentCount();
  }

  // Reuses addPastoralFlagFilter()'s own toolbar (.my-flag-filter-wrap)
  // rather than adding a second container - this tweak is only
  // meaningful alongside that filter bar, since it's the only thing on
  // this page that ever hides a student row. Counts tbody rows the
  // same way reorganiseClassListColumns() does (excluding ".sub-row",
  // which isn't a student row), and only touches the DOM when the text
  // actually changes, since applyTweaks() re-runs this on every
  // mutation.
  function updateClassListStudentCount() {
    if (!isClassListPage()) return;

    const modeRow = document.querySelector(".my-flag-filter-mode-row");
    if (!modeRow) return;

    const table = document.querySelector("#contact-table");
    if (!table) return;

    const studentRows = Array.from(table.querySelectorAll("tbody tr")).filter(
      (row) => !row.classList.contains("sub-row")
    );
    const total = studentRows.length;
    if (!total) return;

    const visible = studentRows.filter(
      (row) => window.getComputedStyle(row).display !== "none"
    ).length;

    const noun = total === 1 ? "student" : "students";
    const text =
      visible === total ? `${total} ${noun}` : `${visible} of ${total} ${noun}`;

    let label = modeRow.querySelector(".my-flag-filter-student-count");
    if (!label) {
      label = document.createElement("span");
      label.className = "my-flag-filter-student-count";
      modeRow.appendChild(label);
    }

    if (label.textContent !== text) {
      label.textContent = text;
    }
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
  // Dashboard timetable: shared period-code/start-time lookup
  //
  // Used to find which timetable column a given period code (e.g.
  // "1H") corresponds to - currently only by the "My duties" feature
  // below. Only covers periods that actually appear as timetable
  // columns (teaching sessions + homeroom). Duty slots like
  // BSH/RH/LH/ASH/AS2H never have a matching column, so they're
  // intentionally left out here - there's nothing on the dashboard
  // timetable to mark.
  // ---------------------------------------------------------------
  const PERIOD_START_TIMES = {
    HH: "8:30am",
    "1H": "8:45am",
    "2H": "9:45am",
    "3H": "11:00am",
    "4H": "12:00pm",
    "5H": "1:30pm",
    "6H": "2:30pm",
  };

  function getDesktopTimetableTable() {
    return document.querySelector("table.timetable[data-timetable]");
  }

  // Combined periods (two classes running at the same time, e.g. an
  // ATAR unit split across two columns) share one start time, so more
  // than one column can legitimately match here. Returns every match
  // - callers that care which specific one to mark disambiguate using
  // the assignment's class code instead of assuming index 0.
  function findColumnIndexesForPeriodCode(table, periodCode) {
    const startTime = PERIOD_START_TIMES[periodCode];
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

  // Class codes show up with a dot in some places ("10DJERAN.01")
  // and a space in others ("10DJERAN 01"). Normalising both the same
  // way lets them compare equal.
  function normaliseClassCode(code) {
    return code.replace(/[.\s]+/g, " ").trim().toLowerCase();
  }

  // ---------------------------------------------------------------
  // Dashboard: "My duties"
  //
  // Recurring, teacher-defined duties (yard duty, gate duty, etc.),
  // stored once and shown every matching day of the week - managed
  // from the "My duties" section of the nav dropdown panel. Two
  // shapes:
  //  - "session" duties land on an existing timetable column (using
  //    PERIOD_START_TIMES above to find it) as a small banner,
  //    non-destructively.
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

  // afterSlot is the ordinal position (into PERIOD_START_TIMES'
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

  const DUTY_SESSION_CODES = Object.keys(PERIOD_START_TIMES);

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
    Object.entries(PERIOD_START_TIMES).forEach(([code, time]) => {
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

  // Non-destructive: adds a small banner rather than replacing the
  // cell's own content, so the
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

        // Clamp to the gap input's own min="1"/max="8" bounds - those
        // HTML attributes don't stop someone from typing "-1" or "99",
        // and an unclamped negative value would push the next date
        // backward instead of forward.
        const parsedGap = parseInt(nextGapInput.value, 10);
        const gapWeeks = Number.isFinite(parsedGap)
          ? Math.min(Math.max(parsedGap, 1), 8)
          : 1;
        const nextDate = addDaysToDate(currentDate, gapWeeks * 7);
        setDateInputValue(
          nextInput,
          formatDdMmYyyy(nextDate, nextInput.value)
        );
      }

      // Row 0 has no gap input of its own (it's the anchor - nothing
      // to compute it from), so it can't go through the same per-row
      // block below. It still needs a "change" listener so hand-editing
      // it cascades forward too, same as every other row.
      if (dueInputs[0]) {
        dueInputs[0].addEventListener("change", () => cascadeFrom(0));
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

  // ---------------------------------------------------------------
  // Pastoral record insert page: previous-records history panel
  //
  // /pastoral/student/{id}/record/insert has no way to see a
  // student's past pastoral records while filling in a new one, short
  // of opening a second tab. /pastoral/student/{id} already renders
  // that history as plain server-rendered HTML (not Vue, confirmed
  // from a real page - no CORS/background.js hop needed since both
  // pages are same-origin), so this fetches it directly and shows it
  // in a side panel on the insert page.
  //
  // The #pastoralRecords container on that page also holds its own
  // #typeId/#subtypeId filter <select>s in a <fieldset> - those are
  // stripped out before injecting, since the insert-record form on
  // THIS page already has elements with those exact ids and having
  // two would be invalid/broken.
  //
  // Layout: a class on <body> shrinks the existing page content
  // (margin-right) rather than a fixed overlay sitting on top of it,
  // so the insert form stays fully visible/usable while the panel is
  // open. See the matching CSS in styles.css for exactly which
  // selector that targets, and the note there about it being
  // unverified against the real page.
  // ---------------------------------------------------------------

  // "Always open this panel automatically" - same opt-in,
  // chrome.storage.sync pattern as addPastoralFlagFilter()'s
  // "Remember my choices" (per-user across devices/classes, not
  // .local). Populated from storage alongside tweakToggles at the
  // bottom of this file, before addPastoralRecordHistoryPanel() first
  // runs, and kept in sync here so a mid-session toggle doesn't need
  // a re-read to take effect.
  let pastoralPanelAlwaysOpen = false;

  function isPastoralRecordInsertPage() {
    return /^\/pastoral\/student\/\d+\/record\/insert(?:\/|$)/.test(
      window.location.pathname
    );
  }

  function getPastoralStudentIdFromUrl() {
    const match = window.location.pathname.match(
      /^\/pastoral\/student\/(\d+)\/record\/insert(?:\/|$)/
    );
    return match ? match[1] : null;
  }

  // Fetches /pastoral/student/{id}[query] (query is the pagination
  // link's own href, e.g. "?pageCurrent=2", or null for the first
  // page), parses out just the heading/list/paginator, and returns
  // them as a fragment ready to inject into the current document.
  // Confirmed directly from a real /pastoral/student/{id} response:
  // the whole history lives inside <div id="pastoralRecords"> as
  // plain HTML, not behind any Vue hydration.
  // Shared by fetchPastoralRecordsFragment() (history panel) and the
  // PMI stepback helper's own record-title counting below - both need
  // the same /pastoral/student/{id} fetch+parse, just different parts
  // of the result, so this is the one place that does the actual
  // network request.
  function fetchPastoralRecordsSource(studentId, query) {
    const url = "/pastoral/student/" + studentId + (query || "");
    return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(
      (res) => {
        if (!res.ok) {
          throw new Error("pastoral history fetch failed: HTTP " + res.status);
        }
        return res.text();
      }
    ).then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const source = doc.querySelector("#pastoralRecords");
      if (!source) {
        throw new Error("#pastoralRecords not found in fetched page");
      }
      return source;
    });
  }

  function fetchPastoralRecordsFragment(studentId, query) {
    return fetchPastoralRecordsSource(studentId, query).then((source) => {
      // This page's own type/subtype filter dropdowns share ids with
      // the insert-record form already on the target page - drop the
      // whole fieldset rather than carrying those ids over.
      const fieldset = source.querySelector("fieldset");
      if (fieldset) fieldset.remove();

      const heading = source.querySelector("h2.subheader");
      const list = source.querySelector("ul.information-list");
      const paginator = source.querySelector("div.paginator");

      const fragment = document.createDocumentFragment();
      [heading, list, paginator].forEach((node) => {
        if (node) fragment.appendChild(document.importNode(node, true));
      });
      return fragment;
    });
  }

  // Loads one page of history into the panel body and wires up its
  // paginator links to re-run this same fetch instead of navigating -
  // those links are relative to /pastoral/student/{id} (confirmed from
  // the real page), which is a different URL to the insert page they'd
  // otherwise navigate away from.
  function renderPastoralRecordsPanel(studentId, bodyEl, query) {
    bodyEl.textContent = "Loading…";

    fetchPastoralRecordsFragment(studentId, query)
      .then((fragment) => {
        bodyEl.textContent = "";
        bodyEl.appendChild(fragment);

        const paginator = bodyEl.querySelector("div.paginator");
        if (!paginator) return;

        paginator.querySelectorAll("a[href]").forEach((link) => {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            renderPastoralRecordsPanel(
              studentId,
              bodyEl,
              link.getAttribute("href")
            );
          });
        });
      })
      .catch((err) => {
        console.log("[my-pastoral-history] load failed", err);
        bodyEl.textContent = "Couldn't load record history.";
      });
  }

  function addPastoralRecordHistoryPanel() {
    if (!isPastoralRecordInsertPage()) return;
    if (document.querySelector(".my-pastoral-history-panel")) return;

    const studentId = getPastoralStudentIdFromUrl();
    if (!studentId) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "my-pastoral-history-toggle";
    toggle.textContent = "Record history";

    const panel = document.createElement("div");
    panel.className = "my-pastoral-history-panel";
    panel.hidden = true;

    const header = document.createElement("div");
    header.className = "my-pastoral-history-header";

    const title = document.createElement("span");
    title.textContent = "Pastoral record history";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "my-pastoral-history-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close record history panel");

    header.appendChild(title);
    header.appendChild(closeButton);

    // Own row directly under the title, above the record list - same
    // custom switch as "Remember my choices" on the Class List flag
    // filter (see addPastoralFlagFilter()), since Schoolbox's own CSS
    // leaves a plain checkbox invisible.
    const alwaysOpenRow = document.createElement("div");
    alwaysOpenRow.className = "my-pastoral-history-always-open-row";

    const alwaysOpenSwitch = document.createElement("label");
    alwaysOpenSwitch.className = "my-nav-switch";

    const alwaysOpenCheckbox = document.createElement("input");
    alwaysOpenCheckbox.type = "checkbox";
    alwaysOpenCheckbox.checked = pastoralPanelAlwaysOpen;

    const alwaysOpenSlider = document.createElement("span");
    alwaysOpenSlider.className = "my-nav-slider";

    alwaysOpenCheckbox.addEventListener("change", () => {
      pastoralPanelAlwaysOpen = alwaysOpenCheckbox.checked;
      chrome.storage.sync.set({
        pastoralPanelAlwaysOpen: alwaysOpenCheckbox.checked,
      });
    });

    alwaysOpenSwitch.appendChild(alwaysOpenCheckbox);
    alwaysOpenSwitch.appendChild(alwaysOpenSlider);
    alwaysOpenRow.appendChild(alwaysOpenSwitch);
    alwaysOpenRow.appendChild(
      document.createTextNode("Always open this panel automatically")
    );

    const body = document.createElement("div");
    body.className = "my-pastoral-history-body";

    panel.appendChild(header);
    panel.appendChild(alwaysOpenRow);
    panel.appendChild(body);

    function openPanel() {
      panel.hidden = false;
      document.body.classList.add("my-pastoral-panel-open");
      renderPastoralRecordsPanel(studentId, body, null);
    }

    function closePanel() {
      panel.hidden = true;
      document.body.classList.remove("my-pastoral-panel-open");
    }

    toggle.addEventListener("click", () => {
      if (panel.hidden) {
        openPanel();
      } else {
        closePanel();
      }
    });
    closeButton.addEventListener("click", closePanel);

    // Same "heading's row, else #content" fallback already used by
    // addQuickActionsOnClassHomepage() above.
    const heading = document.querySelector("h1");
    const anchorRow = heading ? heading.closest(".row") || heading : null;
    if (anchorRow && anchorRow.parentNode) {
      anchorRow.parentNode.insertBefore(toggle, anchorRow.nextSibling);
    } else {
      const content = document.querySelector("#content") || document.body;
      content.insertBefore(toggle, content.firstChild);
    }

    document.body.appendChild(panel);

    if (pastoralPanelAlwaysOpen) openPanel();
  }

  // ---------------------------------------------------------------
  // Pastoral record insert page: PMI removed stepback helper
  //
  // Year Managers create one pastoral record per PMI level a student
  // steps down (9 -> 4 needs 5 records), and every one of those
  // records shares the exact same title:
  //   "Stepbacks Completed - PMI {from} to PMI {to}"
  // This prefills Type/Sub-type/Title for each record in turn so the
  // human only has to press Save - it never submits the form itself.
  //
  // The in-progress stepback (which student, which from/to levels)
  // lives in chrome.storage.local under "pmiStepback" - student id
  // plus the two levels only, never note text/visibility/related
  // students. It's cleared if it belongs to a different student or is
  // older than PMI_STEPBACK_MAX_AGE_MS (12 hours), so a half-finished
  // stepback can never silently reappear on the wrong student or days
  // later.
  //
  // How far through the stepback is, rather than being tracked as a
  // counter in storage, is derived every time from the student's own
  // record history: countMatchingStepbackRecords() counts how many
  // records already have the exact stepback title. That's what
  // addPastoralRecordHistoryPanel() already fetches and parses (see
  // fetchPastoralRecordsSource(), shared with it above) - no second
  // fetch, and no risk of the counter drifting from what's actually
  // been saved.
  //
  // NOT independently confirmed against a real page (see the report
  // this was built against for the full list):
  //  - whether #subtypeId's options are populated synchronously or
  //    via an AJAX round-trip once #typeId changes (hence the polling
  //    in selectPmiSubtypeByLabel() rather than a single synchronous
  //    check)
  //  - whether a native, isolated-world dispatchEvent("change") is
  //    actually seen by Schoolbox's own jQuery `.on('change', ...)`
  //    handler on #typeId/#subtypeId (reasoned likely from
  //    main-world-bridge.js's note that the DOM itself is shared
  //    across worlds, but not tested live)
  //  - whether the student's current PMI level can be read reliably
  //    from this page or the profile page the same way addPmiBadges()
  //    reads it on the Class List (from the pastoral flags row) - not
  //    confirmed the same source exists here, so "Current PMI" in the
  //    popup is always left blank rather than guessed at.
  // ---------------------------------------------------------------

  const PMI_STEPBACK_STORAGE_KEY = "pmiStepback";
  const PMI_STEPBACK_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const PMI_TYPE_VALUE = "16"; // YM/HOY
  const PMI_SUBTYPE_LABEL = "Personal Management Issue Removed";
  const PMI_SUBTYPE_POLL_TIMEOUT_MS = 5000;

  // Shared across every unverified add-record-page helper (PMI removed,
  // Commendation) so the "(untested)" marker can be deleted in one
  // place once they're confirmed working against a real record.
  const UNTESTED_FEATURE_SUFFIX = " (untested)";

  function isPastoralStudentProfilePage() {
    return /^\/pastoral\/student\/\d+\/?$/.test(window.location.pathname);
  }

  function getPastoralProfileStudentIdFromUrl() {
    const match = window.location.pathname.match(
      /^\/pastoral\/student\/(\d+)\/?$/
    );
    return match ? match[1] : null;
  }

  // Reads "pmiStepback" and hands back null (clearing storage) if
  // it's missing, belongs to a different student, or has aged past
  // PMI_STEPBACK_MAX_AGE_MS - every reader goes through this so
  // neither the add page nor the profile page can act on a stale or
  // mismatched one.
  function getActivePmiStepbackForStudent(studentId, callback) {
    chrome.storage.local.get({ [PMI_STEPBACK_STORAGE_KEY]: null }, (result) => {
      const seq = result[PMI_STEPBACK_STORAGE_KEY];
      if (!seq) {
        callback(null);
        return;
      }

      const expired = Date.now() - seq.ts > PMI_STEPBACK_MAX_AGE_MS;
      const mismatched = String(seq.studentId) !== String(studentId);
      if (expired || mismatched) {
        chrome.storage.local.remove(PMI_STEPBACK_STORAGE_KEY);
        callback(null);
        return;
      }

      callback(seq);
    });
  }

  function savePmiStepback(seq) {
    chrome.storage.local.set({ [PMI_STEPBACK_STORAGE_KEY]: seq });
  }

  function clearPmiStepback() {
    chrome.storage.local.remove(PMI_STEPBACK_STORAGE_KEY);
  }

  // The one title every record in this stepback shares - no date, no
  // per-record step counter.
  function pmiStepbackTitle(seq) {
    return "Stepbacks Completed - PMI " + seq.from + " to PMI " + seq.to;
  }

  function pmiStepbackTotal(seq) {
    return seq.from - seq.to;
  }

  function findOptionByLabel(select, label) {
    return Array.from(select.options).find(
      (option) => option.textContent.trim() === label
    );
  }

  // #typeId's options are confirmed already present in the page's own
  // HTML (unlike #subtypeId, below), so this is a plain synchronous
  // lookup - no polling needed.
  function selectPmiType(typeSelect) {
    const option = Array.from(typeSelect.options).find(
      (o) => o.value === PMI_TYPE_VALUE
    );
    if (!option) return false;

    typeSelect.value = PMI_TYPE_VALUE;
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Same "options already in the page's own HTML" assumption as
  // selectPmiType() above, but matching by label text instead of a
  // known value - used by the Commendation helper, where only the
  // option's visible label ("Recognition") is confirmed.
  function selectTypeByLabel(typeSelect, label) {
    const option = findOptionByLabel(typeSelect, label);
    if (!option) return false;

    typeSelect.value = option.value;
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // #subtypeId is saved EMPTY in the page's own HTML - Schoolbox's own
  // chained.js (window.sbx.chained) fills it in once #typeId changes,
  // and whether that happens synchronously or via an AJAX round-trip
  // isn't confirmed, so this polls (via a MutationObserver on the
  // select itself, not a timer loop) for an option matching the label
  // rather than assuming either timing. Matches by label text, not
  // value, since the value isn't confirmed either.
  function selectPmiSubtypeByLabel(subtypeSelect, label, timeoutMs, onDone) {
    const existing = findOptionByLabel(subtypeSelect, label);
    if (existing) {
      subtypeSelect.value = existing.value;
      subtypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      onDone(true);
      return;
    }

    let settled = false;
    const observer = new MutationObserver(() => {
      const option = findOptionByLabel(subtypeSelect, label);
      if (!option) return;

      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      subtypeSelect.value = option.value;
      subtypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      onDone(true);
    });
    observer.observe(subtypeSelect, { childList: true });

    const timer = setTimeout(() => {
      if (settled) return;
      observer.disconnect();
      console.log(
        "[my-pmi-stepback] timed out waiting for subtype option",
        label
      );
      onDone(false);
    }, timeoutMs);
  }

  // Sets Type, then Sub-type, then the Title - note, visibility,
  // related students and every other field on the form are left
  // exactly as Schoolbox set them. Never touches the form's submit
  // button or calls form.submit() - onDone(false) just means the bar
  // should tell the human to finish filling it in manually.
  function prefillPmiStepbackFields(title, onDone) {
    const typeSelect = document.querySelector("#typeId");
    const subtypeSelect = document.querySelector("#subtypeId");
    const headingInput = document.querySelector("#heading");
    if (!typeSelect || !subtypeSelect || !headingInput) {
      onDone(false);
      return;
    }

    if (!selectPmiType(typeSelect)) {
      onDone(false);
      return;
    }

    selectPmiSubtypeByLabel(
      subtypeSelect,
      PMI_SUBTYPE_LABEL,
      PMI_SUBTYPE_POLL_TIMEOUT_MS,
      (subtypeOk) => {
        if (!subtypeOk) {
          onDone(false);
          return;
        }
        headingInput.value = title;
        onDone(true);
      }
    );
  }

  // The note's CKEditor instance only exists in the page's own JS
  // world (window.sbProps.editors.body_public) - content.js runs
  // isolated from that, so this hands the actual read/edit/write off
  // to main-world-bridge.js over a CustomEvent round-trip on the
  // shared DOM (the one thing genuinely shared between the two
  // worlds), the same reasoning already documented there for
  // window.schoolboxUser. Only a request id crosses the boundary,
  // never the editor object itself.
  //
  // main-world-bridge.js does its own polling (editor not existing
  // yet, or the Sub-type's template table not having swapped in yet -
  // see PMI_NOTE_* there) up to ~5s and replies with ok: true/false.
  // The timeout here is slightly longer than that, purely as a
  // fallback for main-world-bridge.js not being loaded/responding at
  // all - it should never normally fire on its own.
  let pmiNoteFillRequestCounter = 0;

  function requestPmiNoteFill(onDone) {
    const requestId = "pmi-note-" + Date.now() + "-" + (++pmiNoteFillRequestCounter);
    let settled = false;

    function onResponse(event) {
      if (!event.detail || event.detail.requestId !== requestId) return;
      if (settled) return;
      settled = true;
      document.removeEventListener("my-pmi-note-fill-response", onResponse);
      clearTimeout(timer);
      if (!event.detail.ok) {
        console.log(
          "[my-pmi-stepback] note fill did not apply, reason:",
          event.detail.reason
        );
      }
      onDone(!!event.detail.ok);
    }
    document.addEventListener("my-pmi-note-fill-response", onResponse);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      document.removeEventListener("my-pmi-note-fill-response", onResponse);
      console.log("[my-pmi-stepback] note-fill request got no response");
      onDone(false);
    }, 6000);

    document.dispatchEvent(
      new CustomEvent("my-pmi-note-fill-request", { detail: { requestId } })
    );
  }

  // Counts how many of this student's existing records have a title
  // that exactly matches (trimmed, case-insensitive) the one given -
  // this is "how many of this stepback's records are already saved",
  // derived from the real record history rather than tracked as a
  // separate counter that could drift from it.
  function countPastoralRecordTitleMatches(recordsRoot, title) {
    const normalized = title.trim().toLowerCase();
    let count = 0;
    recordsRoot
      .querySelectorAll("ul.information-list li.list-item h3")
      .forEach((h3) => {
        if (h3.textContent.trim().toLowerCase() === normalized) count++;
      });
    return count;
  }

  // Fetches this student's record history the same way
  // addPastoralRecordHistoryPanel() does (via the shared
  // fetchPastoralRecordsSource()) and counts title matches in it.
  // Hands back null on a fetch failure rather than 0, so callers don't
  // mistake "couldn't check" for "none saved yet".
  function countMatchingStepbackRecords(studentId, title, callback) {
    fetchPastoralRecordsSource(studentId, null)
      .then((source) => callback(countPastoralRecordTitleMatches(source, title)))
      .catch((err) => {
        console.log("[my-pmi-stepback] record count fetch failed", err);
        callback(null);
      });
  }

  // The progress strip shown above the Title field once a stepback is
  // active for this student - whether it was just started from the
  // popup or is continuing after a redirect back from the profile
  // page's "Add next record" link. Runs the Type/Sub-type/Title
  // prefill itself; on a timeout, appends a manual-fallback message
  // rather than leaving the strip looking like it actually worked.
  function buildPmiActiveStrip(fieldset, studentId, seq, title, total, count) {
    const bar = document.createElement("div");
    bar.className = "my-tweak-pmi-bar my-tweak-pmi-bar--active";

    const entryNumber = count === null ? null : count + 1;
    const progressText = document.createElement("span");
    progressText.className = "my-tweak-pmi-progress";
    progressText.textContent =
      "PMI " +
      seq.from +
      " → " +
      seq.to +
      " · Entry " +
      (entryNumber === null ? "?" : entryNumber) +
      " of " +
      total;
    bar.appendChild(progressText);

    const cancelLink = document.createElement("a");
    cancelLink.href = "#";
    cancelLink.className = "my-tweak-pmi-cancel";
    cancelLink.textContent = "Cancel";
    cancelLink.addEventListener("click", (event) => {
      event.preventDefault();
      clearPmiStepback();
      bar.remove();
      buildPmiOpenButton(studentId);
    });
    bar.appendChild(cancelLink);

    fieldset.parentNode.insertBefore(bar, fieldset);

    prefillPmiStepbackFields(title, (ok) => {
      if (!ok) {
        console.log(
          "[my-pmi-stepback] couldn't set Type/Sub-type for",
          title
        );
        progressText.textContent = "Couldn't set Type/Sub-type, fill manually";
        return;
      }

      // Only attempted once Type/Sub-type/Title are confirmed set -
      // the note's template table is loaded by the Sub-type change,
      // so filling it any earlier would just hit "no-row" instantly.
      requestPmiNoteFill((noteOk) => {
        if (noteOk) return;
        const warning = document.createElement("span");
        warning.className = "my-tweak-pmi-error";
        warning.textContent = "Couldn't fill note, add it manually";
        bar.insertBefore(warning, cancelLink);
      });
    });

    return bar;
  }

  // Finds the Title field's fieldset, the strip's anchor point, the
  // same way both call sites below need it - returns null if the form
  // isn't there yet (applyTweaks() will just retry on the next pass).
  function getPmiHeadingFieldset() {
    const headingInput = document.querySelector("#heading");
    return headingInput ? headingInput.closest("fieldset") : null;
  }

  // The "PMI removed" button next to the "Record history" button,
  // shown when no stepback is active yet for this student. Opens the
  // popup that collects Current/New PMI and starts one.
  function buildPmiOpenButton(studentId) {
    if (document.querySelector(".my-tweak-pmi-open-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "my-tweak-pmi-open-button";
    button.textContent = "PMI removed" + UNTESTED_FEATURE_SUFFIX;
    button.addEventListener("click", () => openPmiModal(studentId));

    const historyToggle = document.querySelector(".my-pastoral-history-toggle");
    if (historyToggle && historyToggle.parentNode) {
      historyToggle.insertAdjacentElement("afterend", button);
      return;
    }

    // Same "heading's row, else #content" fallback already used by
    // addPastoralRecordHistoryPanel() above, for when that tweak is
    // off and its own toggle button doesn't exist to anchor against.
    const heading = document.querySelector("h1");
    const anchorRow = heading ? heading.closest(".row") || heading : null;
    if (anchorRow && anchorRow.parentNode) {
      anchorRow.parentNode.insertBefore(button, anchorRow.nextSibling);
    } else {
      const content = document.querySelector("#content") || document.body;
      content.insertBefore(button, content.firstChild);
    }
  }

  // The "Current PMI" / "New PMI" popup. Prefill-only and modal-only -
  // "Fill entry" just stores the stepback and runs the same strip/
  // prefill path a continuing stepback uses, it never touches Save.
  function openPmiModal(studentId) {
    if (document.querySelector(".my-tweak-pmi-modal-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "my-tweak-pmi-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "my-tweak-pmi-modal";

    const titleEl = document.createElement("h3");
    titleEl.className = "my-tweak-pmi-modal-title";
    titleEl.textContent = "PMI removed" + UNTESTED_FEATURE_SUFFIX;
    modal.appendChild(titleEl);

    const row = document.createElement("div");
    row.className = "my-tweak-pmi-modal-row";

    // Current PMI is deliberately always left blank rather than
    // prefilled - see the NOT-confirmed note above this section on
    // why (no confirmed source for "current PMI" on this page).
    const currentLabel = document.createElement("label");
    currentLabel.textContent = "Current PMI";
    const currentInput = document.createElement("input");
    currentInput.type = "number";
    currentInput.className = "my-tweak-pmi-input";
    currentLabel.appendChild(currentInput);

    const newLabel = document.createElement("label");
    newLabel.textContent = "New PMI";
    const newInput = document.createElement("input");
    newInput.type = "number";
    newInput.className = "my-tweak-pmi-input";
    newLabel.appendChild(newInput);

    row.appendChild(currentLabel);
    row.appendChild(newLabel);
    modal.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "my-tweak-pmi-modal-hint";
    hint.textContent = "Enter both PMI levels.";
    modal.appendChild(hint);

    const error = document.createElement("div");
    error.className = "my-tweak-pmi-error";
    modal.appendChild(error);

    function readValidInts() {
      const from = parseInt(currentInput.value, 10);
      const to = parseInt(newInput.value, 10);
      const validInts =
        String(from) === currentInput.value.trim() &&
        String(to) === newInput.value.trim();
      return validInts && from > to ? { from, to } : null;
    }

    function updateHint() {
      const levels = readValidInts();
      if (levels) {
        const total = levels.from - levels.to;
        hint.textContent =
          "This makes " +
          total +
          (total === 1
            ? " record with the same title."
            : " records with the same title.");
        error.textContent = "";
      } else {
        hint.textContent = "Enter both PMI levels.";
      }
    }
    currentInput.addEventListener("input", updateHint);
    newInput.addEventListener("input", updateHint);

    function closeModal() {
      overlay.remove();
    }

    const actions = document.createElement("div");
    actions.className = "my-tweak-pmi-modal-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "my-tweak-pmi-modal-cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", closeModal);

    const fillButton = document.createElement("button");
    fillButton.type = "button";
    fillButton.className = "my-tweak-pmi-start my-tweak-pmi-modal-primary";
    fillButton.textContent = "Fill entry";
    fillButton.addEventListener("click", () => {
      const levels = readValidInts();
      if (!levels) {
        error.textContent =
          'Enter whole numbers, with "Current PMI" greater than "New PMI".';
        return;
      }

      const fieldset = getPmiHeadingFieldset();
      if (!fieldset || !fieldset.parentNode) {
        error.textContent = "Couldn't find the Title field on this page.";
        return;
      }

      const seq = {
        studentId: String(studentId),
        from: levels.from,
        to: levels.to,
        ts: Date.now(),
      };
      savePmiStepback(seq);
      closeModal();

      const openButton = document.querySelector(".my-tweak-pmi-open-button");
      if (openButton) openButton.remove();

      const title = pmiStepbackTitle(seq);
      const total = pmiStepbackTotal(seq);
      countMatchingStepbackRecords(studentId, title, (count) => {
        if (document.querySelector(".my-tweak-pmi-bar")) return;
        buildPmiActiveStrip(fieldset, studentId, seq, title, total, count);
      });
    });

    actions.appendChild(cancelButton);
    actions.appendChild(fillButton);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);
    currentInput.focus();
  }

  // Guards the async chrome.storage.local.get()/fetch() lookups below
  // the same way flagFilterBuilding guards addPastoralFlagFilter() -
  // without it, the body-wide MutationObserver could call this again
  // while the first lookup is still in flight and end up building two
  // buttons/strips.
  let pmiBarBuilding = false;

  function addPmiStepbackOnInsertPage(studentId) {
    if (
      document.querySelector(".my-tweak-pmi-bar") ||
      document.querySelector(".my-tweak-pmi-open-button")
    ) {
      return;
    }
    if (pmiBarBuilding) return;

    const fieldset = getPmiHeadingFieldset();
    if (!fieldset || !fieldset.parentNode) return;

    pmiBarBuilding = true;
    getActivePmiStepbackForStudent(studentId, (seq) => {
      if (!seq) {
        pmiBarBuilding = false;
        if (
          document.querySelector(".my-tweak-pmi-bar") ||
          document.querySelector(".my-tweak-pmi-open-button")
        ) {
          return;
        }
        buildPmiOpenButton(studentId);
        return;
      }

      const title = pmiStepbackTitle(seq);
      const total = pmiStepbackTotal(seq);

      countMatchingStepbackRecords(studentId, title, (count) => {
        pmiBarBuilding = false;
        if (
          document.querySelector(".my-tweak-pmi-bar") ||
          document.querySelector(".my-tweak-pmi-open-button")
        ) {
          return;
        }

        if (count !== null && count >= total) {
          clearPmiStepback();
          buildPmiOpenButton(studentId);
          return;
        }

        buildPmiActiveStrip(fieldset, studentId, seq, title, total, count);
      });
    });
  }

  // Guards the profile-page banner's own async lookups, same reason
  // as pmiBarBuilding above.
  let pmiBannerBuilding = false;

  const PMI_BANNER_COUNTDOWN_SECONDS = 3;

  // "PMI {from} -> {to} - K of N saved - Opening entry K+1 in T...
  // [Cancel] [Open now]" banner, counting down to a same-tab
  // navigation to the add page - plain <a href> / location.href, not
  // chrome.tabs.create or window.open, since those are what tripped
  // the PWA link-capturing issue noted elsewhere in this file for
  // timetable links (see (h) in the report this was built against).
  // Pressing Cancel here only stops the auto-open and swaps the
  // banner's own two links for a manual "Add next record"/"Stop
  // sequence" pair, in place - it never clears the stored stepback by
  // itself; "Stop sequence" (or "Dismiss" once complete) is what
  // clears that. Once all N are saved, this instead shows a plain
  // "All N saved" line and clears the stored stepback itself.
  //
  // K is always the real count of matching-title records on this
  // page's own already-rendered history (#pastoralRecords), not a
  // stored counter.
  function renderPmiBanner(studentId, seq, savedCount, total, allSaved) {
    if (document.querySelector(".my-tweak-pmi-banner")) return;

    const banner = document.createElement("div");
    banner.className = "my-tweak-pmi-banner";

    if (allSaved) {
      const text = document.createElement("span");
      text.textContent =
        "All " + total + " saved · PMI " + seq.from + " → " + seq.to + " complete";
      banner.appendChild(text);

      const content = document.querySelector("#content") || document.body;
      content.insertBefore(banner, content.firstChild);
      return;
    }

    const addHref = "/pastoral/student/" + studentId + "/record/insert";
    const nextEntry = savedCount + 1;

    const text = document.createElement("span");
    const actions = document.createElement("span");
    actions.className = "my-tweak-pmi-banner-actions";
    banner.appendChild(text);
    banner.appendChild(actions);

    let countdownTimer = null;
    let secondsLeft = PMI_BANNER_COUNTDOWN_SECONDS;

    function renderManual() {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }

      text.textContent =
        "PMI " + seq.from + " → " + seq.to + " · " + savedCount + " of " + total + " saved";
      actions.textContent = "";

      const addLink = document.createElement("a");
      addLink.href = addHref;
      addLink.className = "my-tweak-pmi-banner-add";
      addLink.textContent = "Add next record";
      actions.appendChild(addLink);

      const stopLink = document.createElement("a");
      stopLink.href = "#";
      stopLink.className = "my-tweak-pmi-banner-cancel";
      stopLink.textContent = "Stop sequence";
      stopLink.addEventListener("click", (event) => {
        event.preventDefault();
        clearPmiStepback();
        banner.remove();
      });
      actions.appendChild(stopLink);
    }

    function renderCountdown() {
      text.textContent =
        "PMI " +
        seq.from +
        " → " +
        seq.to +
        " · " +
        savedCount +
        " of " +
        total +
        " saved · Opening entry " +
        nextEntry +
        " in " +
        secondsLeft +
        "…";
      actions.textContent = "";

      const cancelLink = document.createElement("a");
      cancelLink.href = "#";
      cancelLink.className = "my-tweak-pmi-banner-cancel";
      cancelLink.textContent = "Cancel";
      cancelLink.addEventListener("click", (event) => {
        event.preventDefault();
        renderManual();
      });
      actions.appendChild(cancelLink);

      const openNowLink = document.createElement("a");
      openNowLink.href = addHref;
      openNowLink.className = "my-tweak-pmi-banner-add";
      openNowLink.textContent = "Open now";
      openNowLink.addEventListener("click", () => {
        if (countdownTimer) clearInterval(countdownTimer);
      });
      actions.appendChild(openNowLink);
    }

    renderCountdown();
    countdownTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        window.location.href = addHref;
        return;
      }
      renderCountdown();
    }, 1000);

    const content = document.querySelector("#content") || document.body;
    content.insertBefore(banner, content.firstChild);
  }

  function addPmiStepbackOnProfilePage(studentId) {
    if (document.querySelector(".my-tweak-pmi-banner")) return;
    if (pmiBannerBuilding) return;
    pmiBannerBuilding = true;

    getActivePmiStepbackForStudent(studentId, (seq) => {
      pmiBannerBuilding = false;
      if (!seq) return;
      if (document.querySelector(".my-tweak-pmi-banner")) return;

      const title = pmiStepbackTitle(seq);
      const total = pmiStepbackTotal(seq);

      // The profile page's own history is already server-rendered
      // right here in the current document - no fetch needed, unlike
      // the add page counting a different page's history.
      const recordsRoot = document.querySelector("#pastoralRecords");
      const savedCount = recordsRoot
        ? countPastoralRecordTitleMatches(recordsRoot, title)
        : 0;

      if (savedCount >= total) {
        clearPmiStepback();
        renderPmiBanner(studentId, seq, savedCount, total, true);
      } else {
        renderPmiBanner(studentId, seq, savedCount, total, false);
      }
    });
  }

  function addPmiStepbackHelper() {
    if (isPastoralRecordInsertPage()) {
      const studentId = getPastoralStudentIdFromUrl();
      if (studentId) addPmiStepbackOnInsertPage(studentId);
    } else if (isPastoralStudentProfilePage()) {
      const studentId = getPastoralProfileStudentIdFromUrl();
      if (studentId) addPmiStepbackOnProfilePage(studentId);
    }
  }

  // ---------------------------------------------------------------
  // Pastoral record insert page: Commendation shortcut (untested)
  //
  // A plain one-click Type/Sub-type filler, same page as the PMI
  // removed helper above but with none of its popup/stepback/storage
  // machinery - there's nothing to resume across page loads, so
  // there's nothing to store.
  //
  // NOT CONFIRMED (see report):
  //  - COMMENDATION_SUBTYPE_LABEL is read off a record's "Type
  //    (Sub-type)" display line, so the live #subtypeId option's
  //    text may differ slightly
  //  - what visibility this sub-type gets once selected
  //    (loadAudience / data-visibility-locked, in the page's own JS)
  //  - whether Schoolbox loads a note template for this sub-type the
  //    way it does for "Personal Management Issue Removed" above
  // ---------------------------------------------------------------

  const COMMENDATION_TYPE_LABEL = "Recognition";
  const COMMENDATION_SUBTYPE_LABEL = "Commendation (MyCarey Note)";
  const COMMENDATION_HEADING_TEXT = "Commendation";

  // Sets Type then Sub-type the same way prefillPmiStepbackFields()
  // does (native bubbling "change" on #typeId, then
  // selectPmiSubtypeByLabel()'s poll for chained.js to fill the
  // Sub-type option) - only matching by label on both selects, since
  // neither option's value is confirmed here. Title is left alone if
  // the teacher has already typed something; every other field (note,
  // visibility, related students) is untouched, and this never
  // touches Save.
  function prefillCommendationFields(onDone) {
    const typeSelect = document.querySelector("#typeId");
    const subtypeSelect = document.querySelector("#subtypeId");
    const headingInput = document.querySelector("#heading");
    if (!typeSelect || !subtypeSelect || !headingInput) {
      onDone(false);
      return;
    }

    if (!selectTypeByLabel(typeSelect, COMMENDATION_TYPE_LABEL)) {
      onDone(false);
      return;
    }

    selectPmiSubtypeByLabel(
      subtypeSelect,
      COMMENDATION_SUBTYPE_LABEL,
      PMI_SUBTYPE_POLL_TIMEOUT_MS,
      (subtypeOk) => {
        if (!subtypeOk) {
          onDone(false);
          return;
        }

        if (!headingInput.value.trim()) {
          headingInput.value = COMMENDATION_HEADING_TEXT;
          headingInput.focus();
          const end = headingInput.value.length;
          headingInput.setSelectionRange(end, end);
        }
        onDone(true);
      }
    );
  }

  // The "Commendation" button next to the "PMI removed"
  // one - same anchor and fallback chain as buildPmiOpenButton() so
  // the two sit side by side regardless of which one applyTweaks()
  // happens to add first.
  function buildCommendationButton() {
    if (document.querySelector(".my-tweak-commend-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "my-tweak-commend-button";
    button.textContent = "Commendation";
    button.addEventListener("click", () => {
      prefillCommendationFields((ok) => {
        if (!ok) {
          console.log("[my-commendation] couldn't set Type/Sub-type");
        }
      });
    });

    const historyToggle = document.querySelector(".my-pastoral-history-toggle");
    if (historyToggle && historyToggle.parentNode) {
      historyToggle.insertAdjacentElement("afterend", button);
      return;
    }

    const heading = document.querySelector("h1");
    const anchorRow = heading ? heading.closest(".row") || heading : null;
    if (anchorRow && anchorRow.parentNode) {
      anchorRow.parentNode.insertBefore(button, anchorRow.nextSibling);
    } else {
      const content = document.querySelector("#content") || document.body;
      content.insertBefore(button, content.firstChild);
    }
  }

  function addCommendationHelper() {
    if (!isPastoralRecordInsertPage()) return;
    buildCommendationButton();
  }

  // ---------------------------------------------------------------
  // Course List page (/course/list)
  //
  // Everything here is purely additive: the site's own jQuery
  // courseSelector JS depends on the ~515 li[data-course-row] nodes
  // and their internal structure (its own search filter shows/hides
  // rows by some mechanism of its own), so nothing here ever moves,
  // removes or re-parents one of those rows or anything inside them.
  // New elements (star buttons, tool links, unit pills, heading rows)
  // are only ever inserted as new siblings/children; visual grouping
  // (pinned-first) is done with flex `order`, and our own hiding uses
  // a dedicated `my-cl-hidden` class so it can never collide with or
  // "undo" whatever the site's search box hides on its own.
  // ---------------------------------------------------------------

  function isCourseListPage() {
    return /^\/course\/list\/?$/.test(window.location.pathname);
  }

  // Lazily populated the first time initCourseListPage() can reach
  // chrome.storage.sync - pinned course ids and saved chip selections
  // both live here for the rest of the page's life. Kept as Sets so
  // toggling membership and checking "is this selected" are both O(1).
  let courseListState = null;
  let courseListStateLoading = false;
  let courseListChipsBuilt = false;
  let courseListSearchFocusAttempted = false;
  let courseListCountTextEl = null;
  let courseListRunning = false;
  let courseListToolsBuildScheduled = false;

  // Guards the progressive (first-pass + idle-chunked) row setup so the
  // body-wide MutationObserver - woken by every star/tool/chip-bar node
  // this itself inserts - can't re-enter and restart it mid-flight.
  // "Active" covers the whole staged run; "Done" flips once, after the
  // last chunk, and switches later observer-driven calls back to the
  // original cheap self-heal pass below.
  let courseListStagedSetupActive = false;
  let courseListStagedSetupDone = false;

  // One-shot perf instrumentation for the course list page - see
  // logCourseListTimings() for what gets logged and why.
  let clTimingSyncStart = null;
  let clTimingSyncEnd = null;
  let clTimingRowsDone = null;
  let clTimingFirstFilterDone = null;
  let clTimingLogged = false;

  function clMark(name) {
    try {
      performance.mark(name);
    } catch (e) {
      // DevTools perf marks are a nice-to-have, never load-bearing.
    }
  }

  // Fires once, as soon as the last of the three timing points has
  // landed (whichever of the first-filter pass or the final chunk's
  // row setup happens to finish last) - see initCourseListPage,
  // runCourseListStagedSetup and applyCourseListFilters for where each
  // of the four timestamps gets set.
  function logCourseListTimings() {
    if (clTimingLogged) return;
    if (
      clTimingSyncStart === null ||
      clTimingSyncEnd === null ||
      clTimingRowsDone === null ||
      clTimingFirstFilterDone === null
    ) {
      return;
    }
    clTimingLogged = true;

    try {
      performance.measure(
        "sbux-cl-first-sync-pass",
        "sbux-cl-sync-start",
        "sbux-cl-sync-end"
      );
      performance.measure(
        "sbux-cl-first-filter",
        "sbux-cl-sync-start",
        "sbux-cl-first-filter"
      );
      performance.measure(
        "sbux-cl-full-row-setup",
        "sbux-cl-sync-start",
        "sbux-cl-rows-done"
      );
    } catch (e) {
      // Same as above - only the console.log below is required.
    }

    const round = (n) => Math.round(n * 100) / 100;

    console.log("Schoolbox UX tweaks: course list timings", {
      firstSyncPassMs: round(clTimingSyncEnd - clTimingSyncStart),
      firstSyncPassAtMs: round(clTimingSyncEnd),
      firstFilterMs: round(clTimingFirstFilterDone - clTimingSyncStart),
      firstFilterAtMs: round(clTimingFirstFilterDone),
      fullRowSetupMs: round(clTimingRowsDone - clTimingSyncStart),
      fullRowSetupAtMs: round(clTimingRowsDone),
    });
  }

  function markCourseListRowsDone() {
    if (clTimingRowsDone !== null) return;
    clTimingRowsDone = performance.now();
    clMark("sbux-cl-rows-done");
    logCourseListTimings();
  }

  function loadCourseListState(onReady) {
    if (courseListState) {
      onReady();
      return;
    }
    if (courseListStateLoading) return;
    courseListStateLoading = true;

    try {
      chrome.storage.sync.get(
        { pinnedCourses: [], courseListFilters: {} },
        (result) => {
          courseListStateLoading = false;
          const filters = result.courseListFilters || {};
          courseListState = {
            pinned: new Set(result.pinnedCourses || []),
            campuses: new Set(filters.campuses || []),
            levels: new Set(filters.levels || []),
            other: !!filters.other,
            pinnedOnly: !!filters.pinnedOnly,
          };
          onReady();
        }
      );
    } catch (e) {
      // A storage failure shouldn't leave the page half-built - fall
      // back to "nothing pinned, no filters" and carry on.
      courseListStateLoading = false;
      courseListState = {
        pinned: new Set(),
        campuses: new Set(),
        levels: new Set(),
        other: false,
        pinnedOnly: false,
      };
      onReady();
    }
  }

  function saveCourseListPinned() {
    if (!courseListState) return;
    try {
      chrome.storage.sync.set({
        pinnedCourses: Array.from(courseListState.pinned),
      });
    } catch (e) {
      // Pinning stays working in-page even if the write fails; it
      // just won't survive a reload.
    }
  }

  function saveCourseListFilters() {
    if (!courseListState) return;
    try {
      chrome.storage.sync.set({
        courseListFilters: {
          campuses: Array.from(courseListState.campuses),
          levels: Array.from(courseListState.levels),
          other: courseListState.other,
          pinnedOnly: courseListState.pinnedOnly,
        },
      });
    } catch (e) {
      // Same as above - filtering still works for the rest of this
      // page view even if persisting it fails.
    }
  }

  function initCourseListPage() {
    console.count("Schoolbox UX tweaks: initCourseListPage");

    if (!isCourseListPage()) return;
    if (courseListRunning) return;
    courseListRunning = true;

    if (clTimingSyncStart === null) {
      clTimingSyncStart = performance.now();
      clMark("sbux-cl-sync-start");
    }

    try {
      focusCourseSearchOnLoad();

      const resultsRoot = document.querySelector("#course-selector-results");
      if (!resultsRoot) return;

      const rows = resultsRoot.querySelectorAll("li[data-course-row]");
      if (!rows.length) return;

      // The staged setup below (first pass + idle-time chunks) owns row
      // setup for the rest of this run; any re-entrant call it wakes by
      // inserting DOM nodes should just back off and let it finish.
      if (courseListStagedSetupActive) return;

      loadCourseListState(() => {
        if (courseListStagedSetupActive) return;

        if (!courseListStagedSetupDone) {
          courseListStagedSetupActive = true;
          runCourseListStagedSetup(resultsRoot, rows);
          return;
        }

        // The body-wide observer re-runs this on every DOM mutation
        // anywhere on the page, so once everything is already in place
        // (including a row that lost its star and self-healed on a
        // previous pass), this needs to be a cheap no-op rather than
        // re-walking and re-filtering ~515 rows for nothing. Rows our
        // own filters are hiding are intentionally left without a star
        // (see applyCourseListFilters), so they count as "ready" too.
        const rowsReady = Array.from(rows).every(
          (li) =>
            li.classList.contains("my-cl-hidden") ||
            (li.classList.contains("my-cl-ready") &&
              !!li.querySelector(".my-cl-pin-star"))
        );
        const chipBarReady =
          courseListChipsBuilt || !!document.querySelector(".my-cl-filterbar");
        const headingsReady = !!resultsRoot.querySelector(".my-cl-heading--pinned");

        if (rowsReady && chipBarReady && headingsReady) return;

        let changed = false;
        rows.forEach((li) => {
          if (li.classList.contains("my-cl-hidden")) return;
          if (setupCourseListRow(li)) changed = true;
        });
        if (
          ensureCourseListChipBar(resultsRoot.querySelectorAll("li[data-course-row]"))
        ) {
          changed = true;
        }
        if (ensureCourseListHeadingRows(resultsRoot)) changed = true;

        ensureCourseListToolsDelegation(resultsRoot);

        if (changed) applyCourseListFilters();
      });
    } finally {
      if (clTimingSyncEnd === null && clTimingSyncStart !== null) {
        clTimingSyncEnd = performance.now();
        clMark("sbux-cl-sync-end");
      }
      courseListRunning = false;
    }
  }

  // Peeks a row's course id straight off its link, without touching the
  // dataset/meta-parsing that setupCourseListRow() does - used only to
  // find which of the not-yet-reached rows are pinned so they can be
  // pulled into the first pass regardless of their DOM position.
  function peekCourseListRowCourseId(li) {
    const link = li.querySelector("div.card a[data-course-link]");
    return link ? link.getAttribute("data-course-id") : null;
  }

  // First pass is synchronous (first ~40 rows in DOM order, plus any
  // already-pinned rows wherever they are), everything after that is
  // handed to the existing idle scheduler in chunks of ~30 so the rest
  // of ~515 rows never blocks the main thread in one go. The chip bar,
  // headings and first applyCourseListFilters run right after the first
  // pass (so the page is interactive almost immediately); a final
  // applyCourseListFilters runs again once every row has been reached.
  function runCourseListStagedSetup(resultsRoot, rowsNodeList) {
    const rowList = Array.from(rowsNodeList);
    const FIRST_PASS_COUNT = 40;
    const CHUNK_SIZE = 30;

    const firstPassRows = rowList.slice(0, Math.min(FIRST_PASS_COUNT, rowList.length));
    const firstPassSet = new Set(firstPassRows);

    if (courseListState.pinned.size) {
      for (let i = FIRST_PASS_COUNT; i < rowList.length; i++) {
        const li = rowList[i];
        const courseId = peekCourseListRowCourseId(li);
        if (courseId && courseListState.pinned.has(courseId)) {
          firstPassRows.push(li);
          firstPassSet.add(li);
        }
      }
    }

    firstPassRows.forEach((li) => setupCourseListRow(li));

    ensureCourseListChipBar(resultsRoot.querySelectorAll("li[data-course-row]"));
    ensureCourseListHeadingRows(resultsRoot);
    ensureCourseListToolsDelegation(resultsRoot);

    applyCourseListFilters();

    const remaining = rowList.filter((li) => !firstPassSet.has(li));

    if (!remaining.length) {
      markCourseListRowsDone();
      courseListStagedSetupActive = false;
      courseListStagedSetupDone = true;
      return;
    }

    let index = 0;

    function step() {
      const end = Math.min(index + CHUNK_SIZE, remaining.length);
      for (; index < end; index++) {
        setupCourseListRow(remaining[index]);
      }
      if (index < remaining.length) {
        scheduleCourseListIdleWork(step);
        return;
      }

      markCourseListRowsDone();
      applyCourseListFilters();
      courseListStagedSetupActive = false;
      courseListStagedSetupDone = true;
    }

    scheduleCourseListIdleWork(step);
  }

  // Only ever attempted once, the moment #course-search first shows
  // up - re-focusing on every later pass would steal focus back from
  // whatever the teacher clicked into since.
  function focusCourseSearchOnLoad() {
    if (courseListSearchFocusAttempted) return;

    const input = document.querySelector("#course-search");
    if (!input) return;
    courseListSearchFocusAttempted = true;

    if (window.location.hash) return;

    const active = document.activeElement;
    const nothingFocused =
      !active || active === document.body || active === document.documentElement;
    if (nothingFocused) input.focus();
  }

  // Reads a row's "Campus Courses > Category Courses" meta line once
  // and caches the result on the li's own dataset - the text never
  // changes for a given row, so there's no reason to re-parse it on
  // every pass. Rows with no ">" at all (seen so far: "Test Courses",
  // "Past Parent") have neither a campus nor a level and are flagged
  // as "other" instead.
  function parseCourseListMeta(li) {
    const metaEl = li.querySelector("div.card p.meta");
    const text = metaEl ? metaEl.textContent.trim() : "";

    if (!text.includes(">")) {
      return { campus: null, level: null, other: true };
    }

    const [campusPart, categoryPart] = text.split(">").map((s) => s.trim());
    const campus = campusPart
      .replace(/\bCampus\b/gi, "")
      .replace(/\bCourses\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    let level = null;
    if (/secondary/i.test(categoryPart)) level = "Secondary";
    else if (/primary/i.test(categoryPart)) level = "Primary";

    return { campus: campus || null, level, other: false };
  }

  // Figures out whether a row should currently be visible under the
  // active chip/pinned-only filters, purely from the dataset values
  // setupCourseListRow() already parsed onto it - shared between that
  // function (so a just-parsed row never gets a star built if it's
  // filtered out) and applyCourseListFilters() (the single source of
  // truth re-run on every chip click, pin toggle and setup pass).
  function computeCourseListRowVisibility(li) {
    const courseId = li.dataset.myCourseId;
    const isPinned = !!courseId && courseListState.pinned.has(courseId);
    const isOther = li.dataset.myOther === "1";
    const campus = li.dataset.myCampus || "";
    const level = li.dataset.myLevel || "";

    let visible;
    if (isOther) {
      visible = courseListState.other;
    } else {
      const campusOk =
        courseListState.campuses.size === 0 ||
        (!!campus && courseListState.campuses.has(campus));
      const levelOk =
        courseListState.levels.size === 0 ||
        (!!level && courseListState.levels.has(level));
      visible = campusOk && levelOk;
    }

    if (visible && courseListState.pinnedOnly && !isPinned) visible = false;

    return { visible, isPinned };
  }

  // Parses a row's meta once (cached on its dataset) and, if the row is
  // currently visible under the saved/active filters, builds its star -
  // a row the filters are hiding is left without one (and without
  // my-cl-ready) so the first pass and idle chunks never spend time on
  // UI nobody can see yet. applyCourseListFilters() finishes the job
  // lazily the moment such a row actually becomes visible.
  function setupCourseListRow(li) {
    const alreadyParsed = !!li.dataset.myCourseId;

    if (alreadyParsed) {
      // Treat a row as not-ready (and rebuild it) if the site
      // re-rendered it and wiped the star back out, even though the li
      // itself kept its my-cl-ready class - this is what lets a row
      // self-heal without needing the old dedicated per-row observer.
      if (li.classList.contains("my-cl-ready") && li.querySelector(".my-cl-pin-star")) {
        return false;
      }
    } else {
      const card = li.querySelector("div.card");
      if (!card) return false;

      const link = card.querySelector("a[data-course-link]");
      if (!link) return false;

      const courseId = link.getAttribute("data-course-id");
      if (!courseId) return false;

      li.dataset.myCourseId = courseId;
      li.dataset.myCourseName =
        link.getAttribute("data-course-name") || link.textContent.trim();

      const meta = parseCourseListMeta(li);
      li.dataset.myCampus = meta.campus || "";
      li.dataset.myLevel = meta.level || "";
      li.dataset.myOther = meta.other ? "1" : "";
    }

    const { visible, isPinned } = computeCourseListRowVisibility(li);
    li.classList.toggle("my-cl-pinned", isPinned);

    if (!visible) {
      li.classList.add("my-cl-hidden");
      return true;
    }

    li.classList.remove("my-cl-hidden");

    const card = li.querySelector("div.card");
    if (!card) return true;

    // Sibling BEFORE the link, inside the card - never inside the
    // anchor itself, so clicking the star can never trigger a
    // navigation.
    if (!card.querySelector(".my-cl-pin-star")) {
      card.insertBefore(
        buildCoursePinStar(li.dataset.myCourseId, li.dataset.myCourseName),
        card.firstChild
      );
    }

    li.classList.add("my-cl-ready");
    return true;
  }

  function buildCoursePinStar(courseId, courseName) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "my-cl-pin-star";
    updateCoursePinStar(star, courseId, courseName);

    star.addEventListener("click", (event) => {
      // Belt-and-suspenders: the star is already a sibling of the
      // link, not inside it, but stopping propagation here means a
      // future markup change on Schoolbox's side can't suddenly turn
      // this into a navigation.
      event.preventDefault();
      event.stopPropagation();
      toggleCoursePinned(courseId, courseName);
    });

    return star;
  }

  function updateCoursePinStar(star, courseId, courseName) {
    const pinned = courseListState.pinned.has(courseId);
    star.classList.toggle("my-cl-pin-star--active", pinned);
    star.setAttribute("aria-pressed", pinned ? "true" : "false");
    star.setAttribute("aria-label", (pinned ? "Unpin " : "Pin ") + courseName);
    star.textContent = "★";
  }

  function toggleCoursePinned(courseId, courseName) {
    if (!courseListState) return;

    if (courseListState.pinned.has(courseId)) {
      courseListState.pinned.delete(courseId);
    } else {
      courseListState.pinned.add(courseId);
    }

    const li = document.querySelector(
      `li[data-course-row][data-my-course-id="${courseId}"]`
    );
    if (li) {
      const star = li.querySelector(".my-cl-pin-star");
      if (star) updateCoursePinStar(star, courseId, courseName);
    }

    saveCourseListPinned();
    applyCourseListFilters();
  }

  // Builds the quick-actions row for one course from its own (already
  // server-rendered, already-hidden) actions dropdown - no network
  // request, just reading hrefs that are already sitting in the DOM.
  // The dropdown can end up attached directly to <body> once Foundation
  // (the site's dropdown JS) has initialised it, so this looks it up
  // by id globally rather than assuming it's still nested under `li`.
  //
  // The site's own ⋮ menu (already present on every row) covers any
  // remaining dropdown actions, so this only surfaces the four most
  // useful shortcuts rather than duplicating that menu.
  function buildCourseListTools(li, courseId) {
    const dropdown = document.getElementById(`courseDropdown-${courseId}`);
    if (!dropdown) return null;

    const tools = document.createElement("div");
    tools.className = "my-cl-tools";

    const findLink = (prefix) =>
      dropdown.querySelector(`a[data-test^="${prefix}"]`);

    const addToolLink = (source, label, tool) => {
      if (!source) return;
      const a = document.createElement("a");
      a.href = source.getAttribute("href");
      a.textContent = label;
      a.className = "my-cl-tool-btn";
      if (tool) a.dataset.myClTool = tool;
      tools.appendChild(a);
    };

    addToolLink(findLink("course-list-planner-"), "Unit Planner");
    addToolLink(findLink("course-list-markbook-"), "Course Markbook");
    addToolLink(findLink("course-list-calendar-"), "Assessment Calendar", "calendar");
    addToolLink(findLink("course-list-homepage-"), "Homepage");

    return tools.childElementCount ? tools : null;
  }

  // Building all ~515 rows' quick-action tools used to happen the
  // first time the mouse or keyboard focus actually reached a row, but
  // that made the tools visibly pop in 1-2s after the pointer arrived -
  // each build inserted a new node into that row's own div.card grid,
  // which is a DOM mutation, which woke the body-wide MutationObserver
  // (applyTweaks() -> initCourseListPage()), which re-queried all ~515
  // rows again before the guard at the top of initCourseListPage()
  // could bail out. So instead, every row's tools are built once, up
  // front, spread across idle time in small chunks so it never blocks
  // the thread - by the time a hover or focus event actually reaches a
  // row, its tools already exist and hover only has to flip a CSS
  // visibility/opacity rule. The delegated listeners stay as a
  // fallback for the rare row the idle-time pass hasn't reached yet
  // (e.g. a hover landing within the first idle slice or two).
  function ensureCourseListToolsDelegation(resultsRoot) {
    const list = resultsRoot.querySelector("ul.information-list");
    if (!list || list.dataset.myClToolsWired) return;
    list.dataset.myClToolsWired = "1";

    const handler = (event) => {
      const li = event.target.closest("li[data-course-row]");
      if (li) ensureCourseListToolsForRow(li);
    };
    list.addEventListener("mouseover", handler);
    list.addEventListener("focusin", handler);

    scheduleCourseListToolsBuild(list);
  }

  function ensureCourseListToolsForRow(li) {
    if (li.querySelector(".my-cl-tools")) return;

    // Mirrors setupCourseListRow()'s star gating: a row our own filters
    // are hiding gets its tools lazily, when applyCourseListFilters()
    // reveals it, rather than up front alongside every visible row.
    if (li.classList.contains("my-cl-hidden")) return;

    const courseId = li.dataset.myCourseId;
    if (!courseId) return;

    const tools = buildCourseListTools(li, courseId);
    if (!tools) return;

    const metaEl = li.querySelector("div.card p.meta");
    if (metaEl) {
      metaEl.insertAdjacentElement("afterend", tools);
    } else {
      const card = li.querySelector("div.card");
      if (card) card.appendChild(tools);
    }
  }

  // Only ever starts the background pass once per page load - the
  // body-wide MutationObserver will call ensureCourseListToolsDelegation()
  // again on every later mutation, but the `myClToolsWired` guard above
  // already stops it from getting back in here, so this flag is really
  // just documenting that intent for the one call site that matters.
  function scheduleCourseListToolsBuild(list) {
    if (courseListToolsBuildScheduled) return;
    courseListToolsBuildScheduled = true;
    buildCourseListToolsInChunks(list);
  }

  function scheduleCourseListIdleWork(fn) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn);
    } else {
      setTimeout(fn, 0);
    }
  }

  function buildCourseListToolsInChunks(list) {
    const rows = Array.from(list.querySelectorAll("li[data-course-row]"));
    let index = 0;

    function step() {
      const end = Math.min(index + 25, rows.length);
      for (; index < end; index++) {
        ensureCourseListToolsForRow(rows[index]);
      }
      if (index < rows.length) scheduleCourseListIdleWork(step);
    }

    scheduleCourseListIdleWork(step);
  }

  // Built once, the first time there's at least one row to derive the
  // campus list from - chip selection state then lives entirely in
  // courseListState for the rest of the page's life.
  function ensureCourseListChipBar(rows) {
    if (courseListChipsBuilt) return false;
    if (document.querySelector(".my-cl-filterbar")) {
      courseListChipsBuilt = true;
      return false;
    }

    const searchInput = document.querySelector("#course-search");
    if (!searchInput) return false;

    const anchor = searchInput.closest(".row") || searchInput.parentElement;
    if (!anchor || !anchor.parentNode) return false;

    const campuses = new Set();
    rows.forEach((li) => {
      const campus = li.dataset.myCampus;
      if (campus) campuses.add(campus);
    });
    const sortedCampuses = Array.from(campuses).sort();

    const bar = document.createElement("div");
    bar.className = "my-cl-filterbar";

    const onFilterChange = () => {
      applyCourseListFilters();
      saveCourseListFilters();
    };

    const campusGroup = buildCourseListChipGroup(
      "Campus",
      sortedCampuses,
      courseListState.campuses,
      onFilterChange
    );
    const levelGroup = buildCourseListChipGroup(
      "Level",
      ["Secondary", "Primary"],
      courseListState.levels,
      onFilterChange
    );

    const otherGroup = document.createElement("div");
    otherGroup.className = "my-cl-chip-group";
    const otherChip = buildCourseListToggleChip(
      "Other",
      () => courseListState.other,
      (value) => {
        courseListState.other = value;
      },
      onFilterChange
    );
    otherGroup.appendChild(otherChip);

    const pinnedChip = buildCourseListToggleChip(
      "★ Pinned only",
      () => courseListState.pinnedOnly,
      (value) => {
        courseListState.pinnedOnly = value;
      },
      onFilterChange
    );
    pinnedChip.classList.add("my-cl-chip--pinned-toggle");

    const countWrap = document.createElement("div");
    countWrap.className = "my-cl-count";

    courseListCountTextEl = document.createElement("span");
    courseListCountTextEl.className = "my-cl-count-text";
    countWrap.appendChild(courseListCountTextEl);

    countWrap.appendChild(document.createTextNode(" · "));

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "my-cl-reset";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      courseListState.campuses.clear();
      courseListState.levels.clear();
      courseListState.other = false;
      courseListState.pinnedOnly = false;
      bar.querySelectorAll(".my-cl-chip--active").forEach((chip) => {
        chip.classList.remove("my-cl-chip--active");
        chip.setAttribute("aria-pressed", "false");
      });
      onFilterChange();
    });
    countWrap.appendChild(resetBtn);

    bar.appendChild(campusGroup);
    bar.appendChild(levelGroup);
    bar.appendChild(otherGroup);
    bar.appendChild(pinnedChip);
    bar.appendChild(countWrap);

    anchor.insertAdjacentElement("afterend", bar);
    courseListChipsBuilt = true;
    return true;
  }

  function buildCourseListChipGroup(title, values, selectedSet, onChange) {
    const group = document.createElement("div");
    group.className = "my-cl-chip-group";

    const label = document.createElement("span");
    label.className = "my-cl-chip-group-label";
    label.textContent = title;
    group.appendChild(label);

    values.forEach((value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "my-cl-chip";
      chip.textContent = value;
      chip.setAttribute("aria-pressed", selectedSet.has(value) ? "true" : "false");
      chip.classList.toggle("my-cl-chip--active", selectedSet.has(value));
      chip.addEventListener("click", () => {
        if (selectedSet.has(value)) selectedSet.delete(value);
        else selectedSet.add(value);
        chip.classList.toggle("my-cl-chip--active", selectedSet.has(value));
        chip.setAttribute("aria-pressed", selectedSet.has(value) ? "true" : "false");
        onChange();
      });
      group.appendChild(chip);
    });

    return group;
  }

  function buildCourseListToggleChip(label, getValue, setValue, onChange) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "my-cl-chip";
    chip.textContent = label;
    chip.setAttribute("aria-pressed", getValue() ? "true" : "false");
    chip.classList.toggle("my-cl-chip--active", getValue());
    chip.addEventListener("click", () => {
      const next = !getValue();
      setValue(next);
      chip.classList.toggle("my-cl-chip--active", next);
      chip.setAttribute("aria-pressed", next ? "true" : "false");
      onChange();
    });
    return chip;
  }

  // Appended at the end of the list (never inserted at the front) so
  // the site's own rows keep whatever DOM index its courseSelector JS
  // might rely on - visual position is handled entirely by the flex
  // `order` values in styles.css, not by where these live in the DOM.
  function ensureCourseListHeadingRows(resultsRoot) {
    const list = resultsRoot.querySelector("ul.information-list");
    if (!list) return false;
    if (list.querySelector(".my-cl-heading--pinned")) return false;

    const pinnedHeading = document.createElement("li");
    pinnedHeading.className = "my-cl-heading my-cl-heading--pinned";

    const allHeading = document.createElement("li");
    allHeading.className = "my-cl-heading my-cl-heading--all";

    list.appendChild(pinnedHeading);
    list.appendChild(allHeading);
    return true;
  }

  // The single source of truth for which rows are hidden by our own
  // filters (my-cl-hidden) and which are flagged pinned - re-run after
  // every chip click, pin toggle, and setup pass. Never touches any
  // hiding the site's own search box has already applied.
  //
  // Rows the staged setup (see runCourseListStagedSetup) hasn't reached
  // yet have no dataset.myCourseId and are skipped entirely here - this
  // must stay cheap even for ~475 not-yet-processed rows on the very
  // first call, so it never force-parses them (that's precisely the
  // synchronous cost the chunking exists to avoid). Each row gets
  // correctly classified the moment its own pass/chunk reaches it.
  // Counts are therefore provisional until the final post-chunk call.
  function applyCourseListFilters() {
    if (!courseListState) return;

    const resultsRoot = document.querySelector("#course-selector-results");
    if (!resultsRoot) return;

    const rows = resultsRoot.querySelectorAll("li[data-course-row]");

    let visibleCount = 0;
    let pinnedVisibleCount = 0;

    rows.forEach((li) => {
      if (!li.dataset.myCourseId) return;

      const { visible, isPinned } = computeCourseListRowVisibility(li);
      li.classList.toggle("my-cl-pinned", isPinned);
      li.classList.toggle("my-cl-hidden", !visible);

      if (visible) {
        visibleCount++;
        if (isPinned) pinnedVisibleCount++;

        // A row the filters were hiding when its own setup pass reached
        // it never got a star or tools built (see setupCourseListRow
        // and ensureCourseListToolsForRow) - finish it lazily now that
        // a filter change has revealed it.
        if (!li.classList.contains("my-cl-ready")) {
          setupCourseListRow(li);
        }
        ensureCourseListToolsForRow(li);
      }
    });

    updateCourseListHeadings(resultsRoot, pinnedVisibleCount, visibleCount - pinnedVisibleCount);
    updateCourseListCount(rows.length, visibleCount);

    if (clTimingFirstFilterDone === null) {
      clTimingFirstFilterDone = performance.now();
      clMark("sbux-cl-first-filter");
    }
    logCourseListTimings();
  }

  // Replacing a text node (even with identical text) is still a
  // childList mutation, which would otherwise feed straight back into
  // the body-wide MutationObserver that re-runs applyTweaks() - so
  // every write here is guarded to only touch the DOM when the value
  // actually changed.
  function setTextIfChanged(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function updateCourseListHeadings(resultsRoot, pinnedCount, allCount) {
    const pinnedHeading = resultsRoot.querySelector(".my-cl-heading--pinned");
    const allHeading = resultsRoot.querySelector(".my-cl-heading--all");

    if (pinnedHeading) {
      setTextIfChanged(
        pinnedHeading,
        `PINNED · ${pinnedCount} course${pinnedCount === 1 ? "" : "s"}`
      );
      const display = pinnedCount === 0 ? "none" : "";
      if (pinnedHeading.style.display !== display) {
        pinnedHeading.style.display = display;
      }
    }
    if (allHeading) {
      setTextIfChanged(allHeading, `ALL COURSES · ${allCount} matching your filters`);
      allHeading.classList.toggle("my-cl-show-pin-hint", pinnedCount === 0);
    }
  }

  function updateCourseListCount(total, visible) {
    if (!courseListCountTextEl) return;
    setTextIfChanged(courseListCountTextEl, `Showing ${visible} of ${total} courses`);
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
    { tweaksEnabled: true, tweakToggles: {}, pastoralPanelAlwaysOpen: false },
    (result) => {
      if (!result.tweaksEnabled) return;

      tweakToggles = mergeTweakTogglesWithDefaults(result.tweakToggles);
      pastoralPanelAlwaysOpen = result.pastoralPanelAlwaysOpen;

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
