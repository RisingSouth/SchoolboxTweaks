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
        id: "dashboardRelief",
        label: "Check for relief",
        description: "Marks cover periods from the daily bulletin",
      },
      {
        id: "dashboardDuties",
        label: "My duties",
        description: "Shows recurring duties on the timetable",
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
