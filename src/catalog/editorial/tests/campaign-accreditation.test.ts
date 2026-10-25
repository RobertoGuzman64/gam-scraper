import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createAccreditationDraft, selectAccreditedPublishable, sha256 } from "../campaign-accreditation.js";
import type { AccreditedSource } from "../campaign-accreditation.js";
import { EDITORIAL_PROVIDERS, prepareEditorialCohort } from "./editorial-cohort-fixtures.js";

const preparations = await prepareEditorialCohort("-accreditation");
const sources: readonly AccreditedSource[] = await Promise.all(EDITORIAL_PROVIDERS.map(async (providerId) => {
  const preparation = preparations.find((item) => item.source.providerId === providerId);
  assert.ok(preparation);
  const sourceFile = `storage/prepared/${providerId}/${preparation.source.prefix}-20261022-171552-preparation.json`;
  return {
    providerId,
    catalogSha256: preparation.source.catalogSha256,
    preparationSha256: sha256(await readFile(sourceFile, "utf8")),
    productCount: preparation.source.productCount
  };
}));
const runId = "campana-acreditacion-prueba";
const draft = createAccreditationDraft(preparations, sources, runId);
const approved = {
  ...draft,
  approved: true,
  approvalReason: "Revisadas las incidencias sobre sus publicaciones vigentes.",
  exclusions: draft.exclusions.map((item) => ({
    ...item,
    decision: "excluir",
    reason: "La identidad publicada sigue pendiente de confirmación.",
    evidenceUrls: [item.sourceUrl]
  }))
};

test("prepara borrador de selección sin aprobaciones automáticas", () => {
  assert.equal(draft.approved, false);
  assert.equal(draft.approvalReason, null);
  assert.equal(draft.exclusions.length, 6);
  assert.ok(draft.exclusions.every((item) => item.decision === null && item.reason === null));
  assert.throws(() => selectAccreditedPublishable(preparations, sources, runId, draft, sha256(JSON.stringify(draft))), /aprobación ausente/);
});

test("selecciona solo ready sin contradicciones acreditadas y conserva imágenes originales", () => {
  const result = selectAccreditedPublishable(preparations, sources, runId, approved, sha256(JSON.stringify(approved)));
  assert.deepEqual(result.totals, { original: 1369, ready: 1366, review: 3, excluded: 6, publishable: 1363 });
  assert.deepEqual(result.exclusions.map((item) => `${item.providerId}:${item.reference}`), [
    "gam:6682", "gam:6703", "gam:6002", "gam:6003", "gam:6004", "mercaeleva:M827-8304"
  ]);
  const original = preparations[0]?.products.find((entry) => entry.product.reference === "4988")?.product;
  const selected = result.products.find((item) => item.providerId === "gam" && item.reference === "4988");
  assert.ok(original && selected);
  assert.deepEqual(selected.images, original.images);
});

test("rechaza huellas, lote y decisiones que no coinciden con la campaña", () => {
  assert.throws(() => selectAccreditedPublishable(preparations, sources, "otro-lote", approved, sha256(JSON.stringify(approved))), /vinculada/);
  assert.throws(() => selectAccreditedPublishable(preparations, sources, runId, {
    ...approved, sources: sources.map((source) => ({ ...source, preparationSha256: "a".repeat(64) }))
  }, sha256(JSON.stringify(approved))), /vinculada/);
  assert.throws(() => selectAccreditedPublishable(preparations, sources, runId, {
    ...approved, exclusions: approved.exclusions.slice(1)
  }, sha256(JSON.stringify(approved))), /vinculada/);
  assert.throws(() => selectAccreditedPublishable(preparations, sources, runId, {
    ...approved, exclusions: approved.exclusions.map((item, i) => i === 0 ? { ...item, evidenceUrls: [] } : item)
  }, sha256(JSON.stringify(approved))), /decisión ausente/);
  assert.throws(() => selectAccreditedPublishable(preparations, sources, runId, {
    ...approved, exclusions: approved.exclusions.map((item, i) => i === 0 ? { ...item, issues: ["sin evidencia"] } : item)
  }, sha256(JSON.stringify(approved))), /decisión ausente/);
});

test("bloquea una revisión nueva no acreditada", () => {
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gomariz" ? preparation : {
    ...preparation,
    totals: { ready: 142, review: 1 },
    products: preparation.products.map((entry, i) => i === 0
      ? { ...entry, status: "review" as const, issues: ["Identidad no acreditada"] }
      : entry)
  });
  assert.throws(() => selectAccreditedPublishable(changed, sources, runId, approved, sha256(JSON.stringify(approved))), /aprobación ausente/);
});

test("una ficha intervenida y lista exige aprobación individual antes de incluirse", () => {
  const gam = preparations.find((item) => item.source.providerId === "gam");
  assert.ok(gam);
  const product = gam.products.find((entry) => entry.product.reference === "4988");
  assert.ok(product && product.status === "ready");
  const source = sources.find((item) => item.providerId === "gam");
  assert.ok(source);
  const intervention = {
    campaign: "revision-manual",
    sourceCatalogSha256: source.catalogSha256,
    planSha256: "a".repeat(64), derivedCatalogSha256: "b".repeat(64),
    affectedReferences: ["4988"]
  };
  const modifiedSources = sources.map((item) => item.providerId !== "gam" ? item : {
    ...item, intervention
  });
  const modifiedPreparations = preparations.map((item) => item.source.providerId !== "gam" ? item : {
    ...item,
    source: { ...item.source, catalogSha256: intervention.derivedCatalogSha256, intervention: {
      campaign: intervention.campaign, sourceCatalogSha256: intervention.sourceCatalogSha256,
      planSha256: intervention.planSha256, derivedCatalogSha256: intervention.derivedCatalogSha256
    } }
  });
  const changedDraft = createAccreditationDraft(modifiedPreparations, modifiedSources, runId);
  const pending = changedDraft.exclusions.find((item) => item.providerId === "gam" && item.reference === "4988");
  assert.ok(pending);
  assert.equal(pending.status, "intervention");
  const approveAllExceptChanged = {
    ...changedDraft, approved: true, approvalReason: "Revisión editorial de las seis incidencias y cambio manual.",
    exclusions: changedDraft.exclusions.map((item) => ({
      ...item,
      decision: item.status === "intervention" ? null : "excluir",
      reason: "Revisión de identidad según la fuente vigente del proveedor.",
      evidenceUrls: [item.sourceUrl]
    }))
  };
  assert.throws(() => selectAccreditedPublishable(
    modifiedPreparations, modifiedSources, runId, approveAllExceptChanged,
    sha256(JSON.stringify(approveAllExceptChanged))
  ), /decisión ausente/);
  const approvedChanges = {
    ...approveAllExceptChanged,
    exclusions: approveAllExceptChanged.exclusions.map((item) => ({
      ...item, decision: item.status === "intervention" ? "incluir" : "excluir"
    }))
  };
  const selection = selectAccreditedPublishable(
    modifiedPreparations, modifiedSources, runId, approvedChanges, sha256(JSON.stringify(approvedChanges))
  );
  assert.equal(selection.totals.publishable, 1363);
  assert.ok(selection.products.some((item) => item.providerId === "gam" && item.reference === "4988"));
  assert.ok(selection.accreditation?.preparationSources.some((entry) => entry.providerId === "gam"));

  const incorrect = {
    ...approvedChanges,
    exclusions: approvedChanges.exclusions.map((item) => item.reference !== "6682" ? item : { ...item, decision: "incluir" })
  };
  assert.throws(() => selectAccreditedPublishable(
    modifiedPreparations, modifiedSources, runId, incorrect, sha256(JSON.stringify(incorrect))
  ), /decisión ausente/);

  const changedPlan = modifiedSources.map((item) => item.providerId !== "gam" ? item : {
    ...item, intervention: { ...intervention, planSha256: "c".repeat(64) }
  });
  assert.throws(() => selectAccreditedPublishable(
    modifiedPreparations, changedPlan, runId, approvedChanges, sha256(JSON.stringify(approvedChanges))
  ), /vinculada/);
});
