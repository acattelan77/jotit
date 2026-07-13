const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));

describe("extension package integrity", () => {
  it("declares the minimum version required by sidePanel.open", () => {
    assert.ok(Number.parseInt(manifest.minimum_chrome_version, 10) >= 116);
  });

  it("references files that exist in the package", () => {
    const referencedFiles = [
      manifest.background?.service_worker,
      manifest.side_panel?.default_path,
      ...Object.values(manifest.icons || {}),
      ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
    ].filter(Boolean);

    referencedFiles.forEach((file) => {
      assert.equal(fs.existsSync(path.join(root, file)), true, file);
    });
  });

  it("keeps sidepanel DOM lookups synchronized with sidepanel.html", () => {
    const jsIds = Array.from(
      read("sidepanel.js").matchAll(/getElementById\("([^"]+)"\)/g),
      (match) => match[1]
    );
    const htmlIds = new Set(
      Array.from(read("sidepanel.html").matchAll(/\bid="([^"]+)"/g), (match) => match[1])
    );

    const missing = jsIds.filter((id) => !htmlIds.has(id));
    assert.deepEqual(missing, []);
  });

  it("loads the sidepanel bootstrap as a module with valid local imports", () => {
    assert.match(
      read("sidepanel.html"),
      /<script\s+type="module"\s+src="sidepanel\.js"><\/script>/
    );
    const moduleFiles = [
      "sidepanel.js",
      ...fs
        .readdirSync(path.join(root, "panel"))
        .filter((file) => file.endsWith(".mjs"))
        .map((file) => `panel/${file}`),
    ];
    moduleFiles.forEach((file) => {
      const source = read(file);
      for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
        const importedPath = path.resolve(path.dirname(path.join(root, file)), match[1]);
        assert.equal(fs.existsSync(importedPath), true, `${file}: ${match[1]}`);
      }
    });
  });

  it("keeps manifest commands synchronized with the background allow-list", () => {
    const background = read("background.js");
    const setBody = /const PANEL_COMMANDS = new Set\(\[([\s\S]*?)\]\);/.exec(
      background
    )?.[1];
    assert.ok(setBody, "PANEL_COMMANDS set not found");
    const allowed = new Set(
      Array.from(setBody.matchAll(/"([^"]+)"/g), (match) => match[1])
    );
    const declared = new Set(Object.keys(manifest.commands || {}));
    declared.delete("open-jot-it");

    assert.deepEqual([...allowed].sort(), [...declared].sort());
  });
});
