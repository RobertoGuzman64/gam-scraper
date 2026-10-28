import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { gamNewForkliftIdentityIssues } from "../providers/gam/new-forklift-identity.js";
import { createEditorialTestApproval, EDITORIAL_SOURCES, prepareEditorialCohort } from "./editorial-cohort-fixtures.js";

const sources = EDITORIAL_SOURCES;
const preparations = await prepareEditorialCohort("-identity-holds");
const approved = createEditorialTestApproval(preparations);
const gam = preparations.find((item) => item.source.providerId === "gam");
assert.ok(gam);
const get = (reference: string) => {
  const entry = gam.products.find((item) => item.product.reference === reference);
  assert.ok(entry, reference);
  return entry;
};
const replaceGam = (reference: string, transform: (entry: ReturnType<typeof get>) => ReturnType<typeof get>) =>
  preparations.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
    ...preparation,
    products: preparation.products.map((entry) => entry.product.reference === reference ? transform(entry) : entry)
  });

test("GAM 6002, 6003 y 6004 tienen inconsistencias acreditadas sin forzar HYSTER en sus specs", async () => {
  const source = preparations.find((item) => item.source.providerId === "gam");
  assert.ok(source);
  for (const reference of ["6002", "6003", "6004"]) {
    const entry = get(reference);
    assert.equal(entry.status, "ready");
    assert.equal(entry.product.spec["Marca"], "YALE");
    const issues = gamNewForkliftIdentityIssues(entry.product);
    assert.ok(issues.some((issue) => issue.includes("marca HYSTER en anuncio y YALE en ficha técnica")), reference);
    assert.equal(issues.some((issue) => issue.includes("modelo anunciado distinto")), reference === "6004", reference);
  }
  const original = await readCanonicalCatalog(sources.gam);
  assert.equal(original.products.find((item) => item.reference === "6004")?.specs?.["Modelo"], "J7.0XTG6");
});

test("mantiene GAM 6236 reconciliada y excluye 6002, 6003 y 6004 por identidad Hyster/Yale", () => {
  const result = approved.select(preparations);
  const total = preparations.reduce((sum, item) => sum + item.source.productCount, 0);
  assert.deepEqual(result.totals, { original: total, ready: total - 8, review: 8, publishable: total - 11, excluded: 11 });
  const retained = result.exclusions.filter(({ reference }) => ["6002", "6003", "6004"].includes(reference));
  assert.deepEqual(retained.map(({ reference }) => reference), ["6002", "6003", "6004"]);
  assert.ok(retained.every(({ issues, evidenceUrls, reason }) => issues.length > 0 && evidenceUrls.length === 1 && reason));
  const snorkel = result.products.find((item) => item.providerId === "gam" && item.reference === "6236");
  assert.ok(snorkel);
  assert.equal(snorkel.title, "Plataforma tijera eléctrica 12M SNORKEL S4732E");
  assert.equal(snorkel.spec["Nº de serie"], "S4732E-01-180200369");
  assert.equal(result.products.some((item) => ["6002", "6003", "6004"].includes(item.reference ?? "")), false);
});

test("una marca técnica corregida, un cambio de ruta o una review nueva caducan la decisión", () => {
  const corrected = replaceGam("6002", (entry) => ({
    ...entry, product: { ...entry.product, spec: { ...entry.product.spec, Marca: "HYSTER" } }
  }));
  assert.throws(() => approved.select(corrected), /decisión ausente|aprobación ausente/);
  const changedUrl = replaceGam("6003", (entry) => ({
    ...entry, product: { ...entry.product, sourceUrl: `${entry.product.sourceUrl}?otro=1` }
  }));
  assert.throws(() => approved.select(changedUrl), /decisión ausente|aprobación ausente/);
  const changedStatus = replaceGam("6004", (entry) => ({
    ...entry, status: "review", issues: ["Identidad todavía contradictoria"]
  }));
  assert.throws(() => approved.select(changedStatus), /decisión ausente|aprobación ausente/);
});

test("una contradicción nueva y sin exclusión acreditada bloquea la selección", () => {
  const other = gam.products.find((entry) => entry.status === "ready" &&
    !["6002", "6003", "6004"].includes(entry.product.reference ?? "") &&
    entry.product.sourceUrl.includes("/es/hyster/") && entry.product.spec["Marca"] === "HYSTER" &&
    /carretilla/i.test(entry.product.title ?? ""));
  assert.ok(other);
  const reference = other.product.reference;
  assert.ok(reference);
  const changed = replaceGam(reference, (entry) => ({
    ...entry, product: { ...entry.product, spec: { ...entry.product.spec, Marca: "YALE" } }
  }));
  assert.throws(() => approved.select(changed), /aprobación ausente/);
});

test("reconoce tanto las rutas Hyster/Yale anteriores como las actuales sin admitir categorías ajenas", () => {
  const current = get("6004").product;
  const newRoute = {
    ...current,
    sourceUrl: current.sourceUrl.replace("/es/hyster/", "/es/carretillas-elevadoras-electricas-hyster/")
  };
  assert.deepEqual(gamNewForkliftIdentityIssues(newRoute), gamNewForkliftIdentityIssues(current));
  const invalid = {
    ...current,
    sourceUrl: current.sourceUrl.replace("/es/hyster/", "/es/carretillas-elevadoras-diesel-hyster/")
  };
  assert.deepEqual(gamNewForkliftIdentityIssues(invalid), []);
  const yale = get("5995").product;
  const newYaleRoute = {
    ...yale,
    sourceUrl: yale.sourceUrl.replace("/es/yale/", "/es/carretillas-elevadoras-electricas-yale/")
  };
  assert.deepEqual(gamNewForkliftIdentityIssues(newYaleRoute), []);
});

test("no interpreta como contradicción de marca las variaciones de modelo de otras fichas", () => {
  for (const reference of ["6274", "6322", "6323", "6324", "6325", "6326", "6327", "6422", "6574"]) {
    assert.deepEqual(gamNewForkliftIdentityIssues(get(reference).product), [], reference);
  }
});
