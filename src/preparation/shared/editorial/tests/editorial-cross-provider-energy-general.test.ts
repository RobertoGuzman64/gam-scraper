import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { projectCommercialPresentation } from "../../../../commercial/projection/presentation-projection.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { withoutContradictoryFamilyGeneral } from "../domain/editorial-source-family-general.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const sourceWithContradictoryGeneral = (base: ProductRecord): ProductRecord => ({
  ...base,
  title: "Carretilla elevadora GLP MARCA MODELO10 2500 kg",
  shortDescription: "Carretilla elevadora GLP MARCA MODELO10 con capacidad de 2500 kg.",
  longDescription: "La carretilla elevadora diésel MARCA MODELO10 anuncia una capacidad de 2.500 kg.",
  specs: { ...base.specs, Marca: "MARCA", Modelo: "MODELO10", "Tipo motor": "GLP" }
});

test("la general contradictoria de GAM se sustituye por datos GLP acreditados de la unidad", () => {
  const source = accreditedSourceRecord("gam-original", "6665");
  const snapshot = JSON.stringify(source);
  assert.match(source.longDescription ?? "", /Carretilla Elevadora Diésel HYSTER H5\.0FT/u);
  assert.equal(source.specs?.["Tipo motor"], "GLP");
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /GLP/u);
  assert.match(prepared.product.description_general ?? "", /carretilla elevadora de GLP HYSTER H5\.0FT/u);
  assert.match(prepared.product.description_general ?? "", /altura de elevación de 6 m/u);
  assert.match(prepared.product.description_general ?? "", /5\.000 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /di[eé]sel/iu);
  assert.deepEqual(prepared.product.spec, source.specs);
  assert.equal(JSON.stringify(source), snapshot);
});

test("el mismo filtro de general y su composición funcionan para las tres procedencias", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = sourceWithContradictoryGeneral(base);
    const snapshot = JSON.stringify(source);
    assert.equal(withoutContradictoryFamilyGeneral(source).longDescription, null, source.providerId);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.match(prepared.product.description ?? "", /GLP/u, source.providerId);
    assert.match(prepared.product.description_general ?? "", /carretilla elevadora de GLP MARCA MODELO10/u, source.providerId);
    assert.doesNotMatch(prepared.product.description_general ?? "", /di[eé]sel/iu, source.providerId);
    assert.deepEqual(normalizePreparedEditorialPresentation(source, prepared.product), prepared.product, source.providerId);
    const commercial = projectCommercialPresentation(source, prepared.product, null);
    for (const field of ["title", "description_title", "description", "description_general"] as const) {
      assert.equal(commercial[field], prepared.product[field], `${source.providerId}:${field}`);
    }
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("una variante, origen, declaración parcial u opción no autorizan descartar la general", () => {
  const source = sourceWithContradictoryGeneral(controlledGamForklift());
  for (const changed of [
    { ...source, title: "Carretilla elevadora MARCA MODELO10 2500 kg" },
    { ...source, shortDescription: "Carretilla elevadora MARCA MODELO10 con capacidad de 2500 kg." },
    { ...source, specs: { ...source.specs, "Tipo motor": "GLP / diésel" } },
    { ...source, specs: { ...source.specs, Motorización: "Diésel" } },
    { ...source, model: "MODELO11" },
    { ...source, providerId: "desconocido" },
    { ...source, url: "https://example.invalid/carretilla-control" },
    { ...source, longDescription: `${source.longDescription} Disponible también en versión GLP.` },
    { ...source, longDescription: "La carretilla elevadora diésel MARCA MODELO10 podría montar opcionalmente GLP." }
  ]) assert.equal(withoutContradictoryFamilyGeneral(changed), changed);
});

test("la descripción compatible, la ausencia de energía y una variante en revisión no se reescriben", () => {
  const source = sourceWithContradictoryGeneral(controlledGomarizForklift());
  const compatible = { ...source, longDescription: "La carretilla elevadora GLP MARCA MODELO10 anuncia 2.500 kg de capacidad." };
  assert.equal(withoutContradictoryFamilyGeneral(compatible), compatible);
  const unsupported = { ...source, specs: { ...source.specs, "Tipo motor": "" } };
  assert.equal(withoutContradictoryFamilyGeneral(unsupported), unsupported);
  const sourceRecord = accreditedSourceRecord("gam-original", "2312");
  const reviewed = { ...sourceRecord, longDescription: `${sourceRecord.longDescription} Variante sin corroborar.` };
  const snapshot = JSON.stringify(reviewed);
  const prepared = prepareSourceProduct(reviewed);
  assert.equal(prepared.status, "review");
  assert.match(prepared.product.description_general ?? "", /Carretilla Elevadora Diésel a Pie Yale GC45VX/u);
  assert.equal(JSON.stringify(reviewed), snapshot);
});
