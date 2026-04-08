# Safari Closed Tabs Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Safari Web Extension that records newly closed HTTP(S) tabs, shows them in a compact popup list, and reopens a selected record while removing it from history.

**Architecture:** Use a Safari-first Web Extension with a non-persistent background page, a compact popup UI, and two testable JavaScript modules: one for closed-tab storage rules and one for background controller behavior. Keep browser-facing files thin by pushing sorting, validation, and reopen/remove logic into pure or dependency-injected modules that can be exercised with Node's built-in test runner.

**Tech Stack:** JavaScript ES modules, Safari Web Extension APIs (`browser.tabs`, `browser.storage`, `browser.runtime`), HTML/CSS, Node.js `node:test`

---

## Planned File Structure

- Create: `package.json`
- Create: `extension/manifest.json`
- Create: `extension/src/background/background.html`
- Create: `extension/src/background/background.js`
- Create: `extension/src/background/closedTabsController.js`
- Create: `extension/src/background/registerBackground.js`
- Create: `extension/src/shared/closedTabsStore.js`
- Create: `extension/src/shared/relativeTime.js`
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/popup.js`
- Create: `extension/src/popup/renderClosedTabsList.js`
- Create: `tests/shared/closedTabsStore.test.js`
- Create: `tests/shared/relativeTime.test.js`
- Create: `tests/background/closedTabsController.test.js`
- Create: `tests/background/registerBackground.test.js`
- Create: `tests/popup/renderClosedTabsList.test.js`
- Create: `README.md`
- Create: `docs/manual-testing/safari-closed-tabs-checklist.md`
- Modify: `.gitignore`

## Implementation Notes

- Before starting Task 1, create a dedicated worktree from `main` for implementation work so the plan can be executed with isolated commits.
- Use `manifest_version: 2` with a non-persistent background page for v1. Safari still supports manifest v2, and the background page is easier to inspect while stabilizing Safari-specific behavior. Revisit manifest v3 only after the Safari-first implementation is passing manual checks.
- Keep closed-tab persistence under a single `storage.local` key such as `closedTabs`.
- Record only `http:` and `https:` URLs.
- Treat duplicate URLs as separate history items.
- Do not record private browsing tabs.
- Prefer extension-managed IDs (`crypto.randomUUID()`) for stored records so popup actions don't depend on Safari tab IDs staying meaningful after close.

## Task 1: Bootstrap the repo and lock down closed-tab storage rules

**Files:**
- Create: `package.json`
- Create: `extension/src/shared/closedTabsStore.js`
- Test: `tests/shared/closedTabsStore.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Add the minimal Node test harness and ignore local junk**

Create `package.json` with ESM enabled and tiny scripts:

```json
{
  "name": "safari-closed-tabs-extension",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "test:store": "node --test tests/shared/closedTabsStore.test.js",
    "test:background": "node --test tests/background/*.test.js",
    "test:popup": "node --test tests/popup/*.test.js tests/shared/relativeTime.test.js"
  }
}
```

Ensure `.gitignore` contains:

```gitignore
.superpowers/
.DS_Store
node_modules/
```

- [ ] **Step 2: Write the failing shared-store tests**

Create `tests/shared/closedTabsStore.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  CLOSED_TABS_LIMIT,
  insertClosedTabRecord,
  removeClosedTabRecord,
} from "../../extension/src/shared/closedTabsStore.js";

test("insertClosedTabRecord prepends the newest record", () => {
  const records = insertClosedTabRecord(
    [{ id: "older", url: "https://example.com/1", closedAt: 1000 }],
    { id: "newer", url: "https://example.com/2", closedAt: 2000 }
  );

  assert.deepEqual(records.map((record) => record.id), ["newer", "older"]);
});

test("insertClosedTabRecord trims the list to the configured limit", () => {
  const seed = Array.from({ length: CLOSED_TABS_LIMIT }, (_, index) => ({
    id: `seed-${index}`,
    url: `https://example.com/${index}`,
    closedAt: 1000 - index,
  }));

  const records = insertClosedTabRecord(seed, {
    id: "overflow",
    url: "https://example.com/overflow",
    closedAt: 3000,
  });

  assert.equal(records.length, CLOSED_TABS_LIMIT);
  assert.equal(records.at(-1).id, "seed-18");
});

test("insertClosedTabRecord rejects unsupported URLs", () => {
  assert.throws(
    () => insertClosedTabRecord([], { id: "bad", url: "safari://favorites", closedAt: 10 }),
    /recordable URL/
  );
});

test("removeClosedTabRecord removes only the chosen record", () => {
  const records = removeClosedTabRecord(
    [
      { id: "keep", url: "https://example.com/1", closedAt: 1000 },
      { id: "drop", url: "https://example.com/2", closedAt: 900 },
    ],
    "drop"
  );

  assert.deepEqual(records.map((record) => record.id), ["keep"]);
});
```

- [ ] **Step 3: Run the store test and confirm it fails for the missing module**

Run: `node --test tests/shared/closedTabsStore.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `extension/src/shared/closedTabsStore.js`

- [ ] **Step 4: Implement the shared-store module with only the approved rules**

Create `extension/src/shared/closedTabsStore.js`:

```js
export const CLOSED_TABS_LIMIT = 20;

export function isRecordableUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function insertClosedTabRecord(existingRecords, nextRecord) {
  if (!isRecordableUrl(nextRecord.url)) {
    throw new TypeError("Closed-tab records require a recordable URL");
  }

  return [nextRecord, ...existingRecords]
    .sort((left, right) => right.closedAt - left.closedAt)
    .slice(0, CLOSED_TABS_LIMIT);
}

export function removeClosedTabRecord(existingRecords, recordId) {
  return existingRecords.filter((record) => record.id !== recordId);
}
```

Keep this module intentionally small; do not add storage I/O here.

- [ ] **Step 5: Run the focused test, then the full test suite**

Run: `node --test tests/shared/closedTabsStore.test.js`  
Expected: PASS

Run: `npm test`  
Expected: PASS with only the shared-store tests discovered so far

- [ ] **Step 6: Commit the foundation**

```bash
git add .gitignore package.json extension/src/shared/closedTabsStore.js tests/shared/closedTabsStore.test.js
git commit -m "test: add closed tab store rules"
```

## Task 2: Build and test the background controller behavior

**Files:**
- Create: `extension/src/background/closedTabsController.js`
- Test: `tests/background/closedTabsController.test.js`
- Modify: `extension/src/shared/closedTabsStore.js`

- [ ] **Step 1: Write failing controller tests around snapshots, closure recording, and reopen/remove**

Create `tests/background/closedTabsController.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { createClosedTabsController } from "../../extension/src/background/closedTabsController.js";

function createBrowserFixture(initialRecords = []) {
  const state = { closedTabs: initialRecords };
  const createdTabs = [];

  return {
    createdTabs,
    browserApi: {
      storage: {
        local: {
          async get(key) {
            return { [key]: state[key] ?? [] };
          },
          async set(nextState) {
            Object.assign(state, nextState);
          },
        },
      },
      tabs: {
        async query() {
          return [];
        },
        async create(details) {
          createdTabs.push(details);
          return { id: 999, ...details };
        },
      },
    },
    readRecords() {
      return state.closedTabs;
    },
  };
}

test("seedSnapshots stores existing recordable tabs on startup", async () => {
  const fixture = createBrowserFixture();
  fixture.browserApi.tabs.query = async () => [
    {
      id: 1,
      windowId: 2,
      url: "https://developer.apple.com",
      title: "Apple Developer",
      favIconUrl: "https://developer.apple.com/favicon.ico",
    },
    {
      id: 2,
      windowId: 2,
      url: "safari://favorites",
      title: "Favorites",
    },
  ];

  const controller = createClosedTabsController({
    browserApi: fixture.browserApi,
    now: () => 2000,
    createId: () => "record-seeded",
  });

  await controller.seedSnapshots();
  await controller.recordClosedTab(1);

  assert.equal(fixture.readRecords().length, 1);
  assert.equal(fixture.readRecords()[0].url, "https://developer.apple.com");
});

test("recordClosedTab stores the last seen tab snapshot", async () => {
  const fixture = createBrowserFixture();
  const controller = createClosedTabsController({
    browserApi: fixture.browserApi,
    now: () => 2000,
    createId: () => "record-1",
  });

  controller.upsertTabSnapshot({
    id: 42,
    windowId: 7,
    url: "https://example.com/doc",
    title: "Example Doc",
    favIconUrl: "https://example.com/favicon.ico",
  });

  await controller.recordClosedTab(42);

  assert.deepEqual(fixture.readRecords()[0], {
    id: "record-1",
    sourceTabId: 42,
    sourceWindowId: 7,
    url: "https://example.com/doc",
    title: "Example Doc",
    favIconUrl: "https://example.com/favicon.ico",
    closedAt: 2000,
  });
});

test("recordClosedTab ignores private or unsupported snapshots", async () => {
  const fixture = createBrowserFixture();
  const controller = createClosedTabsController({
    browserApi: fixture.browserApi,
    now: () => 2000,
    createId: () => "record-private",
  });

  controller.upsertTabSnapshot({
    id: 9,
    windowId: 1,
    url: "https://example.com/private",
    title: "Secret",
    incognito: true,
  });

  await controller.recordClosedTab(9);

  assert.equal(fixture.readRecords().length, 0);
});

test("reopenClosedTab opens the stored URL and removes the record", async () => {
  const fixture = createBrowserFixture([
    {
      id: "record-7",
      sourceTabId: 13,
      sourceWindowId: 2,
      url: "https://example.com/reopen",
      title: "Reopen me",
      favIconUrl: "",
      closedAt: 1000,
    },
  ]);

  const controller = createClosedTabsController({
    browserApi: fixture.browserApi,
    now: () => 2000,
    createId: () => "unused",
  });

  await controller.reopenClosedTab("record-7");

  assert.deepEqual(fixture.createdTabs, [{ url: "https://example.com/reopen", active: true }]);
  assert.equal(fixture.readRecords().length, 0);
});
```

- [ ] **Step 2: Run the controller test and confirm it fails**

Run: `node --test tests/background/closedTabsController.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `closedTabsController.js`

- [ ] **Step 3: Implement the controller with injected dependencies**

Create `extension/src/background/closedTabsController.js`:

```js
import {
  insertClosedTabRecord,
  isRecordableUrl,
  removeClosedTabRecord,
} from "../shared/closedTabsStore.js";

const STORAGE_KEY = "closedTabs";

export function createClosedTabsController({
  browserApi,
  now = () => Date.now(),
  createId = () => crypto.randomUUID(),
}) {
  const snapshots = new Map();

  function upsertTabSnapshot(tab) {
    if (!tab?.id || !isRecordableUrl(tab.url) || tab.incognito) {
      return;
    }

    snapshots.set(tab.id, {
      tabId: tab.id,
      windowId: tab.windowId ?? null,
      url: tab.url,
      title: tab.title || new URL(tab.url).hostname,
      favIconUrl: tab.favIconUrl || "",
      incognito: Boolean(tab.incognito),
    });
  }

  async function seedSnapshots() {
    const tabs = await browserApi.tabs.query({});
    tabs.forEach(upsertTabSnapshot);
  }

  async function listClosedTabs() {
    const stored = await browserApi.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] ?? [];
  }

  async function writeClosedTabs(records) {
    await browserApi.storage.local.set({ [STORAGE_KEY]: records });
  }

  async function recordClosedTab(tabId) {
    const snapshot = snapshots.get(tabId);
    snapshots.delete(tabId);

    if (!snapshot || snapshot.incognito || !isRecordableUrl(snapshot.url)) {
      return;
    }

    const nextRecord = {
      id: createId(),
      sourceTabId: snapshot.tabId,
      sourceWindowId: snapshot.windowId,
      url: snapshot.url,
      title: snapshot.title,
      favIconUrl: snapshot.favIconUrl,
      closedAt: now(),
    };

    const records = await listClosedTabs();
    await writeClosedTabs(insertClosedTabRecord(records, nextRecord));
  }

  async function reopenClosedTab(recordId) {
    const records = await listClosedTabs();
    const record = records.find((item) => item.id === recordId);

    if (!record) {
      throw new Error(`Closed-tab record not found: ${recordId}`);
    }

    await browserApi.tabs.create({ url: record.url, active: true });
    await writeClosedTabs(removeClosedTabRecord(records, recordId));
  }

  return {
    seedSnapshots,
    listClosedTabs,
    upsertTabSnapshot,
    recordClosedTab,
    reopenClosedTab,
  };
}
```

Do not register browser listeners yet; keep this file focused on behavior.

- [ ] **Step 4: Run the targeted background test, then the full suite**

Run: `node --test tests/background/closedTabsController.test.js`  
Expected: PASS

Run: `npm test`  
Expected: PASS with shared-store and controller tests

- [ ] **Step 5: Commit the controller**

```bash
git add extension/src/background/closedTabsController.js extension/src/shared/closedTabsStore.js tests/background/closedTabsController.test.js
git commit -m "feat: add closed tabs controller"
```

## Task 3: Implement and test popup rendering

**Files:**
- Create: `extension/src/shared/relativeTime.js`
- Create: `extension/src/popup/renderClosedTabsList.js`
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/popup.js`
- Test: `tests/shared/relativeTime.test.js`
- Test: `tests/popup/renderClosedTabsList.test.js`

- [ ] **Step 1: Write failing tests for relative-time formatting and compact-list markup**

Create `tests/shared/relativeTime.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { formatRelativeTime } from "../../extension/src/shared/relativeTime.js";

test("formatRelativeTime formats recent minutes", () => {
  assert.equal(formatRelativeTime(60_000, 0), "1 min ago");
  assert.equal(formatRelativeTime(9 * 60_000, 0), "9 min ago");
});

test("formatRelativeTime formats hours after 60 minutes", () => {
  assert.equal(formatRelativeTime(2 * 60 * 60_000, 0), "2 hr ago");
});
```

Create `tests/popup/renderClosedTabsList.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { renderClosedTabsList } from "../../extension/src/popup/renderClosedTabsList.js";

test("renderClosedTabsList shows an empty state", () => {
  const markup = renderClosedTabsList([], { now: 2_000 });
  assert.match(markup, /No recently closed tabs yet/);
});

test("renderClosedTabsList renders the compact row layout", () => {
  const markup = renderClosedTabsList(
    [
      {
        id: "row-1",
        title: "Apple Developer",
        url: "https://developer.apple.com/documentation",
        favIconUrl: "",
        closedAt: 1_000,
      },
    ],
    { now: 61_000 }
  );

  assert.match(markup, /data-record-id="row-1"/);
  assert.match(markup, /Apple Developer/);
  assert.match(markup, /developer.apple.com/);
  assert.match(markup, /1 min ago/);
});
```

- [ ] **Step 2: Run the popup-focused tests and confirm they fail**

Run: `node --test tests/shared/relativeTime.test.js tests/popup/renderClosedTabsList.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Implement the popup helpers and thin UI files**

Create `extension/src/shared/relativeTime.js`:

```js
export function formatRelativeTime(now, closedAt) {
  const elapsedMinutes = Math.max(1, Math.floor((now - closedAt) / 60_000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours} hr ago`;
}
```

Create `extension/src/popup/renderClosedTabsList.js`:

```js
import { formatRelativeTime } from "../shared/relativeTime.js";

export function renderClosedTabsList(records, { now = Date.now() } = {}) {
  if (records.length === 0) {
    return '<p class="empty-state">No recently closed tabs yet.</p>';
  }

  return records
    .map((record) => {
      const hostname = new URL(record.url).hostname;
      const favicon = record.favIconUrl || "";

      return `
        <button class="closed-tab-row" data-record-id="${record.id}" type="button">
          <span class="favicon-slot">${favicon ? `<img alt="" src="${favicon}">` : hostname[0].toUpperCase()}</span>
          <span class="closed-tab-copy">
            <span class="closed-tab-title">${record.title}</span>
            <span class="closed-tab-url">${hostname}</span>
          </span>
          <span class="closed-tab-time">${formatRelativeTime(now, record.closedAt)}</span>
        </button>
      `;
    })
    .join("");
}
```

Create `extension/src/popup/popup.html` with a compact shell:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Closed Tabs</title>
    <link rel="stylesheet" href="./popup.css">
  </head>
  <body>
    <main class="popup-shell">
      <header class="popup-header">
        <h1>Recently Closed</h1>
        <p>Reopen a tab from your extension history</p>
      </header>
      <section class="popup-list" data-closed-tabs-list></section>
      <p class="popup-status" data-popup-status hidden></p>
    </main>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
```

Create `extension/src/popup/popup.js`:

```js
import { renderClosedTabsList } from "./renderClosedTabsList.js";

const listNode = document.querySelector("[data-closed-tabs-list]");
const statusNode = document.querySelector("[data-popup-status]");

async function loadClosedTabs() {
  const response = await browser.runtime.sendMessage({ type: "closedTabs:list" });
  listNode.innerHTML = renderClosedTabsList(response.records);
}

async function handleClick(event) {
  const row = event.target.closest("[data-record-id]");
  if (!row) return;

  try {
    await browser.runtime.sendMessage({
      type: "closedTabs:reopen",
      recordId: row.dataset.recordId,
    });
    statusNode.hidden = true;
    await loadClosedTabs();
  } catch (error) {
    statusNode.hidden = false;
    statusNode.textContent = error.message;
  }
}

document.addEventListener("DOMContentLoaded", loadClosedTabs);
listNode.addEventListener("click", handleClick);
```

Create `extension/src/popup/popup.css` with the compact `A` layout from the approved mockup. Keep it intentionally small and Safari-like.

- [ ] **Step 4: Run the popup tests, then the full suite**

Run: `node --test tests/shared/relativeTime.test.js tests/popup/renderClosedTabsList.test.js`  
Expected: PASS

Run: `npm test`  
Expected: PASS with store, controller, relative-time, and popup-render tests

- [ ] **Step 5: Commit the popup UI**

```bash
git add extension/src/shared/relativeTime.js extension/src/popup/popup.html extension/src/popup/popup.css extension/src/popup/popup.js extension/src/popup/renderClosedTabsList.js tests/shared/relativeTime.test.js tests/popup/renderClosedTabsList.test.js
git commit -m "feat: add closed tabs popup"
```

## Task 4: Wire the extension manifest, browser listeners, and manual verification docs

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/src/background/background.html`
- Create: `extension/src/background/background.js`
- Create: `extension/src/background/registerBackground.js`
- Create: `README.md`
- Create: `docs/manual-testing/safari-closed-tabs-checklist.md`
- Test: `tests/background/registerBackground.test.js`
- Modify: `extension/src/popup/popup.js`

- [ ] **Step 1: Write a failing listener-registration test**

Create `tests/background/registerBackground.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { registerBackground } from "../../extension/src/background/registerBackground.js";

function createEventRecorder() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
}

test("registerBackground attaches tab and runtime listeners", () => {
  const onCreated = createEventRecorder();
  const onUpdated = createEventRecorder();
  const onRemoved = createEventRecorder();
  const onMessage = createEventRecorder();

  registerBackground({
    browserApi: {
      tabs: { onCreated, onUpdated, onRemoved, query: async () => [] },
      runtime: { onMessage },
    },
    controller: { seedSnapshots: async () => {} },
  });

  assert.equal(onCreated.listeners.length, 1);
  assert.equal(onUpdated.listeners.length, 1);
  assert.equal(onRemoved.listeners.length, 1);
  assert.equal(onMessage.listeners.length, 1);
});
```

- [ ] **Step 2: Run the listener-registration test and confirm it fails**

Run: `node --test tests/background/registerBackground.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Implement the manifest and background wiring**

Create `extension/src/background/registerBackground.js`:

```js
export function registerBackground({ browserApi, controller }) {
  controller.seedSnapshots();

  browserApi.tabs.onCreated.addListener((tab) => {
    controller.upsertTabSnapshot(tab);
  });

  browserApi.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    controller.upsertTabSnapshot({ ...tab, id: tabId });
  });

  browserApi.tabs.onRemoved.addListener(async (tabId) => {
    await controller.recordClosedTab(tabId);
  });

  browserApi.runtime.onMessage.addListener((message) => {
    if (message.type === "closedTabs:list") {
      return controller.listClosedTabs().then((records) => ({ records }));
    }

    if (message.type === "closedTabs:reopen") {
      return controller.reopenClosedTab(message.recordId).then(() => ({ ok: true }));
    }

    return undefined;
  });
}
```

Create `extension/src/background/background.js`:

```js
import { createClosedTabsController } from "./closedTabsController.js";
import { registerBackground } from "./registerBackground.js";

const controller = createClosedTabsController({ browserApi: browser });
registerBackground({ browserApi: browser, controller });
```

Create `extension/src/background/background.html`:

```html
<!doctype html>
<html lang="en">
  <body>
    <script type="module" src="./background.js"></script>
  </body>
</html>
```

Create `extension/manifest.json`:

```json
{
  "manifest_version": 2,
  "name": "Closed Tabs",
  "version": "0.1.0",
  "description": "Reopen tabs from an extension-managed recently closed list.",
  "permissions": ["tabs", "storage"],
  "browser_action": {
    "default_title": "Closed Tabs",
    "default_popup": "src/popup/popup.html"
  },
  "background": {
    "page": "src/background/background.html",
    "persistent": false
  }
}
```

Create `README.md` that explains:

- how to run `npm test`
- where the extension files live
- that full packaging still requires Xcode
- that Safari testing should follow Apple's "Temporarily install a web extension folder in macOS Safari" guidance for the `extension/` folder

Create `docs/manual-testing/safari-closed-tabs-checklist.md`:

```md
# Safari Closed Tabs Manual Checklist

- Load the `extension/` folder in Safari development mode.
- Close an `https://` tab and confirm it appears at the top of the popup.
- Quit and reopen Safari and confirm the item still exists.
- Click the row and confirm the URL reopens in an active tab.
- Confirm the reopened record disappears from the popup.
- Confirm `safari://` pages and private browsing tabs are not recorded.
- Confirm rows without favicons show a fallback glyph.
```

- [ ] **Step 4: Run the registration test, then the full suite**

Run: `node --test tests/background/registerBackground.test.js`  
Expected: PASS

Run: `npm test`  
Expected: PASS with all automated tests

- [ ] **Step 5: Perform the manual Safari verification pass**

Follow: `docs/manual-testing/safari-closed-tabs-checklist.md`  
Expected: All checklist items pass, or any Safari-specific failures are documented before changing scope

- [ ] **Step 6: Commit the extension wiring**

```bash
git add extension/manifest.json extension/src/background/background.html extension/src/background/background.js extension/src/background/registerBackground.js extension/src/popup/popup.js README.md docs/manual-testing/safari-closed-tabs-checklist.md tests/background/registerBackground.test.js
git commit -m "feat: wire safari closed tabs extension"
```

## Final Verification Gate

- [ ] Run: `npm test`
- [ ] Review the spec at `docs/superpowers/specs/2026-04-07-safari-closed-tabs-design.md`
- [ ] Review the manual checklist results in `docs/manual-testing/safari-closed-tabs-checklist.md`
- [ ] Only after both automated and manual verification are green, prepare the branch for implementation review
