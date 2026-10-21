import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { prepareImportBatch } from "../prepare.js";
import { loadImportCatalog } from "../catalog-loader.js";
import { parseCsv } from "../../../shared/csv-parse.js";
import type { ProductRecord, SpecScalar, SpecsMap } from "../../../contracts/catalog.js";
import { getProvider } from "../../../scraping/registry.js";

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

const auditedRoot = process.env.SCRAPER_AUDIT_DATA;
const audited = auditedRoot && auditedRoot.trim() ? auditedRoot.trim() : null;

for (const company of ["gam", "gomariz", "mercaeleva"]) {
  test(`preparación offline real de ${company} (si están disponibles los CSV de auditoría)`, { skip: audited === null }, async () => {
    if (!audited) return;
    const outputPrefix = getProvider(company).defaultOptions.outPrefix;
    const current = join(audited, company, `${outputPrefix}-all.csv`);
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
    const catalog = await loadImportCatalog();
    const output = prepareImportBatch(records, catalog);
    const ids = new Map<number, number>();
    for (const category of catalog.categories) ids.set(category.id, (ids.get(category.id) ?? 0) + 1);
    assert.equal(output.products.length, records.length);
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
      assert.notEqual(result.product.categorySellID, null);
      if (result.product.categorySellID === null) continue;
      assert.equal(ids.get(result.product.categorySellID), 1);
      assert.ok(result.product.price !== null && result.product.price > 0);
      const active = new Set(catalog.relations.filter((item) => item.categoryID === result.product.categorySellID).map((item) => item.attributeID));
      for (const attribute of result.product.attributes) assert.ok(active.has(attribute.attributeID));
      for (const definition of catalog.attributes.filter((item) => item.required && active.has(item.id))) {
        assert.ok(result.product.attributes.some((item) => item.attributeID === definition.id));
      }
    }
  });
}
