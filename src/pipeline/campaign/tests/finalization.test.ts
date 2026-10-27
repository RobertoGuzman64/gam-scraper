import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/offline-preparation.js";
import { persistAppliedIntervention } from "../../../infrastructure/filesystem/intervention-application.js";
import { reviewActiveCampaign } from "../review.js";
import { interveneActiveCampaign } from "../intervention.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog, reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import type { ProviderRun, BatchReport } from "../../batch/report-types.js";

const sourceRoot = resolve("src/testing/fixtures");
const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
} as const;

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-f4-"));
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campanas", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(sourceRoot, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const runFile = join(root, "storage", "runs", runId, "run.json");
  const run: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
  };
  await mkdir(dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify(run));
  const review = await reviewActiveCampaign(root);
  assert.equal(review.complete, true, JSON.stringify(review.providers));
  return { root, runId, providers, review, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

const approveDraft = async (path: string) => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  const approved = {
    ...draft, approved: true, approvalReason: "Exclusiones y correcciones revisadas por una persona responsable.",
    exclusions: draft.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
      ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
      reason: "Ficha contrastada con su fuente y revisada manualmente.",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  await writeFile(path, JSON.stringify(approved, null, 2));
  return approved;
};

const campaignScript = async (root: string, runId: string): Promise<string> => {
  const catalogFile = join(root, "storage", "scraped", "campanas", runId, "gam", `${prefixes.gam}-catalog.json`);
  const catalog = await readCanonicalCatalog(catalogFile);
  const product = catalog.products.find((entry) => entry.title !== null);
  assert.ok(product);
  const folder = join(root, "storage", "interventions", runId, "scripts");
  await mkdir(folder, { recursive: true });
  const file = join(folder, "correccion.ts");
  await writeFile(file, `export const proposals = ${JSON.stringify([{
    providerId: "gam", identity: buildProductIdentity(product).key, field: "title",
    expected: product.title, next: `${product.title} contrastada`,
    reason: "Corrección editorial acordada para esta ficha",
    evidence: "Verificación manual con la ficha de origen publicada"
  }])};`);
  return file;
};

test("elabora borrador del lote sin aprobación automática y selecciona solo al aprobar", async () => {
  const data = await fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    assert.equal(draft.status, "draft");
    assert.ok(draft.draftFile.includes(data.runId));
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    await approveDraft(draft.draftFile);
    const simulated = await finalizeActiveCampaign(data.root, true);
    assert.equal(simulated.status, "simulation");
    assert.ok(simulated.selection);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.ok(selected.selectionDir);
    assert.equal((await finalizeActiveCampaign(data.root, false)).selectionDir, selected.selectionDir);
    const totals = selected.selection?.totals;
    assert.equal(totals?.original, totals?.publishable! + totals?.excluded!);
    const publicables = await Promise.all(CAMPAIGN_PROVIDERS.map(async (id) =>
      JSON.parse(await readFile(join(selected.selectionDir!, `${id}-publishable.json`), "utf8")) as unknown));
    assert.equal(publicables.length, 3);
    assert.ok(publicables.every(Array.isArray));
  } finally { await data.cleanup(); }
});

test("no acepta acreditación incompleta y no crea selección", async () => {
  const data = await fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    const raw = JSON.parse(await readFile(draft.draftFile, "utf8"));
    raw.approved = true;
    raw.approvalReason = "Aprobación sin acreditar decisiones individuales";
    await writeFile(draft.draftFile, JSON.stringify(raw));
    await assert.rejects(finalizeActiveCampaign(data.root, false), /Acreditación editorial/);
  } finally { await data.cleanup(); }
});

test("rechaza un script de otra campaña y requiere autorización explícita para aplicar", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const preview = await interveneActiveCampaign(data.root, "gam", [script], false);
    assert.equal(preview.applied, false);
    assert.ok(preview.simulation);
    assert.equal(preview.simulation.changes.length, 1);
    const oldDir = join(data.root, "storage", "interventions", "otro-lote", "scripts");
    await mkdir(oldDir, { recursive: true });
    const old = join(oldDir, "correccion.ts");
    await copyFile(script, old);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [old], true), /no pertenece al lote actual/);
    const original = data.providers.find((item) => item.providerId === "gam");
    assert.ok(original);
    const originalFile = join(original.outputDir, `${original.outputPrefix}-catalog.json`);
    const before = await readFile(originalFile);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(applied.applied, true);
    assert.ok(applied.derivedFile);
    assert.ok(applied.preparationFile);
    assert.deepEqual(await readFile(originalFile), before);
    assert.ok((await readOfflinePreparation(applied.preparationFile, "gam")).source.intervention);
    const reviewed = await reviewActiveCampaign(data.root);
    assert.equal(reviewed.complete, true, JSON.stringify(reviewed));
    assert.equal(reviewed.providers.find((item) => item.providerId === "gam")?.preparationFile, applied.preparationFile);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [script], true), /ya tiene un origen libre|no tiene un origen libre/);
  } finally { await data.cleanup(); }
});


test("utiliza un script permanente directamente y mantiene el expediente del lote", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const permanent = join(folder, "correccion.ts");
    const source = await readFile(temporal, "utf8");
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Corrección puntual acreditada" };\n${source}`);
    const preview = await interveneActiveCampaign(data.root, "gam", [permanent], false);
    assert.equal(preview.applied, false);
    assert.ok(preview.simulation);
    assert.equal(preview.simulation.changes.length, 1);
    const applied = await interveneActiveCampaign(data.root, "gam", [permanent], true);
    assert.equal(applied.applied, true);
    assert.ok(applied.derivedFile);
    const record = JSON.parse(await readFile(join(dirname(applied.derivedFile), "intervention-record.json"), "utf8"));
    assert.equal(record.campaign, data.runId);
    assert.deepEqual(record.scripts, ["correccion.ts"]);
    assert.equal(record.version, 2);
    assert.equal(record.scriptVersions.length, 1);
    assert.equal(record.scriptVersions[0].id, "gam-correccion");
    assert.match(record.scriptVersions[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "draft");
  } finally { await data.cleanup(); }
});

test("compone intervenciones versionadas en una campaña nueva sin duplicar las corregidas ni ausentes", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const original = await readFile(temporal, "utf8");
    const catalogFile = join(data.root, "storage", "scraped", "campanas", data.runId, "gam", `${prefixes.gam}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogFile);
    const second = catalog.products.find((product) => product.title !== null &&
      buildProductIdentity(product).key !== JSON.parse(original.slice(original.indexOf("["), original.lastIndexOf("]") + 1))[0]?.identity);
    assert.ok(second?.title);
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const scripts = ["pendiente.ts", "corregida.ts", "ausente.ts"].map((name) => join(folder, name));
    await writeFile(scripts[0]!, `export const metadata = { id: "gam-pendiente", summary: "Corrección pendiente" };\n${original}`);
    const asScript = (id: string, entry: object) => `export const metadata = { id: "${id}", summary: "Corrección conocida" };\nexport const proposals = ${JSON.stringify([entry])};`;
    const corrected = {
      providerId: "gam", identity: buildProductIdentity(second).key, field: "title", expected: "Otro título incorrecto",
      next: second.title, reason: "Resuelto en origen", evidence: "Ficha vigente contrastada"
    };
    const absent = { ...corrected, identity: "gam:ref:inexistente", expected: "Título anterior", next: "Título nuevo" };
    await writeFile(scripts[1]!, asScript("gam-corregida", corrected));
    await writeFile(scripts[2]!, asScript("gam-ausente", absent));
    const before = await readFile(catalogFile);
    const preview = await interveneActiveCampaign(data.root, "gam", scripts, false);
    assert.deepEqual(preview.comparison.scripts.map((item) => item.status), ["pending", "corrected", "absent"]);
    assert.equal(preview.simulation?.changes.length, 1);
    const applied = await interveneActiveCampaign(data.root, "gam", scripts, true);
    assert.ok(applied.derivedFile);
    const record = JSON.parse(await readFile(join(dirname(applied.derivedFile), "intervention-record.json"), "utf8"));
    assert.equal(record.version, 2);
    assert.equal(record.scriptVersions.length, 3);
    assert.equal(record.changes.length, 1);
    assert.deepEqual(record.scripts, ["ausente.ts", "corregida.ts", "pendiente.ts"]);
    assert.deepEqual(await readFile(catalogFile), before);
  } finally { await data.cleanup(); }
});

test("bloquea divergencias y alteraciones de scripts permanentes antes de generar resultados", async () => {
  const data = await fixture();
  try {
    const temporal = await campaignScript(data.root, data.runId);
    const original = await readFile(temporal, "utf8");
    const folder = join(data.root, "interventions", "gam");
    await mkdir(folder, { recursive: true });
    const permanent = join(folder, "correccion.ts");
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio de ficha" };\n${original}`);
    let comparison = "";
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [permanent], true, () => {
      writeFileSync(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio alterado" };\n${original}`);
    }), /cambió desde la simulación/);
    const parsed = JSON.parse(original.slice(original.indexOf("["), original.lastIndexOf("]") + 1));
    parsed[0].expected = "Valor incorrecto";
    parsed[0].next = "Valor arbitrario";
    await writeFile(permanent, `export const metadata = { id: "gam-correccion", summary: "Cambio divergente" };\nexport const proposals = ${JSON.stringify(parsed)};`);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [permanent], true, (_sim, state) => {
      comparison = state.scripts[0]?.status ?? "";
    }), /divergentes/);
    assert.equal(comparison, "divergent");
    const result = join(data.root, "storage", "interventions", data.runId, "results");
    await assert.rejects(readFile(join(result, "intervention-record.json")), /ENOENT/);
  } finally { await data.cleanup(); }
});

test("no reutiliza un borrador anterior después de una intervención", async () => {
  const data = await fixture();
  try {
    const initial = await finalizeActiveCampaign(data.root, false);
    await approveDraft(initial.draftFile);
    const script = await campaignScript(data.root, data.runId);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    const updated = await finalizeActiveCampaign(data.root, false);
    assert.equal(updated.status, "draft");
    assert.notEqual(updated.draftFile, initial.draftFile);
    const old = JSON.parse(await readFile(initial.draftFile, "utf8"));
    assert.equal(old.approved, true);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    await approveDraft(updated.draftFile);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.equal(selected.selection?.source.find((item) => item.providerId === "gam")?.intervention?.campaign, data.runId);
  } finally { await data.cleanup(); }
});

test("la manipulación de una preparación intervenida bloquea la finalización", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.ok(applied.preparationFile);
    await writeFile(applied.preparationFile, "{}");
    await assert.rejects(finalizeActiveCampaign(data.root, false), /No se puede finalizar/);
  } finally { await data.cleanup(); }
});


test("recupera un resultado aplicado íntegro tras una interrupción antes de prepararlo", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const preview = await interveneActiveCampaign(data.root, "gam", [script], false);
    const original = data.providers.find((item) => item.providerId === "gam");
    assert.ok(original);
    const source = join(original.outputDir, `${original.outputPrefix}-catalog.json`);
    assert.ok(preview.simulation);
    const pending = await persistAppliedIntervention({
      source, scripts: [script], campaign: data.runId, confirmation: preview.simulation.planSha256,
      simulation: preview.simulation, workspaceRoot: data.root
    });
    const resumed = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(resumed.derivedFile, join(pending.path, "catalog-derived.json"));
    assert.ok(resumed.preparationFile);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "draft");
  } finally { await data.cleanup(); }
});

test("acredita editorialmente una campaña mediante operaciones guiadas sin editar JSON", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial, approveActiveCampaignEditorial } =
      await import("../editorial.js");
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /No existe borrador vigente/);
    const draft = await finalizeActiveCampaign(data.root, false);
    const review = await inspectActiveCampaignEditorial(data.root);
    assert.equal(review.inspection.approved, false);
    assert.equal(review.inspection.completed, 0);
    assert.ok(review.inspection.total > 0);
    assert.equal(review.draftFile, draft.draftFile);
    const entry = review.accreditation.exclusions[0];
    assert.ok(entry);
    await assert.rejects(approveActiveCampaignEditorial(data.root, "Conjunto revisado y acreditado por el responsable."),
      /decisión pendiente/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "incluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: [entry.sourceUrl]
    }), /Solo se admite incluir/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Motivo corto", evidenceUrls: [entry.sourceUrl]
    }), /al menos 15/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: ["https://otro.example/expediente"]
    }), /URL original/);
    for (const item of review.accreditation.exclusions) {
      await decideActiveCampaignEditorial(data.root, {
        providerId: item.providerId, reference: item.reference, decision: "excluir",
        reason: "Contraste editorial individual con la ficha de origen vigente.",
        evidenceUrls: [item.sourceUrl]
      });
    }
    const validated = await inspectActiveCampaignEditorial(data.root);
    assert.equal(validated.inspection.completed, validated.inspection.total);
    assert.deepEqual(validated.inspection.issues, []);
    assert.equal(validated.inspection.approved, false);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    const approved = await approveActiveCampaignEditorial(data.root,
      "Aprobación humana del conjunto completo tras revisar todas las fichas.");
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.issues.length, 0);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: [entry.sourceUrl]
    }), /está aprobada/);
    assert.equal((await finalizeActiveCampaign(data.root, true)).status, "simulation");
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
  } finally { await data.cleanup(); }
});

test("rechaza borradores caducados, estructura adulterada y edición de selecciones existentes", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial, approveActiveCampaignEditorial } =
      await import("../editorial.js");
    const draft = await finalizeActiveCampaign(data.root, false);
    const editorial = await inspectActiveCampaignEditorial(data.root);
    const first = editorial.accreditation.exclusions[0];
    assert.ok(first);
    const content = await readFile(draft.draftFile, "utf8");
    await writeFile(draft.draftFile, `\ufeff${content}`);
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /BOM UTF-8/);
    await writeFile(draft.draftFile, JSON.stringify({
      ...editorial.accreditation,
      exclusions: editorial.accreditation.exclusions.map((item, index) =>
        index === 0 ? { ...item, issues: ["manipulado"] } : item)
    }));
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /caducada/);
    await writeFile(draft.draftFile, content);
    const selectionFolder = join(data.root, "storage", "campanas", data.runId, "seleccion");
    await mkdir(selectionFolder, { recursive: true });
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: first.providerId, reference: first.reference, decision: "excluir",
      reason: "Ficha contrastada manualmente con la publicación vigente.", evidenceUrls: [first.sourceUrl]
    }), /ya tiene selección/);
    await rm(selectionFolder, { recursive: true });
    for (const item of editorial.accreditation.exclusions) {
      await decideActiveCampaignEditorial(data.root, {
        providerId: item.providerId, reference: item.reference, decision: "excluir",
        reason: "Exclusión por incidencia contrastada manualmente.", evidenceUrls: [item.sourceUrl]
      });
    }
    await approveActiveCampaignEditorial(data.root, "Cotejado el conjunto de fichas en la campaña vigente.");
    await finalizeActiveCampaign(data.root, false);
    await assert.rejects(approveActiveCampaignEditorial(data.root, "Una nueva aprobación no corresponde a esta selección."),
      /está aprobada/);
    const selectedContents = await readFile(draft.draftFile, "utf8");
    assert.equal(JSON.parse(selectedContents).approved, true);
  } finally { await data.cleanup(); }
});

test("una intervención nueva invalida la ruta del borrador editorial anterior sin alterar su contenido", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial } = await import("../editorial.js");
    const draft = await finalizeActiveCampaign(data.root, false);
    const original = await readFile(draft.draftFile, "utf8");
    const script = await campaignScript(data.root, data.runId);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /No existe borrador vigente/);
    assert.equal(await readFile(draft.draftFile, "utf8"), original);
    const next = await finalizeActiveCampaign(data.root, false);
    assert.notEqual(next.draftFile, draft.draftFile);
  } finally { await data.cleanup(); }
});

test("los argumentos CLI aplican las decisiones y validan sin aprobar por defecto", async () => {
  const data = await fixture();
  try {
    const { runCampaignFinalization } = await import("../../../cli/campaign-finalize.js");
    const { inspectActiveCampaignEditorial } = await import("../editorial.js");
    await runCampaignFinalization([], data.root);
    const draft = await inspectActiveCampaignEditorial(data.root);
    const entry = draft.accreditation.exclusions[0];
    assert.ok(entry);
    await runCampaignFinalization(["--consultar", entry.providerId, entry.reference], data.root);
    await runCampaignFinalization(["--listar"], data.root);
    await assert.rejects(runCampaignFinalization(["--validar"], data.root), /incidencias editoriales/);
    await runCampaignFinalization(["--decidir", entry.providerId, entry.reference, "excluir",
      "--motivo", "Incidencia verificada manualmente con su fuente original.", "--evidencia", entry.sourceUrl], data.root);
    await assert.rejects(runCampaignFinalization(["--aprobar", "--motivo", "Conjunto cotejado y aprobado humanamente en esta campaña."], data.root),
      /decisión pendiente/);
    await assert.rejects(runCampaignFinalization(["--decidir", entry.providerId, entry.reference, "excluir",
      "--motivo", "Incidencia verificada manualmente con su fuente original.", "--evidencia"], data.root), /evidencia/);
    const updated = await inspectActiveCampaignEditorial(data.root);
    assert.equal(updated.inspection.completed, 1);
    assert.equal(updated.accreditation.exclusions[0]?.decision, "excluir");
    assert.equal(updated.accreditation.approved, false);
  } finally { await data.cleanup(); }
});

test("permite aprobar la inclusión humana de una ficha intervenida y lista", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial, approveActiveCampaignEditorial } =
      await import("../editorial.js");
    const script = await campaignScript(data.root, data.runId);
    const provider = data.review.providers.find((item) => item.providerId === "gam");
    assert.ok(provider?.preparationFile);
    const preparation = await readOfflinePreparation(provider.preparationFile, "gam");
    const ready = preparation.products.find((item) => item.status === "ready" && item.product.title !== null);
    assert.ok(ready?.product.title);
    const originalProvider = data.providers.find((item) => item.providerId === "gam");
    assert.ok(originalProvider);
    const catalogFile = join(originalProvider.outputDir, `${originalProvider.outputPrefix}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogFile);
    const product = catalog.products.find((item) => item.reference === ready.product.reference);
    assert.ok(product?.title);
    await writeFile(script, `export const proposals = ${JSON.stringify([{
      providerId: "gam", identity: buildProductIdentity(product).key, field: "title", expected: product.title,
      next: `${product.title} contrastada`, reason: "Corrección contrastada de título de esta máquina",
      evidence: "Revisión individual de la fuente vigente antes de publicar"
    }])};`);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    await finalizeActiveCampaign(data.root, false);
    const draft = await inspectActiveCampaignEditorial(data.root);
    const affected = draft.accreditation.exclusions.find((item) => item.status === "intervention");
    assert.ok(affected);
    for (const item of draft.accreditation.exclusions) {
      await decideActiveCampaignEditorial(data.root, {
        providerId: item.providerId, reference: item.reference,
        decision: item.status === "intervention" ? "incluir" : "excluir",
        reason: "Ficha comprobada y decisión humana justificada con su publicación.",
        evidenceUrls: [item.sourceUrl]
      });
    }
    const approved = await approveActiveCampaignEditorial(data.root,
      "Aprobación manual de intervenciones y exclusiones de la campaña vigente.");
    assert.equal(approved.inspection.completed, draft.inspection.total);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.ok(selected.selection?.products.some((item) =>
      item.providerId === affected.providerId && item.reference === affected.reference));
  } finally { await data.cleanup(); }
});

test("la edición simultánea no pierde decisiones ni deja bloqueos de escritura", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial } = await import("../editorial.js");
    await finalizeActiveCampaign(data.root, false);
    const initial = await inspectActiveCampaignEditorial(data.root);
    const entries = initial.accreditation.exclusions.slice(0, 2);
    assert.equal(entries.length, 2);
    const results = await Promise.allSettled(entries.map((entry) => decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Incidencia contrastada manualmente con la publicación vigente.", evidenceUrls: [entry.sourceUrl]
    })));
    const after = await inspectActiveCampaignEditorial(data.root);
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const entry = entries[index];
      assert.ok(result && entry);
      if (result.status === "fulfilled") {
        assert.equal(after.accreditation.exclusions.find((item) =>
          item.providerId === entry.providerId && item.reference === entry.reference)?.decision, "excluir");
      }
    }
    assert.ok(results.some((result) => result.status === "fulfilled"));
    await assert.rejects(readFile(`${initial.draftFile}.lock`), /ENOENT/);
  } finally { await data.cleanup(); }
});
