import assert from "node:assert/strict";
import test from "node:test";
import { isProductTechnicalProvenance, matchesTechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../../../provenance/technical-spec-classification.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedModelDocumentClaims, reviewedModelDocumentVerification } from
  "../../../technical/evidence/reviewed-model-claims.js";

const references = [
  { providerId: "gam", reference: "4029", count: 1 },
  { providerId: "gam", reference: "4031", count: 1 },
  { providerId: "mercaeleva", reference: "M547-2372", count: 4 },
  { providerId: "mercaeleva", reference: "M486-0114", count: 4 },
  { providerId: "mercaeleva", reference: "M958-0132", count: 3 },
  { providerId: "mercaeleva", reference: "M570-8735", count: 2 },
  { providerId: "mercaeleva", reference: "M061-0041", count: 3 },
  { providerId: "mercaeleva", reference: "M198-7237", count: 5 },
  { providerId: "mercaeleva", reference: "M479-8138", count: 4 },
  { providerId: "mercaeleva", reference: "M624-7785", count: 4 }
] as const;

const claimFields = new Map<string, readonly string[]>([
  [JSON.stringify(["Toyota","6FBRE14","https://www.toyotamaterialhandling.com.au/media/20096/6fbre12_20.341.pdf","2026-11-21"]), ["Anchura exterior del modelo","Centro de carga nominal del modelo","Propulsión","Radio de giro exterior del modelo"]],
  [JSON.stringify(["LGMG","AS1413","https://www.mercaeleva.com/pdf/fichas/2022/merca-eleva-tijera-electrica-lgmg-as1413.pdf","2026-11-21"]), ["Anchura de plataforma","Capacidad de plataforma","Extensión de plataforma","Longitud de plataforma"]],
  [JSON.stringify(["BT","SWE 160","https://toyota-material-handling.co.th/products/275","2026-11-21"]), ["Anchura (mm)","Centro de carga (mm)","Radio de giro (mm)"]],
  [JSON.stringify(["Linde","T18","https://www.linde-mh.es/es/Productos/Transpaletas/T14-T20/","2026-11-21"]), ["Capacidad nominal de carga","Elevación de horquillas"]],
  [JSON.stringify(["Tennant","BCS S16H Descarga alto","https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/s16/s16-specifications-en-emea.pdf","2026-11-21"]), ["Altura máxima de descarga de la tolva"]],
  [JSON.stringify(["Tennant","BCS S20 Batería","https://www.tennantco.com/content/dam/tennant/tennantco/products/machines/sweeper%20riders/S20/s20-specifications-battery-en-noam.pdf","2026-11-21"]), ["Longitud del cepillo principal"]],
  [JSON.stringify(["Manitou","200ATJ","https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-wheeled-articulating-boom-lifts-manitou/200-atj-1161009","2026-11-21"]), ["Alcance horizontal (m)","Anchura (mm)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["JLG","SL203-204","https://cdnc.heyzine.com/flip-book/pdf/3bf89898f6e750b3a716118e3b59d30cf09fe308-1.pdf","2026-11-21"]), ["Altura de plataforma según catálogo técnico","Anchura según catálogo técnico","Capacidad de carga de plataforma según catálogo técnico","Dimensiones de plataforma según catálogo técnico","Longitud según catálogo técnico"]],
  [JSON.stringify(["Genie","Z-30/20NRJ","https://www.mateco.es/fileadmin/user_upload/Guia-de-alquiler-2019.pdf","2026-11-21"]), ["Alcance horizontal (m)","Altura de plataforma","Anchura (mm)","Capacidad máxima de plataforma"]],
  [JSON.stringify(["JLG","1350 SJP","https://www.manualslib.com/manual/1277304/Jlg-1350sjp.html","2026-11-21"]), ["Alcance horizontal máximo sin restricción de carga","Altura de plataforma","Anchura con ejes recogidos","Capacidad de plataforma sin restricciones"]]
]);
const claims = reviewedModelDocumentClaims().filter((claim) =>
  claimFields.get(JSON.stringify([claim.document.brand, claim.document.model, claim.document.url,
    claim.verification.reviewedOn]))?.includes(claim.field));

test("fase 28: las 31 afirmaciones revisadas se emiten durante la preparación sin mutar el producto", async () => {
  assert.equal(claims.length, 31);
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
  assert.equal(seen.size, 31);
});

test("fase 28: documentos, marca, modelo y valores diferentes invalidan la acreditación", () => {
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
