import { readMercaelevaSource } from "../../../../../testing/builders/mercaeleva-source-fixture.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { sourceSemanticQualityIssues } from "../../../source/semantic-quality.js";
import { reconcileGomarizVerifiedElectricSemanticSource } from "../../../reconciliation/gomariz.js";
import { reconcileMercaelevaVerifiedReachTruckFamily } from "../../../reconciliation/mercaeleva.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const gomariz = (await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json")).products;
const gam = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const mercaeleva = await readMercaelevaSource();
const find = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const conflicts = ["BA1465", "M547-2372", "M838-0666", "M969-4655"] as const;

const recordOf = (reference: string): ProductRecord =>
  find(reference.startsWith("M") ? mercaeleva : gomariz, reference);

test("Las contradicciones originales se conservan; solo dos se concilian con evidencia individual", () => {
  for (const reference of conflicts) {
    const record = recordOf(reference);
    const before = JSON.stringify(record);
    const findings = sourceSemanticQualityIssues(record);
    assert.equal(findings.length, 1, reference);
    const result = prepareSourceProduct(record);
    const reconciled = reference === "BA1465" || reference === "M547-2372";
    assert.equal(result.status, reconciled ? "ready" : "review", reference);
    if (reconciled) {
      assert.equal(result.issues.length, 0, reference);
    } else {
      assert.ok(result.issues.includes(findings[0] ?? ""), reference);
    }
    assert.equal(result.product.reference, record.reference, reference);
    assert.equal(result.product.sourceUrl, record.url, reference);
    assert.deepEqual(result.product.spec, { ...record.specs, ...(record.providerId === "gomariz" && record.year ? { "Año de fabricación": record.year } : {}) }, reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("las dos conciliaciones semánticas requieren la fuente íntegra y la variante exacta", () => {
  const electric = recordOf("BA1465");
  const reach = recordOf("M547-2372");
  assert.notStrictEqual(reconcileGomarizVerifiedElectricSemanticSource(electric), electric);
  assert.notStrictEqual(reconcileMercaelevaVerifiedReachTruckFamily(reach), reach);
  const alteredElectric = { ...electric, specs: { ...electric.specs, Motor: "Diésel" } };
  assert.strictEqual(reconcileGomarizVerifiedElectricSemanticSource(alteredElectric), alteredElectric);
  const alteredReach = { ...reach, url: `${reach.url}?variant=2` };
  assert.strictEqual(reconcileMercaelevaVerifiedReachTruckFamily(alteredReach), alteredReach);
});

test("Las alturas SS0507E ya resueltas por evidencia siguen aptas", () => {
  for (const reference of ["TE1858", "TE1621", "TE1622"]) {
    const record = find(gomariz, reference);
    assert.deepEqual(sourceSemanticQualityIssues(record), [], reference);
    assert.equal(prepareSourceProduct(record).status, "ready", reference);
    assert.equal(record.specs?.["Altura plataforma"], "14.30 m");
  }
});

test("La anomalía de alturas no acreditada sí queda bajo revisión", () => {
  const record = find(gomariz, "TE1858");
  const altered = { ...record, specs: { ...record.specs, "Altura plataforma": "18 m" } };
  assert.ok(sourceSemanticQualityIssues(altered).some((issue) => issue.includes("Alturas contradictorias")));
  assert.equal(prepareSourceProduct(altered).status, "review");
});

test("Las familias, variantes, URLs y artículos deben corresponder a la misma referencia", () => {
  const model = find(mercaeleva, "M838-0666");
  const family = find(mercaeleva, "M547-2372");
  const cases: readonly ProductRecord[] = [
    { ...model, providerId: "gam" },
    { ...model, reference: "M969-4655" },
    { ...model, url: model.url.replace("sales.mercaeleva.com", "example.com") },
    { ...model, url: `${model.url}?source=copy` },
    { ...model, model: "450 AJ SII" },
    { ...model, title: "JLG 450 AJ SII" },
    { ...model, specs: { ...model.specs, Modelo: "450 AJ SII" } },
    { ...model, specs: { ...model.specs, "Artículo No.": "453" } },
    { ...model, longDescription: model.longDescription?.replace("SII", "SIII") ?? null },
    { ...family, providerId: "gomariz" },
    { ...family, reference: "M547-2373" },
    { ...family, title: "Toyota 6FBRE14 TRANSPALET ELECTRICO 1350 KG" },
    { ...family, specs: { ...family.specs, "Título adicional": "TRANSPALET ELECTRICO 1350 KG" } },
    { ...family, longDescription: family.longDescription?.replace("TRANSPALET", "CARRETILLA RETRACTIL") ?? null }
  ];
  for (const [index, record] of cases.entries()) {
    assert.deepEqual(sourceSemanticQualityIssues(record), [], String(index));
  }
});

test("Miles expresados como 3000 y 3.000 kg son la misma capacidad", () => {
  for (const reference of ["M644-0759", "M520-1851", "M493-1006"]) {
    assert.deepEqual(sourceSemanticQualityIssues(find(mercaeleva, reference)), [], reference);
  }
  const record = find(mercaeleva, "M644-0759");
  const incompatible = { ...record, longDescription: record.longDescription?.replace("3.000 KG", "2.500 KG") ?? null };
  assert.ok(sourceSemanticQualityIssues(incompatible).some((issue) => issue.includes("Capacidad contradictoria")));
});

test("Corte completo: solo cuatro conflictos no resueltos y sin contaminación de GAM", () => {
  assert.equal(gomariz.length, 143);
  assert.equal(gam.length, 983);
  assert.equal(mercaeleva.length, 221);
  const sources: readonly ProductRecord[] = [...gomariz, ...gam, ...mercaeleva];
  const found = sources.filter((record) => sourceSemanticQualityIssues(record).length).map((record) => record.reference);
  assert.deepEqual(found.sort(), [...conflicts].sort());
  assert.ok(gam.every((record) => sourceSemanticQualityIssues(record).length === 0));
});
