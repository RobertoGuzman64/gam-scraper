import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { inspectAccreditationDraft, selectAccreditedPublishable, sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { AccreditationInspection, CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { readCampaignFinalizationContext } from "./finalization.js";

export type EditorialReview = {
  readonly runId: string;
  readonly draftFile: string;
  readonly accreditation: CampaignAccreditation;
  readonly inspection: AccreditationInspection;
};

export type EditorialDecisionRequest = {
  readonly providerId: string;
  readonly reference: string;
  readonly decision: "incluir" | "excluir";
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isAccreditation = (value: unknown): value is CampaignAccreditation => {
  if (!isRecord(value) || value.version !== 1 || typeof value.runId !== "string" ||
    typeof value.approved !== "boolean" ||
    (value.approvalReason !== null && typeof value.approvalReason !== "string") ||
    !Array.isArray(value.sources) || !Array.isArray(value.exclusions)) return false;
  return value.exclusions.every((item: unknown) => isRecord(item) &&
    typeof item.providerId === "string" && typeof item.reference === "string" &&
    typeof item.sourceUrl === "string" && typeof item.status === "string" &&
    Array.isArray(item.issues) &&
    (item.decision === "incluir" || item.decision === "excluir" || item.decision === null) &&
    (item.reason === null || typeof item.reason === "string") &&
    Array.isArray(item.evidenceUrls) && item.evidenceUrls.every((url: unknown) => typeof url === "string"));
};

const readEditorialState = async (rootDirectory: string) => {
  const context = await readCampaignFinalizationContext(rootDirectory);
  let metadata;
  try { metadata = await lstat(context.draftFile); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      throw new Error("No existe borrador vigente. Ejecuta primero npm run campana:finalizar");
    }
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Borrador editorial no es un archivo regular");
  const raw = await readFile(context.draftFile, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) throw new Error("Acreditación editorial: BOM UTF-8 no admitido");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Acreditación editorial: JSON inválido"); }
  const inspection = inspectAccreditationDraft(context.preparations, context.sources, context.runId, parsed);
  if (!isAccreditation(parsed)) throw new Error("Acreditación editorial: estructura de decisiones inválida");
  return { context, raw, accreditation: parsed, inspection };
};

export const inspectActiveCampaignEditorial = async (rootDirectory: string): Promise<EditorialReview> => {
  const { context, accreditation, inspection } = await readEditorialState(rootDirectory);
  return { runId: context.runId, draftFile: context.draftFile, accreditation, inspection };
};

const updateEditorialState = async (
  rootDirectory: string,
  makeNext: (value: CampaignAccreditation) => CampaignAccreditation
): Promise<EditorialReview> => {
  const root = resolve(rootDirectory);
  const initial = await readEditorialState(root);
  if (initial.accreditation.approved) throw new Error("La acreditación está aprobada; no se modifican sus decisiones");
  const next = makeNext(initial.accreditation);
  const inspection = inspectAccreditationDraft(
    initial.context.preparations, initial.context.sources, initial.context.runId, next
  );
  if (next.approved) {
    if (inspection.issues.length) {
      throw new Error(`Acreditación editorial: ${inspection.issues.map((item) =>
        `${item.providerId}:${item.reference} ${item.message}`).join("; ")}`);
    }
    selectAccreditedPublishable(initial.context.preparations, initial.context.sources,
      initial.context.runId, next, sha256(JSON.stringify(next)));
  }
  const selectionDir = join(root, "storage", "campanas", initial.context.runId, "seleccion");
  try {
    await lstat(selectionDir);
    throw new Error("La campaña ya tiene selección; no se permite modificar la acreditación");
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  const stage = join(dirname(initial.context.draftFile), `.editorial-${randomUUID()}.tmp`);
  const lockFile = `${initial.context.draftFile}.lock`;
  let lock;
  try { lock = await open(lockFile, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") {
      throw new Error("Otra edición editorial está en curso o quedó interrumpida; no se sobrescribe el borrador");
    }
    throw error;
  }
  try {
    await writeFile(stage, JSON.stringify(next, null, 2), { flag: "wx" });
    const currentContext = await readCampaignFinalizationContext(root);
    if (currentContext.runId !== initial.context.runId || currentContext.draftFile !== initial.context.draftFile ||
      sha256(JSON.stringify(currentContext.sources)) !== sha256(JSON.stringify(initial.context.sources))) {
      throw new Error("Las preparaciones cambiaron durante la operación editorial");
    }
    if (await readFile(initial.context.draftFile, "utf8") !== initial.raw) {
      throw new Error("El borrador cambió durante la operación; no se sobrescribe");
    }
    try {
      await lstat(selectionDir);
      throw new Error("La campaña fue seleccionada durante la edición; no se sobrescribe");
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
    }
    await rename(stage, initial.context.draftFile);
  } finally {
    await rm(stage, { force: true });
    await lock.close();
    await rm(lockFile, { force: true });
  }
  return { runId: initial.context.runId, draftFile: initial.context.draftFile, accreditation: next, inspection };
};

export const decideActiveCampaignEditorial = async (
  rootDirectory: string, request: EditorialDecisionRequest
): Promise<EditorialReview> => updateEditorialState(rootDirectory, (accreditation) => {
  const matches = accreditation.exclusions.filter((item) =>
    item.providerId === request.providerId && item.reference === request.reference);
  if (matches.length !== 1) throw new Error(`La ficha ${request.providerId}:${request.reference} no requiere decisión editorial`);
  const entry = matches[0];
  if (!entry) throw new Error("Decisión editorial ausente");
  if (request.decision === "incluir" && entry.status !== "intervention") {
    throw new Error("Solo se admite incluir una ficha intervenida y lista");
  }
  if (request.reason.trim().length < 15) throw new Error("Motivo editorial de al menos 15 caracteres requerido");
  if (!request.evidenceUrls.length || !request.evidenceUrls.includes(entry.sourceUrl) ||
    request.evidenceUrls.some((url) => {
      try { return new URL(url).protocol !== "https:"; } catch { return true; }
    })) throw new Error("Las evidencias deben ser HTTPS e incluir la URL original de la ficha");
  return {
    ...accreditation,
    exclusions: accreditation.exclusions.map((item) =>
      item.providerId === request.providerId && item.reference === request.reference
        ? { ...item, decision: request.decision, reason: request.reason, evidenceUrls: [...request.evidenceUrls] }
        : item)
  };
});

export const approveActiveCampaignEditorial = async (
  rootDirectory: string, approvalReason: string
): Promise<EditorialReview> => {
  if (approvalReason.trim().length < 15) throw new Error("Motivo global de aprobación de al menos 15 caracteres requerido");
  return updateEditorialState(rootDirectory, (accreditation) => ({
    ...accreditation, approved: true, approvalReason
  }));
};
