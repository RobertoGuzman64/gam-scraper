import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { prepareImportBatch } from "../../../catalog/preparation/prepare.js";
import { differenceBetween } from "../active-publication.js";
import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";
import { reconcileRemovedSpecifications } from "../specification-reconciliations.js";
import { classifyQualityIssue } from "../../../catalog/preparation/offline-diagnostics.js";

const root = resolve(process.cwd());
const source = await readCanonicalCatalog(resolve(root, "catalogs/providers/gam/original/scrape-gam-catalog.json"));
const activeFile = await resolveAccreditedPublication(root, "gam");
assert.ok(activeFile);
const previous = (await readAccreditedPublication(activeFile)).products;
const prepared = prepareImportBatch(source.products);
const next = prepared.products.filter((item) => item.status === "ready").map((item) => item.product);
const difference = differenceBetween(activeFile, "preparación sin acreditar", previous, next);

const migrationKeys = [
  "ref:6688:ALFA ROMEO", "ref:6689:AUDI", "ref:6690:PEUGEOUT", "ref:2218:Ancho promedio",
  "ref:2109:Capacidad de la batería", "ref:2108:Capacidad de la batería", "ref:920:Capacidad de la batería",
  "ref:2134:Capacidad de carga (kg)", "ref:2135:Capacidad de carga (kg)", "ref:1714:Altura Plataforma",
  "ref:2737:Potencia Motor (KW)", "ref:2573:Potencia Motor (CV)"
];

test("distingue doce correcciones técnicas comprobables de pérdidas accidentales", () => {
  const reconciled = reconcileRemovedSpecifications("gam", difference, previous, next);
  assert.deepEqual([...reconciled.resolved].sort(), [...migrationKeys].sort());
  assert.deepEqual(reconciled.unresolved, []);
  assert.deepEqual(difference.lostSpecificationValues, []);
  assert.ok(evaluateIndividualPublicationDifference("gam", difference, previous, next, null).accepted);
  const other = reconcileRemovedSpecifications("gomariz", difference, previous, next);
  assert.deepEqual(other.resolved, []);
  assert.deepEqual([...other.unresolved].sort(), [...migrationKeys].sort());
});

test("un cambio del valor previo, del destino o de la procedencia invalida cada reconciliación", () => {
  for (const removal of migrationKeys) {
    const first = removal.indexOf(":", removal.indexOf(":") + 1);
    const identity = removal.slice(0, first);
    const key = removal.slice(first + 1);
    const original = previous.find((item) => `ref:${item.reference?.toLowerCase()}` === identity);
    const updated = next.find((item) => `ref:${item.reference?.toLowerCase()}` === identity);
    assert.ok(original && updated);
    const invalidOld = previous.map((item) => item === original ? { ...item, spec: { ...item.spec, [key]: "valor cambiado" } } : item);
    const invalidNew = next.map((item) => item === updated ? { ...item, sourceUrl: "https://example.com/otra-referencia" } : item);
    for (const [before, after] of [[invalidOld, next], [previous, invalidNew]] as const) {
      const assessment = reconcileRemovedSpecifications("gam", difference, before, after);
      assert.ok(assessment.unresolved.includes(removal), removal);
      assert.equal(evaluateIndividualPublicationDifference("gam", difference, before, after, null).accepted, false, removal);
    }
    const destination = removal.includes("Capacidad de carga") ? "Capacidad de arrastre" :
      removal.includes("Ancho promedio") || removal.includes("Capacidad de la batería") ? "Voltaje batería (V)" :
      removal.includes("Potencia Motor") ? "Modelo" :
      removal.includes("Altura Plataforma") ? "Altura" : "Marca";
    const damaged = next.map((item) => item === updated ? { ...item, spec: { ...item.spec, [destination]: "valor ajeno" } } : item);
    assert.ok(reconcileRemovedSpecifications("gam", difference, previous, damaged).unresolved.includes(removal), removal);
    assert.equal(evaluateIndividualPublicationDifference("gam", difference, previous, damaged, null).accepted, false, removal);
  }
});

test("dos unidades de stock distintas con número de serie compartido continúan bloqueadas", () => {
  const collisions = prepared.products.filter((item) => ["6682", "6703"].includes(item.product.reference ?? ""));
  assert.equal(collisions.length, 2);
  for (const item of collisions) {
    assert.equal(item.status, "review");
    assert.ok(item.issues.some((issue) => issue.startsWith("Número de serie ")));
    assert.ok(item.issues.some((issue) => issue.startsWith("Stock GAM diferenciado: ")));
  }
  assert.deepEqual(classifyQualityIssue(collisions[0]!.issues[0]!).code, "identity.serial_collision");
  assert.deepEqual(classifyQualityIssue(collisions[0]!.issues[1]!).code, "identity.stock_serial_verification");
});
