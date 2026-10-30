// Runs on my.edval.education/timetable. Completely passive: it does
// nothing until the extension's background worker asks (message type
// SCRAPE_RELIEF), which only happens when the user clicks "Check
// relief" on the Schoolbox dashboard. The background worker opens this
// page in an inactive tab, polls this script until it answers "ok" (or
// "login"), then closes the tab.
//
// What it reads: each lesson box's own data-* attributes (the same ones
// Edval's page already renders), plus Edval's staff <select> to turn a
// teacher code (e.g. WILMJA01) into a name. Nothing is sent anywhere
// except back to the extension.
//
// How relief is told apart (verified against saved timetable pages):
//  - Relief GIVEN to me:  data-usual-teacher="false", a class code, a
//    covering code, not an event. The covering code is the teacher
//    whose lesson I'm taking (Edval's tooltip: "Covering for X").
//  - Lesson COVERED by someone else: data-usual-teacher="true" with a
//    covering code ("Covered by X").
(function () {
  let skeletonFirstSeen = 0;

  function readNameMap() {
    const names = {};
    document.querySelectorAll("option[value]").forEach((opt) => {
      const code = opt.value;
      const text = opt.textContent.trim();
      // Any "Surname, First" entry with a value - no assumption about
      // what the code itself looks like. Only looked up by the codes
      // that appear on relief lessons, so extra entries are harmless.
      if (code && /^[^,]+,\s*\S+/.test(text)) {
        names[code] = text;
      }
    });
    return names;
  }

  function scrape() {
    // Redirected away from the timetable (e.g. to a login page).
    if (!/^\/timetable/.test(location.pathname)) return { status: "login" };

    const events = Array.from(
      document.querySelectorAll(".timetableTimeGridEvent")
    ).filter((el) => !(el.dataset.classCode || "").includes("{{"));

    const skeleton = document.querySelector(".timetableContentSkeleton");
    if (!skeleton) return { status: "loading" };
    if (!skeletonFirstSeen) skeletonFirstSeen = Date.now();
    // Boxes are drawn after the skeleton - wait for some, but accept an
    // empty week (holiday) once the skeleton has been up a few seconds.
    if (events.length === 0 && Date.now() - skeletonFirstSeen < 4000) {
      return { status: "loading" };
    }

    const names = readNameMap();
    const items = [];
    events.forEach((el) => {
      const d = el.dataset;
      if (d.event === "true" || !d.classCode || !d.coveringTeacherCode) return;
      if (d.teacherAbsence === "true") return;
      items.push({
        kind: d.usualTeacher === "false" ? "covering" : "covered",
        date: d.date,
        from: Number(d.from),
        to: Number(d.to),
        periodKey: d.periodKey,
        classCode: d.classCode,
        subject: d.classSubject,
        room: d.roomCode || "",
        otherCode: d.coveringTeacherCode,
        otherName: names[d.coveringTeacherCode] || "",
      });
    });

    return { status: "ok", items, lessonCount: events.length };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "SCRAPE_RELIEF") {
      sendResponse(scrape());
    }
    return false;
  });
})();
