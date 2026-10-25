import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeOutputs } from "../../../pipeline/publication/publish.js";
import { base, result, url } from "./preparation-fixtures.js";

test("CSV mantiene sus campos y añade imágenes; preparación publicada por separado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "catalog-preparation-"));
  try {
    await writeOutputs(dir, "lote", [result(base)], "2026-10-15T09:00:00Z", "2026-10-15T09:01:00Z");
    const csv = await readFile(join(dir, "lote-all.csv"), "utf8");
    assert.match(csv, /imagesJson/);
    assert.match(csv, /2\.jpeg/);
    const report: unknown = JSON.parse(await readFile(join(dir, "lote-preparation.json"), "utf8"));
    assert.ok(report !== null && typeof report === "object" && "totals" in report);
    if (report && typeof report === "object" && "totals" in report) {
      assert.deepEqual(report.totals, { ready: 1, review: 0 });
    }
    await assert.rejects(writeOutputs(dir, "lote", [result({ ...base, price: null }, [{ url, error: "503" }])],
      "2026-10-15T09:02:00Z", "2026-10-15T09:03:00Z"), /Extracción partial/);
    assert.equal(await readFile(join(dir, "lote-all.csv"), "utf8"), csv);
    assert.match(await readFile(join(dir, "lote-partial-preparation.json"), "utf8"), /"review": 0/);
    assert.deepEqual(JSON.parse(await readFile(join(dir, "lote-preparation.json"), "utf8")), report);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
