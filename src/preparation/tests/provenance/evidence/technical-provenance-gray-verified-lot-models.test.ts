import assert from "node:assert/strict";
import test from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import {
  isProductTechnicalProvenance, matchesTechnicalDocumentVerification, technicalDocumentClaimSha256
} from "../../../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reviewedCatalogModelIdentity } from "../../../technical/reviewed-catalog-model-identity.js";
import { reviewedModelDocumentVerification } from "../../../technical/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const cases = [
  { reference: "6971", unitReference: "GAM-01397", brand: "UniCarriers", model: "1Q2L25Q",
    url: "https://machineryline.es/-/venta/carretillas-electricas/UniCarriers/1Q2L25Q--25090213332743096600",
    fields: [
      ["UniCarriers 1Q2L25Q · Capacidad de carga", "2.500 kg"],
      ["UniCarriers 1Q2L25Q · Altura de elevación", "4.750 mm"]
    ] },
  { reference: "6987", unitReference: "GAM-19513", brand: "YALE", model: "MP20",
    url: "https://online.gamrentals.com/en/electric-pallets/5827-2017-yale-mp20",
    fields: [
      ["Yale MP20 · Capacidad de carga", "2.000 kg"],
      ["Yale MP20 · Longitud de horquillas", "1.156 mm"]
    ] },
  { reference: "6994", unitReference: "GAM-28543", brand: "Yale", model: "MP16",
    url: "https://online.gamrentals.com/fichas-tecnicas/es/MP18.pdf",
    fields: [["Yale MP16 · Accionamiento", "Eléctrico"]] }
] as const;

const replace = (
  trace: ProductTechnicalProvenance, field: string, replacement: TechnicalSpecEvidence
): ProductTechnicalProvenance => ({
  ...trace, entries: trace.entries.map((item) => item.field === field ? replacement : item)
});

test("fase 52: cinco hechos de los lotes 11, 12 y 17 quedan acreditados con identidad y documento exacto", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  let credited = 0;
  for (const item of cases) {
    const original = catalog.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    assert.equal(original.externalReference, item.unitReference);
    assert.equal(original.brand, null);
    assert.equal(original.model, null);
    const snapshot = JSON.stringify(original);
    const document = reviewedCatalogModelIdentity(original, item.url);
    assert.deepEqual(document, { url: item.url, brand: item.brand, model: item.model });
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    assert.ok(isProductTechnicalProvenance(trace));
    assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
    assert.equal(JSON.stringify(original), snapshot);
    for (const [field, value] of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = trace.entries.find((candidate) => candidate.field === field);
      assert.ok(entry && entry.scope === "document-reference" && entry.verification);
      assert.equal(entry.value, value);
      assert.deepEqual(entry.document, document);
      assert.equal(entry.verification.kind, "reviewed-model-fact");
      assert.deepEqual(entry.verification, reviewedModelDocumentVerification(entry.document, field, value));
      assert.ok(matchesTechnicalDocumentVerification(entry.document, field, value, entry.verification));
      assert.equal(classifyPublishedTechnicalSpec(original, trace, field, value), "reused");
      credited++;
    }
  }
  assert.equal(credited, 5);
});

test("fase 52: cambios de unidad, referencia comercial, modelo, documento y afirmación impiden acreditar", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  for (const item of cases) {
    const original = catalog.products.find((candidate) => candidate.reference === item.reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const field = item.fields[0][0];
    const entry = trace.entries.find((candidate) => candidate.field === field);
    assert.ok(entry && entry.scope === "document-reference" && entry.verification);
    for (const altered of [
      { ...original, reference: `${original.reference}-otro` },
      { ...original, externalReference: "GAM-00000" },
      { ...original, title: `${original.title} cambiado` },
      { ...original, longDescription: `${original.longDescription} alterada` },
      { ...original, model: "VARIANTE DIFERENTE" },
      { ...original, url: `${original.url}?ficha=otra` }
    ]) {
      assert.equal(reviewedCatalogModelIdentity(altered, item.url), null);
      assert.equal(classifyPublishedTechnicalSpec(altered, trace, field, entry.value), "pending");
    }
    assert.equal(reviewedCatalogModelIdentity(original, `${item.url}?version=otra`), null);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, `${entry.value} cambiado`), "pending");
    const document = { ...entry.document, url: `${entry.document.url}?version=otra` };
    const rehashedDocument = { ...entry.verification,
      claimSha256: technicalDocumentClaimSha256(document, field, entry.value,
        entry.verification.reviewedOn, entry.verification.support) };
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace(trace, field, { ...entry, document, verification: rehashedDocument }), field, entry.value), "pending");
    const forgedSupport = "afirmación no revisada con hash formalmente válido";
    const forgedVerification = { ...entry.verification, support: forgedSupport,
      claimSha256: technicalDocumentClaimSha256(entry.document, field, entry.value,
        entry.verification.reviewedOn, forgedSupport) };
    assert.ok(matchesTechnicalDocumentVerification(entry.document, field, entry.value, forgedVerification));
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace(trace, field, { ...entry, verification: forgedVerification }), field, entry.value), "pending");
    const { verification: excluded, ...withoutVerification } = entry;
    assert.ok(excluded);
    assert.equal(classifyPublishedTechnicalSpec(original,
      replace(trace, field, withoutVerification), field, entry.value), "pending");
  }
});

test("fase 52: las fichas de otros miembros de lote y la anchura opcional no heredan la acreditación", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  for (const [reference, field] of [
    ["6971", "UniCarriers A1N1L18Q · Capacidad de carga"],
    ["6987", "Hyster P2.0SD · Altura de elevación"],
    ["6994", "Yale MP16 · Ancho exterior de horquillas"]
  ] as const) {
    const original = catalog.products.find((candidate) => candidate.reference === reference);
    assert.ok(original);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const entry = trace.entries.find((candidate) => candidate.field === field);
    assert.equal(entry, reference === "6994" ? undefined : entry);
    assert.equal(classifyPublishedTechnicalSpec(original, trace, field, entry?.value ?? "680 mm"), "pending");
  }
});
