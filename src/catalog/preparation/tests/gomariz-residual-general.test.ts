import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGomarizResidualGeneral } from "../mapping/providers/gomariz/residual-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set(["CC1535", "CC1666", "FR1077", "BA1522", "PV556", "BA1465", "TE1814", "TE1772", "BA1358"]);
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Gomariz personaliza generales genéricas con medidas de su propia ficha", () => {
  const improved = new Set<string>();
  for (const record of catalog.products) {
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    if (references.has(record.reference ?? "")) {
      const general = prepared.product.description_general;
      const replacement = resolveGomarizResidualGeneral(record);
      assert.ok(record.reference && general && replacement);
      assert.equal(general, replacement, record.reference);
      assert.ok(general.includes(record.title ?? ""), record.reference);
      assert.ok(general.includes("longitud") && general.includes("anchura") && general.includes("peso"), record.reference);
      assert.equal(prepared.status, record.reference === "BA1465" ? "review" : "ready", record.reference);
      improved.add(record.reference);
    }
    assert.equal(JSON.stringify(record), original);
  }
  assert.deepEqual(improved, references);
});

test("Gomariz preserva fuentes no coherentes o fuera de identidad", () => {
  for (const reference of ["TE1858", "TE1621", "TE1622", "RO1197", "RE454", "CC1665"]) {
    const record = find(reference);
    assert.equal(resolveGomarizResidualGeneral(record), null, reference);
  }
  const record = find("CC1535");
  const rejected: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "CC1666", url: `${record.url}?variant=2` },
    { ...record, model: "FORSTE 18T SPEED" },
    { ...record, brand: "Otra Marca" },
    { ...record, specs: { ...record.specs, "Altura plataforma": "25 m" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "0 m" } },
    { ...record, specs: { ...record.specs, Motor: "Híbrido" } },
    { ...record, longDescription: "Descripción específica." }
  ];
  for (const [index, invalid] of rejected.entries()) {
    assert.equal(resolveGomarizResidualGeneral(invalid), null, String(index));
  }
});
