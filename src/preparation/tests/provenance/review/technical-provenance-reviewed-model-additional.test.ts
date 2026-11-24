import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/reviewed-model-claims.js";

const references = [
  { providerId: "gam", reference: "212", count: 1 },
  { providerId: "gam", reference: "239", count: 1 },
  { providerId: "mercaeleva", reference: "M318-0509", count: 4 },
  { providerId: "mercaeleva", reference: "M451-2844", count: 4 },
  { providerId: "mercaeleva", reference: "M649-6453", count: 3 },
  { providerId: "mercaeleva", reference: "M141-6600", count: 4 },
  { providerId: "mercaeleva", reference: "M777-6495", count: 3 },
  { providerId: "mercaeleva", reference: "M829-9712", count: 2 },
  { providerId: "mercaeleva", reference: "M380-2365", count: 4 },
  { providerId: "mercaeleva", reference: "M238-0251", count: 3 }
] as const;

const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["LGMG","S1012E-2","https://www.lgmglifts.com/upload/file/2025/04/lgmg-scissorlift-en-S1012E-2.pdf","2026-11-21"]), ["Anchura de plataforma","Capacidad de plataforma","Extensión de plataforma","Longitud de plataforma"]],
  [JSON.stringify(["JLG","2630ES","https://www.megaltura.com/wp-content/uploads/2022/08/JLG-2630-ES.pdf","2026-11-21"]), ["Altura de plataforma","Anchura (mm)","Distancia entre ejes (mm)","Extensión de plataforma"]],
  [JSON.stringify(["Skyjack","SJ9250","https://www.skyjack.com/sites/default/files/specifications/ENEU-SJ9241-50RT_0.pdf","2026-11-21"]), ["Altura de plataforma","Anchura (mm)","Anchura de plataforma"]],
  [JSON.stringify(["Haulotte","HA20PX","https://www.grarasulin.com/wp-content/uploads/2023/05/ha20px_uk_bda0a.pdf","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma","Anchura (mm)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Genie","S-65","https://www.colle.eu/media/3955/genie-s65-en.pdf","2026-11-21"]), ["Alcance horizontal máximo","Altura máxima de plataforma","Capacidad máxima de plataforma"]],
  [JSON.stringify(["JLG","860SJ","https://www.jlg.com/en/equipment/boom-lifts/telescopic/engine-powered/800-series/860sj","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma"]],
  [JSON.stringify(["LOGITRANS","ELFR/SELFR","https://logitrans.com/rotator-with-non-adjustable-box-holders/","2026-11-21"]), ["Soportes necesarios para más de 500 kg"]],
  [JSON.stringify(["LOGITRANS","LogiQ 200/300","https://logitrans.com/logiq-200-quarter-pallet-lifter/","2026-11-21"]), ["Propulsión"]],
  [JSON.stringify(["Genie","Z-30/20N","https://manualzilla.com/doc/6014943/from-sn-951-to-6289--z-30-20n--pn-43651-","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma","Anchura (mm)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["Manitou","150AETJC","https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-elevadoras-articuladas-plataformas-articuladas-de-ruedas-manitou/150-aetj-c-1036275","2026-11-21"]), ["Alcance horizontal (m)","Anchura (mm)","Capacidad máxima de plataforma"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 27: las 29 verificaciones documentales son emitidas por el motor sin alterar el producto", async () => {
  assert.equal(claims.length, 29);
  const verified = new Set<string>();
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const { reference, count } of references.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === reference);
      assert.ok(original);
      const unchanged = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(JSON.stringify(original), unchanged);
      assert.ok(prepared.technicalProvenance);
      assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
      const entries = prepared.technicalProvenance.entries.filter((entry) =>
        entry.scope === "model-document" && claims.some((claim) => entry.document?.url === claim.document.url &&
          entry.field === claim.field && entry.value === claim.value &&
          entry.verification?.claimSha256 === claim.verification.claimSha256));
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
        verified.add(JSON.stringify([providerId, reference, entry.field]));
      }
    }
  }
  assert.equal(verified.size, 29);
});

test("fase 27: una fuente, marca, variante o valor diferente no convalida la prueba", () => {
  for (const claim of claims) {
    assert.deepEqual(reviewedModelDocumentVerification(claim.document, claim.field, claim.value), claim.verification);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, url: claim.document.url + "-diferente" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, brand: "MARCA DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification({ ...claim.document, model: "MODELO DIFERENTE" },
      claim.field, claim.value), null);
    assert.equal(reviewedModelDocumentVerification(claim.document, claim.field, claim.value + " alterado"), null);
    assert.equal(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value,
      { ...claim.verification, support: "prueba manipulada" }), false);
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
