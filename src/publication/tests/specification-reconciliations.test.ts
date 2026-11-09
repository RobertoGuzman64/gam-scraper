import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareImportBatch } from "../../preparation/prepare.js";
import { differenceBetween } from "../active-publication.js";
import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";
import { reconcileRemovedSpecifications } from "../specification-reconciliations.js";
import { classifyQualityIssue } from "../../preparation/offline-diagnostics.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { accreditedReconciliationCases } from "../../testing/fixtures/gam/specification-reconciliations.js";

const root = resolve(process.cwd());
const source = await readCanonicalCatalog(resolve(root, "catalogs/providers/gam/original/scrape-gam-catalog.json"));
const prepared = prepareImportBatch(source.products);
const reconciliationProduct = (
  item: (typeof accreditedReconciliationCases)[number], spec: ImportCandidate["spec"]
): ImportCandidate => ({
  providerId: "gam", sourceUrl: item.sourceUrl, reference: item.reference,
  title: null, categorySellID: null, category: null, condition: null, price: null,
  description_title: null, description: null, description_general: null,
  image: null, images: [], spec, attributes: []
});
const previous = accreditedReconciliationCases.map((item) => reconciliationProduct(item, item.previousSpec));
const next = accreditedReconciliationCases.map((item) => reconciliationProduct(item, item.nextSpec));
const difference = differenceBetween("GAM anterior", "GAM corregida", previous, next);

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

test("FINISH acredita las veintiuna retiradas técnicas contrastadas sin relajar el bloqueo de pérdidas nuevas", async () => {
  const cases = [
    { providerId: "gam", references: ["2130", "2300", "2301", "2242", "2243", "2244", "2245", "2246", "2247"], count: 19 },
    { providerId: "mercaeleva", references: ["M062-8951", "M119-9334"], count: 2 }
  ] as const;
  for (const scenario of cases) {
    const catalog = scenario.providerId === "gam" ? source :
      await readCanonicalCatalog(resolve(root, "catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"));
    const output = scenario.providerId === "gam" ? prepared : prepareImportBatch(catalog.products);
    const candidateProducts = output.products.filter((item) => item.status === "ready" &&
      scenario.references.some((reference) => item.product.reference === reference)).map((item) => item.product);
    const originalSpecs = new Map(catalog.products.map((item) => [item.reference, item.specs]));
    const publishedProducts = candidateProducts.map((item) => {
      const spec = originalSpecs.get(item.reference);
      assert.ok(spec);
      return { ...item, spec };
    });
    assert.equal(candidateProducts.length, scenario.references.length);
    const changes = differenceBetween("origen", "preparación", publishedProducts, candidateProducts);
    assert.equal(changes.removedSpecifications.length, scenario.count);
    assert.deepEqual(changes.lostSpecificationValues, []);
    const accepted = reconcileRemovedSpecifications(scenario.providerId, changes, publishedProducts, candidateProducts);
    assert.equal(accepted.resolved.length, scenario.count);
    assert.deepEqual(accepted.unresolved, []);
    assert.equal(evaluateIndividualPublicationDifference(scenario.providerId, changes, publishedProducts, candidateProducts, null).accepted, true);
    const otherProvider = scenario.providerId === "gam" ? "mercaeleva" : "gam";
    assert.equal(reconcileRemovedSpecifications(otherProvider, changes, publishedProducts, candidateProducts).resolved.length, 0);

    for (const removal of changes.removedSpecifications) {
      const separator = removal.indexOf(":", removal.indexOf(":") + 1);
      const reference = removal.slice("ref:".length, separator);
      const field = removal.slice(separator + 1);
      const incorrectSource = publishedProducts.map((item) => item.reference?.toLowerCase() === reference ?
        { ...item, spec: { ...item.spec, [field]: "valor sin evidencia" } } : item);
      const incorrectOrigin = candidateProducts.map((item) => item.reference?.toLowerCase() === reference ?
        { ...item, sourceUrl: "https://example.com/otra-unidad" } : item);
      for (const [before, after] of [[incorrectSource, candidateProducts], [publishedProducts, incorrectOrigin]] as const) {
        const check = reconcileRemovedSpecifications(scenario.providerId, changes, before, after);
        assert.ok(check.unresolved.includes(removal), removal);
        assert.equal(evaluateIndividualPublicationDifference(scenario.providerId, changes, before, after, null).accepted, false);
      }
      const destination = reference === "2130" || scenario.providerId === "mercaeleva" ? null :
        reference === "2300" || reference === "2301" ? "Altura de elevación (mm)" : "Batería (V / Ah)";
      if (destination !== null) {
        const incorrectDestination = candidateProducts.map((item) => item.reference?.toLowerCase() === reference ?
          { ...item, spec: { ...item.spec, [destination]: "valor sin evidencia" } } : item);
        assert.ok(reconcileRemovedSpecifications(scenario.providerId, changes, publishedProducts, incorrectDestination).unresolved.includes(removal));
      }
    }
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
