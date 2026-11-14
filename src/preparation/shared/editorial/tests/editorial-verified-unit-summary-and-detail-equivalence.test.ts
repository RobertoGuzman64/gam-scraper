import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform,
  controlledMercaelevaForklift, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

const sourceSummary = "La carretilla MARCA MODELO10 es una unidad documentada en el anuncio del proveedor y debe contrastarse con su configuración concreta.";

const summaryCandidate = (source: ProductRecord): ProductRecord => ({
  ...source,
  shortDescription: null,
  longDescription: sourceSummary,
  specs: { Marca: "MARCA", Modelo: "MODELO10" }
});

const nextSummaryUnit = (source: ProductRecord): ProductRecord => ({
  ...source,
  reference: "CONTROL-21-NUEVA",
  url: source.url?.replace(source.reference ?? "", "CONTROL-21-NUEVA").replace("modelo10", "modelo11") ?? null,
  title: source.title?.replace("MODELO10", "MODELO11") ?? null,
  model: "MODELO11",
  longDescription: "La carretilla MARCA MODELO11 es otra unidad documentada y su configuración debe comprobarse de manera independiente.",
  specs: { Marca: "MARCA", Modelo: "MODELO11" }
});

test("RE080 conserva el resumen de identidad de una carretilla histórica sin trasladar su detalle general a la corta", () => {
  const source = accreditedSourceRecord("mercaeleva-original", "M827-8304");
  const before = JSON.stringify(source);
  const summary = resolveEditorialIdentitySummary(source, null);
  const prepared = prepareSourceProduct(source);
  const mapped = resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source));
  assert.equal(summary, "Carretilla elevadora Linde E48P de ocasión.");
  assert.equal(mapped.preparedShort, summary);
  assert.equal(prepared.product.description, summary);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /4\.800 kg/u);
  assert.match(prepared.product.description_general ?? "", /2\.649/u);
  assert.doesNotMatch(summary ?? "", /4\.800 kg|2\.649/u);
  assert.equal(JSON.stringify(source), before);
});

test("RE080 recupera el resumen de nuevas unidades compatibles de los tres proveedores sin heredar su identidad", () => {
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const source = summaryCandidate(create());
    const next = nextSummaryUnit(source);
    const before = JSON.stringify([source, next]);
    for (const record of [source, next]) {
      assert.deepEqual(captureSourceEditorialEvidence(record), { identityVerified: true, sourceVerified: true });
      const summary = resolveEditorialIdentitySummary(record, null);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.status, "ready", record.providerId);
      assert.equal(prepared.product.description, summary, record.providerId);
      assert.equal(prepared.product.description_general, record.longDescription, record.providerId);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.match(prepareSourceProduct(next).product.description ?? "", /MODELO11/u);
    assert.doesNotMatch(prepareSourceProduct(next).product.description ?? "", /MODELO10/u);
    assert.equal(JSON.stringify([source, next]), before);
  }
});

test("RE080 bloquea resúmenes sin identidad y procedencia corroboradas o con familia incompatible", () => {
  for (const create of [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift]) {
    const source = summaryCandidate(create());
    for (const invalid of [
      { ...source, model: "MODELO11" },
      { ...source, specs: { ...source.specs, Modelo: "MODELO11" } },
      { ...source, url: "https://example.invalid/ficha/CONTROL-21" },
      { ...source, providerId: "proveedor-ajeno" }
    ]) {
      assert.equal(resolveEditorialIdentitySummary(invalid, null), null, source.providerId);
      const prepared = prepareSourceProduct(invalid);
      assert.notEqual(prepared.product.description, "Carretilla elevadora MARCA MODELO10 de ocasión.");
    }
    const conflicting: ProductRecord = { ...source, condition: "Nuevo", specs: { ...source.specs, Estado: "Usado" } };
    assert.doesNotMatch(resolveEditorialIdentitySummary(conflicting, null) ?? "", /nueva|de ocasión/u);
    assert.equal(resolveEditorialIdentitySummary(source, "barredora"), null);
  }
});

test("RE080 deja en revisión la ficha original sin general verificable aunque pueda resumir su identidad", () => {
  const source = accreditedSourceRecord("mercaeleva-original", "M062-8951");
  const result = prepareSourceProduct(source);
  assert.equal(result.product.description, "Carretilla elevadora MB EFL303 nueva.");
  assert.equal(result.product.description_general, null);
  assert.equal(result.status, "review");
  assert.ok(result.issues.includes("Cobertura editorial insuficiente: descripción general"));
});

test("RE063 mantiene un resumen breve y el detalle adicional en las generales de originales acreditados", () => {
  for (const [dataset, reference, detail] of [
    ["gam-original", "6901", "7.550 kg"],
    ["gomariz-original", "TE1591", "2.360 kg"],
    ["mercaeleva-original", "M827-8304", "2.649"],
    ["mercaeleva-original", "M318-0509", "2026"]
  ] as const) {
    const source = accreditedSourceRecord(dataset, reference);
    const before = JSON.stringify(source);
    const result = prepareSourceProduct(source);
    const short = result.product.description ?? "";
    const general = result.product.description_general ?? "";
    assert.equal(result.status, "ready", reference);
    assert.ok(short.length > 25 && general.length > short.length, reference);
    assert.ok(general.includes(detail), reference);
    assert.ok(!short.includes(detail), reference);
    assert.equal(JSON.stringify(source), before);
  }
});

test("RE063 reutiliza resúmenes y detalles técnicos de unidades nuevas sin duplicar hechos ni inventar medidas", () => {
  for (const create of [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform]) {
    const source = create();
    const record: ProductRecord = {
      ...source,
      reference: "CONTROL-21",
      url: source.url?.replace(source.reference ?? "", "CONTROL-21") ?? null,
      specs: { ...source.specs, Peso: "2400 kg", Longitud: "2,8 m" }
    };
    const expected = resolveReusableEditorial(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.providerId);
    assert.equal(prepared.product.description, expected.short, record.providerId);
    assert.ok(prepared.product.description_general?.includes(expected.general ?? ""), record.providerId);
    assert.match(prepared.product.description_general ?? "", /2\.400 kg/u);
    assert.match(prepared.product.description_general ?? "", /2,8 m/u);
    assert.doesNotMatch(prepared.product.description ?? "", /2\.400 kg|2,8 m/u);
    assert.ok((prepared.product.description_general?.length ?? 0) > (prepared.product.description?.length ?? 0));

    const withoutDetail = { ...record, specs: { ...record.specs } };
    delete withoutDetail.specs.Peso;
    delete withoutDetail.specs.Longitud;
    const reduced = prepareSourceProduct(withoutDetail);
    assert.doesNotMatch(reduced.product.description_general ?? "", /2\.400 kg|2,8 m/u);
    assert.equal(reduced.status, "ready");
  }
});
