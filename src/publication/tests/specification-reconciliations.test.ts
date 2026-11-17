import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareImportBatch } from "../../preparation/prepare.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";
import { differenceBetween } from "../active-publication.js";
import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";
import { reconcileRemovedSpecifications } from "../specification-reconciliations.js";
import { classifyQualityIssue } from "../../preparation/offline-diagnostics.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { accreditedReconciliationCases } from "../../testing/fixtures/gam/specification-reconciliations.js";
import { recoverGamDocumentedWarehouseCleaningAndLiftingSpecs } from "../../preparation/gam/technical/models/documented-warehouse-cleaning-and-lifting-specs.js";
import { reconcileGamForeignCategoryTitle } from "../../preparation/gam/identity/reconciliation/gam-foreign-category-title.js";

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

test("las seis pérdidas de GAM se reconcilian sin sustituir carga por arrastre ni aceptar variantes", () => {
  const refs = ["6966", "171", "72", "73"] as const;
  const products = refs.map((ref) => {
    const original = source.products.find((item) => item.reference === ref);
    assert.ok(original, ref);
    const result = prepared.products.find((item) => item.product.reference === ref);
    assert.ok(result && result.status === "ready", ref);
    return result.product;
  });
  const originalByRef = new Map(source.products.map((item) => [item.reference, item]));
  const previousProducts = products.map((product) => {
    const original = originalByRef.get(product.reference);
    assert.ok(original);
    if (product.reference === "171") {
      const { ["Depósito de agua limpia estándar"]: _water, ["Depósito de recuperación"]: _recovery,
        ["Anchura de la boquilla de aspiración"]: _squeegee, ...rest } = product.spec;
      return { ...product, spec: {
        ...rest, "Depósito de agua limpia estándar": "190 L", "Depósito de recuperación": "225 L",
        "Anchura de la boquilla de aspiración": "1065 mm"
      } };
    }
    if (product.reference === "72" || product.reference === "73") {
      const { ["Capacidad de arrastre"]: _tow, ...rest } = product.spec;
      return { ...product, spec: { ...rest, "Capacidad de carga (kg)": "8000 KG" } };
    }
    return product;
  });
  const changes = differenceBetween("GAM vigente", "GAM preparada", previousProducts, products);
  assert.deepEqual([...changes.removedSpecifications].sort(), [
    "ref:72:Capacidad de carga (kg)", "ref:73:Capacidad de carga (kg)"
  ]);
  const assessment = reconcileRemovedSpecifications("gam", changes, previousProducts, products);
  assert.deepEqual(assessment.unresolved, []);
  assert.deepEqual([...assessment.resolved].sort(), [...changes.removedSpecifications].sort());
  assert.equal(evaluateIndividualPublicationDifference("gam", changes, previousProducts, products, null).accepted, true);
  const byRef = new Map(products.map((item) => [item.reference, item]));
  assert.equal(byRef.get("6966")?.spec["Capacidad de carga (kg)"], "2000 KG");
  assert.equal(byRef.get("6966")?.spec["Capacidad de arrastre (kg)"], "25000 KG");
  assert.match(byRef.get("6966")?.description ?? "", /arrastre de 25\.000 kg/u);
  assert.equal(byRef.get("72")?.spec["Capacidad de arrastre"], "7000 KG");
  assert.match(byRef.get("72")?.description ?? "", /arrastre de 7\.000 kg/u);
  assert.equal(byRef.get("73")?.spec["Capacidad de arrastre"], "8000 KG");
  for (const ref of ["72", "73"]) {
    const altered = products.map((item) => item.reference === ref
      ? { ...item, spec: { ...item.spec, "Capacidad de arrastre": "otro valor" } } : item);
    assert.ok(reconcileRemovedSpecifications("gam", changes, previousProducts, altered).unresolved.includes(`ref:${ref}:Capacidad de carga (kg)`));
    assert.equal(evaluateIndividualPublicationDifference("gam", changes, previousProducts, altered, null).accepted, false);
  }
});

test("la Tennant T16 recupera tres prestaciones documentadas con identidad y huella estrictas", () => {
  const original = source.products.find((record) => record.reference === "171");
  assert.ok(original);
  const identified = reconcileGamForeignCategoryTitle(original);
  const specs = original.specs ?? {};
  const expected = {
    "Depósito de agua limpia estándar": "190 L",
    "Depósito de recuperación": "225 L",
    "Anchura de la boquilla de aspiración": "1065 mm"
  };
  assert.deepEqual(recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(identified, specs), { ...specs, ...expected });
  assert.deepEqual(Object.fromEntries(Object.entries(prepareSourceProduct(original).product.spec)
    .filter(([key]) => Object.hasOwn(expected, key))), expected);
  for (const changed of [
    { ...identified, title: original.title },
    { ...identified, url: `${identified.url}?otra-variante` },
    { ...identified, model: "OTRO" },
    { ...identified, shortDescription: null },
    { ...identified, longDescription: "Información distinta" },
    { ...identified, specs: { ...specs, "Peso": "otro peso" } }
  ]) {
    assert.equal(recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(changed, changed.specs ?? {}), changed.specs ?? {});
  }
});

test("GAM 2145 retira solo el centro de carga atribuido al modelo no acreditado", () => {
  const unit = prepared.products.find((item) => item.product.reference === "2145");
  assert.ok(unit && unit.status === "ready");
  const current = unit.product;
  assert.equal(current.spec["Modelo"], "P2.5");
  assert.equal(Object.hasOwn(current.spec, "Centro de carga del modelo"), false);
  const former = { ...current, spec: { ...current.spec, "Centro de carga del modelo": "600 mm" } };
  const changes = differenceBetween("vigente", "nuevo", [former], [current]);
  assert.deepEqual(changes.removedSpecifications, ["ref:2145:Centro de carga del modelo"]);
  assert.deepEqual(reconcileRemovedSpecifications("gam", changes, [former], [current]).unresolved, []);
  assert.equal(evaluateIndividualPublicationDifference("gam", changes, [former], [current], null).accepted, true);
  for (const [before, after] of [
    [{ ...former, spec: { ...former.spec, "Centro de carga del modelo": "500 mm" } }, current],
    [former, { ...current, sourceUrl: "https://example.com/otra-unidad" }],
    [former, { ...current, spec: { ...current.spec, "Modelo": "P2.0UTS" } }]
  ] as const) {
    assert.equal(evaluateIndividualPublicationDifference("gam", changes, [before], [after], null).accepted, false);
  }
});
