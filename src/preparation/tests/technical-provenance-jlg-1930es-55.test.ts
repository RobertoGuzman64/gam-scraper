import assert from "node:assert/strict";
import test from "node:test";
import { technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";

const documentUrl = "https://www.coalci.es/wp-content/uploads/2019/07/1930ES_ES-pdf.pdf";
const references = [
  "M373-1461", "M352-1310", "M840-8278", "M032-4313", "M931-4108", "M750-3069",
  "M775-6522", "M795-6850", "M674-6716", "M829-6181", "M726-9929", "M995-8408"
] as const;

const replace = (
  trace: ProductTechnicalProvenance, field: string, source: TechnicalSpecEvidence
): ProductTechnicalProvenance => ({
  ...trace, entries: trace.entries.map((entry) => entry.field === field ? source : entry)
});

test("fase 55: las 46 cotas y prestaciones JLG coinciden con las afirmaciones exactas del fabricante", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "mercaeleva");
  let accredited = 0;
  let rounded = 0;
  for (const reference of references) {
    const original = products.find((item) => item.reference === reference);
    assert.ok(original);
    assert.equal(original.brand, "JLG");
    assert.ok(original.model === "1930 ES" || original.model === "1930ES");
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const relevant = trace.entries.filter((entry) => entry.mechanism ===
      "src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts" &&
      entry.scope === "model-document" && entry.document.url === documentUrl);
    assert.equal(relevant.length, 4, reference);
    for (const entry of relevant) {
      assert.equal(entry.scope, "model-document");
      assert.equal(entry.document.brand, "JLG");
      assert.equal(entry.document.model, original.model);
      if (entry.field === "Altura de plataforma" && entry.value === "5,7 m") {
        rounded += 1;
        assert.equal(entry.verification, undefined);
        assert.equal(classifyPublishedTechnicalSpec(original, trace, entry.field, entry.value), "pending");
        continue;
      }
      assert.ok(entry.verification);
      assert.deepEqual(entry.verification,
        reviewedModelDocumentVerification(entry.document, entry.field, entry.value));
      assert.equal(classifyPublishedTechnicalSpec(original, trace, entry.field, entry.value), "reused");
      accredited += 1;
    }
  }
  assert.equal(accredited, 46);
  assert.equal(rounded, 2);
});

test("fase 55: documento, identidad, valor y hash rehecho no sustituyen la revisión", async () => {
  const { products } = await readPortableOriginal(process.cwd(), "mercaeleva");
  const original = products.find((item) => item.reference === "M373-1461");
  assert.ok(original);
  const trace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(trace);
  const evidence = trace.entries.find((entry) => entry.field === "Altura de plataforma");
  assert.ok(evidence && evidence.scope === "model-document" && evidence.verification);
  const { field, value, document, verification } = evidence;
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
  assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "1930 ES ALTERADO" }, trace, field, value), "pending");
  assert.equal(classifyPublishedTechnicalSpec(original, trace, field, "5,7 m"), "pending");
  for (const changed of [
    { ...document, url: `${document.url}?otra-edicion` },
    { ...document, model: "1930ES" },
    { ...document, brand: "Otra marca" }
  ]) {
    assert.equal(classifyPublishedTechnicalSpec(original, replace(trace, field, { ...evidence, document: changed }),
      field, value), "pending");
  }
  const forgedSupport = "Altura según una ficha distinta de la revisada";
  const forged = { ...verification, support: forgedSupport,
    claimSha256: technicalDocumentClaimSha256(document, field, value, verification.reviewedOn, forgedSupport) };
  assert.equal(classifyPublishedTechnicalSpec(original, replace(trace, field,
    { ...evidence, verification: forged }), field, value), "pending");
  const { verification: removed, ...withoutVerification } = evidence;
  assert.ok(removed);
  assert.equal(classifyPublishedTechnicalSpec(original, replace(trace, field,
    withoutVerification), field, value), "pending");
});

test("fase 55: acreditar JLG no altera los tres grises de Yale, Genie y Stöcklin", async () => {
  for (const [providerId, reference, field, value] of [
    ["gam", "6994", "Yale MP16 · Ancho exterior de horquillas", "680 mm"],
    ["mercaeleva", "M690-5522", "Anchura de plataforma", "1,42 m"],
    ["mercaeleva", "M879-4639", "Centro de carga (mm)", "600 mm"]
  ] as const) {
    const { products } = await readPortableOriginal(process.cwd(), providerId);
    const original = products.find((item) => item.reference === reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "pending", reference);
  }
});
