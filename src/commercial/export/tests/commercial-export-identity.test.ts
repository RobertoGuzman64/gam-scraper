import assert from "node:assert/strict";
import test from "node:test";
import { type CommercialExportFile } from "../commercial-export.js";
import type { CommercialExportPlan } from "../../projection/export-projection.js";
import { validateCommercialExportFiles } from "../commercial-export-verification.js";
import { createZipArchive } from "../../../infrastructure/archive/zip.js";
import { inspectCommercialPackage } from "../commercial-package-snapshot.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial/commercial-integration-report.js";
import { verifyCommercialIntegrationArchive } from "../../../cli/reporting/commercial/commercial-package-delivery.js";
import { createFile, emptyPlan, filesForProvider, isRecord, withManifest, planWithProduct } from "./commercial-export-verification-fixture.js";

test("las categorías pendientes exigen una excepción exacta y son visibles en el informe comercial", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  const exception = { identity: "gam:ref:product-1", reference: original.reference,
    sourceUrl: original.sourceUrl, reason: "sin-categoria" };
  const pending: CommercialExportPlan = {
    ...base,
    products: [{ ...original, categorySellID: null, category: null }],
    exceptions: [exception],
    summary: { ...base.summary, categorized: 0, pendingCategory: 1 }
  };
  const files = filesForProvider(pending);
  assert.doesNotThrow(() => validateCommercialExportFiles(files));
  const snapshot = inspectCommercialPackage(files);
  assert.deepEqual(snapshot.providers[0]?.pendingCategories, [
    { reference: "product-1", sourceUrl: "https://example.com/product" }
  ]);
  const markdown = renderCommercialIntegrationReport(snapshot, "2026-11-06");
  assert.match(markdown, /Aptitud para importación: PENDIENTE/u);
  assert.match(markdown, /product-1 \| https:\/\/example\.com\/product/u);
  assert.equal(verifyCommercialIntegrationArchive(createZipArchive([{ name: "INFORME.md", data: markdown }]), files), "2026-11-06");

  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...pending, exceptions: [] })),
    /Categoría pendiente sin excepción/u);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...pending, exceptions: [exception, exception] })),
    /Excepción de categoría no justificada/u);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...base, exceptions: [exception] })),
    /Excepción de categoría no justificada/u);
  assert.match(renderCommercialIntegrationReport(inspectCommercialPackage(filesForProvider(base)), "2026-11-06"),
    /sin categorías pendientes; aceptación en backend NO VERIFICADA/u);
});

test("las referencias técnicas son únicas aunque las referencias externas coincidan", () => {
  const plan = planWithProduct();
  const first = plan.products[0];
  assert.ok(first);
  const second = { ...first, reference: "product-2", sourceUrl: "https://example.com/second",
    title: "Producto de prueba · Ref. product-2", externalReference: "MODELO-COMPARTIDO" };
  const valid: CommercialExportPlan = {
    ...plan,
    total: 2,
    products: [{ ...first, externalReference: "MODELO-COMPARTIDO" }, second],
    summary: { ...plan.summary, exported: 2, categorized: 2, attributes: 2,
      withLogo: 2, withPrice: 2 }
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, products: [valid.products[0]!, { ...second, reference: " PRODUCT-1 " }]
  })), /Referencias técnicas duplicadas/);
});

test("las máquinas excluidas no pueden reutilizar identidades de productos", () => {
  const plan = planWithProduct();
  const excluded = { identity: "gam:ref:excluido-1", reference: "excluido-1",
    sourceUrl: "https://example.com/excluido", reason: "lote" };
  const valid = { ...plan, total: 2, excluded: [excluded],
    summary: { ...plan.summary, excludedLots: 1 } };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, excluded: [{ ...excluded, reference: "product-1",
      identity: "gam:ref:product-1" }]
  })), /Identidad técnica excluida incoherente/);
});

test("las excepciones conservan identidad y referencia del producto publicado", () => {
  const plan = planWithProduct();
  const source = plan.products[0];
  assert.ok(source);
  const exception = { identity: "gam:ref:product-1", reference: "product-1",
    sourceUrl: source.sourceUrl, reason: "revision-comercial-pendiente" };
  const valid = { ...plan, exceptions: [exception] };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  for (const invalid of [
    { ...exception, identity: "gam:ref:otra-unidad" },
    { ...exception, reference: "otra-unidad" }
  ]) {
    assert.throws(() => validateCommercialExportFiles(filesForProvider({
      ...valid, exceptions: [invalid]
    })), /Excepción comercial con identidad discordante/);
  }
});

test("rechaza identidades repetidas y excepciones ajenas aunque coincidan los totales", () => {
  const base = planWithProduct();
  const first = base.products[0];
  assert.ok(first);
  const repeated: CommercialExportPlan = {
    ...base, total: 2, products: [first, first],
    summary: { ...base.summary, exported: 2, categorized: 2, attributes: 2, withLogo: 2, withPrice: 2 }
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(repeated)), /Identidades comerciales duplicadas/);

  const original = emptyPlan();
  const excluded: CommercialExportPlan = {
    ...original, total: 2,
    excluded: [
      { identity: "gam:lot-1", reference: "lot", sourceUrl: "https://example.com/lot", reason: "lote" },
      { identity: "gam:lot-2", reference: "lot", sourceUrl: "https://example.com/lot", reason: "lote" }
    ],
    summary: { ...original.summary, excludedLots: 2 }
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(excluded)), /Identidades excluidas duplicadas|Identidad técnica excluida incoherente/);

  const sameProductExcluded: CommercialExportPlan = {
    ...base, total: 2, excluded: [{ identity: "gam:excluded", reference: first.reference,
      sourceUrl: first.sourceUrl, reason: "lote" }],
    summary: { ...base.summary, excludedLots: 1 }
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(sameProductExcluded)), /Identidades excluidas duplicadas|Identidad técnica excluida incoherente/);

  const orphanException: CommercialExportPlan = {
    ...base, exceptions: [{ identity: "gam:unknown", reference: "unknown",
      sourceUrl: "https://example.com/unknown", reason: "spec-residuo-hoja-calculo:Altura" }]
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(orphanException)), /Excepción comercial sin producto válido/);
});

test("separa la procedencia del producto y bloquea cambios de identidad en el contrato versionado", () => {
  const source = planWithProduct();
  const files = filesForProvider(source);
  const productFile = files[0];
  assert.ok(productFile);
  const plan: unknown = JSON.parse(productFile.content);
  assert.ok(isRecord(plan) && Array.isArray(plan.products) && Array.isArray(plan.sources));
  const product: unknown = plan.products[0];
  const origin: unknown = plan.sources[0];
  assert.ok(isRecord(product) && isRecord(origin));
  assert.equal(plan.version, 2);
  assert.ok(!Object.hasOwn(product, "providerId") && !Object.hasOwn(product, "sourceUrl") &&
    !Object.hasOwn(product, "externalReference"));
  assert.deepEqual(origin, {
    identity: "gam:ref:product-1", reference: "product-1", sourceUrl: "https://example.com/product"
  });
  const adjusted = (update: (data: Record<string, unknown>, source: Record<string, unknown>) => void): CommercialExportFile[] => {
    const data: unknown = JSON.parse(productFile.content);
    assert.ok(isRecord(data) && Array.isArray(data.sources));
    const source: unknown = data.sources[0];
    assert.ok(isRecord(source));
    update(data, source);
    const changed = createFile(productFile.name, `${JSON.stringify(data)}\n`);
    return withManifest([changed, files[1]!], (manifest) => {
      assert.ok(Array.isArray(manifest.providers));
      const provider: unknown = manifest.providers[0];
      assert.ok(isRecord(provider));
      provider.sha256 = changed.sha256;
      provider.bytes = changed.bytes;
    });
  };
  assert.throws(() => validateCommercialExportFiles(adjusted((_, origin) => {
    origin.reference = "reference-falsa";
  })), /Procedencia comercial inválida/);
  assert.throws(() => validateCommercialExportFiles(adjusted((_, origin) => {
    origin.sourceUrl = "file:///origen";
  })), /Procedencia comercial inválida/);
  assert.throws(() => validateCommercialExportFiles(adjusted((data) => {
    data.version = 1;
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(withManifest(files, (manifest) => {
    manifest.version = 1;
  })), /Manifiesto comercial/);
});

test("rechaza exclusiones incoherentes, aunque los totales del manifiesto coincidan", () => {
  const original = emptyPlan();
  const valid: CommercialExportPlan = {
    ...original, total: 1,
    excluded: [{ identity: "gam:ref:lot", reference: "lot", sourceUrl: "https://example.com/lot", reason: "lote" }],
    summary: { ...original.summary, excludedLots: 1 }
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, summary: { ...valid.summary, excludedLots: 0, excludedAccessories: 1 }
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, excluded: [{ ...valid.excluded[0]!, reason: "sin-clasificar" }]
  })), /Totales o procedencia/);
});

test("las referencias comerciales visibles reutilizan la regla del auditor, sin confundirlas con identidad técnica", () => {
  const base = planWithProduct();
  const product = base.products[0]!;
  const changed: CommercialExportPlan = {
    ...base, total: 2,
    products: [
      { ...product, externalReference: "VISIBLE-A" },
      { ...product, title: "Producto de prueba · Ref. other-reference", reference: "other-reference", sourceUrl: "https://example.com/other", externalReference: "visible-a" }
    ],
    summary: { ...base.summary, exported: 2, categorized: 2, attributes: 2,
      withLogo: 2, withPrice: 2 }
  };
  assert.equal(inspectCommercialPackage(filesForProvider(changed)).providers[0]?.repeatedReferences, 1);
});
