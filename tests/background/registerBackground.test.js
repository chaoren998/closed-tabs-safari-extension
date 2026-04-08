import assert from "node:assert";
import { describe, test } from "node:test";

import { registerBackground } from "../../extension/src/background/registerBackground.js";

const createEventRecorder = () => {
  const listeners = [];

  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
};

describe("registerBackground", () => {
  test("attaches browser listeners and seeds snapshots", async () => {
    const onCreated = createEventRecorder();
    const onUpdated = createEventRecorder();
    const onRemoved = createEventRecorder();
    const onMessage = createEventRecorder();
    const calls = [];
    const controller = {
      async seedSnapshots() {
        calls.push(["seedSnapshots"]);
      },
      upsertTabSnapshot(tab) {
        calls.push(["upsertTabSnapshot", tab]);
      },
      async recordClosedTab(tabId) {
        calls.push(["recordClosedTab", tabId]);
      },
      async listClosedTabs() {
        calls.push(["listClosedTabs"]);
        return [{ id: "rec-1" }];
      },
      async reopenClosedTab(recordId) {
        calls.push(["reopenClosedTab", recordId]);
      },
    };

    registerBackground({
      browserApi: {
        tabs: { onCreated, onUpdated, onRemoved },
        runtime: { onMessage },
      },
      controller,
    });

    assert.deepStrictEqual(calls, [["seedSnapshots"]]);
    assert.strictEqual(onCreated.listeners.length, 1);
    assert.strictEqual(onUpdated.listeners.length, 1);
    assert.strictEqual(onRemoved.listeners.length, 1);
    assert.strictEqual(onMessage.listeners.length, 1);

    onCreated.listeners[0]({ id: 7, url: "https://example.com/new" });
    assert.deepStrictEqual(calls.at(-1), [
      "upsertTabSnapshot",
      { id: 7, url: "https://example.com/new" },
    ]);

    onUpdated.listeners[0](11, {}, { url: "https://example.com/update", title: "Update" });
    assert.deepStrictEqual(calls.at(-1), [
      "upsertTabSnapshot",
      { id: 11, url: "https://example.com/update", title: "Update" },
    ]);

    onUpdated.listeners[0](12, {}, undefined);
    assert.deepStrictEqual(calls.at(-1), ["upsertTabSnapshot", { id: 12 }]);

    await onRemoved.listeners[0](13);
    assert.deepStrictEqual(calls.at(-1), ["recordClosedTab", 13]);

    const listResponse = await onMessage.listeners[0]({ type: "closedTabs:list" });
    assert.deepStrictEqual(listResponse, { records: [{ id: "rec-1" }] });
    assert.deepStrictEqual(calls.at(-1), ["listClosedTabs"]);

    const reopenResponse = await onMessage.listeners[0]({
      type: "closedTabs:reopen",
      recordId: "rec-1",
    });
    assert.deepStrictEqual(reopenResponse, { ok: true });
    assert.deepStrictEqual(calls.at(-1), ["reopenClosedTab", "rec-1"]);

    const ignoredResponse = onMessage.listeners[0]({ type: "unknown" });
    assert.strictEqual(ignoredResponse, undefined);
  });

  test("catches startup seedSnapshots failures to avoid unhandled rejections", async () => {
    const onCreated = createEventRecorder();
    const onUpdated = createEventRecorder();
    const onRemoved = createEventRecorder();
    const onMessage = createEventRecorder();
    const error = new Error("seed failed");
    const originalConsoleError = console.error;
    const consoleErrors = [];
    console.error = (...args) => {
      consoleErrors.push(args);
    };

    try {
      registerBackground({
        browserApi: {
          tabs: { onCreated, onUpdated, onRemoved },
          runtime: { onMessage },
        },
        controller: {
          seedSnapshots() {
            return Promise.reject(error);
          },
          upsertTabSnapshot() {},
          async recordClosedTab() {},
          async listClosedTabs() {
            return [];
          },
          async reopenClosedTab() {},
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(consoleErrors, [["Failed to seed tab snapshots", error]]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("catches recordClosedTab failures from onRemoved to avoid unhandled rejections", async () => {
    const onCreated = createEventRecorder();
    const onUpdated = createEventRecorder();
    const onRemoved = createEventRecorder();
    const onMessage = createEventRecorder();
    const error = new Error("record failed");
    const originalConsoleError = console.error;
    const consoleErrors = [];
    console.error = (...args) => {
      consoleErrors.push(args);
    };

    try {
      registerBackground({
        browserApi: {
          tabs: { onCreated, onUpdated, onRemoved },
          runtime: { onMessage },
        },
        controller: {
          async seedSnapshots() {},
          upsertTabSnapshot() {},
          recordClosedTab() {
            return Promise.reject(error);
          },
          async listClosedTabs() {
            return [];
          },
          async reopenClosedTab() {},
        },
      });

      onRemoved.listeners[0](101);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(consoleErrors, [["Failed to record closed tab", error]]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
