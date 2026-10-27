import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../finalization.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import { approveDraft, createFixture } from "./finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

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
