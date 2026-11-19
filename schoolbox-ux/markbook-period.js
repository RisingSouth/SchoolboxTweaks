// Markbook: remember the "Due in Academic Period" filter.
//
// Schoolbox resets that filter to its own default (the current period)
// on every fresh load. Filters live in the URL (?5[4]=1&5[3]=1 ...), so
// to "remember" a choice this adds those parameters on a fresh load.
//
// There is no button: applying filters in Schoolbox's own panel saves the
// selection automatically.
//
// What is stored is a RULE, not a list of periods, so it doesn't go stale
// when the year rolls over:
//   default      - leave Schoolbox alone (nothing stored)
//   current      - the current period only
//   year         - every period in the current year (2026-1 + 2026-2, then
//                  just 2027-1 once 2027 starts - never drags in 2026-2)
//   currentPrev  - the current period and the one before it
//   fixed        - exactly the periods that were ticked. Only used for
//                  anything else, and it LAPSES (falls back to Schoolbox's
//                  default, with a notice) as soon as a newer period shows
//                  up in the list, so nobody gets stuck on 2026 in 2027.
//
// NOT independently confirmed against a live page: that a Markbook URL
// with only ?5[k]=1 params (no others) keeps the other filters at their
// defaults, and where Schoolbox's fresh-load default sits at a semester
// boundary (the "current" period is read from what Schoolbox itself
// pre-ticks on a fresh load, not guessed from the date, when possible).
(function () {
  if (!/\/learning\/markbook\/class\//.test(location.pathname)) return;

  const KEY = "markbookPeriodRule";
  const LABEL = "Due in Academic Period";

  function findComponent() {
    const pop = document.querySelector('sbx-pop-out[button-text="' + LABEL + '"]');
    const li = pop && pop.closest("li.filter-component");
    if (!li) return null;
    const comp = li.getAttribute("data-component");
    const periods = Array.from(li.querySelectorAll('input[type="checkbox"][data-filter-options]'))
      .map((i) => {
        const label = (i.getAttribute("data-label-in-summary") || "").replace(/\s*\[archived\]\s*$/i, "").trim();
        const m = /^(\d{4})-(\d+)$/.exec(label);
        return m ? { key: i.getAttribute("data-key"), label, rank: +m[1] * 10 + +m[2], archived: /\[archived\]/i.test(i.getAttribute("data-label-in-summary") || ""), checked: i.checked } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.rank - a.rank); // newest first
    return periods.length ? { comp, periods } : null;
  }

  const hasPeriodParams = (comp) => Array.from(new URLSearchParams(location.search).keys()).some((k) => k.indexOf(comp + "[") === 0);

  // the period Schoolbox itself treats as current = newest of what it pre-ticks on a fresh load
  function currentFrom(periods, ticked) {
    const pool = ticked.length ? ticked : periods.filter((p) => !p.archived);
    return pool.slice().sort((a, b) => b.rank - a.rank)[0];
  }

  function sameSet(a, b) {
    return a.length === b.length && a.every((x) => b.indexOf(x) !== -1);
  }

  function describe(rule) {
    if (!rule) return "";
    if (rule.type === "current") return "current period";
    if (rule.type === "year") return "this year";
    if (rule.type === "currentPrev") return "current + previous period";
    return "fixed: " + rule.labels.join(", ");
  }

  // turn the periods ticked right now into a rule
  function infer(c, freshDefault) {
    const ticked = c.periods.filter((p) => p.checked);
    const labels = ticked.map((p) => p.label);
    if (!labels.length) return null;
    // On a fresh load the current period is what Schoolbox pre-ticked. Once
    // a filter has been applied that is unknown, so estimate it from the
    // date: newest non-archived period that has started (Semester 2 from July).
    let cur;
    if (freshDefault) {
      cur = currentFrom(c.periods, freshDefault);
    } else {
      const now = new Date();
      const nowRank = now.getFullYear() * 10 + (now.getMonth() >= 6 ? 2 : 1);
      const open = c.periods.filter((p) => !p.archived);
      cur = open.find((p) => p.rank <= nowRank) || open[0] || c.periods[0];
    }
    const idx = c.periods.indexOf(cur);
    const prev = c.periods[idx + 1];
    if (freshDefault && sameSet(labels, freshDefault.map((p) => p.label))) return { type: "default" };
    if (sameSet(labels, [cur.label])) return { type: "current" };
    const yearOf = (p) => Math.floor(p.rank / 10);
    const thisYear = c.periods.filter((p) => yearOf(p) === yearOf(cur)).map((p) => p.label);
    if (sameSet(labels, thisYear)) return { type: "year" };
    if (prev && sameSet(labels, [cur.label, prev.label])) return { type: "currentPrev" };
    return { type: "fixed", labels, seen: c.periods.map((p) => p.label) };
  }

  function resolve(rule, c, ticked) {
    const cur = currentFrom(c.periods, ticked);
    const idx = c.periods.indexOf(cur);
    if (rule.type === "current") return [cur];
    if (rule.type === "year") return c.periods.filter((p) => Math.floor(p.rank / 10) === Math.floor(cur.rank / 10));
    if (rule.type === "currentPrev") return [cur].concat(c.periods[idx + 1] ? [c.periods[idx + 1]] : []);
    if (rule.type === "fixed") {
      // a period newer than anything seen when this was saved => lapse
      const newest = c.periods[0];
      if (rule.seen.indexOf(newest.label) === -1 && newest.rank > Math.max.apply(null, c.periods.filter((p) => rule.labels.indexOf(p.label) !== -1).map((p) => p.rank))) return "lapsed";
      return c.periods.filter((p) => rule.labels.indexOf(p.label) !== -1);
    }
    return null;
  }

  function load(cb) {
    chrome.storage.sync.get({ tweaksEnabled: true, tweakToggles: {}, [KEY]: null }, (r) => {
      const t = r.tweakToggles || {};
      if (!r.tweaksEnabled || t.markbookPeriodMemory === false) return;
      cb(r[KEY]);
    });
  }

  function save(rule, done) {
    const p = rule && rule.type !== "default" ? chrome.storage.sync.set({ [KEY]: rule }) : chrome.storage.sync.remove(KEY);
    Promise.resolve(p).then(done, done);
  }

  let freshDefault = null; // what Schoolbox pre-ticked, only known on a fresh load
  let lapsed = false;

  function start(rule) {
    const c = findComponent();
    if (!c) return;
    const fresh = !hasPeriodParams(c.comp);
    if (fresh) freshDefault = c.periods.filter((p) => p.checked);

    if (fresh && rule) {
      const target = resolve(rule, c, freshDefault);
      if (target === "lapsed") {
        lapsed = true;
      } else if (target && target.length && !sameSet(target.map((p) => p.key), freshDefault.map((p) => p.key))) {
        let guard = null;
        try {
          guard = sessionStorage.getItem("sbux-period-redirect");
        } catch (e) {}
        if (guard !== location.href) {
          try {
            sessionStorage.setItem("sbux-period-redirect", location.href);
          } catch (e) {}
          const url = new URL(location.href);
          target.forEach((p) => url.searchParams.set(c.comp + "[" + p.key + "]", "1"));
          location.replace(url.toString());
          return;
        }
      }
    }
    watchApply();
  }

  // No button: whenever the teacher uses Schoolbox's own "Apply filters",
  // the periods they ticked at that moment become the saved rule (the same
  // rolling rules as above). Ticking just what Schoolbox pre-ticks on a
  // fresh load clears the saved rule, i.e. goes back to the default.
  function watchApply() {
    const remember = () => {
      const c = findComponent();
      if (!c) return;
      const r = infer(c, freshDefault);
      if (r) save(r, () => {});
    };
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest && e.target.closest('#submit_button, [data-test="panel-apply-filters-button"]')) remember();
      },
      true
    );
    document.addEventListener(
      "submit",
      (e) => {
        if (e.target && e.target.querySelector && e.target.querySelector("#filter_panel, .filter-component")) remember();
      },
      true
    );
  }

  load(start);
})();
