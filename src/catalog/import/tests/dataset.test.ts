import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareImportBatch } from "../preparation/prepare.js";
import type { ImportCatalog } from "../preparation/prepare.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { parseCsv } from "../../../shared/csv-parse.js";
import type { ProductRecord, SpecScalar, SpecsMap } from "../../../contracts/catalog.js";
import { DEFAULT_OPTIONS } from "../../../scraping/providers/gam/config.js";
import { GOMARIZ_OPTIONS } from "../../../scraping/providers/gomariz/config.js";
import { MERCAELeVA_OPTIONS } from "../../../scraping/providers/mercaeleva/config.js";

const parseImages = (raw: string): readonly string[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((item: unknown) => typeof item === "string")) throw new Error("Galería original inválida");
  return parsed;
};

const isScalar = (value: unknown): value is SpecScalar => typeof value === "string" || typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

const parseSpecs = (raw: string): SpecsMap => {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Especificaciones originales inválidas");
  const result: Record<string, SpecScalar | readonly SpecScalar[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isScalar(value)) result[key] = value;
    else if (Array.isArray(value) && value.every(isScalar)) result[key] = value;
    else throw new Error(`Especificación inválida: ${key}`);
  }
  return result;
};

const assertPrepared = (records: readonly ProductRecord[], company: string, catalog: ImportCatalog): void => {
  assert.ok(records.length > 0, `${company}: catálogo vacío`);
  assert.ok(records.every((record) => record.providerId === company), `${company}: proveedor incorrecto`);
  const output = prepareImportBatch(records, catalog);
  const ids = new Map<number, number>();
  for (const category of catalog.categories) ids.set(category.id, (ids.get(category.id) ?? 0) + 1);
  assert.equal(output.products.length, records.length);
  assert.equal(output.totals.ready + output.totals.review, records.length);
  for (const record of records) {
    if (company !== "mercaeleva") continue;
    for (const label of Object.keys(record.specs ?? {})) {
      assert.doesNotMatch(label, /(?:¡haz una oferta!|dpt gestión flota|avinguda de tarragona|^.+@.+\..+$)/i,
        `${record.reference ?? record.url}: ${label}`);
    }
  }
  for (const result of output.products) {
    if (result.status !== "ready") continue;
    assert.equal(result.issues.length, 0);
    assert.ok(result.importIssues);
    if (result.product.categorySellID === null) {
      assert.ok(result.importIssues.excel.some((issue) => issue.startsWith("Categoría no ")));
      assert.deepEqual(result.product.attributes, []);
      continue;
    }
    assert.equal(ids.get(result.product.categorySellID), 1);
    assert.ok(result.product.price === null || result.product.price > 0);
    const active = new Set(catalog.relations.filter((item) => item.categoryID === result.product.categorySellID).map((item) => item.attributeID));
    for (const attribute of result.product.attributes) assert.ok(active.has(attribute.attributeID));
    if (result.importIssues.createMany.length === 0) {
      for (const definition of catalog.attributes.filter((item) => item.required && active.has(item.id))) {
        assert.ok(result.product.attributes.some((item) => item.attributeID === definition.id),
          `${company}: atributo obligatorio ${definition.name} ausente en ${result.product.reference}`);
      }
    }
  }
};

const auditedRoot = process.env.SCRAPER_AUDIT_DATA;
const audited = auditedRoot && auditedRoot.trim() ? auditedRoot.trim() : null;
const catalog = await loadImportCatalog();

for (const [company, options] of [
  ["gam", DEFAULT_OPTIONS],
  ["gomariz", GOMARIZ_OPTIONS],
  ["mercaeleva", MERCAELeVA_OPTIONS]
] as const) {
  const prefix = options.outPrefix;
  test(`preparación offline real de ${company} desde catálogo canónico acreditado`, async () => {
    const file = fileURLToPath(new URL(`../../../../storage/scraped/${company}/${prefix}-catalog.json`, import.meta.url));
    const source = await readCanonicalCatalog(file);
    assert.equal(source.providerId, company);
    assert.equal(source.productCount, source.products.length);
    assertPrepared(source.products, company, catalog);
  });

  if (audited !== null) {
    test(`preparación offline real de ${company} desde CSV de auditoría`, async () => {
      const current = join(audited, company, `${prefix}-all.csv`);
      const previous = join(audited, company, `${company}-completo-all.csv`);
      const csv = await readFile(existsSync(current) ? current : previous, "utf8");
      const records: ProductRecord[] = parseCsv(csv).rows.map((row) => ({
        providerId: row.providerId ?? company, categoryKey: row.categoryKey ?? "", categoryName: row.categoryName ?? "",
        url: row.url ?? "", title: row.title || null, shortDescription: row.shortDescription || null,
        longDescription: row.longDescription || null, price: row.price || null, reference: row.reference || null,
        brand: row.brand || null, model: row.model || null, year: row.year || null, location: row.location || null,
        country: row.country || null, horometer: row.horometer || null, serialNumber: row.serialNumber || null,
        image: row.image || null, images: parseImages(row.imagesJson ?? "[]"),
        condition: row.condition === "Nuevo" || row.condition === "Segunda mano" ? row.condition : null,
        specs: parseSpecs(row.specJson ?? "{}")
      }));
      assertPrepared(records, company, catalog);
    });
  }
}
