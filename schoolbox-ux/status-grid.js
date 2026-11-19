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
  // In an empty mark box: A / N / S enter Schoolbox's three non-numeric statuses.
  const STATUS_KEYS = { a: "Absent", n: "Not Assessed", s: "Not Submitted" };
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

  // True if the caret (collapsed selection) is on the first (down=false)
  // or last (down=true) visual line of the editable, so arrow keys can
  // hop to the neighbouring student without breaking cursor movement
  // inside a multi-line comment.
  function caretOnEdge(editable, down) {
    const sel = window.getSelection();
    if (!editable || !sel || !sel.rangeCount || !sel.isCollapsed) return false;
    if (!editable.textContent.trim()) return true;
    const r = sel.getRangeAt(0);
    const edge = document.createRange();
    edge.selectNodeContents(editable);
    edge.collapse(!down);
    const top = (rg) => {
      const rects = rg.getClientRects();
      return rects.length ? rects[0].top : null;
    };
    const a = top(r);
    const b = top(edge);
    if (a === null || b === null) {
      // boundary positions can report no rect: fall back to "at the very edge"
      return r.compareBoundaryPoints(down ? Range.END_TO_END : Range.START_TO_START, edge) === 0;
    }
    return Math.abs(a - b) < 4;
  }

  // ---- ▾ menu beside each mark: Absent / Not Assessed / Not Submitted ----
  let menu = null;
  let menuFor = null;
  let menuOpenedAt = 0;
  function closeMenu() {
    if (menu) menu.style.display = "none";
    menuFor = null;
  }
  function openMenu(btn, input) {
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "my-grid-menu";
      ["Absent", "Not Assessed", "Not Submitted", "Clear mark"].forEach((label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.setAttribute("data-v", label === "Clear mark" ? "" : label);
        b.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus
        b.addEventListener("click", () => {
          if (menuFor) {
            setValue(menuFor, b.getAttribute("data-v"));
            menuFor.focus();
          }
          closeMenu();
        });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      document.addEventListener("mousedown", (e) => {
        if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target.closest && e.target.closest(".my-grid-dd"))) closeMenu();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
      });
      window.addEventListener("scroll", () => { if (Date.now() - menuOpenedAt > 400) closeMenu(); }, true);
    }
    if (menuFor === input && menu.style.display === "block") return closeMenu();
    menuFor = input;
    menuOpenedAt = Date.now();
    const r = btn.getBoundingClientRect();
    menu.style.display = "block";
    const h = menu.offsetHeight;
    menu.style.left = Math.max(8, r.right - menu.offsetWidth) + "px";
    menu.style.top = (r.bottom + h + 8 > window.innerHeight ? r.top - h - 4 : r.bottom + 4) + "px";
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
          e.stopPropagation(); // keep Schoolbox's own combobox list shut
          move(li, "mark", 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          move(li, "mark", -1);
        } else if (e.key === "Tab" && !e.shiftKey) {
          if (focusCell(li, "feedback")) e.preventDefault();
        } else if (e.key === "Escape") {
          t.blur();
        } else if (!t.value && !e.ctrlKey && !e.metaKey && !e.altKey && STATUS_KEYS[e.key.toLowerCase()]) {
          e.preventDefault();
          setValue(t, STATUS_KEYS[e.key.toLowerCase()]);
          move(li, "mark", 1);
        }
      } else if (t.closest(".ck-editor__editable")) {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopImmediatePropagation(); // pre-empt CKEditor's own Enter
          move(li, "feedback", 1);
        } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey && !e.altKey) {
          const down = e.key === "ArrowDown";
          // Ctrl/Cmd always jumps; plain arrows jump only from the last
          // (down) / first (up) line, otherwise they move the cursor as usual.
          if (e.ctrlKey || e.metaKey || caretOnEdge(t.closest(".ck-editor__editable"), down)) {
            if (move(li, "feedback", down ? 1 : -1)) {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          }
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

  // ---- hover portrait card (floats outside the row, never inside it) ----
  let pop = null;
  function showPop(a) {
    const li = a.closest(ROW);
    if (!li) return;
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "my-grid-pop";
      document.body.appendChild(pop);
    }
    const id = li.getAttribute("data-participant");
    const m = markOf(li);
    pop.textContent = "";
    const big = document.createElement("img");
    big.src = "/portrait.php?id=" + id + "&size=square192";
    big.alt = "";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = li.getAttribute("data-participant-name") || "";
    const r1 = document.createElement("div");
    r1.className = "r2";
    r1.innerHTML = "<span>Status</span><span></span>";
    r1.lastChild.textContent = statusText(li);
    const r2 = document.createElement("div");
    r2.className = "r2";
    r2.innerHTML = "<span>Mark</span><span></span>";
    r2.lastChild.textContent = m && m.value ? m.value : "-";
    pop.append(big, nm, r1, r2);
    const b = a.getBoundingClientRect();
    pop.style.display = "block";
    const h = pop.offsetHeight;
    pop.style.left = Math.min(b.right + 10, window.innerWidth - 230) + "px";
    pop.style.top = Math.max(8, Math.min(b.top - 20, window.innerHeight - h - 8)) + "px";
  }
  document.addEventListener("mouseover", (e) => {
    const a = e.target.closest && e.target.closest(".my-grid-portrait");
    if (a) showPop(a);
  });
  document.addEventListener("mouseout", (e) => {
    const a = e.target.closest && e.target.closest(".my-grid-portrait");
    if (a && pop) pop.style.display = "none";
  });

  // ---- row data helpers ----
  function statusText(li) {
    const l = li.querySelector("[data-assessment-status-text]");
    return l ? l.textContent.trim() : "";
  }
  // Percentage tasks (e.g. marks pulled in from a rubric) store the mark as
  // text like "59.07 %" and validate with withinPercentageRange.
  function isPctInput(m) {
    return !!m && (m.title === "Percentage" || /%\s*$/.test(m.value));
  }
  function markNum(li) {
    const m = markOf(li);
    const v = m ? parseFloat(m.value) : NaN;
    const max = m ? parseFloat(m.getAttribute("data-validation-limit")) : NaN;
    return { v: isNaN(v) ? null : v, max: isNaN(max) ? null : max, raw: m ? m.value.trim() : "", pct: isPctInput(m) };
  }

  function refreshRow(li) {
    const pct = li.querySelector(".my-grid-pct");
    if (!pct) return;
    const { v, max, raw, pct: isPct } = markNum(li);
    const bad = v !== null && max !== null && (v < 0 || v > max);
    setText(pct, !isPct && v !== null && max && !bad ? Math.round((v / max) * 100) + "%" : "");
    const m = markOf(li);
    if (m) m.classList.toggle("my-grid-bad", bad);
    li.setAttribute("data-my-empty", raw === "" ? "1" : "0");
  }

  // Writing identical text still counts as a DOM mutation, which would
  // re-trigger the observer below forever - so only write on change.
  const setText = (e, t) => {
    if (e && e.textContent !== t) e.textContent = t;
  };

  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  let statsEl = null;
  function refreshStats() {
    if (!statsEl) return;
    const rows = Array.from(document.querySelectorAll(ROW));
    const nums = rows.map(markNum);
    const vals = nums.filter((x) => x.v !== null && (x.max === null || (x.v >= 0 && x.v <= x.max))).map((x) => x.v);
    const max = (nums.find((x) => x.max) || {}).max;
    const marked = nums.filter((x) => x.raw !== "").length;
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const set = (k, t) => {
      const e = statsEl.querySelector('[data-k="' + k + '"]');
      setText(e, t);
    };
    set("marked", marked + " / " + rows.length);
    const isPct = nums.some((x) => x.pct);
    const r1 = (x) => Math.round(x * 10) / 10;
    set("avg", avg === null ? "-" : isPct ? r1(avg) + "%" : r1(avg) + (max ? " (" + Math.round((avg / max) * 100) + "%)" : ""));
    set("range", vals.length ? r1(Math.min(...vals)) + " – " + r1(Math.max(...vals)) + (isPct ? "%" : "") : "-");
    set("unmarked", String(rows.length - marked));
    set("draft", String(rows.filter((r) => r.getAttribute("data-my-draft") === "1").length));
    document.querySelectorAll(".my-grid-head [data-k=max]").forEach((h) => setText(h, isPct ? "Mark %" : max ? "Mark /" + max : "Mark"));
  }

  // ---- filter chips / sort ----
  let filter = "all";
  let sortMode = "roll";
  function applyView() {
    const list = document.querySelector("[data-assessment-status] ul.information-list");
    if (!list) return;
    const rows = Array.from(list.querySelectorAll(":scope > " + ROW));
    rows.forEach((li) =>
      li.classList.toggle(
        "my-grid-hidden",
        (filter === "unmarked" && li.getAttribute("data-my-empty") !== "1") || (filter === "draft" && li.getAttribute("data-my-draft") !== "1")
      )
    );
    const idx = (li) => +li.getAttribute("data-my-idx");
    const sorted = rows.slice().sort((a, b) => {
      if (sortMode === "roll") return idx(a) - idx(b);
      const ma = markNum(a).v, mb = markNum(b).v;
      const d = (mb === null ? -1e9 : mb) - (ma === null ? -1e9 : ma);
      return sortMode === "high" ? d || idx(a) - idx(b) : -d || idx(a) - idx(b);
    });
    sorted.forEach((li) => list.appendChild(li));
    document.querySelectorAll("#my-grid-bar [data-f]").forEach((c) => c.classList.toggle("on", c.getAttribute("data-f") === filter));
    const sb = document.getElementById("my-grid-sort");
    if (sb) setText(sb, { roll: "Class order", high: "Mark: high to low", low: "Mark: low to high" }[sortMode]);
  }

  // ---- build rows ----
  function S(el, css) {
    if (!el) return;
    Object.keys(css).forEach((k) => el.style.setProperty(k, css[k], "important"));
  }
  const COLS = "28px 190px 96px 48px minmax(0, 1fr) 200px";

  // A row is a draft when Schoolbox is offering a Publish button for it.
  function refreshDraft(li) {
    const isDraft = !!li.querySelector('a[data-draft="publish"]');
    const pill = li.querySelector(".my-grid-pill");
    const flag = isDraft ? "1" : "0";
    if (li.getAttribute("data-my-draft") !== flag) li.setAttribute("data-my-draft", flag);
    if (pill) {
      setText(pill, isDraft ? "Draft" : statusText(li));
      pill.classList.toggle("my-grid-pill--draft", isDraft);
    }
  }

  function decorate() {
    const all = Array.from(document.querySelectorAll(ROW));
    all.forEach((li, i) => {
      if (li.querySelector(":scope > .my-grid-row")) return;
      const form = li.querySelector("form[data-feedback-form]");
      const frow = form && form.querySelector(":scope > .row");
      if (!frow || frow.children.length < 2) return;
      li.setAttribute("data-my-idx", String(i));

      const id = li.getAttribute("data-participant");
      const name = li.getAttribute("data-participant-name") || "";
      const submission = li.querySelector("a[data-inline-grader]");
      const href = (submission && submission.getAttribute("href")) || "/search/user/" + id;
      const ta = form.querySelector("textarea[data-feedback-comment]");
      const nClip = ta ? (ta.value.match(/fetch\.php\?hash=/g) || []).length : 0;
      const status = li.getAttribute("data-status") || "";

      const num = el("span", "my-grid-num", String(i + 1));
      const cell = el("div", "my-grid-name");
      const pa = el("a", "my-grid-portrait");
      pa.href = "/search/user/" + id;
      pa.setAttribute("aria-label", "Profile: " + name);
      const img = el("img");
      img.src = "/portrait.php?id=" + id + "&size=square64";
      img.alt = "";
      pa.appendChild(img);
      const nm = el("a", "my-grid-student", name);
      nm.href = href;
      nm.title = "View and mark submission";
      cell.append(pa, nm);
      if (nClip) {
        const c = el("span", "my-grid-clip", "\u{1F4CE}" + nClip);
        c.title = nClip + " attachment" + (nClip === 1 ? "" : "s");
        cell.appendChild(c);
      }
      const pct = el("span", "my-grid-pct");
      const pill = el("span", "my-grid-pill my-grid-pill--" + status.replace(/[^a-z-]/g, ""), statusText(li));
      const stCell = el("span", "my-grid-status");
      stCell.appendChild(pill);

      // Schoolbox's own per-student Publish / "Saved as Draft" bar: move the
      // real element (keeps its handlers) into the Status cell.
      const bar = li.querySelector("[data-action-bar]");
      if (bar) stCell.appendChild(bar);
      Array.from(li.children).forEach((c) => {
        if (c.classList.contains("column")) S(c, { display: "none" });
      });
      S(li, { "list-style": "none", padding: "0", margin: "0", height: "auto", float: "none", width: "auto" });

      const row = el("div", "my-grid-row");
      S(row, { display: "grid", "grid-template-columns": COLS, gap: "8px", "align-items": "center", width: "100%", "box-sizing": "border-box" });
      row.append(num, cell, form, pct, stCell);
      li.appendChild(row);

      // The real form joins the row's grid directly (display: contents),
      // so its mark box and editor become grid cells 3 and 5.
      S(form, { display: "contents" });
      Array.from(form.children).forEach((c) => {
        if (c !== frow) S(c, { display: "none" });
      });
      S(frow, { display: "contents" });
      const markCol = frow.children[0];
      const commentCol = frow.children[1];
      S(markCol, { display: "contents" });
      S(commentCol, { display: "contents" });
      Array.from(markCol.children).forEach((c) => {
        if (c.tagName !== "LABEL") S(c, { display: "none" });
      });
      const lab = markCol.querySelector("label");
      S(lab, { display: "block", margin: "0", "font-size": "0", "line-height": "0", "grid-column": "3", "grid-row": "1", width: "100%" });
      S(lab && lab.querySelector(".combobox"), { display: "block", width: "100%" });
      const markInput = markCol.querySelector('input[name="mark"]');
      if (markInput) {
        // stop Chrome's autofill history ("30 / 40" ...) popping up over the grid
        markInput.setAttribute("autocomplete", "off");
        form.setAttribute("autocomplete", "off");
        const lim = markInput.getAttribute("data-validation-limit");
        markInput.setAttribute("placeholder", isPctInput(markInput) ? "%" : lim ? "/" + lim : "");
      }
      if (markInput && lab) {
        const dd = el("button", "my-grid-dd", "\u25BE");
        dd.type = "button";
        dd.tabIndex = -1;
        dd.title = "Absent / Not Assessed / Not Submitted";
        dd.setAttribute("aria-label", "Mark status options");
        dd.addEventListener("mousedown", (e) => e.preventDefault());
        dd.addEventListener("click", (e) => {
          e.preventDefault();
          openMenu(dd, markInput);
        });
        const wrap = lab.querySelector(".combobox");
        S(wrap, { position: "relative" });
        (wrap || lab).appendChild(dd);
      }
      S(markCol.querySelector('input[name="mark"]'), { "font-size": "13px", height: "30px", width: "100%", margin: "0", padding: "0 26px 0 8px", "text-align": "right" });
      Array.from(commentCol.children).forEach((c) => {
        if (!c.classList.contains("ck-editor") && c.tagName !== "TEXTAREA") S(c, { display: "none" });
      });
      S(commentCol.querySelector(".ck-editor"), { "grid-column": "5", "grid-row": "1", width: "100%", "max-width": "none", margin: "0" });
      S(num, { "grid-column": "1", "grid-row": "1" });
      S(cell, { "grid-column": "2", "grid-row": "1" });
      S(pct, { "grid-column": "4", "grid-row": "1" });
      S(stCell, { "grid-column": "6", "grid-row": "1" });
      refreshRow(li);
    });
    all.forEach(refreshDraft);
    refreshStats();
  }

  // the chrome around the grid: stats, chips, header row, key hints
  function addChrome() {
    if (document.getElementById("my-grid-bar")) return;
    const section = document.querySelector("section[data-assessment-status]");
    const list = section && section.querySelector("ul.information-list");
    if (!list || !document.querySelector(ROW)) return;

    const bar = el("div", "");
    bar.id = "my-grid-bar";
    statsEl = el("div", "my-grid-stats");
    [["marked", "Marked"], ["avg", "Average"], ["range", "Range"], ["unmarked", "Unmarked"], ["draft", "Unpublished"]].forEach(([k, l]) => {
      const s = el("div", "my-grid-stat");
      s.append(el("span", "", l));
      const v = el("strong", "", "-");
      v.setAttribute("data-k", k);
      s.append(v);
      statsEl.appendChild(s);
    });
    const chips = el("div", "my-grid-chips");
    [["all", "All"], ["unmarked", "Unmarked"], ["draft", "Drafts"]].forEach(([f, l]) => {
      const c = el("button", "my-grid-chip", l);
      c.type = "button";
      c.setAttribute("data-f", f);
      c.addEventListener("click", () => {
        filter = f;
        applyView();
      });
      chips.appendChild(c);
    });
    chips.appendChild(el("span", "my-grid-spacer"));
    const sort = el("button", "my-grid-chip", "Class order");
    sort.type = "button";
    sort.id = "my-grid-sort";
    sort.addEventListener("click", () => {
      sortMode = sortMode === "roll" ? "high" : sortMode === "high" ? "low" : "roll";
      applyView();
    });
    chips.appendChild(sort);
    const tg = document.getElementById("my-grid-toggle");
    if (tg) chips.appendChild(tg);
    bar.append(statsEl, chips);

    const head = el("div", "my-grid-head");
    S(head, { display: "grid", "grid-template-columns": COLS, gap: "8px", "align-items": "center" });
    [["#", ""], ["Student", ""], ["Mark", "max"], ["%", ""], ["Feedback", ""], ["Status", ""]].forEach(([t, k], i) => {
      const h = el("span", i === 2 || i === 3 ? "my-grid-right" : "", t);
      if (k) h.setAttribute("data-k", k);
      head.appendChild(h);
    });
    const hint = el("p", "my-grid-hint");
    hint.innerHTML =
      "<kbd>Enter</kbd> next student (same column) · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line in feedback · <kbd>Tab</kbd> mark to feedback · <kbd>Esc</kbd> stop editing · in an empty mark: <kbd>A</kbd> Absent · <kbd>N</kbd> Not Assessed · <kbd>S</kbd> Not Submitted · paste a column to fill down";
    section.parentElement.insertBefore(bar, section);
    section.parentElement.insertBefore(head, section);
    section.appendChild(hint);
    list.classList.add("my-grid-list");
    refreshStats();
    S(list, { margin: "0", padding: "0" });
    applyView();
  }

  document.addEventListener("input", (e) => {
    const m = e.target;
    if (m.matches && m.matches('input[name="mark"]')) {
      const li = m.closest(ROW);
      if (li) {
        refreshRow(li);
        refreshStats();
      }
    }
  }, true);
  document.addEventListener("change", (e) => {
    const m = e.target;
    if (m.matches && m.matches('input[name="mark"]')) {
      // percentage tasks keep marks as "65 %": add the suffix to a bare number
      if (isPctInput(m) && /^\s*\d+(\.\d+)?\s*$/.test(m.value)) m.value = parseFloat(m.value) + " %";
      const li = m.closest(ROW);
      if (li) {
        refreshRow(li);
        refreshStats();
      }
    }
  }, true);

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
    const b = el("button", "my-grid-chip");
    b.id = "my-grid-toggle";
    b.type = "button";
    b.addEventListener("click", () => {
      try {
        localStorage.setItem("sbux-grid", on ? "off" : "on");
      } catch (e) {}
      location.reload();
    });
    // parked in the chip bar once it exists (addChrome moves it); until
    // then, above the search box
    const host = document.querySelector("[data-participant-search]");
    const anchor = host && (host.closest(".row, div") || host.parentElement);
    if (anchor) anchor.parentElement.insertBefore(b, anchor);
    apply();
  }

  function apply() {
    document.body.classList.toggle("my-status-grid", on);
    const b = document.getElementById("my-grid-toggle");
    setText(b, on ? "Classic view" : "Grid view");
  }

  function init() {
    chrome.storage.sync.get({ tweaksEnabled: true, tweakToggles: {} }, (r) => {
      const t = r.tweakToggles || {};
      if (!r.tweaksEnabled || t.assessmentStatusGrid === false) return;
      apply();
      addToggle();
      if (on) {
        decorate();
        addChrome();
      }
      ensureAllRows();
      let pending = false;
      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          addToggle();
          if (on) {
            decorate();
            addChrome();
          }
        });
      }).observe(document.body, { childList: true, subtree: true });
      setTimeout(ensureAllRows, 1500);
    });
  }
  init();
})();
