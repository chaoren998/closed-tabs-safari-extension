import assert from "node:assert";
import { describe, test } from "node:test";

import {
  CLOSED_TABS_LIMIT,
  insertClosedTabRecord,
  removeClosedTabRecord,
} from "../../extension/src/shared/closedTabsStore.js";

describe("closed tab store", () => {
  test("newest record prepends", () => {
    const existing = [
      { id: "older", url: "https://example.com", closedAt: 1 },
      { id: "tie", url: "https://example.com", closedAt: 2 },
    ];
    const nextRecord = { id: "newest", url: "https://example.com", closedAt: 2 };

    const updated = insertClosedTabRecord(existing, nextRecord);

    assert.strictEqual(updated[0].id, "newest");
    assert.strictEqual(updated[1].id, "tie");
  });

  test("limit trims to closed tabs limit", () => {
    const baseRecords = Array.from({ length: CLOSED_TABS_LIMIT }, (_, idx) => ({
      id: `seed-${idx}`,
      url: "https://example.com",
      closedAt: CLOSED_TABS_LIMIT - idx,
    }));
    const nextRecord = { id: "new-record", url: "https://example.com", closedAt: CLOSED_TABS_LIMIT + 1 };

    const updated = insertClosedTabRecord(baseRecords, nextRecord);

    assert.strictEqual(updated.length, CLOSED_TABS_LIMIT);
    assert.strictEqual(updated.at(-1).id, "seed-18");
  });

  test("unsupported URLs throw recordable URL error", () => {
    assert.throws(() => {
      insertClosedTabRecord(
        [],
        { id: "invalid", url: "ftp://example.com", closedAt: 1 }
      );
    }, { name: "TypeError", message: /recordable URL/ });
  });

  test("removeClosedTabRecord removes only the chosen record", () => {
    const records = [
      { id: "keep", url: "https://example.com", closedAt: 1 },
      { id: "drop", url: "https://example.com", closedAt: 2 },
    ];

    const remaining = removeClosedTabRecord(records, "drop");

    assert.deepStrictEqual(remaining, [records[0]]);
  });
});
