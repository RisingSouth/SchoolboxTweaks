// Assessment status page: spreadsheet-style marking grid.
// Rows are Schoolbox's own <li data-participant> items; this only
// restyles them (styles.css, under body.my-status-grid) and adds keyboard
// navigation. Marks and feedback are still typed into Schoolbox's real
// inputs, so its validation, draft-saving and publish flow are untouched.
//
// Keys: Enter / Down = next student, Up = previous (same column).
// Mark: Tab -> feedback, "A" -> Absent, pasting a column fills downward.
// Feedback: Enter = next student's feedback, Shift+Enter = new line.
// Esc leaves the field (blur, so Schoolbox saves).
//
// NOT independently confirmed against a live page: that a programmatic
// value + input/change/blur triggers Schoolbox's draft save, and that
// CKEditor's own Enter handling can be pre-empted with a capturing
// keydown listener (done below).
(function () {
  if (!/\/learning\/assessments\/\d+\/status/.test(location.pathname)) return;

  const ROW = "li[data-participant]";
  let on = true;

  function visibleRows() {
    return Array.from(document.querySelectorAll(ROW)).filter(
      (li) => li.style.display !== "none" && li.offsetParent !== null
    );
  }
  const markOf = (li) => li.querySelector('input[name="mark"]');
  const editableOf = (li) => li.querySelector(".ck-editor__editable");

  function setValue(input, v) {
    input.value = v;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function focusCell(li, kind) {
    const el = kind === "mark" ? markOf(li) : editableOf(li);
    if (!el) return false;
    el.focus();
    li.scrollIntoView({ block: "nearest" });
    if (kind === "mark" && el.select) el.select();
    return true;
  }

  function move(li, kind, delta) {
    const rows = visibleRows();
    const i = rows.indexOf(li) + delta;
    if (i < 0 || i >= rows.length) return false;
    return focusCell(rows[i], kind);
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (!on || e.isComposing) return;
      const t = e.target;
      const li = t.closest && t.closest(ROW);
      if (!li) return;

      if (t.matches('input[name="mark"]')) {
        if (e.key === "Enter" || e.key === "ArrowDown") {
          e.preventDefault();
          move(li, "mark", 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          move(li, "mark", -1);
        } else if (e.key === "Tab" && !e.shiftKey) {
          if (focusCell(li, "feedback")) e.preventDefault();
        } else if (e.key === "Escape") {
          t.blur();
        } else if ((e.key === "a" || e.key === "A") && !t.value && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setValue(t, "Absent");
          move(li, "mark", 1);
        }
      } else if (t.closest(".ck-editor__editable")) {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopImmediatePropagation(); // pre-empt CKEditor's own Enter
          move(li, "feedback", 1);
        } else if (e.key === "ArrowDown" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          move(li, "feedback", 1);
        } else if (e.key === "ArrowUp" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          move(li, "feedback", -1);
        } else if (e.key === "Tab" && e.shiftKey) {
          if (focusCell(li, "mark")) e.preventDefault();
        } else if (e.key === "Escape") {
          t.blur();
        }
      }
    },
    true
  );

  // Paste a column of marks (e.g. from a spreadsheet) and fill downward.
  document.addEventListener(
    "paste",
    (e) => {
      if (!on) return;
      const t = e.target;
      if (!t.matches || !t.matches('input[name="mark"]')) return;
      const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
      const lines = text.split(/\r?\n/).map((s) => s.trim());
      while (lines.length && lines[lines.length - 1] === "") lines.pop();
      if (lines.length < 2) return;
      e.preventDefault();
      const rows = visibleRows();
      let i = rows.indexOf(t.closest(ROW));
      lines.forEach((v) => {
        const input = rows[i] && markOf(rows[i]);
        if (input) setValue(input, v);
        i++;
      });
    },
    true
  );

  // Hover portrait: swap the 64px image for the 192px one on first hover.
  document.addEventListener(
    "mouseover",
    (e) => {
      const img = e.target.closest && e.target.closest(".my-grid-portrait img");
      if (img && img.src.includes("size=square64")) {
        img.src = img.src.replace("size=square64", "size=square192");
      }
    },
    true
  );

  // Builds our own name cell (portrait, name, status, attachment count)
  // from the row's data, and marks Schoolbox's original card column as
  // hidden - the card's own layout CSS is never relied on. The form
  // column (mark + CKEditor) stays in place, untouched.
  function decorate() {
    document.querySelectorAll(ROW).forEach((li) => {
      if (li.querySelector(":scope > .my-grid-name")) return;
      const form = li.querySelector("form[data-feedback-form]");
      const cols = Array.from(li.children).filter((c) => c.classList.contains("column"));
      if (!form || !cols.length) return;
      cols.forEach((c) => c.classList.add(c.contains(form) ? "my-grid-form-col" : "my-grid-orig"));

      const id = li.getAttribute("data-participant");
      const name = li.getAttribute("data-participant-name") || "";
      const submission = li.querySelector("a[data-inline-grader]");
      const href = (submission && submission.getAttribute("href")) || "/search/user/" + id;

      const cell = document.createElement("div");
      cell.className = "my-grid-name";

      const pa = document.createElement("a");
      pa.className = "my-grid-portrait";
      pa.href = "/search/user/" + id;
      pa.title = "View profile";
      const img = document.createElement("img");
      img.src = "/portrait.php?id=" + id + "&size=square64";
      img.alt = "";
      pa.appendChild(img);

      const text = document.createElement("div");
      text.className = "my-grid-text";
      const nm = document.createElement("a");
      nm.className = "my-grid-student";
      nm.href = href;
      nm.title = "View and mark submission";
      nm.textContent = name;
      const sub = document.createElement("div");
      sub.className = "my-grid-sub";
      const tick = li.querySelector(".progress-tick");
      if (tick) sub.appendChild(tick.cloneNode(true));
      const lbl = li.querySelector("[data-assessment-status-text]");
      sub.appendChild(document.createTextNode(lbl ? lbl.textContent.trim() : ""));
      const ta = li.querySelector("textarea[data-feedback-comment]");
      const n = ta ? (ta.value.match(/fetch\.php\?hash=/g) || []).length : 0;
      if (n) {
        const s = document.createElement("span");
        s.className = "my-grid-clip";
        s.title = n + " attachment" + (n === 1 ? "" : "s");
        s.textContent = "\u{1F4CE}" + n;
        sub.appendChild(s);
      }
      text.append(nm, sub);
      cell.append(pa, text);
      li.insertBefore(cell, li.firstChild);
    });
  }

  // Fallback if the 50-row override didn't take: un-hide every row.
  function ensureAllRows() {
    if (document.documentElement.getAttribute("data-sbux-status-limit-applied")) return;
    const rows = document.querySelectorAll(ROW);
    const filtered = document.querySelector("[data-participant-filters] input:checked[data-status]");
    const search = document.querySelector("input[data-participant-search]");
    if (rows.length > 25 && rows.length <= 50 && !filtered && !(search && search.value)) {
      rows.forEach((li) => {
        if (li.style.display === "none") li.style.display = "";
      });
      const pager = document.querySelector("[data-participant-paginator]");
      if (pager) pager.style.display = "none";
    }
  }

  function addToggle() {
    if (document.getElementById("my-grid-toggle")) return;
    const host = document.querySelector("[data-participant-search]");
    const anchor = host && (host.closest(".row, div") || host.parentElement);
    if (!anchor) return;
    const b = document.createElement("button");
    b.id = "my-grid-toggle";
    b.type = "button";
    b.className = "button tiny";
    b.addEventListener("click", () => {
      on = !on;
      apply();
    });
    anchor.parentElement.insertBefore(b, anchor);
    apply();
  }

  function apply() {
    document.body.classList.toggle("my-status-grid", on);
    const b = document.getElementById("my-grid-toggle");
    if (b) b.textContent = on ? "Grid view: on (click for classic)" : "Grid view: off";
  }

  function init() {
    chrome.storage.sync.get({ tweaksEnabled: true, tweakToggles: {} }, (r) => {
      const t = r.tweakToggles || {};
      if (!r.tweaksEnabled || t.assessmentStatusGrid === false) return;
      apply();
      addToggle();
      decorate();
      ensureAllRows();
      new MutationObserver(() => {
        addToggle();
        decorate();
      }).observe(document.body, { childList: true, subtree: true });
      setTimeout(ensureAllRows, 1500);
    });
  }
  init();
})();
