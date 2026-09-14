# Privacy Policy — Schoolbox UX Tweaks

**Last updated:** 14/09/2026

Schoolbox UX Tweaks is a browser extension that changes how existing
Schoolbox pages are displayed and navigated. This policy describes
what data the extension accesses, how it's used, and where it goes.

## What this extension does

The extension runs only on the Schoolbox site it's built for. It
rearranges, filters, and adds shortcuts to information that is
already shown to the signed-in user on that site — it does not add
any new data source or connect to any service beyond Schoolbox
itself.

## What data it accesses

To do this, the extension reads content that is already visible (or
one click away) to the signed-in user on Schoolbox pages, including:

- Student and staff names
- Pastoral-care flags, including Medical Alert and Risk Management
  Plan flags
- Class, timetable, and Markbook information
- The text of a daily staff bulletin PDF, when the user manually
  clicks "Check for relief"

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
itself (to load pages the user is already viewing or navigating to)
and to the storage host Schoolbox's own file-download links redirect
to, in order to fetch a single already-authorised file (the daily
bulletin PDF) on the user's behalf. No request is made to any other
destination.

## What is stored, and for how long

The extension stores two small pieces of information locally, using
Chrome's built-in storage APIs:

1. **An on/off toggle** for the extension's page modifications
   (`chrome.storage.sync`) — kept until the user changes it or
   uninstalls the extension.
2. **The result of the day's "Check for relief" click**
   (`chrome.storage.local`) — kept only for that calendar day, so a
   page refresh doesn't lose the result; a new day's result simply
   replaces it.

Neither is transmitted anywhere. Uninstalling the extension removes
both.

## Changes to this policy

If what this extension accesses or how it's used changes in a future
version, this page will be updated to reflect that before the update
is published.

## Contact

Questions about this policy can be sent to: markflowau@gmail.com
