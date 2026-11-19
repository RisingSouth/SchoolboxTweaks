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
  try {
    on = localStorage.getItem("sbux-grid") !== "off";
  } catch (e) {}

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

  // Applies inline !important styles: these beat any stylesheet rule,
  // including Schoolbox's own, which we can't see or rely on.
  function S(el, css) {
    if (!el) return;
    Object.keys(css).forEach((k) => el.style.setProperty(k, css[k], "important"));
  }

  // Builds our own row inside the <li>: [name cell | the real <form>].
  // The form is MOVED (not cloned), so Schoolbox's validation, draft save
  // and publish keep working. Everything else in the form (hints,
  // resubmission checkbox, action bar, combobox arrow) is hidden.
  function decorate() {
    document.querySelectorAll(ROW).forEach((li) => {
      if (li.querySelector(":scope > .my-grid-row")) return;
      const form = li.querySelector("form[data-feedback-form]");
      const frow = form && form.querySelector(":scope > .row");
      if (!frow || frow.children.length < 2) return;

      const id = li.getAttribute("data-participant");
      const name = li.getAttribute("data-participant-name") || "";
      const submission = li.querySelector("a[data-inline-grader]");
      const href = (submission && submission.getAttribute("href")) || "/search/user/" + id;
      const tick = li.querySelector(".progress-tick");
      const lbl = li.querySelector("[data-assessment-status-text]");
      const ta = form.querySelector("textarea[data-feedback-comment]");
      const n = ta ? (ta.value.match(/fetch\.php\?hash=/g) || []).length : 0;

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
      if (tick) sub.appendChild(tick.cloneNode(true));
      sub.appendChild(document.createTextNode(lbl ? lbl.textContent.trim() : ""));
      if (n) {
        const c = document.createElement("span");
        c.className = "my-grid-clip";
        c.title = n + " attachment" + (n === 1 ? "" : "s");
        c.textContent = "\u{1F4CE}" + n;
        sub.appendChild(c);
      }
      text.append(nm, sub);
      cell.append(pa, text);

      // hide Schoolbox's own card/name column(s)
      Array.from(li.children).forEach((c) => {
        if (c.classList.contains("column")) S(c, { display: "none" });
      });

      S(li, { "list-style": "none", padding: "0", height: "auto" });
      const row = document.createElement("div");
      row.className = "my-grid-row";
      S(row, {
        display: "grid",
        "grid-template-columns": "240px minmax(0, 1fr)",
        gap: "10px",
        "align-items": "center",
        width: "100%",
        "box-sizing": "border-box",
      });
      row.append(cell, form);
      li.appendChild(row);

      // the form: block, only its .row visible
      S(form, { display: "block", margin: "0", padding: "0", width: "auto", float: "none", "min-width": "0" });
      Array.from(form.children).forEach((c) => {
        if (c !== frow) S(c, { display: "none" });
      });
      S(frow, {
        display: "grid",
        "grid-template-columns": "120px minmax(0, 1fr)",
        gap: "10px",
        "align-items": "center",
        margin: "0",
        padding: "0",
        width: "auto",
        "max-width": "none",
      });
      const reset = { float: "none", width: "auto", "max-width": "none", margin: "0", padding: "0", "min-width": "0" };
      const markCol = frow.children[0];
      const commentCol = frow.children[1];
      S(markCol, reset);
      S(commentCol, reset);
      Array.from(markCol.children).forEach((c) => {
        if (c.tagName !== "LABEL") S(c, { display: "none" });
      });
      const lab = markCol.querySelector("label");
      S(lab, { margin: "0", "font-size": "0", "line-height": "0" });
      const mark = markCol.querySelector('input[name="mark"]');
      S(mark, { "font-size": "14px", height: "32px", width: "110px", margin: "0", padding: "2px 8px" });
      Array.from(commentCol.children).forEach((c) => {
        if (!c.classList.contains("ck-editor") && c.tagName !== "TEXTAREA") S(c, { display: "none" });
      });
      S(commentCol.querySelector(".ck-editor"), { width: "100%", "max-width": "none", margin: "0" });
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
      try {
        localStorage.setItem("sbux-grid", on ? "off" : "on");
      } catch (e) {}
      location.reload();
    });
    anchor.parentElement.insertBefore(b, anchor);
    apply();
  }

  function apply() {
    document.body.classList.toggle("my-status-grid", on);
    const b = document.getElementById("my-grid-toggle");
    if (b) b.textContent = on ? "Grid view: on (click for classic)" : "Classic view (click for grid)";
  }

  function init() {
    chrome.storage.sync.get({ tweaksEnabled: true, tweakToggles: {} }, (r) => {
      const t = r.tweakToggles || {};
      if (!r.tweaksEnabled || t.assessmentStatusGrid === false) return;
      apply();
      addToggle();
      if (on) decorate();
      ensureAllRows();
      new MutationObserver(() => {
        addToggle();
        if (on) decorate();
      }).observe(document.body, { childList: true, subtree: true });
      setTimeout(ensureAllRows, 1500);
    });
  }
  init();
})();
