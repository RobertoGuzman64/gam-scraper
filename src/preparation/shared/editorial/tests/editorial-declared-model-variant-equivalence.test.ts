import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";

const historical = (reference: string): ProductRecord => accreditedSourceRecord("mercaeleva-original", reference);
const note = /El anuncio denomina esta unidad «Haulotte Optimum 8 AC»; esa denominación no acredita por sí sola equipamiento ni prestaciones diferentes\./u;
const general = "La ficha describe únicamente las características contrastadas de esta unidad.";

test("la denominación comercial Optimum 8 AC de cuatro originales se conserva sin alterar el modelo técnico", () => {
  for (const reference of ["M131-5855", "M281-3486", "M229-0241", "M539-6438"]) {
    const record = historical(reference);
    const snapshot = JSON.stringify(record);
    assert.match(record.longDescription ?? "", /HAULOTTE OPTIMUM 8 AC/u);
    assert.equal(record.specs?.Modelo, "Optimum 8");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description_general ?? "", /Optimum 8 AC/u, reference);
    if (reference === "M131-5855") assert.match(prepared.product.description_general ?? "", note);
    else assert.doesNotMatch(prepared.product.description_general ?? "", note);
    assert.equal(prepared.product.spec.Modelo, "Optimum 8");
    assert.doesNotMatch(prepared.product.description ?? "", /Optimum 8 AC|prestaciones diferentes/u);
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.match(resolveKnowledgeEditorial(historical("M131-5855"), historical("M131-5855")).fallbackGeneral ?? "", /Optimum 8 AC/u);
});

test("otra unidad compatible consume únicamente la denominación que realmente declara su propio anuncio", () => {
  const record = historical("M131-5855");
  const source: ProductRecord = {
    ...record,
    reference: "M131-5855-OTRA",
    url: record.url.replace("M131-5855", "M131-5855-OTRA"),
    horometer: "75",
    longDescription: (record.longDescription ?? "").replace("623", "986").replace("464", "75"),
    specs: { ...record.specs, "Artículo No.": "986", "Horas laborales": "75 h" }
  };
  const output = prepareSourceProduct(source);
  assert.equal(resolveKnowledgeEditorial(source, source).fallbackGeneral, null);
  assert.equal(output.status, "ready");
  assert.match(output.product.description_general ?? "", note);
  assert.match(output.product.description_general ?? "", /75 horas|75 h/u);
  assert.doesNotMatch(output.product.description_general ?? "", /464 horas|referencia comercial declarada por el vendedor: 623/iu);
  const other = { ...source, longDescription: (source.longDescription ?? "").replace("OPTIMUM 8 AC", "OPTIMUM 8") };
  assert.doesNotMatch(prepareSourceProduct(other).product.description_general ?? "", note);
});

test("la denominación no sobrevive a contradicciones, opcionalidad ni cambios de procedencia", () => {
  const record = historical("M131-5855");
  const cases: readonly ProductRecord[] = [
    { ...record, longDescription: (record.longDescription ?? "").replace("OPTIMUM 8 AC", "OPTIMUM 8 DC") },
    { ...record, longDescription: "Disponible como opción: HAULOTTE OPTIMUM 8 AC." },
    { ...record, specs: { ...record.specs, Modelo: "Optimum 8 AC" } },
    { ...record, specs: { ...record.specs, Marca: "Otra" } },
    { ...record, brand: "Otra" },
    { ...record, model: "Optimum 7" },
    { ...record, url: "https://example.invalid/unidad" }
  ];
  for (const candidate of cases) {
    assert.doesNotMatch(prepareSourceProduct(candidate).product.description_general ?? "", note);
  }
  assert.equal(resolveVerifiedEditorialUnitContext(record, general, { ...record, reference: "OTRA" }), general);
  assert.equal(resolveVerifiedEditorialUnitContext(record, general, { ...record, condition: "Nuevo" }), general);
  assert.equal(resolveVerifiedEditorialUnitContext(record, general, { ...record, specs: { ...record.specs, Modelo: "OTRO" } }), general);
  const alreadyMentioned = resolveVerifiedEditorialUnitContext(record, `${general} Haulotte Optimum 8 AC.`, record) ?? "";
  assert.doesNotMatch(alreadyMentioned, note);
  assert.equal(alreadyMentioned.match(/Optimum 8 AC/gu)?.length, 1);
});
