import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reconcileGamCorroboratedLoadCapacity } from "../gam/technical/reconciliation/gam-capacity.js";
import { reconcileGomarizVerifiedPlatformHeight } from "../gomariz/technical/reconciliation/gomariz.js";
import { mercaelevaCorroboratedCapacity } from "../mercaeleva/technical/evidence/handling-evidence.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const source = (providerId: "gam" | "gomariz" | "mercaeleva", reference: string): ProductRecord => {
  const catalog = providerId === "gam" ? gam : providerId === "gomariz" ? gomariz : mercaeleva;
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, `${providerId}:${reference}`);
  return record;
};

test("Las siete motorizaciones GAM se reflejan en spec sin trasladar motores entre modelos", () => {
  for (const [reference, motor, motorizacion] of [
    ["2071", "Mercedes-Benz OM934 Diésel", "Diésel"],
    ["2072", "Kubota 3.8L LPG", "GLP"],
    ["2073", "Kubota 3.8L LPG", "GLP"],
    ["2311", "Kubota 3.8L LPG", "GLP"],
    ["2312", "Kubota 3.8L LPG", "GLP"],
    ["2313", "Kubota 3.8L LPG", "GLP"],
    ["2314", "Kubota 3.8L Diesel / PSI 4.3L LPG", "Diésel"]
  ] as const) {
    const record = source("gam", reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Tipo motor"], motor, reference);
    assert.equal(prepared.product.spec.Motorización, motorizacion, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("La altura acreditada de las tres LGMG se aplica en el producto, no en el origen", () => {
  for (const reference of ["TE1858", "TE1621", "TE1622"]) {
    const record = source("gomariz", reference);
    assert.equal(record.specs?.["Altura plataforma"], "14.30 m");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Altura plataforma"], "4,3 m", reference);
    assert.equal(prepared.product.spec["Altura de trabajo"], "6.3 m", reference);
  }
  const original = source("gomariz", "TE1858");
  const variant = { ...original, url: `${original.url}?versión=nueva` };
  assert.strictEqual(reconcileGomarizVerifiedPlatformHeight(variant), variant);
  assert.equal(prepareSourceProduct(variant).status, "review");
});

test("Capacidades GAM reconciliadas solo con corroboración de fuentes y modelo", () => {
  for (const [reference, capacity] of [
    ["6932", 1600], ["5895", 1800], ["2089", 5000], ["2049", 32000],
    ["2044", 25000], ["2016", 1800], ["2274", 1800], ["2275", 2000],
    ["2273", 1600], ["2193", 3000], ["6421", 2000], ["50", 1400], ["2136", 1600]
  ] as const) {
    const record = source("gam", reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], `${capacity} KG`, reference);
  }
  const source6421 = source("gam", "6421");
  const altered = { ...source6421, shortDescription: "Ficha sin capacidad corroborada" };
  assert.strictEqual(reconcileGamCorroboratedLoadCapacity(altered), altered);
  assert.equal(prepareSourceProduct(altered).product.spec["Capacidad de carga (kg)"], "3000 KG");
});

test("Toyota 02-7FD18 conserva altura 4700 mm y corrige solo capacidad 1800 kg", () => {
  const record = source("mercaeleva", "M433-5206");
  const before = JSON.stringify(record);
  assert.equal(mercaelevaCorroboratedCapacity(record), 1800);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Capacidad máxima de elevación"], "1800 kg");
  assert.equal(prepared.product.spec["Altura de elevación según texto comercial"], "4.700 mm");
  assert.equal(prepared.status, "ready");
  assert.equal(JSON.stringify(record), before);
  const altered = { ...record, longDescription: record.longDescription?.replace("4.700mm", "4.800mm") ?? null };
  assert.equal(mercaelevaCorroboratedCapacity(altered), null);
  assert.equal(prepareSourceProduct(altered).product.spec["Capacidad máxima de elevación"], "4700 kg");
  assert.equal(prepareSourceProduct(altered).status, "review");
});

test("Yale 2328 identifica la variante diésel de 8 toneladas sin copiar el modelo de 9 toneladas", () => {
  const record = source("gam", "2328");
  const original = JSON.stringify(record);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec.Modelo, "GDP80VX");
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "8000 KG");
  assert.equal(prepared.product.externalReference, "GP80SVX");
  assert.ok(prepared.product.title?.includes("GDP80VX"));
  assert.ok(prepared.product.description?.includes("8.000 kg"));
  assert.ok(!prepared.product.description?.includes("9.000 kg"));
  assert.ok(!prepared.product.description_general?.includes("GP90VX"));
  assert.equal(JSON.stringify(record), original);
  for (const variant of [
    { ...record, reference: "2329" },
    { ...record, url: `${record.url}?otra=1` },
    { ...record, model: "GP90VX" },
    { ...record, title: "Otra máquina" },
    { ...record, shortDescription: "Otro resumen" },
    { ...record, longDescription: "Otra descripción" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "9000 KG" } }
  ]) {
    const candidate = prepareSourceProduct(variant);
    assert.notEqual(candidate.product.spec.Modelo, "GDP80VX");
    assert.notEqual(candidate.product.title, prepared.product.title);
  }
});

test("Motores multivariante y sufijos comerciales válidos no provocan nuevos avisos", () => {
  for (const reference of ["2314", "4739", "4741", "6997", "2252"]) {
    assert.equal(prepareSourceProduct(source("gam", reference)).status, "ready", reference);
  }
  const original = source("gam", "2314");
  const dualFuel = { ...original, specs: { ...original.specs, Motorización: "GLP" } };
  const prepared = prepareSourceProduct(dualFuel);
  assert.ok(!prepared.issues.some((issue) => issue.startsWith("Motorización contradictoria")));
  const electric = { ...original, shortDescription: "Variación sin evidencia acreditada" };
  assert.ok(prepareSourceProduct(electric).issues.some((issue) => issue.startsWith("Motorización contradictoria")));
});
