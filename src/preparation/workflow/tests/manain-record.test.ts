import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discardedManainProductUrls } from "../../manain/discarded-urls.js";
import { toCsv } from "../../../shared/csv.js";
import { baseProductHeaders } from "../../../scraping/output/csv-serializer.js";
import { buildManainRecord, prepareManainRecord } from "../manain-record.js";

const productUrl = "https://manain.com/producto/venta-elevacion-tijera-prueba/";
const rows: readonly Record<string, string>[] = [{
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: productUrl, reference: "REF-1", title: "Plataforma de tijera", condition: "Segunda mano",
  specJson: JSON.stringify({ Marca: "Ejemplo", Peso: "2100 kg" }),
  imagesJson: "[]", breadcrumbsJson: "[]"
}];
const csv = toCsv(rows, baseProductHeaders);
const census = {
  type: "manain-diagnostic-census", providerId: "manain", complete: true, published: false,
  endReason: "control-exhausted", urlCount: 4, urls: [productUrl, ...discardedManainProductUrls]
};
const summary = {
  quality: { status: "partial", published: false },
  totals: { scrapedProducts: 1, discoveredProductUrls: 4, failures: 3 },
  artifacts: { csvSha256: createHash("sha256").update(csv).digest("hex") }
};
const errors = {
  quality: "partial",
  failures: discardedManainProductUrls.map((url) => ({ categoryKey: "venta", url, error: "Ficha inaccesible" }))
};

test("Manain: el registro offline conserva el origen y la revisión sin acreditar un canónico", () => {
  const result = buildManainRecord(csv, summary, errors, census);
  assert.equal(result.quality.status, "partial");
  assert.equal(result.quality.published, false);
  assert.equal(result.products.length, 1);
  assert.equal(result.discardedUrls.length, 3);
  assert.equal(result.products[0]?.original.reference, "REF-1");
  assert.equal(result.products[0]?.original.specs?.Peso, "2100 kg");
  assert.equal(result.products[0]?.prepared.product.reference, "REF-1");
});

test("Manain: el registro rechaza CSV alterado y descartes no autorizados", () => {
  assert.throws(() => buildManainRecord(csv.replace("REF-1", "REF-2"), summary, errors, census), /CSV alterado/);
  const otherErrors = {
    ...errors,
    failures: [
      { categoryKey: "venta", url: "https://manain.com/producto/otro/", error: "Otro error" },
      ...errors.failures.slice(1)
    ]
  };
  assert.throws(() => buildManainRecord(csv, summary, otherErrors, census), /no conciliadas/);
});

test("Manain: dry-run, escritura exclusiva e idempotencia conservan el registro parcial", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-manain-record-"));
  try {
    const source = join(root, "manain-partial-all.csv");
    const censusFile = join(root, "census.json");
    const out = join(root, "records", "manain-record.json");
    await Promise.all([
      writeFile(source, csv),
      writeFile(join(root, "manain-summary.json"), JSON.stringify(summary)),
      writeFile(join(root, "manain-errors.json"), JSON.stringify(errors)),
      writeFile(censusFile, JSON.stringify(census))
    ]);
    const options = { source, census: censusFile, out, dryRun: true };
    const preview = await prepareManainRecord(options);
    await assert.rejects(readFile(out, "utf8"), { code: "ENOENT" });
    const persisted = await prepareManainRecord({ ...options, dryRun: false });
    assert.deepEqual(persisted, preview);
    const expected = JSON.stringify(preview, null, 2) + "\n";
    assert.equal(await readFile(out, "utf8"), expected);
    await prepareManainRecord({ ...options, dryRun: false });
    assert.equal(await readFile(out, "utf8"), expected);
    await writeFile(out, "{}");
    await assert.rejects(prepareManainRecord({ ...options, dryRun: false }), { code: "EEXIST" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
