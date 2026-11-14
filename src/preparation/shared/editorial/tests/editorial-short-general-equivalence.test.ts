import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

const originals = [
  accreditedSourceRecord("gam-original", "6934"),
  accreditedSourceRecord("gomariz-original", "TE1591"),
  accreditedSourceRecord("mercaeleva-original", "M318-0509")
] as const;

const preparedEditorial = (record: ProductRecord) =>
  resolvePreparedEditorial(record, record, captureSourceEditorialEvidence(record));

test("RE054 compone cortas históricas mediante hechos técnicos compartidos en los tres orígenes", () => {
  for (const source of originals) {
    const snapshot = JSON.stringify(source);
    const shared = resolveReusableEditorial(source);
    const resolved = preparedEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.ok(shared.short, source.providerId);
    assert.ok(shared.general, source.providerId);
    assert.equal(resolved.preparedShort, shared.short, source.providerId);
    assert.equal(prepared.product.description, resolved.preparedShort, source.providerId);
    assert.equal(prepared.product.description_general, resolved.preparedLong, source.providerId);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE054 aplica hechos de cada nueva unidad compatible sin reutilizar las cifras de otra", () => {
  for (const [source, newLoad, expected, forbidden] of [
    [controlledGamForklift(), "3000 kg", "3.000 kg", "2.500 kg"],
    [controlledGomarizPlatform(), "12 m", "12 m", "10 m"],
    [controlledMercaelevaPlatform(), "12 m", "12 m", "10 m"]
  ] as const) {
    const changed: ProductRecord = source.providerId === "gam" ? {
      ...source,
      reference: "CONTROL-33",
      url: "https://online.gamrentals.com/es/carretillas/CONTROL-33-carretilla-elevadora",
      specs: { ...source.specs, "Capacidad de carga (kg)": newLoad },
      title: "Carretilla elevadora MARCA MODELO10 3000 kg"
    } : source.providerId === "gomariz" ? {
      ...source,
      reference: "CONTROL-33",
      url: "https://www.gomarizrent.com/producto/marca-modelo10-nueva/",
      specs: { ...source.specs, "Altura de trabajo": newLoad }
    } : {
      ...source,
      reference: "CONTROL-33",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/equipo-CONTROL-33",
      specs: { ...source.specs, "Altura de trabajo": newLoad }
    };
    const before = JSON.stringify(changed);
    const shared = resolveReusableEditorial(changed);
    assert.ok(shared.short?.includes(expected), source.providerId);
    assert.ok(!shared.short?.includes(forbidden), source.providerId);
    const actual = prepareSourceProduct(changed);
    assert.equal(actual.product.description, shared.short, source.providerId);
    assert.ok(actual.product.description_general, source.providerId);
    assert.equal(actual.product.reference, changed.reference);
    assert.equal(actual.product.sourceUrl, changed.url);
    assert.equal(JSON.stringify(changed), before);
  }
});

test("RE054 no compone hechos desde identidad, procedencia o magnitud inválida", () => {
  for (const source of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    for (const invalid of [
      { ...source, model: "MODELO11" },
      { ...source, url: "https://example.invalid/maquina/CONTROL-01" },
      { ...source, providerId: "proveedor-ajeno" },
      { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg", "Capacidad de carga (kg)": "2500 m" } }
    ]) {
      if (invalid.specs === source.specs) {
        assert.deepEqual(resolveReusableEditorial(invalid), { short: null, general: null });
      } else {
        const shared = resolveReusableEditorial(invalid);
        assert.ok(!shared.short?.includes("10 kg"));
        assert.ok(!shared.short?.includes("2.500 m"));
      }
    }
  }
});

test("RE055 comprime anuncios largos originales conservando hechos en la general", () => {
  for (const reference of ["6262", "6807", "6873"]) {
    const source = accreditedSourceRecord("gam-original", reference);
    const before = JSON.stringify(source);
    const short = compressVerifiedSourceShort(source, source.shortDescription, source.longDescription);
    assert.ok(short, reference);
    assert.ok((source.shortDescription?.length ?? 0) > short.length, reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, short, reference);
    assert.ok(prepared.product.description_general, reference);
    assert.notEqual(prepared.product.description_general, short, reference);
    assert.equal(JSON.stringify(source), before);
  }
});

test("RE055 reutiliza la compresión únicamente con evidencia auténtica y sin pérdida de datos", () => {
  const source = accreditedSourceRecord("gam-original", "6262");
  const newUnit: ProductRecord = {
    ...source,
    reference: "6262-NUEVA",
    url: "https://online.gamrentals.com/es/ciclomotores-electricos-segunda-mano/6262-NUEVA-urban-d2"
  };
  const short = compressVerifiedSourceShort(newUnit, newUnit.shortDescription, newUnit.longDescription);
  assert.ok(short);
  assert.equal(prepareSourceProduct(newUnit).product.description, short);
  for (const invalid of [
    { ...newUnit, url: "https://example.invalid/urban-d2" },
    { ...newUnit, model: "D3" },
    { ...newUnit, specs: { ...newUnit.specs, Modelo: "D3" } },
    { ...newUnit, shortDescription: `${newUnit.shortDescription} Batería adicional de 999 V.` },
    { ...newUnit, shortDescription: `${newUnit.shortDescription} Incluye frenada regenerativa.` }
  ]) {
    assert.equal(compressVerifiedSourceShort(invalid, invalid.shortDescription, invalid.longDescription), null);
  }
});

test("RE056 mantiene corta y general diferenciadas sin intercambiar sus procedencias", () => {
  const sources = [
    accreditedSourceRecord("gam-original", "6262"),
    accreditedSourceRecord("gomariz-original", "TE1591"),
    accreditedSourceRecord("mercaeleva-original", "M318-0509")
  ];
  for (const source of sources) {
    const result = preparedEditorial(source);
    const prepared = prepareSourceProduct(source).product;
    assert.ok(result.preparedShort, source.providerId);
    assert.ok(result.preparedLong, source.providerId);
    assert.notEqual(result.preparedShort, result.preparedLong);
    assert.equal(prepared.description, result.preparedShort);
    assert.equal(prepared.description_general, result.preparedLong);
    assert.equal(prepared.reference, source.reference);
    assert.equal(prepared.sourceUrl, source.url);
  }
  const withoutEvidence: ProductRecord = {
    ...controlledGomarizPlatform(),
    brand: null,
    model: null,
    title: "Máquina sin identidad",
    shortDescription: null,
    longDescription: null,
    specs: {}
  };
  const prepared = prepareSourceProduct(withoutEvidence);
  assert.equal(prepared.status, "review");
  assert.equal(prepared.product.description, null);
  assert.equal(prepared.product.description_general, null);
});
