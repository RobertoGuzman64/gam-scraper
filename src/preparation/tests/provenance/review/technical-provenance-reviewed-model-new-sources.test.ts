import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/reviewed-model-claims.js";

const references = [
  { providerId: "mercaeleva", reference: "M401-4335", count: 2 },
  { providerId: "mercaeleva", reference: "M239-8327", count: 2 },
  { providerId: "mercaeleva", reference: "M502-4867", count: 2 },
  { providerId: "mercaeleva", reference: "M200-9533", count: 3 },
  { providerId: "mercaeleva", reference: "M315-5925", count: 2 },
  { providerId: "mercaeleva", reference: "M055-1205", count: 2 },
  { providerId: "gam", reference: "2365", count: 2 }
] as const;

const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["Niftylift","HR12NDE","https://www.dragon-access.co.uk/niftylift-hr12/","2026-11-21"]), ["Alcance horizontal (m)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Hollandlift","N-165EL12","https://www.colle.eu/en/rent/working-at-heights/aerial-lifts/scissor-lifts/holland-lift-n165el12/","2026-11-21"]), ["Altura de plataforma","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Oil & Steel","SNAKE 189","https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-trailer-mounted-articulating-boom-lifts-oil-steel/snake-189-11697682","2026-11-21"]), ["Alcance horizontal (m)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["JLG","4014PS","https://www.lectura-specs.com/en/model/forklifts/telehandlers-jlg/4014-ps-1152518","2026-11-21"]), ["Alcance horizontal (m)","Anchura de transporte","Longitud de transporte"]],
  [JSON.stringify(["JLG","153-12","https://www.manualslib.mx/manual/359967/Jlg-Liftlux-153-12.html?page=64","2026-11-21"]), ["Altura de plataforma","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Oil & Steel","SCORPION 1812","https://www.tvicranes.com/es/paginas/alquiler","2026-11-21"]), ["Alcance horizontal (m)","Anchura de plataforma"]],
  [JSON.stringify(["BRAVI","SOLO GYPS","https://www.manualslib.com/manual/2589077/Bravi-Platforms-Solo-Gyps.html","2026-11-21"]), ["Capacidad del elevador de paneles","Tamaño máximo del panel"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 31: las quince afirmaciones verificadas se emiten desde el motor sin cambiar el producto", async () => {
  assert.equal(claims.length, 15);
  const seen = new Set<string>();
  for (const { providerId, reference, count } of references) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    const original = catalog.products.find((item) => item.reference === reference);
    assert.ok(original);
    const before = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(JSON.stringify(original), before);
    assert.ok(prepared.technicalProvenance);
    assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
    const actual = prepared.technicalProvenance.entries.filter((entry) =>
      entry.scope === "model-document" && claims.some((claim) =>
        entry.document?.url === claim.document.url && entry.field === claim.field &&
        entry.value === claim.value && entry.verification?.claimSha256 === claim.verification.claimSha256));
    assert.equal(actual.length, count, reference);
    for (const entry of actual) {
      assert.ok(entry.document);
      assert.ok(entry.verification);
      assert.equal(entry.document.brand, original.brand);
      assert.equal(entry.document.model, original.model);
      assert.ok(Object.values(prepared.product.spec).includes(entry.value));
      assert.ok(entry.mechanism.startsWith("src/preparation/"));
      assert.ok(matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification));
      seen.add(JSON.stringify([reference, entry.field, entry.value]));
    }
  }
  assert.equal(seen.size, 15);
});

test("fase 31: fuente, identidad, variante, campo y afirmación alterados no acreditan", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-distinta" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "Otra marca" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "Otra variante" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field + " alterado", claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "afirmación diferente" }), false);
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
