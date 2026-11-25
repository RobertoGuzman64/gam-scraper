import assert from "node:assert/strict";
import test from "node:test";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { catalog, logos, entry, plan } from "./export-projection-fixture.js";

test("detecta pérdidas, recategorizaciones indebidas, metadata y empresa alteradas", () => {
  const input = entry("303");
  const commercial = plan([input], "production", 208);
  const actual = commercial.products[0];
  assert.ok(actual);
  const broken = {
    ...actual,
    spec: {}, images: [], condition: "Nuevo" as const, categorySellID: null,
    companyID: 970, metadata: { ...actual.metadata, tags: [...actual.metadata.tags, "etiqueta-inesperada"] }
  };
  const audit = accreditCommercialPlan([input], { ...commercial, products: [broken] }, catalog, logos, 208);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("campo-spec-changed"));
  assert.ok(issues.includes("campo-images-changed"));
  assert.ok(issues.includes("campo-condition-changed"));
  assert.ok(issues.includes("categoria-distinta-de-decision"));
  assert.ok(issues.includes("companyID-entorno-incoherente"));
  assert.ok(issues.includes("metadata-no-determinista"));
});

test("detecta atributos incompatibles, identidades omitidas y totales inconsistentes", () => {
  const input = [entry("304"), entry("305")];
  const commercial = plan(input);
  const first = commercial.products[0];
  assert.ok(first);
  const corrupted = { ...first, attributes: [{ attributeID: 24, value: "Falso" }] };
  const audit = accreditCommercialPlan(input, {
    ...commercial, products: [corrupted], summary: { ...commercial.summary, exported: 2 }
  }, catalog, logos, null);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("atributos-incompatibles"));
  assert.ok(issues.includes("producto-elegible-ausente-o-excluido"));
  assert.ok(issues.includes("totales-incoherentes"));
});

test("acredita conservación de datos, metadata y referencias visibles compartidas sin mezclarlas", () => {
  const input = [entry("301"), entry("302")];
  const commercial = plan(input);
  const audit = accreditCommercialPlan(input, commercial, catalog, logos, null);
  assert.equal(audit.summary.originals, 2);
  assert.equal(audit.summary.exported, 2);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.lostFields, 0);
  assert.equal(audit.summary.normalizedTitles, 2);
  assert.equal(audit.decisions.length, 2);
  assert.equal(audit.samples.length, 1);
  assert.equal(audit.samples[0]?.count, 2);
});

test("admite referencia comercial compartida e identidad basada en número de serie", () => {
  const first = entry("306");
  const withoutRef: CommercialBaselineInput = {
    ...first,
    source: { ...first.source, reference: null, serialNumber: "SERIE-306" },
    published: { ...first.published, reference: null },
    mapped: { ...first.mapped, product: { ...first.mapped.product, reference: null } }
  };
  const commercial = plan([withoutRef]);
  const audit = accreditCommercialPlan([withoutRef], commercial, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.decisions[0]?.status, "categorized");
});

test("ausencia de precio y uso del logo genérico no crean intervenciones comerciales", () => {
  const sample = entry("308");
  const input = { ...sample, published: {
    ...sample.published, title: "Equipo sin marca", spec: { Modelo: "AB123" }
  } };
  const commercial = plan([input]);
  assert.equal(commercial.products[0]?.price, null);
  assert.equal(commercial.products[0]?.logoID, 18);
  assert.deepEqual(commercial.exceptions, []);
  const audit = accreditCommercialPlan([input], commercial, catalog, logos, null);
  assert.equal(audit.summary.pending, 0);
  assert.equal(audit.summary.blocking, 0);
});

test("si existe valor resoluble y no se proyecta, el auditor sí solicita intervención", () => {
  const sample = entry("309");
  const input = { ...sample, mapped: { ...sample.mapped, product: {
    ...sample.mapped.product, attributes: []
  } } };
  const commercial = plan([input]);
  const audit = accreditCommercialPlan([input], commercial, catalog, logos, null);
  assert.deepEqual(audit.pending.map((item) => item.reason), ["atributos-resueltos-no-asignados"]);
  assert.equal(audit.summary.blocking, 0);
});

test("distingue exclusiones acreditadas de pérdidas de producto", () => {
  const lot = entry("307");
  const excluded = {
    ...lot,
    source: { ...lot.source, url: "https://example.org/lotes/307" },
    published: { ...lot.published, sourceUrl: "https://example.org/lotes/307" },
    mapped: { ...lot.mapped, product: { ...lot.mapped.product, sourceUrl: "https://example.org/lotes/307" } }
  };
  const commercial = plan([excluded]);
  assert.equal(accreditCommercialPlan([excluded], commercial, catalog, logos, null).summary.blocking, 0);
  const audit = accreditCommercialPlan([excluded], { ...commercial, excluded: [] }, catalog, logos, null);
  assert.ok(audit.blocking.some((item) => item.reason === "exclusion-no-corresponde"));
});
