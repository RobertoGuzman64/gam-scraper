import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/reviewed-model-claims.js";

const references = [
  { providerId: "gam", reference: "5949", count: 5 },
  { providerId: "gam", reference: "2364", count: 4 },
  { providerId: "gam", reference: "6807", count: 3 },
  { providerId: "mercaeleva", reference: "M622-7084", count: 3 },
  { providerId: "mercaeleva", reference: "M091-1956", count: 2 },
  { providerId: "mercaeleva", reference: "M829-9712", count: 2 }
] as const;

const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["LITTIUM","Ibiza Titanium","https://www.manualslib.com/manual/2197948/Littium-Ibiza-Titanium.html?page=20","2026-11-21"]), ["Carga máxima admitida","Peso con batería","Potencia del motor","Tensión nominal del motor","Velocidad máxima de asistencia"]],
  [JSON.stringify(["BRAVI","SKY DECK","https://www.bravi-platforms.com/wp-content/uploads/2022/08/PERI-SKYDECK_EN.pdf","2026-11-21"]), ["Dimensiones del panel admitido","Montaje del soporte","Número máximo de soportes por Leonardo HD","Peso neto del portapaneles"]],
  [JSON.stringify(["ZERO","DS 14","https://www.zeromotorcycle.eu/en/motorcycle/ds/","2026-11-21"]), ["Altura del asiento","Par motor máximo del modelo","Peso en orden de marcha del modelo"]],
  [JSON.stringify(["JLG","E600JP","https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/140840-source","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma","Capacidad máxima de plataforma"]],
  [JSON.stringify(["JLG","800AJ","https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/142288-source","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma"]],
  [JSON.stringify(["JLG","860SJ","https://www.jlg.com/en/equipment/boom-lifts/telescopic/engine-powered/800-series/860sj","2026-11-21"]), ["Anchura (mm)","Capacidad de plataforma sin restricciones"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 29: las 19 afirmaciones revisadas se emiten durante la preparación sin mutar el producto", async () => {
  assert.equal(claims.length, 19);
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
  assert.equal(seen.size, 19);
});

test("fase 29: documentos, marca, modelo y valores diferentes invalidan la acreditación", () => {
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
