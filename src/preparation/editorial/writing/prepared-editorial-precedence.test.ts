import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../prepare-product.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { enrichVerifiedTechnicalBrief } from "../measurements/editorial-technical-brief.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import { resolveReusableEditorial } from "../core/editorial-composition.js";
import { resolvePreparedEditorial } from "../core/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../claims/source-editorial-evidence.js";
import { projectCommercialPresentation } from "../../../commercial/projection/presentation-projection.js";
import { controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaForklift, controlledMercaelevaPlatform } from "../core/editorial-contract-records.js";

test("la precedencia editorial compone desde hechos y no depende del tamaño del catálogo", () => {
  const source = controlledGomarizPlatform();
  const snapshot = JSON.stringify(source);
  const shared = resolveReusableEditorial(source);
  const mapped = resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source));
  assert.equal(resolveEditorialFacts(source)?.family, "plataforma-tijera");
  assert.equal(mapped.preparedShort, shared.short);
  assert.ok(mapped.preparedLong?.startsWith(shared.general ?? "SIN GENERAL"));
  assert.match(mapped.preparedShort ?? "", /altura de trabajo de 10 m/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("una unidad equivalente reutiliza composición sin reutilizar contenido firmado de otra unidad", () => {
  const source = controlledGomarizPlatform();
  const equivalent = { ...source, reference: "CONTROL-OTRA", url: "https://www.gomarizrent.com/producto/otra-marca-modelo10/" };
  const original = resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source));
  const other = resolvePreparedEditorial(equivalent, equivalent, captureSourceEditorialEvidence(equivalent));
  assert.equal(other.preparedShort, original.preparedShort);
  assert.equal(other.preparedLong, original.preparedLong);
  assert.equal(prepareSourceProduct(equivalent).product.description, prepareSourceProduct(source).product.description);
});

test("los conflictos de identidad, origen, energía y magnitud se rechazan", () => {
  const source = controlledGomarizPlatform();
  const invalid = [
    { ...source, providerId: "gam" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, model: "MODELO11" },
    { ...source, specs: { ...source.specs, Marca: "DISTINTA" } },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, specs: { ...source.specs, Capacidad: "450 litros" } }
  ];
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(resolveEditorialFacts(candidate), null, String(index));
    assert.deepEqual(resolveReusableEditorial(candidate), { short: null, general: null }, String(index));
  }
});

test("tres proveedores comparten la composición y la proyección respeta las tres salidas editoriales", () => {
  const sources = [
    controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift(),
    controlledGomarizPlatform(), controlledMercaelevaPlatform()
  ];
  for (const source of sources) {
    const snapshot = JSON.stringify(source);
    const result = prepareSourceProduct(source);
    const reusable = resolveReusableEditorial(source);
    const projected = projectCommercialPresentation(source, result.product, source.categoryName);
    assert.equal(result.status, "ready", source.providerId);
    assert.deepEqual(result.issues, [], source.providerId);
    assert.equal(result.product.description, reusable.short, source.providerId);
    assert.ok(result.product.description_general?.startsWith(reusable.general ?? "SIN GENERAL"));
    for (const field of ["title", "description_title", "description", "description_general"] as const) {
      assert.equal(projected[field], result.product[field], `${source.providerId}:${field}`);
    }
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("la composición compartida no publica identidades ajenas ni variantes contradictorias", () => {
  const sources = [
    controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift(),
    controlledGomarizPlatform(), controlledMercaelevaPlatform()
  ];
  for (const source of sources) {
    const conflicting = [
      { ...source, providerId: "origen-desconocido" },
      { ...source, model: "MODELO99" },
      { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
      { ...source, specs: { ...source.specs, "Título adicional": source.title?.includes("Carretilla")
        ? "TRANSPALETA ELÉCTRICA" : "PLATAFORMA ARTICULADA" } }
    ];
    for (const [index, candidate] of conflicting.entries()) {
      assert.equal(resolveEditorialFacts(candidate), null, `${source.providerId}:${index}`);
      assert.deepEqual(resolveReusableEditorial(candidate), { short: null, general: null });
      const result = prepareSourceProduct(candidate);
      assert.equal(result.status, "review", `${source.providerId}:${index}`);
      assert.equal(result.product.description, null, `${source.providerId}:${index}`);
      assert.equal(result.product.description_general, null, `${source.providerId}:${index}`);
    }
  }
});

const compactHandlingSource = (base: ProductRecord): ProductRecord => ({
  ...base, title: "Transpaleta eléctrica MARCA MODELO10",
  url: base.providerId === "gam" ? "https://online.gamrentals.com/es/transpaletas/CONTROL-03-marca-modelo10" : base.url,
  specs: { "Capacidad de carga (kg)": "1500 kg", Anchura: "800 mm" }
});

test("el resumen de manutención añade la anchura corroborada sin reescribir la descripción general", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift()]) {
    const record = compactHandlingSource(base);
    const original = structuredClone(record);
    const result = resolveReusableEditorial(record);
    assert.match(result.short ?? "", /capacidad de carga de 1\.500 kg y anchura del equipo de 0,8 m/u);
    assert.match(result.general ?? "", /anchura de 0,8 m/u);
    assert.equal(resolveReusableEditorial(record).short, result.short);
    assert.deepEqual(record, original);
    const second = { ...record, specs: { ...record.specs, Anchura: "900 mm" } };
    assert.match(resolveReusableEditorial(second).short ?? "", /anchura del equipo de 0,9 m/u);
    assert.doesNotMatch(resolveReusableEditorial(second, null, record).short ?? "", /anchura del equipo/u);
    assert.doesNotMatch(resolveReusableEditorial(record, null, { ...record, reference: "OTRA-UNIDAD" }).short ?? "", /anchura del equipo/u);
    assert.doesNotMatch(resolveReusableEditorial(record, null, { ...record, specs: { ...record.specs, "Anchura total": "900 mm" } }).short ?? "", /anchura del equipo/u);
  }
});

test("una síntesis de identidad recupera la altura declarada sin divulgar una carga contradictoria", () => {
  for (const base of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, specs: { "Altura máxima de elevación": "3300 mm" } };
    const short = "Carretilla elevadora MARCA MODELO10 de ocasión.";
    const enriched = enrichVerifiedTechnicalBrief(source, source, short);
    assert.equal(enriched, "Carretilla elevadora MARCA MODELO10 de ocasión, con altura de elevación declarada de 3,3 m.");
    assert.equal(enrichVerifiedTechnicalBrief(source, source, enriched), null);
    assert.equal(enrichVerifiedTechnicalBrief(source, { ...source, model: "MODELO11" }, short), null);
    assert.equal(enrichVerifiedTechnicalBrief(source, { ...source, providerId: "otro" }, short), null);
    assert.equal(enrichVerifiedTechnicalBrief(source, { ...source, specs: { "Altura máxima de elevación": "4000 mm" } }, short), null);
    assert.equal(enrichVerifiedTechnicalBrief({ ...source, shortDescription: short }, source, short), null);
    const conflicting = { ...source, longDescription: "La altura de elevación es de 4 m." };
    assert.equal(enrichVerifiedTechnicalBrief(conflicting, conflicting, short), null);
  }
});

test("la capacidad nominal recuperada exige anuncio explícito, identidad y magnitud concordante", () => {
  const source: ProductRecord = {
    ...controlledMercaelevaForklift(), title: "MARCA MODELO10 APILADOR ELECTRICO 1600 KG",
    longDescription: "APILADOR ELECTRICO 1600 KG MARCA MODELO10", specs: { Marca: "MARCA", Modelo: "MODELO10" }
  };
  const prepared = { ...source, specs: { ...source.specs, "Capacidad nominal de carga": "1600 kg" } };
  const short = "Apilador MARCA MODELO10, con anchura de 0,8 m.";
  assert.match(enrichVerifiedTechnicalBrief(source, prepared, short) ?? "", /anchura de 0,8 m y capacidad nominal declarada de 1\.600 kg/u);
  assert.equal(enrichVerifiedTechnicalBrief(source, { ...prepared, specs: { ...prepared.specs, "Capacidad nominal de carga": "1800 kg" } }, short), null);
  assert.equal(enrichVerifiedTechnicalBrief(source, { ...prepared, specs: { ...prepared.specs, "Capacidad de carga": "1800 kg" } }, short), null);
  assert.equal(enrichVerifiedTechnicalBrief({ ...source, longDescription: "Apilador eléctrico MARCA MODELO10, peso 1600 kg" }, prepared, short), null);
  assert.equal(enrichVerifiedTechnicalBrief({ ...source, longDescription: "APILADOR ELECTRICO 1600 KG MARCA MODELO10, según versión" }, prepared, short), null);
});
