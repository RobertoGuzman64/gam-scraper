import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { loadCommercialPublicationInputs } from "../../export/commercial-inputs.js";
import { planCommercialExport } from "../export-projection.js";
import { assessCommercialYear } from "../../validation/year-consistency.js";
import { analyzeCommercialOutputConsistency } from "../../diagnostics/commercial-output-consistency.js";
import { unresolvedCommercialTitleCollisions } from "../unit-disambiguation.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";

const catalog = await loadImportCatalog();
const references = await loadCommercialReference();
const gam = (await loadCommercialPublicationInputs(process.cwd(), catalog))
  .find((provider) => provider.providerId === "gam");
assert.ok(gam);
const plan = planCommercialExport(gam.entries, "gam", gam.publicationSha256,
  catalog, references.brandLogos, null, null);
const correctedYears = new Map([
  ["6797", 2016], ["6869", 2008], ["6870", 2008], ["6930", 2014],
  ["6909", 2008], ["6911", 2014]
]);

test("la proyección comercial acredita seis años sin cambiar originales ni publicaciones", () => {
  for (const [reference, year] of correctedYears) {
    const input: CommercialBaselineInput | undefined = gam.entries.find((entry) => entry.source.reference === reference);
    const product = plan.products.find((item) => item.reference === reference);
    assert.ok(input && product, reference);
    const sourceSnapshot: string = JSON.stringify(input.source);
    const publicationSnapshot: string = JSON.stringify(input.published);
    assert.equal(input.mapped.product.attributes.find((item) => item.attributeID === 117)?.value, year);
    assert.equal(product.attributes.find((item) => item.attributeID === 117)?.value, year);
    assert.equal(product.description?.includes(`Año ${year}`), true, reference);
    assert.equal(product.description?.includes(`Año ${input.source.year}`), false, reference);
    if (reference === "6909" || reference === "6911") {
      assert.doesNotMatch(product.description_general ?? "", /fabricada en (?:el año )?(?:2006|2007)\b/iu);
    } else {
      assert.equal(product.description_general?.includes(String(year)), true, reference);
    }
    assert.deepEqual(assessCommercialYear(product), {
      attributeYear: year, urlYear: year, inconsistentClaims: [], urlAttributeDisagreement: false
    });
    assert.equal(JSON.stringify(input.source), sourceSnapshot);
    assert.equal(JSON.stringify(input.published), publicationSnapshot);
  }
});

test("los años acreditados llegan al título y subtítulo sin perder la referencia de unidad", () => {
  for (const [reference, year] of [["6797", 2016], ["6869", 2008], ["6870", 2008]] as const) {
    const input: CommercialBaselineInput | undefined = gam.entries.find((entry) => entry.source.reference === reference);
    const product = plan.products.find((item) => item.reference === reference);
    assert.ok(input && product, reference);
    assert.equal(product.title?.endsWith(` · Año ${year} · Ref. ${reference}`), true, reference);
    assert.equal(product.description_title, product.title, reference);
    assert.equal(product.title?.includes(` · Año ${input.source.year} · `), false, reference);
    assert.deepEqual(analyzeCommercialOutputConsistency([product]).findings.filter(
      (finding) => finding.reason === "ano-titulo-atributo-contradictorio"), [], reference);
  }
  for (const [reference, year] of [["5845", 2015], ["6226", 2016]] as const) {
    const input: CommercialBaselineInput | undefined = gam.entries.find((entry) => entry.source.reference === reference);
    const product = plan.products.find((item) => item.reference === reference);
    assert.ok(input && product, reference);
    assert.equal(input.source.year, String(year), reference);
    assert.equal(product.title?.endsWith(` · Año ${year} · Ref. ${reference}`), true, reference);
    assert.equal(product.description_title, product.title, reference);
  }
  assert.equal(unresolvedCommercialTitleCollisions(plan.products).size, 0);
  assert.deepEqual(analyzeCommercialOutputConsistency(plan.products).findings.filter(
    (finding) => finding.reason === "ano-titulo-atributo-contradictorio"), []);
});

test("las unidades reconocidas mantienen su trazabilidad y las correcciones no crean bloqueantes", () => {
  for (const reference of ["6909", "6911"]) {
    const product = plan.products.find((item) => item.reference === reference);
    assert.ok(product, reference);
    assert.equal(assessCommercialYear(product).urlAttributeDisagreement, false);
    assert.deepEqual(assessCommercialYear(product).inconsistentClaims, []);
  }
  const yearIssues = plan.exceptions.filter((item) => item.reason === "ano-url-atributo-discordante");
  assert.deepEqual(yearIssues.map((item) => item.reference).sort(),
    ["5961", "6236", "6921"]);
  assert.equal(plan.exceptions.some((item) => item.reason === "ano-descripcion-atributo-discordante"), false);
  assert.equal(plan.summary.exported, 970);
  assert.equal(plan.summary.attributes, 5160);
});
