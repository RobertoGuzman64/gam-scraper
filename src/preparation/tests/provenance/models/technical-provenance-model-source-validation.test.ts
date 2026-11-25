import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/evidence/reviewed-model-claims.js";

const expected = [
  { providerId: "mercaeleva", reference: "M549-6792", count: 4 },
  { providerId: "mercaeleva", reference: "M731-0501", count: 4 },
  { providerId: "mercaeleva", reference: "M209-3306", count: 3 },
  { providerId: "mercaeleva", reference: "M971-8124", count: 2 },
  { providerId: "gam", reference: "4661", count: 1 }
] as const;
const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["JLG","3394RT","https://www.gregorypoolelift.com/new-equipment/aerial-lifts/3394rt/","2026-11-21"]), ["Altura de plataforma","Anchura (mm)","Anchura de plataforma","Longitud de plataforma"]],
  [JSON.stringify(["Manitou","160ATJ","https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/160-atj-11680545","2026-11-21"]), ["Anchura (mm)","Anchura de plataforma","Capacidad máxima de plataforma","Longitud de plataforma"]],
  [JSON.stringify(["JLG","660SJ","https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-telescopicas/plataformas-telescopicas-de-ruedas-jlg/660sj-1157114","2026-11-21"]), ["Alcance horizontal (m)","Anchura (mm)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Genie","S-125","https://www.gtaccess.co.uk/machine/genie-s125","2026-11-21"]), ["Alcance horizontal (m)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["CTE","ZED 21.3 JHV","https://www.afi-rentals.co.uk/news/wilson-access-continues-fleet-investment-with-four-new-cte-zed-213-jhv-truck-mounts","2026-11-21"]), ["Alcance horizontal (m)"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 32: las 14 acreditaciones del motor conservan fuente, mecanismo y valores comerciales", async () => {
  assert.equal(claims.length, 14);
  let total = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of expected.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const serialized = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), serialized);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const verified = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) =>
          claim.document.url === entry.document.url && claim.field === entry.field &&
          claim.value === entry.value && claim.verification.claimSha256 === entry.verification?.claimSha256));
      assert.equal(verified.length, count, reference);
      for (const entry of verified) {
        assert.equal(entry.scope, "model-document");
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.ok(Object.values(prepared.product.spec).includes(entry.value));
        assert.ok(entry.mechanism.startsWith("src/preparation/"));
        assert.ok(entry.verification);
        assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
        total++;
      }
    }
  }
  assert.equal(total, 14);
});

test("fase 32: variantes, valores y referencias externas diferentes no acreditan", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-otra" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "OTRA MARCA" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "OTRA VARIANTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, "OTRO VALOR"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "texto cambiado" }), false);
  }
});


test("la preparación y el motor clasifican las afirmaciones sin dependencia del panel", async () => {
  const root = process.cwd();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(root, providerId);
    for (const item of expected.filter((candidate) => candidate.providerId === providerId)) {
      const original = catalog.products.find((candidate) => candidate.reference === item.reference);
      assert.ok(original);
      const trace = prepareSourceProduct(original).technicalProvenance;
      assert.ok(trace);
      const additions = trace.entries.filter((entry) => entry.scope === "model-document" &&
        entry.verification && reviewedModelDocumentClaims().some((claim) => claim.field === entry.field && claim.value === entry.value &&
          claim.document.url === entry.document?.url)).map(({ field, value }) => ({ field, value }));
      assert.ok(additions.length >= item.count);
      const classify = (record = original, emission: typeof trace | null = trace, reference = original.reference) =>
        classifyPublishedTechnicalAdditions(record, emission, providerId, reference, original.url, true, additions);
      assert.ok(classify().every((entry) => entry.kind === "reused"));
      assert.ok(classify(original, null).every((entry) => entry.kind === "reused"));
      assert.ok(classify(original, { ...trace, originalRecordSha256: "0".repeat(64) })
        .every((entry) => entry.kind === "pending"));
      assert.ok(classify(original, trace, `${original.reference}-otra`).every((entry) => entry.kind === "pending"));
    }
  }
});
