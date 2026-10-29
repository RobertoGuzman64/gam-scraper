import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { inspectAccreditationDraft, sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { AccreditationInspection, CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { readIndividualSelection, selectIndividualPublishable } from "./individual-selection.js";
import type { IndividualSelectionContext } from "./individual-selection.js";

export type IndividualEditorialOptions = {
  readonly rootDirectory: string;
  readonly providerId: string;
  readonly catalogFile: string;
  readonly preparationFile: string;
};

export type IndividualEditorialReview = {
  readonly runId: string;
  readonly draftFile: string;
  readonly accreditation: CampaignAccreditation;
  readonly inspection: AccreditationInspection;
};

export type IndividualEditorialDecision = {
  readonly reference: string;
  readonly decision: "excluir" | "incluir";
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isAccreditation = (value: unknown): value is CampaignAccreditation =>
  isRecord(value) && value.version === 1 && typeof value.runId === "string" &&
  typeof value.approved === "boolean" &&
  (value.approvalReason === null || typeof value.approvalReason === "string") &&
  Array.isArray(value.sources) && Array.isArray(value.exclusions) &&
  value.exclusions.every((item: unknown) => isRecord(item) &&
    typeof item.providerId === "string" && typeof item.reference === "string" &&
    typeof item.sourceUrl === "string" && typeof item.status === "string" &&
    Array.isArray(item.issues) &&
    (item.decision === "incluir" || item.decision === "excluir" || item.decision === null) &&
    (item.reason === null || typeof item.reason === "string") &&
    Array.isArray(item.evidenceUrls) && item.evidenceUrls.every((url: unknown) => typeof url === "string"));

const draftPath = (options: IndividualEditorialOptions, context: IndividualSelectionContext): string =>
  join(resolve(options.rootDirectory), "storage", "providers", context.providerId, "editorial",
    `accreditation-${sha256(JSON.stringify(context.sources))}.json`);

const exists = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return false;
    throw error;
  }
};

const contextFor = async (options: IndividualEditorialOptions): Promise<IndividualSelectionContext> =>
  readIndividualSelection(options.providerId, options.catalogFile, options.preparationFile);

export const startIndividualEditorial = async (options: IndividualEditorialOptions): Promise<IndividualEditorialReview> => {
  const context = await contextFor(options);
  const draftFile = draftPath(options, context);
  await mkdir(dirname(draftFile), { recursive: true });
  try { await writeFile(draftFile, JSON.stringify(context.draft, null, 2), { flag: "wx" }); }
  catch (error) {
    if (!isRecord(error) || error.code !== "EEXIST") throw error;
  }
  return inspectIndividualEditorial(options);
};

const readState = async (options: IndividualEditorialOptions) => {
  const context = await contextFor(options);
  const draftFile = draftPath(options, context);
  let metadata;
  try { metadata = await lstat(draftFile); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      throw new Error("No hay borrador individual vigente. Ejecuta primero acreditar:proveedor sin opciones editoriales");
    }
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("El borrador individual no es un archivo regular");
  const raw = await readFile(draftFile, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) throw new Error("Acreditación individual: BOM UTF-8 no admitido");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Acreditación individual: JSON inválido"); }
  const inspection = inspectAccreditationDraft([context.preparation], context.sources, context.runId, parsed);
  if (!isAccreditation(parsed)) throw new Error("Acreditación individual: estructura de decisiones inválida");
  return { context, draftFile, raw, accreditation: parsed, inspection };
};

export const inspectIndividualEditorial = async (options: IndividualEditorialOptions): Promise<IndividualEditorialReview> => {
  const state = await readState(options);
  return { runId: state.context.runId, draftFile: state.draftFile,
    accreditation: state.accreditation, inspection: state.inspection };
};

const update = async (
  options: IndividualEditorialOptions,
  makeNext: (draft: CampaignAccreditation) => CampaignAccreditation
): Promise<IndividualEditorialReview> => {
  const initial = await readState(options);
  if (initial.accreditation.approved) throw new Error("La acreditación individual ya está aprobada y no admite cambios");
  const next = makeNext(initial.accreditation);
  const inspection = inspectAccreditationDraft(
    [initial.context.preparation], initial.context.sources, initial.context.runId, next
  );
  if (next.approved) {
    if (inspection.issues.length) {
      throw new Error(`Acreditación individual: decisiones pendientes o inválidas: ${inspection.issues.map((item) =>
        `${item.providerId}:${item.reference} ${item.message}`).join("; ")}`);
    }
    selectIndividualPublishable(initial.context, JSON.stringify(next));
  }
  const lockFile = `${initial.draftFile}.lock`;
  let lock;
  try { lock = await open(lockFile, "wx"); }
  catch (error) {
    if (isRecord(error) && error.code === "EEXIST") throw new Error("Otra edición individual está en curso; no se sobrescribe");
    throw error;
  }
  const stage = join(dirname(initial.draftFile), `.editorial-${randomUUID()}.tmp`);
  try {
    await writeFile(stage, JSON.stringify(next, null, 2), { flag: "wx" });
    const current = await contextFor(options);
    if (current.runId !== initial.context.runId || draftPath(options, current) !== initial.draftFile ||
      sha256(JSON.stringify(current.sources)) !== sha256(JSON.stringify(initial.context.sources))) {
      throw new Error("El catálogo o la preparación cambió durante la edición individual");
    }
    if (await readFile(initial.draftFile, "utf8") !== initial.raw) {
      throw new Error("El borrador cambió durante la edición; no se sobrescribe");
    }
    await rename(stage, initial.draftFile);
  } finally {
    await rm(stage, { force: true });
    await lock.close();
    await rm(lockFile, { force: true });
  }
  return { runId: initial.context.runId, draftFile: initial.draftFile, accreditation: next, inspection };
};

export const decideIndividualEditorial = async (
  options: IndividualEditorialOptions, request: IndividualEditorialDecision
): Promise<IndividualEditorialReview> => update(options, (draft) => {
  const matching = draft.exclusions.filter((item) =>
    item.providerId === options.providerId && item.reference === request.reference);
  if (matching.length !== 1) throw new Error(`La ficha ${options.providerId}:${request.reference} no requiere decisión editorial`);
  const entry = matching[0];
  if (!entry) throw new Error("Decisión editorial ausente");
  if (request.decision === "incluir" && entry.status !== "intervention") {
    throw new Error("Solo se admite incluir una ficha intervenida y lista");
  }
  if (request.reason.trim().length < 15) throw new Error("Motivo editorial de al menos 15 caracteres requerido");
  if (!request.evidenceUrls.length || !request.evidenceUrls.includes(entry.sourceUrl) ||
    request.evidenceUrls.some((url) => {
      try { return new URL(url).protocol !== "https:"; } catch { return true; }
    })) throw new Error("Las evidencias deben ser HTTPS e incluir la URL original de la ficha");
  return { ...draft, exclusions: draft.exclusions.map((item) =>
    item.providerId === options.providerId && item.reference === request.reference
      ? { ...item, decision: request.decision, reason: request.reason, evidenceUrls: [...request.evidenceUrls] }
      : item) };
});

export const approveIndividualEditorial = async (
  options: IndividualEditorialOptions, approvalReason: string
): Promise<IndividualEditorialReview> => {
  if (approvalReason.trim().length < 15) throw new Error("Motivo global de al menos 15 caracteres requerido");
  return update(options, (draft) => ({ ...draft, approved: true, approvalReason }));
};
