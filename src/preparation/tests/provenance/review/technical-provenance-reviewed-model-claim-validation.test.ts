import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/evidence/reviewed-model-claims.js";

const references = [
  { providerId: "gam", reference: "3034", count: 3 },
  { providerId: "gam", reference: "222", count: 1 },
  { providerId: "gam", reference: "223", count: 1 },
  { providerId: "gam", reference: "4657", count: 2 },
  { providerId: "gam", reference: "4659", count: 2 },
  { providerId: "mercaeleva", reference: "M018-7013", count: 4 }
] as const;

const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["YALE","PLHP25","https://www.briggsstore.co.uk/uploads/Yale_EN_PLHP25_standard_spec-sheet.pdf","2026-11-21"]), ["Centro de carga (mm)","Elevación de las horquillas","Peso de servicio"]],
  [JSON.stringify(["LOGITRANS","Self Maxi","https://logitrans.com/fully-powered-logiflex-stacker-self-maxi/","2026-11-21"]), ["Controlador de tracción"]],
  [JSON.stringify(["LOGITRANS","Self Maxi S","https://logitrans.com/fully-powered-logiflex-stacker-with-straddle-legs-selfs-maxi/","2026-11-21"]), ["Controlador de tracción"]],
  [JSON.stringify(["CTE","TRACCESS 170E","https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-170-e/","2026-11-21"]), ["Alcance horizontal (m)","Rotación de torreta"]],
  [JSON.stringify(["CTE","TRACCESS 230","https://cpslift.com/access-platforms/cte-traccess-platforms/traccess-230/","2026-11-21"]), ["Alcance horizontal (m)","Anchura en transporte"]],
  [JSON.stringify(["JLG","1250AJP","https://jlg.ru/upload/iblock/a55/a55ac022eb564236eb1714d950c513c3.pdf","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma","Anchura con ejes recogidos","Longitud (mm)"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 30: las 13 afirmaciones revisadas se emiten durante la preparación sin mutar el producto", async () => {
  assert.equal(claims.length, 13);
  const seen = new Set<string>();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of references.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const before = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), before);
      assert.ok(prepared.technicalProvenance);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const entries = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) =>
          entry.document?.url === claim.document.url && entry.field === claim.field &&
          entry.value === claim.value && entry.verification?.claimSha256 === claim.verification.claimSha256));
      assert.equal(entries.length, count, reference);
      for (const entry of entries) {
        assert.equal(entry.scope, "model-document");
        assert.ok(entry.document);
        assert.ok(entry.verification);
        assert.equal(entry.document.brand, original.brand);
        assert.equal(entry.document.model, original.model);
        assert.ok(Object.values(prepared.product.spec).includes(entry.value));
        assert.ok(entry.mechanism.startsWith("src/preparation/"));
        assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
        seen.add(JSON.stringify([providerId, reference, entry.field, entry.value]));
      }
    }
  }
  assert.equal(seen.size, 13);
});

test("fase 30: documentos, marca, modelo y valores diferentes invalidan la acreditación", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-otra" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "MARCA DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "VARIANTE DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "texto alterado" }), false);
  }
});


test("la preparación y el motor clasifican las afirmaciones sin dependencia del panel", async () => {
  const root = process.cwd();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(root, providerId);
    for (const item of references.filter((candidate) => candidate.providerId === providerId)) {
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
