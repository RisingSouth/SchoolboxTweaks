// Runs in the page's own JS world (declared with "world": "MAIN" in
// manifest.json), NOT the extension's isolated world - the two don't
// share JS globals even though they share the same DOM. Schoolbox
// sets window.schoolboxUser via an inline <script> in its own world,
// so content.js (isolated world) can't see it directly, no matter how
// it tries to reach for `window.schoolboxUser`.
//
// The DOM itself, unlike JS globals, genuinely is shared between the
// two worlds - so this copies the one or two fields actually needed
// onto a data attribute, which content.js can then read normally.
(function () {
  try {
    if (
      window.schoolboxUser &&
      window.schoolboxUser.firstname &&
      window.schoolboxUser.lastname
    ) {
      document.documentElement.setAttribute(
        "data-schoolbox-user",
        JSON.stringify({
          firstname: window.schoolboxUser.firstname,
          lastname: window.schoolboxUser.lastname,
        })
      );
    }
  } catch (err) {
    // schoolboxUser not present on this page (e.g. a login page) -
    // nothing to bridge, content.js's reader just gets null.
  }
})();

// ---------------------------------------------------------------
// PMI stepback helper: fill the "Reason for PMI being removed" note
// cell
//
// The pastoral record's note (#body_public) is a CKEditor 5 instance
// reachable only as window.sbProps.editors.body_public in this (MAIN)
// world - content.js can't touch it directly. This listens on the
// shared DOM for a request from content.js, does the actual
// read/edit/write here where the editor object lives, and replies
// with just a requestId + ok/reason - the editor itself never crosses
// into the isolated world.
//
// NOT independently confirmed against a real page:
//  - "body_public" as the editor's key in window.sbProps.editors -
//    assumed from the field's own id (#body_public), not read out of
//    Schoolbox's page JS.
//  - whether the Sub-type change's template table lands in the editor
//    before or after that change event finishes - this is why
//    fillPmiNoteReasonCell() is retried on a poll rather than tried
//    once: "no-row" (table/editor not there yet) keeps retrying,
//    "not-empty" (the row's value cell already has text) stops
//    immediately rather than fighting anything the user's already
//    typed.
//  - whether getData() renders the cell's text as plain text directly
//    inside the <td> or wrapped in a <p> - handled either way, see
//    fillPmiNoteReasonCell() below.
// ---------------------------------------------------------------
(function () {
  const PMI_NOTE_EDITOR_KEY = "body_public";
  const PMI_NOTE_REASON_LABEL = "Reason for PMI being removed";
  const PMI_NOTE_FILL_TEXT = "Stepback completed";
  const PMI_NOTE_POLL_TIMEOUT_MS = 5000;
  const PMI_NOTE_POLL_INTERVAL_MS = 150;

  function getPmiNoteEditor() {
    try {
      return (
        (window.sbProps &&
          window.sbProps.editors &&
          window.sbProps.editors[PMI_NOTE_EDITOR_KEY]) ||
        null
      );
    } catch (err) {
      return null;
    }
  }

  function cellTextMatches(cell, label) {
    return !!cell && cell.textContent.trim() === label;
  }

  // CKEditor pads an otherwise-blank cell with a non-breaking space
  // (U+00A0) so the cursor has somewhere to land - that still counts
  // as "empty" here, not as "the user already typed something".
  function cellIsEmpty(cell) {
    return !!cell && cell.textContent.replace(/ /g, "").trim() === "";
  }

  // Tries once to fill the value cell, returning what happened rather
  // than a plain boolean so the poll loop below can tell "not ready
  // yet, keep trying" apart from "ready, but don't touch it".
  function tryFillPmiNoteReasonCell(editor) {
    if (!editor) return "no-editor";

    let html;
    try {
      html = editor.getData();
    } catch (err) {
      return "no-editor";
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("table tr"));
    const targetRow = rows.find((row) =>
      cellTextMatches(row.querySelector("td, th"), PMI_NOTE_REASON_LABEL)
    );
    if (!targetRow) return "no-row";

    const cells = Array.from(targetRow.querySelectorAll("td, th"));
    const valueCell = cells[1];
    if (!valueCell) return "no-row";
    if (!cellIsEmpty(valueCell)) return "not-empty";

    // Keep whatever wrapper CKEditor put inside the cell (a <p>, most
    // likely) rather than replacing the cell's own markup outright -
    // this only ever changes text, never structure.
    const paragraph = valueCell.querySelector("p");
    if (paragraph) {
      paragraph.textContent = PMI_NOTE_FILL_TEXT;
    } else {
      valueCell.textContent = PMI_NOTE_FILL_TEXT;
    }

    try {
      editor.setData(doc.body.innerHTML);
    } catch (err) {
      return "no-editor";
    }
    return "filled";
  }

  function pollForPmiNoteFill(timeoutMs, onDone) {
    const deadline = Date.now() + timeoutMs;

    (function poll() {
      const result = tryFillPmiNoteReasonCell(getPmiNoteEditor());

      // "filled" and "not-empty" are both final - the first succeeded,
      // the second must never be retried into overwriting real text.
      // "no-editor"/"no-row" just mean "not ready yet".
      if (result === "filled" || result === "not-empty") {
        onDone(result);
        return;
      }
      if (Date.now() >= deadline) {
        onDone(result);
        return;
      }
      setTimeout(poll, PMI_NOTE_POLL_INTERVAL_MS);
    })();
  }

  document.addEventListener("my-pmi-note-fill-request", (event) => {
    const requestId = event.detail && event.detail.requestId;

    pollForPmiNoteFill(PMI_NOTE_POLL_TIMEOUT_MS, (result) => {
      document.dispatchEvent(
        new CustomEvent("my-pmi-note-fill-response", {
          detail: { requestId, ok: result === "filled", reason: result },
        })
      );
    });
  });
})();

// ---------------------------------------------------------------
// Pastoral note Templates: read/write the note editor and the Tags
// field. Same reason as the PMI helper above - window.sbProps.editors
// and the Tags field's selectize instance only exist in this (MAIN)
// world.
//
// The payload (note HTML, tags) travels as JSON in an attribute on a
// hidden element in the shared DOM, not in CustomEvent.detail, so the
// feature doesn't depend on how event detail crosses worlds. Only the
// note editor's own HTML goes through - never a field the page marks
// Confidential (body_private is never read here).
//
// Ops, request in data-request ({id, op, ...}), reply in data-response:
//  - "read":  {ok, html, tags}   the General note HTML and Tags value
//  - "write": {ok, reason}       setData(html) then EDITOR__CHECK_DATA,
//             exactly what Schoolbox's own replaceTemplate() does
//  - "tags":  {ok, reason}       sets the Tags field via selectize
//
// NOT confirmed live: the tags op (selectize.setValue with tag names
// that may or may not already be options).
// ---------------------------------------------------------------
(function () {
  const BRIDGE_ID = "my-tpl-bridge";

  function editor() {
    try {
      return (
        (window.sbProps &&
          window.sbProps.editors &&
          window.sbProps.editors.body_public) ||
        null
      );
    } catch (err) {
      return null;
    }
  }

  function tagsInput() {
    return document.getElementById("tags");
  }

  function handle(req) {
    if (req.op === "read") {
      const ed = editor();
      if (!ed) return { ok: false, reason: "no-editor" };
      let html = "";
      try {
        html = ed.getData();
      } catch (err) {
        return { ok: false, reason: "no-editor" };
      }
      const tags = tagsInput();
      return { ok: true, html, tags: tags ? tags.value || "" : "" };
    }

    if (req.op === "write") {
      const ed = editor();
      if (!ed) return { ok: false, reason: "no-editor" };
      try {
        ed.setData(String(req.html || ""));
        ed.sourceElement.dispatchEvent(new CustomEvent("EDITOR__CHECK_DATA"));
      } catch (err) {
        return { ok: false, reason: "set-failed" };
      }
      return { ok: true };
    }

    if (req.op === "tags") {
      const el = tagsInput();
      if (!el) return { ok: false, reason: "no-tags" };
      const names = String(req.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      try {
        if (el.selectize) {
          el.selectize.clear(true);
          names.forEach((n) => {
            if (!el.selectize.options[n]) {
              el.selectize.addOption({ value: n, text: n });
            }
          });
          el.selectize.setValue(names, true);
        } else {
          el.value = names.join(",");
        }
      } catch (err) {
        return { ok: false, reason: "tags-failed" };
      }
      return { ok: true };
    }

    return { ok: false, reason: "bad-op" };
  }

  document.addEventListener("my-tpl-request", () => {
    const bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) return;
    let req = null;
    try {
      req = JSON.parse(bridge.getAttribute("data-request") || "null");
    } catch (err) {
      req = null;
    }
    const result = req ? handle(req) : { ok: false, reason: "bad-request" };
    bridge.setAttribute(
      "data-response",
      JSON.stringify({ id: req && req.id, ...result })
    );
    document.dispatchEvent(new Event("my-tpl-response"));
  });
})();
