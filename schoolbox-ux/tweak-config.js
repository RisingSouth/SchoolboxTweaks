// Single source of truth for which tweaks exist, their storage keys,
// labels and grouping. Loaded as a plain script (no build step) by
// both content.js (as an extra content script, see manifest.json)
// and options.html - so the settings page and the tweaks it controls
// can never drift out of sync with each other. Add a new tweak here
// first, then gate its function call in content.js's applyTweaks().

const TWEAK_GROUPS = [
  {
    name: "Dashboard",
    tweaks: [
      {
        id: "dashboardLinks",
        label: "Class List / Markbook links",
        description: "Adds numeric-ID links to each timetable box",
      },
      {
        id: "dashboardDuties",
        label: "My duties",
        description: "Shows recurring duties on the timetable",
      },
      {
        id: "dashboardRelief",
        label: "Relief check",
        description: "\"Check relief\" button on the dashboard timetable: opens Edval in a background tab on click, reads this week's relief, then closes it",
      },
    ],
  },
  {
    name: "Search",
    tweaks: [
      {
        id: "searchStudentActions",
        label: "Student shortcuts in search",
        description: "Icon buttons on student search results (header dropdown and full results page): add pastoral record, pastoral history, grades, due work, timetable, Veracross attendance",
      },
    ],
  },
  {
    name: "Classes list",
    tweaks: [
      {
        id: "classesGridQuickLinks",
        label: "Quick links on class cards",
        description: "Class List / Markbook / Pastoral Care buttons on each card",
      },
    ],
  },
  {
    name: "Class homepage",
    tweaks: [
      {
        id: "classHomeQuickActions",
        label: "Quick actions",
        description: "Surfaces Class Actions links as buttons",
      },
      {
        id: "classHomeSeat",
        label: "Seating chart",
        description: "Embeds the Seat app inline",
      },
    ],
  },
  {
    name: "Markbook",
    tweaks: [
      {
        id: "markbookFilters",
        label: "Collapsible filters",
        description: "Hides the 6 filter dropdowns behind a toggle",
      },
      {
        id: "markbookHeading",
        label: "Hide redundant heading",
        description: "Removes the heading that repeats the breadcrumb",
      },
      {
        id: "markbookFullHeight",
        label: "Full-height table",
        description: "Removes the table's own internal scrollbar",
      },
      {
        id: "markbookSort",
        label: "Click-to-sort columns",
        description: "Click a header to sort students by that column",
      },
      {
        id: "markbookShading",
        label: "Assessment bucket shading",
        description: "Colour-tints project bucket columns",
      },
      {
        id: "markbookQuickLinks",
        label: "Quick links",
        description: "Mark-all and open-response shortcuts on gradable columns",
      },
      {
        id: "markbookGradeColumn",
        label: "Grade column",
        description: "Adds an indicative A-E grade next to each student's weighted average (cutoffs are editable below)",
      },
    ],
  },
  {
    name: "Class list",
    tweaks: [
      {
        id: "classListFlagFilter",
        label: "Pastoral flag filter",
        description: "Toggle pills to hide flags by category",
      },
      {
        id: "classListPmiBadge",
        label: "PMI level badge",
        description: "Shows current given-minus-removed count",
      },
      {
        id: "classListAttentionTags",
        label: "Attention tags",
        description: "Medical alert / risk plan / learning support",
      },
      {
        id: "classListColumnReorg",
        label: "Column reorganisation",
        description: "Hides blank columns, relocates flag pills",
      },
      {
        id: "classListStudentCount",
        label: "Student count",
        description: "Shows how many students are visible in the pastoral flag filter bar",
      },
      {
        id: "classListExportCsv",
        label: "Export student list (CSV)",
        description: "Adds an Export CSV button to the class list for downloading names and emails.",
      },
    ],
  },
  {
    name: "Marks overview",
    tweaks: [
      {
        id: "gradesOverviewPanels",
        label: "Class panels",
        description: "Shows each class's current average as a panel; click one to see its assessments",
      },
    ],
  },
  {
    name: "Course list",
    tweaks: [
      {
        id: "courseListImprovements",
        label: "Pinned courses, filters and quick actions",
        description: "Pin courses, filter by campus and level, and show quick actions on hover",
      },
    ],
  },
  {
    name: "Course import",
    tweaks: [
      {
        id: "courseImportUnitDates",
        label: "Copy unit dates",
        description: "\"Copy to all units\" button on the Units step",
      },
      {
        id: "courseImportLessonCascade",
        label: "Weekly lesson dates",
        description: "Auto-shifting weekly dates on the Learning Activities step",
      },
    ],
  },
  {
    name: "Pastoral records",
    tweaks: [
      {
        id: "pastoralRecordHistoryPanel",
        label: "Record history panel",
        description: "Shows a student's past pastoral records beside the new-record form",
      },
      {
        id: "pastoralPmiStepback",
        label: "PMI removed sequence",
        description: "Prefills each step of a multi-level \"PMI removed\" sequence - you still press Save",
      },
      {
        id: "pastoralCommendation",
        label: "Commendation shortcut",
        description: "Sets Type/Sub-type to Recognition / Commendation and the Title to \"Commendation\" - you still press Save",
      },
    ],
  },
];

// Flat {id: true} defaults, derived from the groups above so there's
// only one place that needs a new line when a tweak is added.
function buildDefaultTweakToggles() {
  const defaults = {};
  TWEAK_GROUPS.forEach((group) => {
    group.tweaks.forEach((tweak) => {
      defaults[tweak.id] = true;
    });
  });
  return defaults;
}

// Merges a stored tweakToggles value over the defaults, so a tweak
// added after someone last saved their settings comes back `true`
// instead of `undefined` (falsy) - chrome.storage's own default
// handling only fills in a *missing key*, not missing properties
// inside an object that's already there.
function mergeTweakTogglesWithDefaults(stored) {
  return Object.assign(buildDefaultTweakToggles(), stored || {});
}

// ---------------------------------------------------------------
// Grade scales for the Markbook "Grade" column.
//
// Cutoffs are [A, B, C, D] - a weighted average at or above a
// cutoff earns that letter, anything below the D cutoff is an E.
// These are the SEQTA (".5") values: Schoolbox shows the weighted
// average to 2 decimals, so comparing the displayed number against
// a ".5" cutoff matches "round first, then compare".
//
// Shared by content.js (the column itself) and options.js (the
// editable cutoffs card) for the same reason TWEAK_GROUPS is: one
// definition, so the two can't drift apart.
// ---------------------------------------------------------------
const GRADE_SCALES = [
  { id: "7", label: "Year 7" },
  { id: "8", label: "Year 8" },
  { id: "9", label: "Year 9" },
  { id: "10", label: "Year 10-12" },
];

const GRADE_LETTERS = ["A", "B", "C", "D", "E"];

const DEFAULT_GRADE_CUTOFFS = {
  "7": [79.5, 69.5, 49.5, 34.5],
  "8": [77.5, 67.5, 49.5, 34.5],
  "9": [75.5, 65.5, 49.5, 34.5],
  "10": [74.5, 64.5, 49.5, 34.5],
};

// True for exactly four finite numbers in 0-100, strictly
// descending (A > B > C > D). Used both when merging stored values
// (so a corrupted/hand-edited value falls back to the default
// rather than producing nonsense grades) and by the options page's
// own validation.
function isValidGradeCutoffs(cutoffs) {
  if (!Array.isArray(cutoffs) || cutoffs.length !== 4) return false;
  if (!cutoffs.every((n) => typeof n === "number" && isFinite(n) && n >= 0 && n <= 100)) {
    return false;
  }
  return cutoffs[0] > cutoffs[1] && cutoffs[1] > cutoffs[2] && cutoffs[2] > cutoffs[3];
}

// Merges stored cutoffs over the defaults, one scale at a time - a
// scale that's missing or invalid in storage falls back to its own
// default instead of discarding the whole object.
function mergeGradeCutoffsWithDefaults(stored) {
  const merged = {};
  Object.keys(DEFAULT_GRADE_CUTOFFS).forEach((id) => {
    const candidate = stored && stored[id];
    merged[id] = isValidGradeCutoffs(candidate)
      ? candidate.slice()
      : DEFAULT_GRADE_CUTOFFS[id].slice();
  });
  return merged;
}

// Letter for a weighted average (a number), or "" if it isn't one.
function gradeLetterForValue(value, cutoffs) {
  if (typeof value !== "number" || !isFinite(value)) return "";
  for (let i = 0; i < 4; i++) {
    if (value >= cutoffs[i]) return GRADE_LETTERS[i];
  }
  return GRADE_LETTERS[4];
}
