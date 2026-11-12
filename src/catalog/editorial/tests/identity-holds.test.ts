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

test("GAM 6002 y 6003 están reconciliadas y 6004 conserva su conflicto de identidad", async () => {
  for (const reference of ["6002", "6003"]) {
    const entry = get(reference);
    assert.equal(entry.status, "ready", reference);
    assert.deepEqual(entry.issues, [], reference);
    assert.equal(entry.product.spec.Marca, "HYSTER", reference);
    assert.deepEqual(gamNewForkliftIdentityIssues(entry.product), [], reference);
  }
  const unresolved = get("6004");
  assert.equal(unresolved.status, "ready");
  assert.equal(unresolved.product.spec.Marca, "YALE");
  assert.equal(unresolved.product.spec.Modelo, "J7.0XTG6");
  const issues = gamNewForkliftIdentityIssues(unresolved.product);
  assert.ok(issues.some((issue) => issue.includes("marca HYSTER en anuncio y YALE en ficha técnica")));
  assert.ok(issues.some((issue) => issue.includes("modelo anunciado distinto")));
  const original = await readCanonicalCatalog(sources.gam);
  for (const reference of ["6002", "6003", "6004"]) {
    assert.equal(original.products.find((item) => item.reference === reference)?.specs?.Marca, "YALE", reference);
  }
  assert.equal(original.products.find((item) => item.reference === "6004")?.specs?.Modelo, "J7.0XTG6");
});

test("una identidad alterada, una ruta distinta o una review nueva caducan la decisión", () => {
  const altered = replaceGam("6004", (entry) => ({
    ...entry, product: { ...entry.product, spec: { ...entry.product.spec, Marca: "HYSTER" } }
  }));
  assert.throws(() => approved.select(altered), /decisión ausente|aprobación ausente/);
  const changedUrl = replaceGam("6004", (entry) => ({
    ...entry, product: { ...entry.product, sourceUrl: `${entry.product.sourceUrl}?otro=1` }
  }));
  assert.throws(() => approved.select(changedUrl), /decisión ausente|aprobación ausente/);
  const changedStatus = replaceGam("6002", (entry) => ({
    ...entry, status: "review", issues: ["Identidad todavía contradictoria"]
  }));
  assert.throws(() => approved.select(changedStatus), /decisión ausente|aprobación ausente/);
  for (const reference of ["6002", "6003"]) {
    const contradicted = replaceGam(reference, (entry) => ({
      ...entry, product: { ...entry.product, spec: { ...entry.product.spec, Marca: "YALE" } }
    }));
    assert.throws(() => approved.select(contradicted), /aprobación ausente/, reference);
  }
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
