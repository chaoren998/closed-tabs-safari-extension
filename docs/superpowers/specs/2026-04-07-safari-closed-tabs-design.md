# Safari Closed Tabs Extension Design

## Summary

Build a Safari Web Extension that adds a toolbar button. Clicking the button opens a compact popup listing recently closed tabs that the extension recorded after installation. The list is ordered by close time descending and shows each tab's favicon, title, URL, and relative close time. Selecting an item reopens the URL in a new active tab and removes that record from the list.

## User-Approved Product Decisions

- Use a Safari toolbar button with a popup instead of a keyboard shortcut.
- Show a popup list first; do not immediately reopen the most recent tab.
- Use the compact `A` popup layout.
- Persist closed-tab history across Safari restarts.
- Record only tabs closed after the extension is installed and enabled.
- Remove a record from the list after the user reopens it from the popup.
- Keep at most 20 closed-tab records.

## Constraints

- Safari itself exposes recently closed tabs in its own UI, but Safari Web Extensions don't expose a supported API for reading that internal history directly.
- The WebExtension `sessions` APIs that would normally support native-style recently-closed restoration (`sessions.getRecentlyClosed()` and `sessions.restore()`) are not available in Safari, so the extension must maintain its own history.
- The extension therefore restores URLs it has recorded itself; it does not restore full Safari session state such as scroll position, form contents, back/forward stack, or tab-group placement.
- Safari Web Extensions are implemented as app extensions for distribution, though Safari also supports temporary local installation of an unpacked extension folder during development.
- Full packaging and App Store style distribution require Xcode. This machine currently has Command Line Tools but not full Xcode installed.

## Goals

- Make reopening recently closed tabs more discoverable than relying on `Command+Z`.
- Present a clear, compact, Safari-appropriate popup UI.
- Persist the extension-managed closed-tab history between browser launches.
- Keep the implementation lightweight and Safari-first.

## Non-Goals

- Reproducing Safari's internal "Reopen Last Closed Tab" behavior exactly.
- Restoring full browser session state.
- Syncing closed-tab history across devices.
- Recording private browsing activity.
- Building a native helper app unless Safari Web Extension APIs prove insufficient during implementation.

## Recommended Approach

### Approach A: Pure Safari Web Extension with extension-managed history

Recommended.

The extension listens for tab lifecycle updates, stores the latest known metadata for open tabs, and writes a history entry when a tab closes. The popup reads that extension-owned history and reopens the selected URL with `tabs.create`.

Pros:

- Smallest implementation surface.
- No native helper or app-to-extension messaging required.
- Matches the approved feature set.
- Easy to test incrementally.

Cons:

- Reopens URLs, not full Safari session state.
- Depends on the extension seeing tab metadata before the tab closes.

### Approach B: Safari Web Extension plus native host app

Not recommended for the initial version.

This would add a containing app and native messaging path to handle more advanced logic or future platform features.

Pros:

- Leaves room for native integrations later.

Cons:

- Heavier build and signing setup.
- Doesn't solve the lack of a public Safari API for reading Safari's own recently closed session list.
- Unnecessary for the approved scope.

### Approach C: Custom deep session manager

Not recommended.

Attempting to capture richer page state would add complexity and still be unreliable on many sites.

## Technical Design

### Extension format

Start with a Safari-first Web Extension implemented with plain HTML, CSS, and JavaScript. For reliability on Safari and simpler debugging, begin with a non-persistent background page design instead of adding framework or native app complexity. Packaging into a Safari Extension App can happen once full Xcode is installed.

### High-level components

- `manifest.json`
  Declares the popup, background page, icons, permissions, and storage usage.
- `src/background/background.js`
  Owns tab tracking, history creation, popup message handling, and reopen/remove operations.
- `src/popup/popup.html`
  Hosts the compact popup shell.
- `src/popup/popup.js`
  Requests closed-tab data from the background script and renders the list.
- `src/popup/popup.css`
  Implements the compact `A` layout and Safari-like visual treatment.
- `src/shared/closedTabsStore.js`
  Contains pure logic for validation, sorting, trimming, deletion, and serialization.

## Data Model

### Open tab snapshot

Maintain an in-memory map keyed by current tab ID so the extension can capture the last known metadata before a tab disappears.

Fields:

- `tabId`
- `windowId`
- `url`
- `title`
- `favIconUrl`
- `lastSeenAt`
- `isPrivate` when available from the API context

### Closed tab record

Persist an array of records in `storage.local`.

Fields:

- `id`
- `url`
- `title`
- `favIconUrl`
- `closedAt`
- `sourceWindowId`
- `sourceTabId`

Rules:

- Sort by `closedAt` descending.
- Keep only the latest 20 records.
- Remove the selected record after a successful reopen.

## Event Flow

### Tracking open tabs

- On startup, query current tabs when permitted and seed the snapshot map.
- Listen for tab creation and update events to refresh URL, title, and favicon metadata.
- Keep the latest known snapshot for each tab.

### Recording a closed tab

- Listen for tab removal events.
- When a tab closes, look up the last known snapshot.
- If the tab is recordable, create a closed-tab record and prepend it to stored history.
- Trim history to 20 items before writing back to storage.

### Reopening a tab

- Popup requests current history from the background script.
- User clicks a list item.
- Background script validates the record and opens a new active tab with the stored URL.
- On success, delete the record from storage and notify the popup to refresh.
- On failure, preserve the record and return an error message.

## Recordability Rules

Record only tabs that meet all of these conditions:

- Have a non-empty HTTP or HTTPS URL.
- Are not Safari internal pages.
- Are not extension pages.
- Are not private browsing tabs or tabs from private windows.

Do not add extra deduplication beyond preserving close order. If the same URL is closed multiple times, each closure is a separate history event.

## Popup UX

### Layout

Use the approved compact list layout:

- Small favicon on the left.
- Title as the primary line.
- URL as a muted secondary line.
- Relative close time aligned to the right when space allows.
- Scrollable list container for longer history.

### States

- Default list state with up to 20 records.
- Empty state: concise message that no recorded closed tabs are available yet.
- Error state: lightweight inline message if reopen fails.
- Missing favicon state: fall back to a neutral placeholder icon.

### Interaction details

- One click on a row reopens the tab.
- Open the tab as active in the current Safari window.
- Remove the row immediately after confirmed success.
- Keep the popup focused on the list rather than adding search in v1.

## Privacy and Data Handling

- Closed-tab history lives only in extension local storage.
- Do not sync records to cloud services in v1.
- Do not track private browsing tabs.
- Store only the metadata needed for list display and reopening.

## Risks and Mitigations

### Incomplete metadata on very fast tab closures

Risk:
The extension may see the tab close before title or favicon metadata is fully populated.

Mitigation:
Store the URL as the required field and gracefully fall back to hostname-based display plus a default icon.

### Safari API compatibility details

Risk:
Some Safari-specific differences may affect event timing or which tab fields are populated.

Mitigation:
Implement and verify against Safari directly first, using a small shared store module so behavior can be adjusted without rewriting the popup.

### No full session restore

Risk:
The reopened tab won't match Safari's native session restoration behavior.

Mitigation:
Set expectations clearly in docs and product copy. This extension reopens recorded URLs, not full sessions.

## Testing Strategy

### Automated tests

Add unit tests around shared store logic:

- insert closed records in descending order
- cap storage at 20 items
- delete a selected record
- ignore invalid or unsupported URLs
- preserve duplicate closures as separate records

### Manual integration verification

In Safari development builds verify:

- closing a normal webpage adds it to history
- records survive quitting and relaunching Safari
- popup ordering is newest first
- clicking a record opens the correct URL in a new active tab
- reopened records disappear from the list
- private browsing tabs are not recorded
- tabs without favicons fall back cleanly

## Implementation Notes for Planning

- Start with the smallest possible Safari Web Extension file set.
- Prefer background-owned state changes over direct popup writes to storage.
- Keep the popup free of business logic beyond rendering and user events.
- Delay Xcode packaging work until full Xcode is installed, but structure files so they can drop into an Xcode Safari Extension App target cleanly.

## Source Notes

- Apple documents Safari Web Extensions as the current extension model and notes they can be temporarily installed from a folder during development, while packaged distribution requires an app-extension-based flow.
- Apple points Safari extension developers to the WebExtension API model for feature compatibility.
- Safari does not expose a supported equivalent of the `sessions` recently-closed APIs used in some other browsers, which is why this design maintains extension-owned history instead.
