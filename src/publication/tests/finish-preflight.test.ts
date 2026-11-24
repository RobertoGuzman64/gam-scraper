import assert from "node:assert/strict";
import { lstat, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { classifyFinishAbsences } from "../finish-preflight-diagnostics.js";
import { runPublishIndividual } from "../../cli/commands/catalog/publish-individual.js";
import { inspectIndividualFinishPreflight } from "../finish-preflight.js";
import { prepareIndividualTestWorkspace } from "../../testing/builders/individual-workspace-fixture.js";
import { createIndividualFinishWorkspace, finishProviders } from "../../testing/builders/individual-finish-fixture.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { OfflinePreparation } from "../../preparation/documents/offline-document.js";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";

const withWorkspace = createIndividualFinishWorkspace();

const publication = (reference: string, sourceUrl = `https://example.test/${reference}`): ImportCandidate => ({
  providerId: "gam", reference, sourceUrl, title: "Máquina", categorySellID: 1, category: "Industrial",
  condition: "Nuevo", price: 100, description_title: "Máquina", description: "Descripción",
  description_general: "Descripción general", image: null, images: [], spec: { Horómetro: "100" }, attributes: []
});

const original = (reference: string, url = `https://example.test/${reference}`): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación", url, reference, title: "Máquina",
  shortDescription: "Resumen", longDescription: "Descripción", price: null, brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null
});

const preparation = (entries: readonly { readonly item: ImportCandidate; readonly status: "ready" | "review" }[]): OfflinePreparation => ({
  version: 1, quality: "complete", published: true, preparedAt: "2026-11-16T10:00:00Z",
  source: { providerId: "gam", prefix: "scrape-gam", scope: "0123456789abcdef", catalogSha256: "a".repeat(64), productCount: entries.length },
  fingerprints: { rulesVersion: 2, rulesSha256: "b".repeat(64) },
  totals: { ready: entries.filter((entry) => entry.status === "ready").length, review: entries.filter((entry) => entry.status === "review").length },
  identities: entries.map((entry) => `gam:${entry.item.reference}`),
  products: entries.map((entry) => ({ product: entry.item, status: entry.status,
    issues: entry.status === "review" ? ["Incidencia acreditable"] : [] }))
});

const approval: CampaignAccreditation = {
  version: 1, runId: "individual-gam-0123456789abcdef0123456789abcdef", approved: true,
  approvalReason: "Aprobación expresa de un cambio acreditado", sources: [],
  exclusions: [{ providerId: "gam", reference: "excluida", sourceUrl: "https://example.test/excluida", status: "review",
    issues: ["Incidencia acreditable"], decision: "excluir", reason: "Evidencia acreditada en el origen", evidenceUrls: ["https://example.test/excluida"] }]
};

test("ausencias por referencia conservan motivos y no equivalen automáticamente a bajas", () => {
  const previous = [publication("desaparecida"), publication("revisar"), publication("excluida"),
    publication("variante", "https://example.test/referenciada"), publication("pendiente")];
  const entries = [
    { item: publication("revisar"), status: "review" as const },
    { item: publication("excluida"), status: "review" as const },
    { item: publication("pendiente"), status: "ready" as const }
  ];
  const source = [...entries.map((entry) => original(entry.item.reference ?? "")),
    original("otra-referencia", "https://example.test/referenciada")];
  const classified = classifyFinishAbsences(previous, source, preparation(entries), [], approval);
  assert.deepEqual(classified.map((entry) => [entry.reference, entry.classification]), [
    ["desaparecida", "ausente_origen"], ["revisar", "review"], ["excluida", "exclusion_acreditada"],
    ["variante", "variante_posible"], ["pendiente", "no_seleccionado"]
  ]);
  const selected = [publication("pendiente"), publication("revisar")];
  const accepted = classifyFinishAbsences(previous, source, preparation(entries), selected, approval);
  assert.equal(accepted.find((entry) => entry.reference === "excluida")?.classification, "exclusion_acreditada");
  assert.ok(!accepted.some((entry) => entry.reference === "pendiente"));
  const unavailable = classifyFinishAbsences([publication("desaparecida")], null, null, null, null);
  assert.equal(unavailable[0]?.classification, "comparacion_imposible");
});

test("preflight sin preparación recorre los tres proveedores y no genera decisiones ni storage", async () => {
  await withWorkspace(async (root, desktop) => {
    const before = await readdir(root);
    const result = await inspectIndividualFinishPreflight(root, finishProviders);
    assert.equal(result.complete, false);
    assert.deepEqual(result.providers.map((entry) => entry.providerId), finishProviders);
    assert.ok(result.providers.every((entry) => entry.blockers.some((blocker) => blocker.step === "preparacion")));
    assert.ok(result.providers.every((entry) => entry.original?.count && entry.published === null));
    assert.deepEqual(await readdir(root), before);
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage")), { code: "ENOENT" });
  }, "original");
});

test("FINISH productivo diagnostica los tres proveedores sin abrir diario", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(runPublishIndividual([], root, { desktopDirectory: desktop }),
      /FINISH \/ PREFLIGHT BLOQUEADO.*3 proveedores/s);
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage")), { code: "ENOENT" });
  }, "original");
});

test("varias incidencias GAM se notifican separadas y no se omiten los otros proveedores", async () => {
  await withWorkspace(async (root, desktop) => {
    await prepareIndividualTestWorkspace(root);
    const before = await readdir(desktop);
    const result = await inspectIndividualFinishPreflight(root, finishProviders);
    const gam = result.providers[0];
    assert.equal(result.complete, false);
    if (!gam) throw new Error("GAM ausente del preflight");
    assert.ok(gam.blockers.filter((item) => item.step === "acreditacion" && item.reference !== null).length >= 2);
    assert.ok(result.providers.every((item) => item.original !== null && item.preparation !== null));
    assert.deepEqual(await readdir(desktop), before);
    for (const id of finishProviders) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
  }, "original");
});

test("con acreditación legítima los tres proveedores son evaluables en simulación sin publicar", async () => {
  await withWorkspace(async (root, desktop) => {
    const before = await readdir(desktop);
    const report = await inspectIndividualFinishPreflight(root, finishProviders);
    assert.equal(report.complete, true, JSON.stringify(report.providers.map((item) => item.blockers)));
    assert.ok(report.providers.every((item) => item.evaluable && item.candidate && item.difference && item.blockers.length === 0));
    assert.deepEqual(await readdir(desktop), before);
    for (const id of finishProviders) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
  });
});

test("origen inválido informa del proveedor afectado sin detener los otros dos", async () => {
  await withWorkspace(async (root) => {
    await rm(join(root, "catalogs", "providers", "gomariz", "original", "scrape-gomariz-catalog.manifest.json"));
    const report = await inspectIndividualFinishPreflight(root, finishProviders);
    assert.equal(report.complete, false);
    assert.ok(report.providers[1]?.blockers.some((entry) => entry.step === "origen"));
    assert.ok(report.providers[0]?.evaluable);
    assert.ok(report.providers[2]?.evaluable);
  });
});
