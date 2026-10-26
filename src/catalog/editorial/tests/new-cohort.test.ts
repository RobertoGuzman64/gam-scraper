import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../campaign-accreditation.js";
import { isNewEditorialCohort, selectPublishableCatalog } from "../select-publishable.js";
import { createEditorialTestApproval, prepareEditorialCohort } from "./editorial-cohort-fixtures.js";

const originals = await prepareEditorialCohort("-new-routes");
const changedIdentityRoutes = new Set(["6002", "6003", "6004"]);
const preparations = originals.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
  ...preparation,
  products: preparation.products.map((entry) => !changedIdentityRoutes.has(entry.product.reference ?? "") ? entry : {
    ...entry,
    product: {
      ...entry.product,
      sourceUrl: entry.product.sourceUrl.replace(
        "/es/hyster/", "/es/carretillas-elevadoras-electricas-hyster/"
      )
    }
  })
});
const approved = createEditorialTestApproval(preparations);

test("las rutas Hyster actualizadas retienen las tres identidades y no requieren hashes históricos", () => {
  const result = approved.select();
  const exclusions = result.exclusions.filter((item) => changedIdentityRoutes.has(item.reference));
  assert.equal(exclusions.length, 3);
  assert.ok(exclusions.every(({ sourceUrl, evidenceUrls, issues }) =>
    sourceUrl.includes("/es/carretillas-elevadoras-electricas-hyster/") &&
    evidenceUrls.includes(sourceUrl) &&
    issues.some((issue) => issue.includes("marca HYSTER en anuncio y YALE en ficha técnica"))));
  assert.equal(result.totals.publishable, result.totals.original - 6);
  assert.equal(result.products.filter((item) => item.providerId === "gomariz").length,
    originals.find((item) => item.source.providerId === "gomariz")?.products.length);
});

test("el selector histórico rechaza una cohorte distinta aunque las rutas sean conocidas", () => {
  assert.equal(isNewEditorialCohort(preparations), false);
  assert.throws(() => selectPublishableCatalog(preparations), /cohorte desconocida/);
});

test("una ruta diferente caduca la decisión que aprobó la fuente exacta", () => {
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "6002"
      ? { ...entry, product: { ...entry.product, sourceUrl: entry.product.sourceUrl.replace(
        "/carretillas-elevadoras-electricas-hyster/", "/carretillas-elevadoras-diesel-hyster/") } }
      : entry) });
  assert.throws(() => approved.select(changed), /decisión ausente|aprobación ausente/);
  const alternate = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "6003"
      ? { ...entry, product: { ...entry.product, sourceUrl: entry.product.sourceUrl.replace(
        "/carretillas-elevadoras-electricas-hyster/", "/hyster/") } }
      : entry) });
  assert.throws(() => approved.select(alternate), /decisión ausente|aprobación ausente/);
});

test("la aprobación no permite mezclar el origen ni añadir reviews sin decisión", () => {
  const mixed = preparations.map((preparation) => preparation.source.providerId !== "gomariz"
    ? preparation
    : { ...preparation, source: { ...preparation.source, catalogSha256: "a".repeat(64) } });
  assert.throws(() => approved.select(mixed), /preparación no admitida/);
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gomariz" ? preparation : {
    ...preparation,
    products: preparation.products.map((entry) => entry.product.reference === "TE1858"
      ? { ...entry, status: "review" as const, issues: ["Altura no acreditada"] }
      : entry)
  });
  assert.throws(() => approved.select(changed), /aprobación ausente/);
});

test("galerías y descripciones son parte de la huella de preparación, no evidencia reutilizable", () => {
  const modified = preparations.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
    ...preparation,
    products: preparation.products.map((entry) => entry.product.reference === "4988"
      ? { ...entry, product: { ...entry.product, images: entry.product.images.slice(0, -1) } }
      : entry)
  });
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
    ...preparation,
    products: preparation.products.map((entry) => entry.product.reference === "5996"
      ? { ...entry, product: { ...entry.product, description: `${entry.product.description} ` } }
      : entry)
  });
  assert.notEqual(sha256(JSON.stringify(modified)), sha256(JSON.stringify(preparations)));
  assert.notEqual(sha256(JSON.stringify(changed)), sha256(JSON.stringify(preparations)));
});
