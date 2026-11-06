import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamRegenerativeBrakingInGeneral } from "./source-regenerative-braking-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera una prestación operativa explícita sin volver a escribir datos estructurados", () => {
  for (const reference of ["2130", "2219", "2794"]) {
    const record = find(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Frenado regenerativo"], true, reference);
    assert.match(prepared.product.description_general ?? "",
      /dispone de frenado regenerativo\.(?: El proveedor declara un sistema de detección de obstáculos\.)?$/u,
      reference);
    assert.equal((prepared.product.description_general ?? "").match(/dispone de frenado regenerativo/gu)?.length, 1);
    assert.deepEqual(record, snapshot);
  }
  const existing = find("2018");
  const preparedExisting = prepareSourceProduct(existing);
  assert.ok(preparedExisting.product.description_general?.includes("regenerativo"));
  assert.ok(!preparedExisting.product.description_general?.includes("La ficha del proveedor confirma"));
});

test("descarta identidad ajena, incertidumbre, duplicados y especificaciones no acreditadas", () => {
  const source = find("2130");
  const baseline = "Equipo eléctrico identificado para el modelo original.";
  const confirmed = { ...source.specs, "Frenado regenerativo": true };
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, categoryKey: "carretillas-usadas" },
    { ...source, condition: "Segunda mano" },
    { ...source, brand: "OTRA" },
    { ...source, model: "OTRO" },
    { ...source, reference: "9999" },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, longDescription: "Frenado regenerativo." },
    { ...source, longDescription: `${source.longDescription} Sin frenado regenerativo.` },
    { ...source, longDescription: `${source.longDescription} Puede incorporar frenado regenerativo.` },
    { ...source, longDescription: `${source.longDescription} Frenado regenerativo opcional.` }
  ];
  for (const record of variants) {
    assert.equal(includeGamRegenerativeBrakingInGeneral(record, baseline, confirmed), baseline);
  }
  assert.equal(includeGamRegenerativeBrakingInGeneral(source, baseline, { ...source.specs }), baseline);
  assert.equal(includeGamRegenerativeBrakingInGeneral(source, baseline, { ...confirmed, "Frenado regenerativo": false }), baseline);
  assert.equal(includeGamRegenerativeBrakingInGeneral(source, "El equipo incluye frenado regenerativo.", confirmed), "El equipo incluye frenado regenerativo.");
  assert.equal(includeGamRegenerativeBrakingInGeneral(source, null, confirmed), null);
});
