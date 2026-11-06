import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceUnitDetailsInGeneral } from "./source-unit-details-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera solo identidad y horómetro acreditados sin alterar el contenido anterior", () => {
  for (const reference of ["6901", "6979", "6682", "6694", "6837"]) {
    const record = find(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const original = record.longDescription;
    assert.equal(prepared.status, "ready", reference);
    assert.ok(original);
    assert.ok(record.specs);
    assert.ok(prepared.product.description_general?.includes(`número de serie ${record.specs["Nº de serie"]}`), reference);
    assert.ok((prepared.product.description_general?.length ?? 0) > original.length, reference);
    assert.equal(JSON.stringify(record), before, reference);
    const enriched = prepared.product.description_general;
    assert.equal(includeGamSourceUnitDetailsInGeneral(record, enriched, prepared.product.spec), enriched);
  }
  const forklift = prepareSourceProduct(find("6682"));
  assert.match(forklift.product.description_general ?? "", /horómetro de 22192 horas/u);
  const lift = prepareSourceProduct(find("6901"));
  assert.doesNotMatch(lift.product.description_general ?? "", /y horómetro de/u);
});

test("no afirma datos de una variante, dominio, identidad u horómetro manipulados", () => {
  const sourceRecord = find("6682");
  const general = sourceRecord.longDescription;
  assert.ok(general);
  assert.ok(sourceRecord.specs);
  const variants: readonly ProductRecord[] = [
    { ...sourceRecord, providerId: "mercaeleva" },
    { ...sourceRecord, condition: "Nuevo" },
    { ...sourceRecord, reference: "otro" },
    { ...sourceRecord, model: "H2.5FT" },
    { ...sourceRecord, title: "HYSTER H2.5FT" },
    { ...sourceRecord, shortDescription: "HYSTER H2.5FT" },
    { ...sourceRecord, specs: { ...sourceRecord.specs, Modelo: "H2.5FT" } },
    { ...sourceRecord, url: sourceRecord.url.replace("online.gamrentals.com", "example.com") },
    { ...sourceRecord, specs: { ...sourceRecord.specs, "Horómetro": "200 horas", "Nº de serie": "NO-COINCIDE" } },
    { ...sourceRecord, longDescription: `${general} Fabricada en 2016.` }
  ];
  for (const [index, candidate] of variants.entries()) {
    assert.equal(includeGamSourceUnitDetailsInGeneral(candidate, general, sourceRecord.specs), general, String(index));
  }
  const changedHours = includeGamSourceUnitDetailsInGeneral({ ...sourceRecord, horometer: "200 horas" }, general, sourceRecord.specs);
  assert.ok(changedHours?.includes("número de serie P177B10585U"));
  assert.doesNotMatch(changedHours ?? "", /horómetro de/u);
  assert.equal(includeGamSourceUnitDetailsInGeneral(sourceRecord, `${general} Número de serie P177B10585U y 22192 horas.`, sourceRecord.specs), `${general} Número de serie P177B10585U y 22192 horas.`);
  assert.equal(prepareSourceProduct(find("6981")).product.description_general?.includes("Según la ficha del proveedor, esta unidad tiene"), false);
});
