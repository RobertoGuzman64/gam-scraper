import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareImportBatch } from "../../../batch-identity.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gam = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

test("GAM: las variantes JLG y XCMG sin identificación acreditada siguen en revisión", () => {
  const pending = [
    ["6934", "Identidad GAM contradictoria entre título y modelo técnico"],
    ["4736", "Modelo contradictorio: título y especificación identifican variantes diferentes"],
    ["4739", "Descripción comercial contradictoria: capacidad de carga"]
  ] as const;
  for (const [reference, issue] of pending) {
    const record = gam(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.includes(issue), reference);
    assert.equal(prepared.product.reference, record.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
  const jlg = prepareSourceProduct(gam("6934"));
  assert.equal(jlg.product.spec.Modelo, "E300AJ");
  assert.doesNotMatch(jlg.product.description_general ?? "", /JibPLUS/u);
  const xcmgVariant = prepareSourceProduct(gam("4736"));
  assert.equal(xcmgVariant.product.spec.Modelo, "XG0807AC-LI");
  assert.ok(xcmgVariant.issues.some((issue) => issue.startsWith("Atributo rechazado por seguridad:")));
  const xcmgLoad = prepareSourceProduct(gam("4739"));
  assert.equal(xcmgLoad.product.spec["Capacidad de carga (kg)"], "450 KG");
  assert.match(gam("4739").longDescription ?? "", /230 kg/u);
});

test("GAM: una identidad Yale cruzada no hereda un modelo o una capacidad inventada", () => {
  const record = accreditedSourceRecord("gam-editorial-cases", "2328");
  const result = prepareSourceProduct(record);
  assert.equal(result.status, "review");
  assert.ok(result.issues.includes("Identidad GAM contradictoria entre título, resumen y ficha técnica"));
  assert.ok(result.issues.includes("Cobertura editorial insuficiente: descripción corta"));
  assert.equal(result.product.description, null);
  assert.equal(result.product.spec.Modelo, "GDP80VX");
  assert.equal(result.product.spec["Capacidad de carga (kg)"], "8000 KG");
});

test("GAM: ambos Hyster se bloquean en el lote sin asignar el mismo número de serie dos veces", () => {
  const records = [gam("6682"), gam("6703")];
  const snapshots = records.map((record) => JSON.stringify(record));
  const prepared = prepareImportBatch(records);
  assert.deepEqual(prepared.totals, { ready: 0, review: 2 });
  assert.equal(records[0]?.serialNumber, records[1]?.serialNumber);
  assert.notEqual(records[0]?.externalReference, records[1]?.externalReference);
  assert.notEqual(records[0]?.horometer, records[1]?.horometer);
  for (const [index, result] of prepared.products.entries()) {
    assert.equal(result.status, "review");
    assert.ok(result.issues.some((issue) => issue.startsWith("Número de serie P177B10585U compartido")));
    assert.ok(result.issues.some((issue) => issue.startsWith("Stock GAM diferenciado:")));
    assert.equal(result.product.reference, records[index]?.reference ?? undefined);
    assert.equal(JSON.stringify(records[index]), snapshots[index]);
  }
});

test("Gomariz: un peso con unidad de longitud no se convierte en kg sin acreditar la unidad", () => {
  const record = accreditedSourceRecord("gomariz-documented-weight", "CA1459");
  const before = JSON.stringify(record);
  const result = prepareSourceProduct(record);
  assert.equal(result.status, "review");
  assert.equal(record.specs?.Peso, "3956 m");
  assert.ok(result.issues.includes("Atributo no normalizable: Peso"));
  assert.ok(result.issues.includes("Atributo no normalizable: Peso operativo"));
  assert.notEqual(result.product.spec.Peso, "3956 kg");
  assert.equal(JSON.stringify(record), before);
});


test("el conjunto pendiente mantiene siete retenciones por lote y conserva sus originales", () => {
  const cases = [
    { dataset: "gam-original", reference: "6934", issue: "Identidad GAM contradictoria entre título y modelo técnico" },
    { dataset: "gam-original", reference: "6682", issue: "Número de serie P177B10585U compartido" },
    { dataset: "gam-original", reference: "6703", issue: "Número de serie P177B10585U compartido" },
    { dataset: "gam-original", reference: "4736", issue: "Modelo contradictorio: título y especificación identifican variantes diferentes" },
    { dataset: "gam-original", reference: "4739", issue: "Descripción comercial contradictoria: capacidad de carga" },
    { dataset: "gam-editorial-cases", reference: "2328", issue: "Identidad GAM contradictoria entre título, resumen y ficha técnica" },
    { dataset: "gomariz-documented-weight", reference: "CA1459", issue: "Atributo no normalizable: Peso" }
  ] as const;
  const records = cases.map(({ dataset, reference }) => accreditedSourceRecord(dataset, reference));
  const originals = records.map((record) => JSON.stringify(record));
  const prepared = prepareImportBatch(records);
  assert.deepEqual(prepared.totals, { ready: 0, review: 7 });
  assert.equal(prepared.products.length, cases.length);
  for (const [index, { issue, reference }] of cases.entries()) {
    const source = records[index];
    const product = prepared.products[index];
    assert.ok(source && product);
    assert.equal(product.status, "review", reference);
    assert.ok(product.issues.some((message) => message.includes(issue)), reference);
    assert.equal(product.product.providerId, source.providerId, reference);
    assert.equal(product.product.reference, source.reference, reference);
    assert.equal(product.product.sourceUrl, source.url, reference);
    assert.equal(JSON.stringify(source), originals[index], reference);
  }
});

test("las variantes cercanas acreditadas no heredan las siete retenciones", () => {
  const records = [
    gam("4735"),
    gam("4738"),
    accreditedSourceRecord("gomariz-documented-weight", "RE454"),
    accreditedSourceRecord("gomariz-documented-weight", "TE1152")
  ];
  const originals = records.map((record) => JSON.stringify(record));
  const prepared = prepareImportBatch(records);
  assert.deepEqual(prepared.totals, { ready: 4, review: 0 });
  for (const [index, result] of prepared.products.entries()) {
    assert.equal(result.status, "ready", records[index]?.reference ?? undefined);
    assert.deepEqual(result.issues, [], records[index]?.reference ?? undefined);
    assert.equal(JSON.stringify(records[index]), originals[index]);
  }
});
