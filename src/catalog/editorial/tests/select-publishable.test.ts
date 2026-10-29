import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { selectPublishableCatalog } from "../select-publishable.js";
import { createEditorialTestApproval, EDITORIAL_PROVIDERS, EDITORIAL_SOURCES, prepareEditorialCohort } from "./editorial-cohort-fixtures.js";

const preparations = await prepareEditorialCohort("-base");
const approved = createEditorialTestApproval(preparations);

const replaceEntry = (providerId: string, reference: string, transform: (
  item: (typeof preparations)[number]["products"][number]
) => (typeof preparations)[number]["products"][number]) => preparations.map((preparation) => ({
  ...preparation,
  products: preparation.source.providerId === providerId
    ? preparation.products.map((item) => item.product.reference === reference ? transform(item) : item)
    : preparation.products
}));

test("la acreditación editorial selecciona fichas listas sin alterar muestras ni incorporar contradicciones", async () => {
  const originals = await Promise.all(EDITORIAL_PROVIDERS.map((providerId) => readCanonicalCatalog(EDITORIAL_SOURCES[providerId])));
  const originalSnapshot = JSON.stringify(originals);
  const preparationSnapshot = JSON.stringify(preparations);
  const result = approved.select();
  const original = originals.reduce((sum, item) => sum + item.products.length, 0);
  assert.deepEqual(result.totals, {
    original, ready: original - 5, review: 5, publishable: original - 8, excluded: 8
  });
  assert.deepEqual(result.exclusions.map(({ providerId, reference }) => `${providerId}:${reference}`), [
    "gam:6682", "gam:6703", "gam:6764", "gam:157", "gam:6002", "gam:6003", "gam:6004",
    "mercaeleva:M827-8304"
  ]);
  assert.equal(new Set(result.products.map(({ providerId, reference }) => `${providerId}:${reference}`)).size, result.products.length);
  assert.ok(result.products.every(({ providerId, reference }) =>
    !result.exclusions.some((entry) => entry.providerId === providerId && entry.reference === reference)));
  assert.ok(result.exclusions.every((entry) => entry.reason && entry.evidenceUrls.length && entry.issues.length));
  assert.equal(JSON.stringify(originals), originalSnapshot);
  assert.equal(JSON.stringify(preparations), preparationSnapshot);
});

test("las contradicciones siguen en review y los valores no representables conservan su origen", () => {
  const gam = preparations.find((entry) => entry.source.providerId === "gam");
  assert.ok(gam);
  for (const reference of ["6764", "157", "2130", "2237", "2240"]) {
    const entry: (typeof gam.products)[number] | undefined = gam.products.find((item) => item.product.reference === reference);
    assert.ok(entry, reference);
    assert.equal(entry.status, ["6764", "157"].includes(reference) ? "review" : "ready", reference);
    assert.equal(entry.issues.length > 0, ["6764", "157"].includes(reference), reference);
    assert.equal(entry.product.categorySellID, null);
    assert.deepEqual(entry.product.attributes, []);
    assert.ok(Object.keys(entry.product.spec).length > 0, reference);
  }
  const contradictions = gam.products.find((item) => item.product.reference === "6764");
  assert.ok(contradictions);
  assert.ok(contradictions.issues.includes("Atributo contradictorio: Altura de elevación"));
  const nonNumeric = gam.products.find((item) => item.product.reference === "2130");
  assert.equal(nonNumeric?.product.spec["Altura de elevación (mm)"], "#VALUE! mm");
  assert.equal(approved.select().totals.excluded, 8);
});

test("las dos Hyster con número de serie compartido siguen pendientes de aprobación individual", () => {
  const result = approved.select();
  const colliding = result.exclusions.filter((item) => ["6682", "6703"].includes(item.reference));
  assert.equal(colliding.length, 2);
  assert.ok(colliding.every((item) => item.issues.some((issue) => issue.includes("P177B10585U"))));
  assert.ok(colliding.every((item) => item.providerId === "gam"));
});

test("una review nueva no adquiere autorización por pertenecer a la misma cohorte", () => {
  const mutated = replaceEntry("gam", "6683", (entry) => ({
    ...entry, status: "review", issues: ["Contradicción técnica nueva"]
  }));
  assert.throws(() => approved.select(mutated), /aprobación ausente/);
});

test("una contradicción modificada invalida la decisión editorial anterior", () => {
  const changed = replaceEntry("gam", "6682", (entry) => ({ ...entry, issues: ["Identidad sin evidencia"] }));
  assert.throws(() => approved.select(changed), /decisión ausente/);
});

test("la URL o el estado de una ficha excluida no heredan aprobaciones", () => {
  const changedUrl = replaceEntry("mercaeleva", "M827-8304", (entry) => ({
    ...entry, product: { ...entry.product, sourceUrl: `${entry.product.sourceUrl}?revision=2` }
  }));
  assert.throws(() => approved.select(changedUrl), /decisión ausente/);
  const changedQuality = replaceEntry("gam", "6703", (entry) => ({ ...entry, status: "ready", issues: [] }));
  assert.throws(() => approved.select(changedQuality), /aprobación ausente/);
});

test("rechaza fuentes sustituidas, muestras truncadas y referencias repetidas", () => {
  const alteredSource = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, source: { ...preparation.source, catalogSha256: "a".repeat(64) } });
  assert.throws(() => approved.select(alteredSource), /preparación no admitida/);
  const incomplete = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.slice(1) });
  assert.throws(() => approved.select(incomplete), /aprobación ausente|preparación no admitida/);
  const duplicate = replaceEntry("gam", "6683", (entry) => ({
    ...entry, product: { ...entry.product, reference: "6682" }
  }));
  assert.throws(() => approved.select(duplicate), /duplicada/);
});

test("una cohorte desconocida no entra en el selector legado de hashes fijos", () => {
  assert.throws(() => selectPublishableCatalog(preparations), /cohorte desconocida/);
});

test("la selección acreditada no depende de la elegibilidad del formato Excel", () => {
  const result = approved.select();
  const gam = result.products.filter((product) => product.providerId === "gam");
  assert.equal(gam.length, preparations[0]!.totals.ready - 3);
  assert.ok(gam.some((product) => product.price === null));
});
