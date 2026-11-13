import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";
import { projectCommercialPresentation } from "../../../../commercial/projection/presentation-projection.js";
import { controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaForklift, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

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
