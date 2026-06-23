import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the group toolbar in normal flow above the table headers", async () => {
  const css = await readFile(new URL("../app/operational-polish.css", import.meta.url), "utf8");
  const toolbarRule = css.match(/\.groupToolbar\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.doesNotMatch(toolbarRule, /position:\s*sticky/);
  assert.match(css, /\.memberTable th\s*\{[^}]*z-index:\s*2/s);
});
