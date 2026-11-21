import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reviewedUnitDescriptionEvidence } from "../shared/technical/evidence/reviewed-unit-description-claims.js";
import { reviewedModelDocumentVerification } from "../shared/technical/evidence/reviewed-model-claims.js";
import { classifyPublishedTechnicalSpec } from "../technical-spec-classification.js";

const sourceCases = [
  { reference: "6702", fields: [{ field: "Motorización", value: "GLP", excerpt: "Equipo propulsado por GLP (Gas Licuado del Petroleo)" }] },
  { reference: "6723", fields: [{ field: "Año", value: "2019", excerpt: "Fabricada en el año 2019" }] },
  { reference: "4778", fields: [
    { field: "Alcance horizontal (m)", value: "8,22 m", excerpt: "alcance horizontal de 8,22 metros" },
    { field: "Altura de trabajo (m)", value: "16,3 m", excerpt: "altura máxima de trabajo de 16,3 metros" },
    { field: "Tracción 4x4", value: "true", excerpt: "sistema de tracción en las cuatro ruedas" }
  ] },
  { reference: "4792", fields: [
    { field: "Alcance horizontal (m)", value: "24,8 m", excerpt: "alcance horizontal de 24,8 metros" },
    { field: "Potencia (kW)", value: "75 kW", excerpt: "motor Cummins F3.8 de 75 kW" }
  ] },
  { reference: "2159", fields: [{ field: "Sensor de inclinación", value: "true", excerpt: "sensor de inclinación incorporado" }] },
  { reference: "2237", fields: [{ field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }] },
  { reference: "2240", fields: [{ field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }] }
] as const;

const reconciledCases = [
  { provider: "gam", reference: "2134", field: "Capacidad de arrastre (kg)", value: "5000 KG",
    mechanism: "src/preparation/shared/technical/reconciliation/handling-family-specifications.ts",
    sourceField: "Capacidad de carga (kg)" },
  { provider: "gam", reference: "2135", field: "Capacidad de arrastre (kg)", value: "7000 KG",
    mechanism: "src/preparation/shared/technical/reconciliation/handling-family-specifications.ts",
    sourceField: "Capacidad de carga (kg)" },
  { provider: "mercaeleva", reference: "M329-6156", field: "Kilómetros (km)", value: "73 883 km",
    mechanism: "src/preparation/mercaeleva/technical/evidence/verified-platform-source-specs.ts",
    sourceField: "longDescription" },
  { provider: "mercaeleva", reference: "M502-4867", field: "Kilómetros (km)", value: "42 922 km",
    mechanism: "src/preparation/mercaeleva/technical/evidence/verified-platform-source-specs.ts",
    sourceField: "longDescription" },
  { provider: "mercaeleva", reference: "M958-0132", field: "Año", value: "2004",
    mechanism: "src/preparation/mercaeleva/technical/evidence/verified-platform-source-specs.ts",
    sourceField: "longDescription" }
] as const;

test("la preparación acredita las diez afirmaciones presentes literalmente en originales concretos", async () => {
  const catalog = await readPortableOriginal(process.cwd(), "gam");
  let accredited = 0;
  for (const { reference, fields } of sourceCases) {
    const original = catalog.products.find((item) => item.reference === reference);
    assert.ok(original);
    const originalContent = JSON.stringify(original);
    const provenance = prepareSourceProduct(original).technicalProvenance;
    assert.ok(provenance);
    assert.ok(isProductTechnicalProvenance(provenance));
    assert.equal(provenance.originalRecordSha256, originalRecordFingerprint(original));
    assert.equal(JSON.stringify(original), originalContent);
    for (const { field, value, excerpt } of fields) {
      assert.ok(original.longDescription?.includes(excerpt));
      const entry: TechnicalSpecEvidence | undefined = provenance.entries.find((item) =>
        item.field === field && item.value === value);
      assert.ok(entry);
      assert.equal(entry.scope, "unit");
      assert.equal(entry.sourceField, "longDescription");
      assert.equal(entry.sourceValue, original.longDescription);
      assert.equal(classifyPublishedTechnicalSpec(original, provenance, field, value), "own");
      assert.equal(classifyPublishedTechnicalSpec(original, provenance, field, `${value} otro`), "pending");
      const changed: ProductRecord = { ...original, longDescription: original.longDescription?.replaceAll(excerpt, "") ?? null };
      assert.equal(reviewedUnitDescriptionEvidence(changed, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence({ ...original, reference: "incorrecta" }, field, value), null);
      assert.equal(reviewedUnitDescriptionEvidence({ ...original, model: "INCORRECTO" }, field, value), null);
      assert.equal(classifyPublishedTechnicalSpec(changed, provenance, field, value), "pending");
      accredited++;
    }
  }
  assert.equal(accredited, 10);
});

test("cinco incorporaciones finales conservan su mecanismo y procedencia de unidad", async () => {
  const catalogs = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"),
    readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  const originals = { gam: catalogs[0].products, mercaeleva: catalogs[1].products };
  for (const { provider, reference, field, value, sourceField, mechanism } of reconciledCases) {
    const original = originals[provider].find((item) => item.reference === reference);
    assert.ok(original);
    const prepared = prepareSourceProduct(original);
    const provenance = prepared.technicalProvenance;
    assert.ok(provenance);
    const entry: TechnicalSpecEvidence | undefined = provenance.entries.find((item) =>
        item.field === field && item.value === value);
    assert.ok(entry, `${reference}: ${field}`);
    assert.equal(entry.mechanism, mechanism);
    assert.equal(entry.scope, "unit");
    assert.equal(entry.sourceField, sourceField);
    assert.equal(entry.sourceValue,
      sourceField === "longDescription" ? original.longDescription : original.specs?.[sourceField]);
    assert.equal(classifyPublishedTechnicalSpec(original, provenance, field, value), "own");
    assert.equal(classifyPublishedTechnicalSpec({ ...original, title: `${original.title} editado` },
      provenance, field, value), "pending");
  }
});

test("las tres especificaciones retiradas no reaparecen en preparación ni procedencia", async () => {
  const [gam, mercaeleva] = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"),
    readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  for (const { provider, reference, field } of [
    { provider: "gam", reference: "6994", field: "Yale MP16 · Ancho exterior de horquillas" },
    { provider: "mercaeleva", reference: "M690-5522", field: "Anchura de plataforma" },
    { provider: "mercaeleva", reference: "M879-4639", field: "Centro de carga (mm)" }
  ] as const) {
    const original = (provider === "gam" ? gam.products : mercaeleva.products)
      .find((item) => item.reference === reference);
    assert.ok(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec[field], undefined);
    assert.equal(prepared.technicalProvenance?.entries.some((entry) => entry.field === field), false);
  }
});

const reviewedDocumentCases = [
  { provider: "gam", reference: "3425", model: "MC25D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3426", model: "MC50D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3427", model: "MC75D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3428", model: "MX25D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3429", model: "MX50D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3430", model: "MX75D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3431", model: "ML25D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3432", model: "ML50D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "gam", reference: "3433", model: "ML75D", url: "https://www.modula.eu/wp-content/uploads/2024/07/Modula-Lift-ENG.pdf" },
  { provider: "mercaeleva", reference: "M563-8693", model: "AS1212E", url: "https://en.lgmg.com.cn/product/625.htm" },
  { provider: "mercaeleva", reference: "M887-9469", model: "A14JE", url: "https://www.lgmglifts.com/product/pro-detail-616.htm" },
  { provider: "mercaeleva", reference: "M057-0589", model: "SR1218D", url: "https://www.lgmglifts.com/product/pro-detail-1028.htm" },
  { provider: "mercaeleva", reference: "M998-5889", model: "450 AJ", url: "https://www.geeritsverhuur.be/sites/default/files/2025-09/1_FICHE_JLG_450AJ.pdf" },
  { provider: "mercaeleva", reference: "M921-0545", model: "HA15IP", url: "https://www.coalci.es/wp-content/uploads/2021/07/haulotte-ha15ip.pdf" },
  { provider: "mercaeleva", reference: "M953-7579", model: "COMPACT-10N", url: "https://documentacionqr.com/sat/objects/919543/HAULOTTE_COMPACT10N_FICHA_CARACTERISTICAS_TECNICAS_ES.pdf" },
  { provider: "mercaeleva", reference: "M873-8524", model: "170AETJL", url: "https://www.colle.eu/media/6015/170aetj-l_eng.pdf" },
  { provider: "mercaeleva", reference: "M236-6155", model: "AR16J", url: "https://www.lgmglifts.com/product/pro-detail-617.htm" },
  { provider: "mercaeleva", reference: "M572-8190", model: "180ATJ", url: "https://www.colle.eu/media/6020/180atj_eng.pdf" },
  { provider: "mercaeleva", reference: "M510-3631", model: "120AETJC", url: "https://www.colle.eu/media/6008/120aetj-c-eng.pdf" },
  { provider: "mercaeleva", reference: "M131-5855", model: "Optimum 8", url: "https://www.plataformasnoain.com/wp-content/uploads/2022/03/Haulotte-OPTIMUM-8-AC.pdf" },
  { provider: "mercaeleva", reference: "M028-0455", model: "COMPACT-14", url: "https://documentacionqr.com/sat/objects/955887/HAULOTTE_COMPACT14_FICHA_TECNICA.pdf" },
  { provider: "mercaeleva", reference: "M369-6811", model: "HA16RTJ", url: "https://www.haulotte.com.es/es_ES/productos/ha16-rtj" },
  { provider: "mercaeleva", reference: "M778-4251", model: "Compact 12", url: "https://www.eagleplatforms.com/wp-content/uploads/Haulotte-Compact-12-Electric-SPEC-SHEET.pdf" },
  { provider: "mercaeleva", reference: "M342-3553", model: "SJ6832RT", url: "https://www.skyjack.com/sites/default/files/literature-library/KC_SJ6832_RT_TEAR_SHEET_WEB.pdf" }
,
  { provider: "mercaeleva", reference: "M309-0364", model: "S0808EII", url: "https://www.lgmglifts.com/es/product/pro-detail-2066.htm" },
  { provider: "mercaeleva", reference: "M544-7437", model: "COMPACT-10", url: "https://www.rothlehner.de/produkt/c10-29108/?lang=en" },
  { provider: "mercaeleva", reference: "M579-7579", model: "COMPACT-12DX", url: "https://www.haulotte.co.uk/en_GB/product/compact-12-dx" },
  { provider: "mercaeleva", reference: "M005-4474", model: "S0808EII", url: "https://www.lgmglifts.com/product/pro-detail-2026.htm" },
  { provider: "mercaeleva", reference: "M346-8211", model: "SS0407ER", url: "https://www.lgmglifts.com/product/pro-detail-1030.htm" }
] as const;

test("los documentos cotejados acreditan únicamente campos y valores de sus modelos", async () => {
  const [gam, mercaeleva] = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"),
    readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  const originals = { gam: gam.products, mercaeleva: mercaeleva.products };
  let verified = 0;
  for (const { provider, reference, model, url } of reviewedDocumentCases) {
    const original = originals[provider].find((item) => item.reference === reference);
    assert.ok(original);
    const provenance = prepareSourceProduct(original).technicalProvenance;
    assert.ok(provenance);
    assert.equal(originalRecordFingerprint(original), provenance.originalRecordSha256);
    const entries = provenance.entries.filter((entry) => entry.scope !== "unit" && entry.scope !== "unknown" &&
      entry.document.url === url && entry.document.model === model && entry.verification !== undefined);
    assert.ok(entries.length >= (model === "180ATJ" ? 2 : 3), `${reference}: ${model}`);
    for (const entry of entries) {
      assert.ok(entry.scope !== "unit" && entry.scope !== "unknown");
      const verification = reviewedModelDocumentVerification(entry.document, entry.field, entry.value);
      assert.ok(verification);
      assert.equal(verification.claimSha256, entry.verification?.claimSha256);
      assert.equal(classifyPublishedTechnicalSpec(original, provenance, entry.field, entry.value), "reused");
      assert.equal(classifyPublishedTechnicalSpec(original, provenance, entry.field, `${entry.value} erróneo`), "pending");
      verified++;
    }
  }
  assert.ok(verified >= 80);
});
