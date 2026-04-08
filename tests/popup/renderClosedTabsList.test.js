import assert from "node:assert";
import { describe, test } from "node:test";

import { renderClosedTabsList } from "../../extension/src/popup/renderClosedTabsList.js";

describe("renderClosedTabsList", () => {
  test("shows empty state: /No recently closed tabs yet/", () => {
    const markup = renderClosedTabsList([]);

    assert.match(markup, /No recently closed tabs yet/);
  });

  test("renders compact row layout: matches data-record-id=\"row-1\", title, hostname, and 1 min ago", () => {
    const now = Date.UTC(2026, 3, 8, 10, 0, 0);
    const markup = renderClosedTabsList(
      [{
        id: "row-1",
        title: "Example Article",
        url: "https://example.com/blog/post",
        favIconUrl: "",
        closedAt: now - (1 * 60 * 1000),
      }],
      { now }
    );

    assert.match(markup, /data-record-id="row-1"/);
    assert.match(markup, /Example Article/);
    assert.match(markup, /example\.com/);
    assert.match(markup, /1 min ago/);
  });
});
