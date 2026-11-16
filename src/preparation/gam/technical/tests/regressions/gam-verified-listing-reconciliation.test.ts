import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamVerifiedListing } from "../../models/gam-verified-listing-reconciliation.js";

const references = ["2190", "2180", "4792", "6171", "2314", "6622", "6236", "4650", "5902"] as const;
const source = (reference: string): ProductRecord => accreditedSourceRecord(reference === "2190" ? "editorial-load-original" : "gam-original", reference);
const catalog = await loadImportCatalog();

test("nueve reconciliaciones GAM documentadas conservan las prestaciones y la identidad original", () => {
  for (const reference of references) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const reconciled = reconcileGamVerifiedListing(record);
    assert.notStrictEqual(reconciled, record, reference);
    assert.strictEqual(reconcileGamVerifiedListing(reconciled), reconciled, reference);
    assert.equal(reconciled.reference, record.reference);
    assert.equal(reconciled.url, record.url);
    for (const prepared of [prepareSourceProduct(record), prepareProduct(record, catalog)]) {
      assert.equal(prepared.status, "ready", `${reference}: ${prepared.issues.join("; ")}`);
      assert.deepEqual(prepared.issues, [], reference);
      assert.equal(prepared.product.reference, reference);
      assert.equal(prepared.product.sourceUrl, record.url);
      assert.ok(prepared.product.description?.trim(), reference);
      assert.ok(prepared.product.description_general?.trim(), reference);
    }
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("modelos verificados y propulsión se reflejan en título, descripción y especificación", () => {
  const hyster = prepareSourceProduct(source("2180")).product;
  const xcmg = prepareSourceProduct(source("4792")).product;
  const cte = prepareSourceProduct(source("6171")).product;
  const yale = prepareSourceProduct(source("2314")).product;
  assert.equal(hyster.spec.Modelo, "S1.6 SL");
  assert.match(hyster.title ?? "", /S1\.6 SL/u);
  assert.match(hyster.description_general ?? "", /1\.600 kg/u);
  assert.equal(hyster.spec["Capacidad de carga (kg)"], "1600 KG");
  assert.equal(xcmg.spec.Modelo, "XGS58E1");
  assert.match(xcmg.title ?? "", /XGS58E1/u);
  assert.doesNotMatch(xcmg.description_general ?? "", /XGS58E(?!1)/u);
  assert.equal(xcmg.spec["Capacidad de carga (kg)"], "450 kg con limitación");
  assert.equal(cte.spec.Modelo, "TRCS 210E");
  assert.match(cte.title ?? "", /TRCS 210E/u);
  assert.doesNotMatch(`${cte.title} ${cte.description_general}`, /TRACCESS 210E|200 kg/u);
  assert.equal(cte.spec["Capacidad de carga (kg)"], "230 KG");
  assert.equal(cte.spec["Alcance Lateral"], "11,30 metros");
  assert.equal(yale.spec.Motorización, "Diésel");
  assert.match(yale.description_general ?? "", /motor diésel/iu);
  assert.doesNotMatch(yale.description_general ?? "", /Diésel a Pie/u);
  assert.equal(yale.spec["Capacidad de carga (kg)"], "6000 KG");
});

test("la capacidad nominal del Hyster de contenedores se acredita con fabricante y unidad", () => {
  const original = source("2190");
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "26400 KG");
  assert.equal(prepared.product.spec["Centro de carga"], "1220 mm");
  assert.equal(prepared.product.spec.Peso, "51553 KG");
  assert.match(prepared.product.description ?? "", /26400 kg/u);
  assert.match(prepared.product.description ?? "", /6,06 metros/u);
  assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /12000 kg|12701 kg/u);
  assert.equal(original.specs?.["Capacidad de carga (kg)"], "12701 KG");
});

test("los cuatro anuncios GAM recuperados reflejan únicamente las prestaciones de su modelo corroborado", () => {
  const genie = prepareSourceProduct(source("6622")).product;
  const snorkel = prepareSourceProduct(source("6236")).product;
  const cte = prepareSourceProduct(source("4650")).product;
  const xcmg = prepareSourceProduct(source("5902")).product;
  assert.match(genie.title ?? "", /GENIE GS-5390/u);
  assert.match(genie.description ?? "", /680 kg/u);
  assert.equal(genie.spec["Dimensiones Cesta"], "3,98X1,83 metros");
  assert.doesNotMatch(`${genie.title} ${genie.description}`, /JLG 1930ES/u);
  assert.match(snorkel.title ?? "", /S4732E/u);
  assert.equal(snorkel.spec["Capacidad de carga (kg)"], "350 KG");
  assert.doesNotMatch(`${snorkel.description} ${snorkel.description_general}`, /S3219E/u);
  assert.match(cte.title ?? "", /B-LIFT 18HV/u);
  assert.doesNotMatch(`${cte.title} ${cte.description}`, /B-LIFT 18HD|360 kg/u);
  assert.equal(cte.spec["Capacidad de carga (kg)"], "300 KG");
  assert.match(xcmg.title ?? "", /XGA43K/u);
  assert.doesNotMatch(`${xcmg.description} ${xcmg.description_general}`, /XGA36K|230 kg/u);
  assert.equal(xcmg.spec["Capacidad de carga (kg)"], "460 KG");
});

test("ninguna corrección GAM se transfiere a proveedor, edición, modelo, stock o especificación distintos", () => {
  for (const reference of references) {
    const record = source(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-NUEVA` },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, brand: "OTRO" },
      { ...record, model: "OTRO" },
      { ...record, externalReference: `${record.externalReference}-OTRA` },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, year: record.year === "2024" ? "2025" : "2024" },
      { ...record, horometer: record.horometer === "DIFERENTE" ? "OTRO" : "DIFERENTE" },
      { ...record, serialNumber: record.serialNumber === "DIFERENTE" ? "OTRO" : "DIFERENTE" },
      { ...record, title: `${record.title} versión diferente` },
      { ...record, shortDescription: `${record.shortDescription} versión diferente` },
      { ...record, longDescription: `${record.longDescription} versión diferente` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "9999 KG" } }
    ];
    for (const variant of variants) {
      assert.strictEqual(reconcileGamVerifiedListing(variant), variant, `${reference}: ${variant.url}`);
    }
  }
  for (const reference of ["6934", "4736"]) {
    assert.equal(prepareSourceProduct(source(reference)).status, "review", reference);
  }
});
