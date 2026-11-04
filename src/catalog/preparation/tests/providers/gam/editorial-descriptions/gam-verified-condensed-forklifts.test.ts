import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { includeGamRegenerativeBrakingInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-regenerative-braking-general.js";
import { createGamCondensedEditorialResolver } from "../../../../mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import { forkliftsEvidence } from "../../../../evidence/providers/gam/editorial/condensed/forklifts.js";

const { general: resolveGamForkliftCondensedGeneral, short: resolveGamForkliftCondensedShort } = createGamCondensedEditorialResolver(forkliftsEvidence, true);

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "2368", "2327", "2329", "2331", "2321", "2322", "2326", "2325", "2324", "2316",
  "2317", "2213", "2214", "2212", "2315", "2296", "5889", "5890", "5891", "6424"
]);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("revisa veinte carretillas con medidas y fuente propias, sin modificar sus specs", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const snapshot = JSON.stringify(record);
    const general = resolveGamForkliftCondensedGeneral(record);
    const short = resolveGamForkliftCondensedShort(record);
    if (general !== null) {
      assert.ok(record.reference && record.model && short);
      changed.add(record.reference);
      assert.ok(general.toLowerCase().includes(record.model.toLowerCase()), record.reference);
      assert.ok(words(general) >= 75 && words(general) < words(record.longDescription ?? "") * 0.6, record.reference);
      assert.ok(words(short) < 30, record.reference);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, includeGamRegenerativeBrakingInGeneral(record, general, prepared.spec), record.reference);
      assert.equal(prepared.description, short, record.reference);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
      }
    } else {
      assert.equal(short, null, record.reference ?? "");
    }
    assert.equal(JSON.stringify(record), snapshot, record.reference ?? "");
  }
  assert.deepEqual(changed, references);
  for (const record of gomariz.products) {
    assert.equal(resolveGamForkliftCondensedGeneral(record), null);
    assert.equal(resolveGamForkliftCondensedShort(record), null);
  }
});

test("bloquea evidencia modificada, otra variante y modelos cruzados", () => {
  const record = find("2329");
  assert.ok(resolveGamForkliftCondensedGeneral(record));
  const cases: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "2331" },
    { ...record, model: "GP70VX" },
    { ...record, externalReference: "GP70VX" },
    { ...record, title: "Otra carretilla" },
    { ...record, url: `${record.url}?otra=1` },
    { ...record, brand: "HYSTER" },
    { ...record, categoryKey: "carretillas-usadas" },
    { ...record, shortDescription: "Descripción cambiada" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "6000 KG" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Texto añadido.` }
  ];
  for (const [index, candidate] of cases.entries()) {
    assert.equal(resolveGamForkliftCondensedGeneral(candidate), null, String(index));
    assert.equal(resolveGamForkliftCondensedShort(candidate), null, String(index));
  }
});
