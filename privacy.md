# Privacy Policy — Schoolbox UX Tweaks

**Last updated:** 14/09/2026

Schoolbox UX Tweaks is a browser extension that changes how existing
Schoolbox pages are displayed and navigated. This policy describes
what data the extension accesses, how it's used, and where it goes.

## What this extension does

The extension runs on the Schoolbox site it's built for, and — only
when the user clicks "Check relief" on the dashboard — on the school's
Edval timetable page (my.edval.education). It rearranges, filters, and
adds shortcuts to information that is already shown to the signed-in
user on those sites.

## What data it accesses

To do this, the extension reads content that is already visible (or
one click away) to the signed-in user on Schoolbox pages, including:

- Student and staff names
- Pastoral-care flags, including Medical Alert and Risk Management
  Plan flags
- Class, timetable, and Markbook information

This is the same information the user could already see themselves
by using Schoolbox normally — the extension does not access anything
the signed-in user couldn't already view.

## How this data is used

All of the above is used only to change what's shown on the page in
the user's own browser — for example, adding a badge, a filter, a
link, or a highlighted timetable cell. None of it is used for any
other purpose.

## Where this data goes

**Nowhere outside the user's own browser.** This extension:

- Does not transmit any of the data listed above to the developer,
  to Anthropic/Google, or to any third party
- Does not use analytics, tracking, or advertising of any kind
- Does not sell or share data with anyone

The only network requests the extension makes are to Schoolbox
itself (to load pages the user is already viewing or navigating to),
to the storage host Schoolbox's own file-download links redirect to
(to fetch an already-authorised file, such as a seating chart layout,
on the user's behalf), and — only when the user clicks "Check relief"
— to the school's Edval timetable page, which is opened in a
background tab, read for the signed-in user's own relief lessons, and
closed again. No request is made to any other destination.

## What is stored, and for how long

The most recent "Check relief" result (the user's own relief lessons
for the week, with the covering/covered teacher's name) is stored
locally in the browser using `chrome.storage.local`, and is replaced
the next time the user clicks the button.

The extension stores its settings and preferences (such as the
on/off toggle for its page modifications) locally, using Chrome's
`chrome.storage.sync` API — kept until the user changes them or
uninstalls the extension.

None of this is transmitted anywhere. Uninstalling the extension
removes it.

## Changes to this policy

If what this extension accesses or how it's used changes in a future
version, this page will be updated to reflect that before the update
is published.

## Contact

Questions about this policy can be sent to: info@markflow.com.au
