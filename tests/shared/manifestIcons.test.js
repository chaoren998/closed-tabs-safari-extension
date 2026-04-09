import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const manifestPath = path.join(workspaceRoot, "extension/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

describe("manifest icons", () => {
  test("declares toolbar icon sizes for Safari small-icon rendering", () => {
    assert.deepStrictEqual(manifest.browser_action.default_icon, {
      "16": "src/icons/toolbar-16.png",
      "19": "src/icons/toolbar-19.png",
      "32": "src/icons/toolbar-32.png",
      "38": "src/icons/toolbar-38.png",
    });
  });

  test("references icon files that exist on disk", () => {
    const iconPaths = [
      ...Object.values(manifest.icons ?? {}),
      ...Object.values(manifest.browser_action.default_icon ?? {}),
    ];

    for (const iconPath of iconPaths) {
      assert.ok(
        fs.existsSync(path.join(workspaceRoot, "extension", iconPath)),
        `missing icon file: ${iconPath}`
      );
    }
  });

  test("keeps runtime icon assets inside the extension src bundle copied by Xcode", () => {
    const iconPaths = [
      ...Object.values(manifest.icons ?? {}),
      ...Object.values(manifest.browser_action.default_icon ?? {}),
    ];

    for (const iconPath of iconPaths) {
      assert.match(iconPath, /^src\/icons\//);
    }
  });
});
