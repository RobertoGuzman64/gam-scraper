import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedGomarizPriorityGeneral } from "../evidence/providers/gomariz/verified-priority-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "OR1537", "FR1077", "DU473", "GR1113", "BA1358", "BA1522",
  "RO1197", "TO1241", "CC1665", "CAE1207", "CA1041", "CA1436",
  "CAE1054", "CAE1525", "MT1314", "TE1746", "TE1772", "TE1814",
  "MT1659", "MT1661", "BA1575", "5051BDX", "TE1621", "TE1622", "TE1858", "RE454"
]);

test("Gomariz: las 26 descripciones individualizadas se aplican sin alterar fichas técnicas ni originales", () => {
  const changed = new Set<string>();
  for (const record of catalog.products) {
    const snapshot = JSON.stringify(record);
    const general = verifiedGomarizPriorityGeneral(record);
    if (references.has(record.reference ?? "")) {
      assert.ok(general, record.reference ?? "");
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, general, record.reference ?? "");
      assert.ok(general.split(/\s+/u).length >= 65, record.reference ?? "");
      assert.notEqual(general, record.longDescription, record.reference ?? "");
      assert.deepEqual(prepared.spec, record.specs, record.reference ?? "");
      assert.equal(prepared.sourceUrl, record.url);
      assert.ok(record.reference ?? "");
      changed.add(record.reference ?? "");
    } else {
      assert.equal(general, null, record.reference ?? "");
    }
    assert.equal(JSON.stringify(record), snapshot, record.reference ?? "");
  }
  assert.deepEqual(changed, references);
});

test("Gomariz: evidencia editorial vinculada a la ficha original, sin extenderse a variantes alteradas", () => {
  for (const record of catalog.products.filter((item) => references.has(item.reference ?? ""))) {
    const original = verifiedGomarizPriorityGeneral(record);
    assert.ok(original, record.reference ?? "");
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, condition: "Nuevo" },
      { ...record, reference: "NO-EXISTE" },
      { ...record, url: `${record.url}?revision=1` },
      { ...record, title: `${record.title} VARIANTE` },
      { ...record, brand: "Marca distinta" },
      { ...record, model: "Modelo distinto" },
      { ...record, year: "1999" },
      { ...record, longDescription: `${record.longDescription} Edición posterior.` },
      { ...record, specs: { ...record.specs, "Dato adicional": "nuevo" } }
    ];
    for (const variant of variants) {
      assert.equal(verifiedGomarizPriorityGeneral(variant), null, record.reference ?? "");
    }
  }
});
