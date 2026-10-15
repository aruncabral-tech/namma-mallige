import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("does not ship development preview metadata", async () => {
  const serverEntry = await readFile(path.join(root, "dist/server/index.js"), "utf8");

  assert.doesNotMatch(serverEntry, developmentPreviewMeta);
});
