import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { normalizeEditorialTitle } from "../domain/editorial-normalization.js";
import { presentCommercialMotorization } from "../domain/editorial-motorization.js";
import { resolvePreparedEditorialTitle } from "../mapping/prepared-editorial-title.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const historical = [
  [accreditedSourceRecord("gam-original", "6901"), "Plataforma articulada diésel SNORKEL A46JRT"],
  [accreditedSourceRecord("gomariz-original", "TE1591"), "Plataforma de tijera eléctrica LGMG AS0812 · 10 m de trabajo"],
  [accreditedSourceRecord("mercaeleva-original", "M940-4770"), "Carretilla elevadora eléctrica Linde E20PL"]
] as const;

test("RE051 y RE052 conservan títulos técnicos documentados en originales de los tres proveedores", () => {
  for (const [record, expected] of historical) {
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.title, expected, `${record.providerId}:${record.reference}`);
    assert.equal(prepared.product.description_title, expected);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(JSON.stringify(record), snapshot);
  }
});

test("RE051 compone familia, identidad, motorización y altura con datos de una unidad nueva compatible", () => {
  const old = controlledGomarizPlatform();
  const next: ProductRecord = {
    ...old,
    reference: "CONTROL-PLATAFORMA-NUEVA",
    url: "https://www.gomarizrent.com/producto/marca-modelo10-nueva/",
    specs: { ...old.specs, "Altura de trabajo": "12 m" }
  };
  assert.equal(resolveEditorialFacts(next)?.workingHeightM, 12);
  assert.equal(resolvePreparedEditorialTitle(next, next), "Plataforma de tijera eléctrica MARCA MODELO10 · 12 m de trabajo");
  assert.equal(prepareSourceProduct(next).product.title, "Plataforma de tijera eléctrica MARCA MODELO10 · 12 m de trabajo");
  assert.equal(resolvePreparedEditorialTitle(old, old), "Plataforma de tijera eléctrica MARCA MODELO10 · 10 m de trabajo");
  const different = { ...next, model: "MODELO11", title: "Plataforma de tijera eléctrica MARCA MODELO11", url: "https://www.gomarizrent.com/producto/marca-modelo11-nueva/" };
  assert.equal(resolveEditorialFacts(different)?.workingHeightM, 12);
  assert.equal(resolvePreparedEditorialTitle(different, different), "Plataforma de tijera eléctrica MARCA MODELO11 · 12 m de trabajo");
  const mismatched = { ...different, model: "MODELO12" };
  assert.equal(resolveEditorialFacts(mismatched), null);
  assert.equal(resolvePreparedEditorialTitle(mismatched, mismatched), mismatched.title);
});

test("RE051 reutiliza títulos de manutención en otros proveedores sin retener el peso de una unidad", () => {
  for (const original of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const next: ProductRecord = {
      ...original,
      reference: `${original.reference}-NUEVA`,
      url: original.url?.replace(original.reference ?? "", `${original.reference}-NUEVA`) ?? null,
      specs: { ...original.specs }
    };
    const first = resolvePreparedEditorialTitle(original, original);
    const second = resolvePreparedEditorialTitle(next, next);
    assert.equal(first, "Carretilla elevadora MARCA MODELO10");
    assert.equal(second, first);
    assert.equal(prepareSourceProduct(next).product.title, second);
    assert.equal(prepareSourceProduct(next).product.reference, next.reference);
    assert.equal(prepareSourceProduct(next).product.sourceUrl, next.url);
  }
});

test("RE051 no introduce atributos por identidad, fuente, familia o magnitudes no corroboradas", () => {
  const original = controlledGomarizPlatform();
  for (const invalid of [
    { ...original, providerId: "gam" },
    { ...original, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...original, model: "MODELO11" },
    { ...original, specs: { ...original.specs, Marca: "OTRA" } },
    { ...original, specs: { ...original.specs, "Altura de trabajo": "12 kg" } },
    { ...original, title: "Plataforma de tijera eléctrica diésel MARCA MODELO10" }
  ]) {
    assert.equal(resolveEditorialFacts(invalid), null);
    assert.equal(resolvePreparedEditorialTitle(invalid, invalid), invalid.title);
  }
});

test("RE052 normaliza prefijos, familia y unidades, preservando el modelo y el concepto de magnitud", () => {
  assert.equal(normalizeEditorialTitle("Compra PLATAFORMA DE TIJERA ELECTRICA 10MT MARCA MODELO10", "MODELO10"),
    "Plataforma de tijera eléctrica 10 m MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("Compra CARRETILLA ELEVADORA DIESEL 2500KG MARCA MODELO10", "MODELO10"),
    "Carretilla elevadora diésel 2500 kg MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("PLATAFORMA ELECTRICA 10KG MARCA MODELO10", "MODELO10"),
    "Plataforma eléctrica 10 kg MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("PLATAFORMA ELECTRICA 10MT MARCA MODELO10", "MODELO10")?.endsWith("MODELO10"), true);
});

test("RE052 incorpora motorización de ficha solo con valor permitido, sin duplicarla", () => {
  const title = "Plataforma articulada MARCA MODELO10";
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Eléctrico" } }),
    "Plataforma articulada eléctrica MARCA MODELO10");
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Diésel" } }),
    "Plataforma articulada diésel MARCA MODELO10");
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Eléctrico / Diésel" } }), title);
  assert.equal(presentCommercialMotorization("Plataforma articulada diésel MARCA MODELO10", { spec: { Motor: "Eléctrico" } }),
    "Plataforma articulada diésel MARCA MODELO10");
});


test("RE052 aplica la normalización dentro de la presentación comercial sin cambiar la unidad ni sus datos", () => {
  const source = controlledGomarizPlatform();
  const prepared = prepareSourceProduct(source).product;
  const rawTitle = "Compra PLATAFORMA DE TIJERA ELECTRICA 10MT MARCA MODELO10";
  const corrected = normalizePreparedEditorialPresentation(source, {
    ...prepared, title: rawTitle, description_title: rawTitle
  });
  assert.equal(corrected.title, "Plataforma de tijera eléctrica 10 m MARCA MODELO10");
  assert.equal(corrected.description_title, corrected.title);
  assert.equal(corrected.reference, source.reference);
  assert.equal(corrected.sourceUrl, source.url);
  assert.deepEqual(corrected.spec, prepared.spec);
  assert.deepEqual(corrected.attributes, prepared.attributes);
  assert.deepEqual(normalizePreparedEditorialPresentation(source, corrected), corrected);
  assert.throws(() => normalizePreparedEditorialPresentation({ ...source, reference: "OTRA" }, prepared),
    /Identidad editorial discordante/u);
});
