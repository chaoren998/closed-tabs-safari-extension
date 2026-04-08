import assert from "node:assert";
import { describe, test } from "node:test";

import { createClosedTabsController } from "../../extension/src/background/closedTabsController.js";

const STORAGE_KEY = "closedTabs";

const createBrowserFixture = ({ records = [], tabs = [] } = {}) => {
  const setCalls = [];
  const createCalls = [];
  const queryCalls = [];
  let storedRecords = [...records];

  return {
    setCalls,
    createCalls,
    queryCalls,
    browserApi: {
      storage: {
        local: {
          async get(key) {
            assert.strictEqual(key, STORAGE_KEY);
            return { [STORAGE_KEY]: [...storedRecords] };
          },
          async set(value) {
            setCalls.push(value);
            storedRecords = [...(value[STORAGE_KEY] ?? [])];
          },
        },
      },
      tabs: {
        async query(filter) {
          queryCalls.push(filter);
          return tabs;
        },
        async create(options) {
          createCalls.push(options);
          return { id: 999, ...options };
        },
      },
    },
  };
};

describe("closed tabs controller", () => {
  test("recordClosedTab stores the last seen tab snapshot", async () => {
    const fixture = createBrowserFixture();
    const controller = createClosedTabsController({
      browserApi: fixture.browserApi,
      now: () => 1234,
      createId: () => "rec-1",
    });

    controller.upsertTabSnapshot({
      id: 7,
      windowId: 3,
      url: "https://example.com/old",
      title: "Old title",
      favIconUrl: "old.ico",
      incognito: false,
    });
    controller.upsertTabSnapshot({
      id: 7,
      windowId: 5,
      url: "https://example.com/new",
      title: "New title",
      favIconUrl: "new.ico",
      incognito: false,
    });

    await controller.recordClosedTab(7);

    assert.strictEqual(fixture.setCalls.length, 1);
    assert.deepStrictEqual(fixture.setCalls[0], {
      [STORAGE_KEY]: [
        {
          id: "rec-1",
          sourceTabId: 7,
          sourceWindowId: 5,
          url: "https://example.com/new",
          title: "New title",
          favIconUrl: "new.ico",
          closedAt: 1234,
        },
      ],
    });
  });

  test("seedSnapshots stores existing recordable tabs on startup", async () => {
    const fixture = createBrowserFixture({
      tabs: [
        { id: 10, windowId: 1, url: "https://example.com/path", title: "", favIconUrl: "", incognito: false },
        { id: 11, windowId: 1, url: "about:blank", title: "skip", favIconUrl: "", incognito: false },
      ],
    });
    const controller = createClosedTabsController({
      browserApi: fixture.browserApi,
      now: () => 55,
      createId: () => "seed-1",
    });

    await controller.seedSnapshots();
    await controller.recordClosedTab(10);
    await controller.recordClosedTab(11);

    assert.deepStrictEqual(fixture.queryCalls, [{}]);
    assert.strictEqual(fixture.setCalls.length, 1);
    assert.deepStrictEqual(fixture.setCalls[0], {
      [STORAGE_KEY]: [
        {
          id: "seed-1",
          sourceTabId: 10,
          sourceWindowId: 1,
          url: "https://example.com/path",
          title: "example.com",
          favIconUrl: "",
          closedAt: 55,
        },
      ],
    });
  });

  test("recordClosedTab ignores private or unsupported snapshots", async () => {
    const fixture = createBrowserFixture();
    const controller = createClosedTabsController({
      browserApi: fixture.browserApi,
      now: () => 222,
      createId: () => "ignored",
    });

    controller.upsertTabSnapshot({
      id: 1,
      windowId: 1,
      url: "https://example.com/private",
      title: "Private",
      favIconUrl: "",
      incognito: true,
    });
    controller.upsertTabSnapshot({
      id: 2,
      windowId: 1,
      url: "ftp://example.com",
      title: "Unsupported",
      favIconUrl: "",
      incognito: false,
    });

    await controller.recordClosedTab(1);
    await controller.recordClosedTab(2);

    assert.strictEqual(fixture.setCalls.length, 0);
  });

  test("reopenClosedTab opens the stored URL and removes the record", async () => {
    const fixture = createBrowserFixture({
      records: [
        { id: "keep", url: "https://keep.example", closedAt: 2 },
        { id: "open-me", url: "https://open.example", closedAt: 1 },
      ],
    });
    const controller = createClosedTabsController({ browserApi: fixture.browserApi });

    await controller.reopenClosedTab("open-me");

    assert.deepStrictEqual(fixture.createCalls, [{ url: "https://open.example", active: true }]);
    assert.deepStrictEqual(fixture.setCalls, [
      {
        [STORAGE_KEY]: [{ id: "keep", url: "https://keep.example", closedAt: 2 }],
      },
    ]);
  });
});
