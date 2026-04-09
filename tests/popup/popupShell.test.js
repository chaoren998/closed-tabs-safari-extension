import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const popupHtml = fs.readFileSync(
  path.join(workspaceRoot, "extension/src/popup/popup.html"),
  "utf8"
);
const popupCss = fs.readFileSync(
  path.join(workspaceRoot, "extension/src/popup/popup.css"),
  "utf8"
);

describe("popup shell", () => {
  test("uses compact Chinese header copy", () => {
    assert.match(popupHtml, /<h1>最近关闭<\/h1>/);
    assert.match(popupHtml, /<p>从列表中重新打开已关闭标签页<\/p>/);
  });

  test("tightens header spacing so the list gets more room", () => {
    assert.match(popupCss, /\.popup-header\s*\{[^}]*gap:\s*2px;[^}]*margin-bottom:\s*8px;/s);
    assert.match(popupCss, /\.popup-header p\s*\{[^}]*margin:\s*0;[^}]*font-size:\s*11px;/s);
    assert.match(popupCss, /\.popup-header h1\s*\{[^}]*margin:\s*0;[^}]*font-size:\s*13px;/s);
  });

  test("makes the closed tabs list a scrollable region inside the popup", () => {
    assert.match(
      popupCss,
      /\.popup-shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*height:\s*320px;/s
    );
    assert.match(
      popupCss,
      /\.popup-list\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s
    );
  });
});
