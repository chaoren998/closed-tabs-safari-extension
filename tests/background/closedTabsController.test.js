import assert from "node:assert";
import { describe, test } from "node:test";

import { createClosedTabsController } from "../../extension/src/background/closedTabsController.js";

const STORAGE_KEY = "closedTabs";
const NO_OVERRIDE = Symbol("no_override");

const createBrowserFixture = ({ records = [], tabs = [], storedValue = NO_OVERRIDE } = {}) => {
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
            if (storedValue !== NO_OVERRIDE) {
              return { [STORAGE_KEY]: storedValue };
            }
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
  test("listClosedTabs returns [] for non-array storage values", async () => {
    const cases = [
      undefined,
      null,
      "not-an-array",
      123,
      true,
      { id: "oops" },
    ];

    for (const storedValue of cases) {
      const fixture = createBrowserFixture({ storedValue });
      const controller = createClosedTabsController({ browserApi: fixture.browserApi });
      // eslint-disable-next-line no-await-in-loop
      const result = await controller.listClosedTabs();
      assert.deepStrictEqual(result, []);
    }
  });

  test("listClosedTabs filters malformed records and preserves optional fields", async () => {
    const fixture = createBrowserFixture({
      storedValue: [
        null,
        "nope",
        {},
        { id: 123, url: "https://bad-id.example", closedAt: 1 },
        { id: "bad-url", url: "about:blank", closedAt: 1 },
        { id: "bad-closedAt", url: "https://bad-closedAt.example", closedAt: NaN },
        {
          id: "ok-1",
          url: "https://ok.example/one",
          closedAt: 10,
          title: "Title 1",
          favIconUrl: "icon1.ico",
          sourceTabId: 7,
          sourceWindowId: 3,
        },
        {
          id: "ok-2",
          url: "https://ok.example/two",
          closedAt: 20,
          title: 123,
          favIconUrl: null,
          sourceTabId: "not-a-number",
          sourceWindowId: undefined,
        },
      ],
    });
    const controller = createClosedTabsController({ browserApi: fixture.browserApi });

    const result = await controller.listClosedTabs();

    assert.deepStrictEqual(result, [
      {
        id: "ok-1",
        url: "https://ok.example/one",
        closedAt: 10,
        title: "Title 1",
        favIconUrl: "icon1.ico",
        sourceTabId: 7,
        sourceWindowId: 3,
      },
      {
        id: "ok-2",
        url: "https://ok.example/two",
        closedAt: 20,
      },
    ]);
  });

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

  test("recordClosedTab ignores stale snapshot after tab becomes non-recordable", async () => {
    const fixture = createBrowserFixture();
    const controller = createClosedTabsController({
      browserApi: fixture.browserApi,
      now: () => 300,
      createId: () => "stale",
    });

    controller.upsertTabSnapshot({
      id: 9,
      windowId: 1,
      url: "https://example.com/live",
      title: "Live",
      favIconUrl: "",
      incognito: false,
    });
    controller.upsertTabSnapshot({
      id: 9,
      windowId: 1,
      url: "about:blank",
      title: "Now unsupported",
      favIconUrl: "",
      incognito: false,
    });

    await controller.recordClosedTab(9);

    assert.strictEqual(fixture.setCalls.length, 0);
  });

  test("recordClosedTab is a no-op when no snapshot exists", async () => {
    const fixture = createBrowserFixture();
    const controller = createClosedTabsController({
      browserApi: fixture.browserApi,
      now: () => 301,
      createId: () => "unused",
    });

    await controller.recordClosedTab(999);

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
