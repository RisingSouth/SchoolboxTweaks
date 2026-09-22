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
