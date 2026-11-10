import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectCommercialEditorialQuality } from "../../commercial/validation/editorial-quality.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { verifiedEditorialClosure } from "../shared/editorial/evidence/verified-editorial-closure.js";
import { resolveVerifiedEditorialClosure } from "../shared/editorial/mapping/verified-editorial-closure.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = ["911", "921", "922", "2311", "2330"] as const;

const recordFor = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las cinco descripciones verificadas dejan de terminar con fragmentos truncados", () => {
  for (const reference of references) {
    const record = recordFor(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const evidence = verifiedEditorialClosure[`gam:${reference}`];
    assert.ok(evidence, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(JSON.stringify(record), before, reference);
    assert.equal(prepared.product.description_general, evidence.general, reference);
    assert.ok(prepared.product.description_general?.endsWith("."), reference);
    assert.ok(!inspectCommercialEditorialQuality(prepared.product).some((issue) =>
      issue.reason === "descripcion-general-posiblemente-truncada"), reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
  }
});

test("los cambios no ocultan discrepancias de modelo y conducción", () => {
  const expected = {
    "921": ["MS15XUX", "M15XUX"],
    "922": ["a pie", "a bordo", "verificarse"],
    "2311": ["GC40VX", "GLC40VX", "4 toneladas", "4.500 kg", "Hyster", "GLP"],
    "2330": ["Yale GP70SVX9", "Hyster", "7.000 kg"]
  } as const;
  for (const [reference, values] of Object.entries(expected)) {
    const general = prepareSourceProduct(recordFor(reference)).product.description_general;
    assert.ok(general, reference);
    for (const value of values) assert.ok(general.includes(value), `${reference}: ${value}`);
  }
});

test("un cambio de fuente o de preparación previa invalida cada cierre", () => {
  for (const reference of references) {
    const record = recordFor(reference);
    const previous = record.longDescription;
    assert.ok(previous, reference);
    assert.equal(resolveVerifiedEditorialClosure(record, null), null, reference);
    assert.equal(resolveVerifiedEditorialClosure(record, `${previous} cambiado`), null, reference);
    const variants: readonly ProductRecord[] = [
      { ...record, reference: `${reference}-distinta` },
      { ...record, url: `${record.url}?revisado=1` },
      { ...record, model: "OTRO" },
      { ...record, specs: { ...record.specs, "Dato revisado": "pendiente" } },
      { ...record, longDescription: "Fuente sustituida" }
    ];
    for (const variant of variants) {
      assert.equal(resolveVerifiedEditorialClosure(variant, previous), null, reference);
    }
  }
});
