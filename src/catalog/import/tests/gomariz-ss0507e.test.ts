import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareCached } from "./prepare-cached.js";

const importCatalog = await loadImportCatalog();
const sourceFile = new URL("../../../../storage/scraped/gomariz/scrape-gomariz-catalog.json", import.meta.url);
const source: unknown = JSON.parse(await readFile(sourceFile, "utf8"));
assert.ok(source && typeof source === "object" && "products" in source && Array.isArray(source.products));
const records: readonly ProductRecord[] = source.products;
const references = ["TE1858", "TE1621", "TE1622"] as const;
const platform = importCatalog.attributes.find((item) => item.name === "Altura de plataforma");
assert.ok(platform);

const changed = (record: ProductRecord): ProductRecord => ({
  ...record, specs: { ...record.specs, "Altura plataforma": "14.30 m" }
});

const prepared = references.map((reference) => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record);
  return changed(record);
});

test("tres SS0507E publicadas con 14,30 m recuperan solo 4,3 m acreditados", () => {
  for (const record of prepared) {
    assert.equal(record.specs?.["Altura plataforma"], "14.30 m");
    assert.equal(resolveAttributeValue(record, platform), 4.3, record.reference ?? "");
    const result = prepareCached(record, importCatalog);
    assert.equal(result.status, "ready", record.reference ?? "");
    assert.ok(!result.issues.includes("Atributo no normalizable: Altura de plataforma"));
    assert.equal(record.specs?.["Altura plataforma"], "14.30 m");
  }
});

test("la reconciliación no hereda identidades ni valores alterados", () => {
  for (const record of prepared) {
    const cases: readonly ProductRecord[] = [
      { ...record, reference: "OTRA" },
      { ...record, title: "LGMG SS0607E" },
      { ...record, model: "SS0607E" },
      { ...record, brand: "Otra" },
      { ...record, providerId: "gam" },
      { ...record, url: record.url.replace("gomarizrent.com", "falso.example") },
      { ...record, url: `${record.url}extra/` },
      { ...record, specs: { ...record.specs, "Altura plataforma": "18 m" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "7.5 m" } },
      { ...record, specs: { ...record.specs, "Altura almacenaje": "2.4 m" } },
      { ...record, specs: { ...record.specs, Longitud: "1.55 m" } },
      { ...record, specs: { ...record.specs, Anchura: "0.82 m" } },
      { ...record, specs: { ...record.specs, Peso: "1300 kg" } },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, specs: { ...record.specs, Capacidad: "320 kg" } }
    ];
    for (const candidate of cases) {
      assert.notEqual(resolveAttributeValue(candidate, platform), 4.3, `${record.reference}: ${candidate.reference ?? "sin ref"}`);
    }
  }
});

test("las tres recuperaciones conservan el resto de las 143 identidades", () => {
  const replacements = new Map(prepared.map((record) => [record.reference, record]));
  const preparedRecords = records.map((record) => prepareCached(replacements.get(record.reference) ?? record, importCatalog));
  assert.equal(preparedRecords.length, 143);
  assert.equal(new Set(preparedRecords.map((item) => item.product.reference)).size, 143);
  assert.equal(preparedRecords.filter((item) => item.status === "review").length, 0);
});
