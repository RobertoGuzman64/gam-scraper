import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { reconcileGamBtsEditorialSummary } from "../evidence/providers/gam/bts-editorial.js";
import { SOURCE_CATEGORY_ISSUE, sourceCategoryQualityIssue } from "../source/category-quality.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const power = catalog.attributes.find((attribute) => attribute.name === "Potencia" && attribute.unit_option === "kVA (grupos) / kW");
assert.ok(power);
const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};
const recovered = ["2572", "2573", "2737", "2738"] as const;

test("conserva los originales y elimina solo cabeceras comerciales contradichas por evidencia independiente", () => {
  for (const reference of recovered) {
    const record = source(reference);
    const original = JSON.stringify(record);
    assert.equal(sourceCategoryQualityIssue(record), SOURCE_CATEGORY_ISSUE);
    const corrected = reconcileGamBtsEditorialSummary(record);
    assert.notStrictEqual(corrected, record, reference);
    assert.strictEqual(corrected.specs, record.specs, reference);
    assert.equal(corrected.title, record.title, reference);
    assert.equal(corrected.url, record.url, reference);
    assert.equal(corrected.condition, record.condition, reference);
    assert.ok(!/Segunda Mano/i.test(corrected.shortDescription ?? ""), reference);
    assert.equal(sourceCategoryQualityIssue(corrected), null, reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.deepEqual(prepared.product.spec, record.specs, reference);
    assert.equal(prepared.product.description, corrected.shortDescription, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
  assert.match(prepareProduct(source("2738"), catalog).product.description ?? "", /Terminal Tractor TT30K nuevo/);
});

test("reconoce kW explícitos del origen sin deducir unidades de números sin etiqueta", () => {
  for (const [reference, value] of [["2737", 36], ["2738", 48]] as const) {
    const record = source(reference);
    assert.deepEqual(resolveAttribute(record, power), { status: "resolved", value }, reference);
    const altered = { ...record, specs: { ...record.specs, "Potencia Motor (KW)": `${value} CV` } };
    assert.equal(resolveAttribute(altered, power).status, "invalid", reference);
    const unlabeled = { ...record, specs: { ...record.specs, "Potencia (kW)": "48", "Potencia Motor (KW)": "999" } };
    assert.equal(resolveAttribute(unlabeled, power).status, "contradiction", reference);
  }
  const generator = source("1212");
  assert.deepEqual(resolveAttribute(generator, power), { status: "resolved", value: 110 });
});

test("no reescribe cabeceras sin identidad, origen, condición y capacidad corroboradas", () => {
  const original = source("2738");
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, categoryKey: "otros" },
    { ...original, condition: "Segunda mano" },
    { ...original, model: "OTRO" },
    { ...original, specs: { ...original.specs, Modelo: "OTRO" } },
    { ...original, specs: { ...original.specs, "Capacidad de arrastre": "22000 Kg" } },
    { ...original, shortDescription: original.shortDescription?.replace("45300", "22600") ?? null },
    { ...original, longDescription: "Equipo eléctrico sin datos de modelo o arrastre" },
    { ...original, longDescription: original.longDescription?.replace("45.300", "40.000") ?? null },
    { ...original, title: "Carretilla eléctrica TrailerCaddy TT30K" },
    { ...original, url: original.url.replace("/bts/", "/carretillas-elevadoras-diesel-hyster/") },
    { ...original, shortDescription: "Arrastrador a pie sin modelo" }
  ];
  for (const [index, record] of variants.entries()) {
    assert.strictEqual(reconcileGamBtsEditorialSummary(record), record, `${index}`);
  }
  const badge = source("2573");
  const changedBadge = { ...badge, shortDescription: badge.shortDescription?.replace("nuevo ⭐", "usado ⭐") ?? null };
  assert.strictEqual(reconcileGamBtsEditorialSummary(changedBadge), changedBadge);
});

