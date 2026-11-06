import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceSafetyControlsInGeneral } from "./source-safety-controls-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const source = catalog.products.find((record) => record.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("incorpora prestaciones afirmadas y acreditadas sin alterar spec ni repetirlas", () => {
  for (const [reference, declaration] of [
    ["6226", /dispone de frenado automático\./u],
    ["6571", /controles proporcionales para las maniobras/u],
    ["5792", /dispone de dirección asistida\./u],
    ["2227", /sistema de detección de obstáculos\./u],
    ["2080", /dispone de control de estabilidad\./u]
  ] as const) {
    const record = find(reference);
    const source = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description_general ?? "", declaration, reference);
    assert.deepEqual(record, source, reference);
    assert.deepEqual(prepared.product.spec, prepareSourceProduct(record).product.spec, reference);
    assert.equal(includeGamSourceSafetyControlsInGeneral(record, prepared.product.description_general, prepared.product.spec),
      prepared.product.description_general, reference);
  }
});

test("rechaza identidad alterada, prestaciones opcionales, negadas, no estructuradas y duplicadas", () => {
  const source = find("6226");
  const baseline = "La plataforma GENIE GS-3246 se utiliza para trabajos en altura.";
  const specs = prepareSourceProduct(source).product.spec;
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "9999" },
    { ...source, model: "GS-2646" },
    { ...source, specs: { ...source.specs, Modelo: "GS-2646" } },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.com") },
    { ...source, longDescription: (source.longDescription ?? "").replace(/frenado automático/iu, "frenado automático opcional") },
    { ...source, longDescription: (source.longDescription ?? "").replace(/frenado automático/iu, "sin frenado automático") },
    { ...source, longDescription: `${source.longDescription} Sin frenado automático.` }
  ];
  for (const [index, record] of variants.entries()) {
    assert.equal(includeGamSourceSafetyControlsInGeneral(record, baseline, specs), baseline, String(index));
  }
  assert.equal(includeGamSourceSafetyControlsInGeneral(source, baseline, {
    ...specs, "Frenado automático": false
  }), baseline);
  const existing = `${baseline} El proveedor confirma frenos automáticos.`;
  assert.equal(includeGamSourceSafetyControlsInGeneral(source, existing, specs), existing);
  assert.equal(includeGamSourceSafetyControlsInGeneral(source, null, specs), null);
});

test("omite seguridad no acreditada, opcional o ya descrita para obstáculos y estabilidad", () => {
  for (const [reference, key, phrase, duplicate] of [
    ["2227", "Detección de obstáculos", "detección de obstáculos", "El equipo incorpora sensores de obstáculos."],
    ["2080", "Control de estabilidad", "control de estabilidad", "El equipo ya tiene control de estabilidad."]
  ] as const) {
    const source = find(reference);
    const specs = prepareSourceProduct(source).product.spec;
    const baseline = "Equipo de manutención con características acreditadas.";
    assert.notEqual(includeGamSourceSafetyControlsInGeneral(source, baseline, specs), baseline);
    for (const changed of [
      { ...source, model: "MODELO-INEXISTENTE" },
      { ...source, providerId: "gomariz" },
      { ...source, longDescription: (source.longDescription ?? "").replace(phrase, `sin ${phrase}`) },
      { ...source, longDescription: (source.longDescription ?? "").replace(phrase, `${phrase} opcional`) }
    ] as const) {
      assert.equal(includeGamSourceSafetyControlsInGeneral(changed, baseline, specs), baseline, `${reference} invalidado`);
    }
    assert.equal(includeGamSourceSafetyControlsInGeneral(source, baseline, { ...specs, [key]: false }), baseline);
    assert.equal(includeGamSourceSafetyControlsInGeneral(source, duplicate, specs), duplicate);
  }
});


test("incorpora parada de emergencia solo cuando la anuncia el equipo exacto", () => {
  for (const reference of ["4731", "6182"] as const) {
    const record = find(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Parada de emergencia"], true, reference);
    assert.match(prepared.product.description_general ?? "", /dispositivo de parada de emergencia\./iu, reference);
    const baseline = "La máquina permite operaciones profesionales.";
    assert.match(includeGamSourceSafetyControlsInGeneral(record, baseline, prepared.product.spec) ?? "",
      /parada de emergencia/u);
    for (const changed of [
      { ...record, model: "MODELO DISTINTO" },
      { ...record, reference: "99999" },
      { ...record, longDescription: (record.longDescription ?? "").replace(/parada de emergencia/iu, "sin parada de emergencia") },
      { ...record, longDescription: (record.longDescription ?? "").replace(/parada de emergencia/iu, "parada de emergencia opcional") }
    ] as const) {
      assert.equal(includeGamSourceSafetyControlsInGeneral(changed, baseline, prepared.product.spec), baseline);
    }
    assert.equal(includeGamSourceSafetyControlsInGeneral(record, baseline, { ...prepared.product.spec, "Parada de emergencia": false }), baseline);
  }
});
