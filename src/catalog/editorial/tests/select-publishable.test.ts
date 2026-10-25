import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { selectPublishableCatalog } from "../select-publishable.js";
import { EDITORIAL_PROVIDERS, EDITORIAL_SOURCES, prepareEditorialCohort } from "./editorial-cohort-fixtures.js";

const sourceFiles = EDITORIAL_SOURCES;
const sources = EDITORIAL_PROVIDERS;
const preparations = await prepareEditorialCohort("-f48");

const replaceEntry = (providerId: string, reference: string, transform: (
  item: (typeof preparations)[number]["products"][number]
) => (typeof preparations)[number]["products"][number]) => preparations.map((preparation) => ({
  ...preparation,
  products: preparation.source.providerId === providerId
    ? preparation.products.map((item) => item.product.reference === reference ? transform(item) : item)
    : preparation.products
}));

test("selección editorial preserva 1369 referencias y publica 1363 fichas tras retener tres identidades contradictorias", async () => {
  const originalRecords = await Promise.all(sources.map(async (providerId) =>
    readCanonicalCatalog(sourceFiles[providerId])));
  const originalSnapshot = JSON.stringify(originalRecords);
  const preparationSnapshot = JSON.stringify(preparations);
  const result = selectPublishableCatalog(preparations);
  assert.deepEqual(result.totals, { original: 1369, ready: 1366, review: 3, publishable: 1363, excluded: 6 });
  assert.deepEqual(result.exclusions.map(({ providerId, reference }) => `${providerId}:${reference}`), [
    "gam:6682", "gam:6703", "gam:6002", "gam:6003", "gam:6004", "mercaeleva:M827-8304"
  ]);
  assert.equal(new Set(result.products.map(({ providerId, reference }) => `${providerId}:${reference}`)).size, 1363);
  assert.ok(result.products.every(({ providerId, reference }) =>
    !result.exclusions.some((entry) => entry.providerId === providerId && entry.reference === reference)));
  assert.ok(result.exclusions.every((entry) => entry.reason && entry.evidenceUrls.length && entry.issues.length));
  assert.equal(JSON.stringify(originalRecords), originalSnapshot);
  assert.equal(JSON.stringify(preparations), preparationSnapshot);
  assert.deepEqual(preparations.map(({ totals }) => totals), [
    { ready: 1006, review: 2 }, { ready: 143, review: 0 }, { ready: 217, review: 1 }
  ]);
});

test("las Hyster no se consolidan y el número de serie contradictorio sigue en las incidencias", () => {
  const result = selectPublishableCatalog(preparations);
  const hyster = result.exclusions.filter((item) => item.providerId === "gam");
  assert.equal(hyster.length, 5);
  const colliding = hyster.filter((item) => ["6682", "6703"].includes(item.reference));
  assert.equal(colliding.length, 2);
  assert.ok(colliding.every((item) => item.issues.some((issue) => issue.includes("P177B10585U"))));
  assert.ok(colliding.every((item) => item.reason.includes("identidad física")));
});

test("bloquea nuevas reviews incluso si pertenecen a una referencia válida", () => {
  const mutated = replaceEntry("gam", "6683", (entry) => ({
    ...entry, status: "review", issues: ["Contradicción técnica nueva"]
  }));
  assert.throws(() => selectPublishableCatalog(mutated), /review sin exclusión acreditada/);
});

test("bloquea exclusiones de referencia sin contradicción", () => {
  const changed = replaceEntry("gam", "6682", (entry) => ({ ...entry, issues: ["Sin datos"] }));
  assert.throws(() => selectPublishableCatalog(changed), /review sin exclusión acreditada/);
});

test("bloquea URL cambiada o estados ready heredados por una ficha excluida", () => {
  const changedUrl = replaceEntry("mercaeleva", "M827-8304", (entry) => ({
    ...entry, product: { ...entry.product, sourceUrl: `${entry.product.sourceUrl}?revision=2` }
  }));
  assert.throws(() => selectPublishableCatalog(changedUrl), /review sin exclusión acreditada/);
  const changedQuality = replaceEntry("gam", "6703", (entry) => ({ ...entry, status: "ready", issues: [] }));
  assert.throws(() => selectPublishableCatalog(changedQuality), /decisión caducada/);
});

test("bloquea catálogos distintos, faltantes, duplicados o incompletos", () => {
  assert.throws(() => selectPublishableCatalog(preparations.slice(0, 2)), /faltan proveedores/);
  assert.throws(() => selectPublishableCatalog([...preparations, preparations[0]!]), /cohorte desconocida/);
  const changedSource = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, source: { ...preparation.source, catalogSha256: "a".repeat(64) } });
  assert.throws(() => selectPublishableCatalog(changedSource), /cohorte desconocida/);
  const truncated = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.slice(1) });
  assert.throws(() => selectPublishableCatalog(truncated), /cohorte desconocida/);
  const duplicate = replaceEntry("gam", "6683", (entry) => ({
    ...entry, product: { ...entry.product, reference: "6684" }
  }));
  assert.throws(() => selectPublishableCatalog(duplicate), /referencia inválida o repetida/);
});

test("el criterio editorial no depende de elegibilidad Excel/createMany", () => {
  const result = selectPublishableCatalog(preparations);
  const gam = result.products.filter((product) => product.providerId === "gam");
  assert.equal(gam.length, 1003);
  assert.ok(gam.some((product) => product.price === null));
});
