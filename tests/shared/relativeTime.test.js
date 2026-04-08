import assert from "node:assert";
import { describe, test } from "node:test";

import { formatRelativeTime } from "../../extension/src/shared/relativeTime.js";

describe("relative time", () => {
  test("formatRelativeTime formats recent minutes: 1 min ago, 9 min ago", () => {
    const now = Date.UTC(2026, 3, 8, 10, 0, 0);

    assert.strictEqual(formatRelativeTime(now, now - (1 * 60 * 1000)), "1 min ago");
    assert.strictEqual(formatRelativeTime(now, now - (9 * 60 * 1000)), "9 min ago");
  });

  test("formatRelativeTime formats hours after 60 minutes: 2 hr ago", () => {
    const now = Date.UTC(2026, 3, 8, 10, 0, 0);

    assert.strictEqual(formatRelativeTime(now, now - (2 * 60 * 60 * 1000)), "2 hr ago");
  });
});
