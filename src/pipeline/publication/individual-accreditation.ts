import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { inspectAccreditationDraft } from "../../catalog/editorial/campaign-accreditation.js";
import { proposeIndividualExclusions } from "../../catalog/editorial/individual-decision-proposals.js";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { requireIndividualPreparationContext } from "../preparation/individual-context.js";
import type { IndividualCatalogProvider } from "../preparation/individual-context.js";
import {
  approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorialIfExists,
  inspectIndividualEditorial, startIndividualEditorial
} from "./individual-editorial.js";
import type { IndividualEditorialDecision, IndividualEditorialOptions, IndividualEditorialReview } from "./individual-editorial.js";
import { readIndividualSelection } from "./individual-selection.js";

export type IndividualEditorialAntecedent = {
  readonly reference: string;
  readonly sourceUrl: string;
  readonly status: "review" | "identity" | "intervention";
  readonly issues: readonly string[];
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
};

export type IndividualAccreditationProvider = {
  readonly providerId: IndividualCatalogProvider;
  readonly options: IndividualEditorialOptions;
  readonly expected: CampaignAccreditation;
  readonly existing: IndividualEditorialReview | null;
  readonly proposed: CampaignAccreditation;
  readonly antecedents: readonly IndividualEditorialAntecedent[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const historicalExclusions = async (
  activeFile: string | null, providerId: IndividualCatalogProvider
): Promise<readonly IndividualEditorialAntecedent[]> => {
  if (!activeFile || basename(activeFile) !== `${providerId}-publishable.json`) return [];
  const path = join(dirname(activeFile), "accreditation.json");
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isRecord(parsed) || parsed.approved !== true || !Array.isArray(parsed.exclusions)) {
    throw new Error(`Antecedentes de ${providerId}: acreditación vigente inválida`);
  }
  const result: IndividualEditorialAntecedent[] = [];
  const references = new Set<string>();
  for (const item of parsed.exclusions) {
    if (isRecord(item) && item.decision === "incluir") continue;
    if (!isRecord(item) || typeof item.reference !== "string" || typeof item.sourceUrl !== "string" ||
      typeof item.reason !== "string" || item.reason.trim().length < 15 ||
      !["review", "identity", "intervention"].includes(String(item.status)) ||
      !Array.isArray(item.issues) || !item.issues.every((issue: unknown) => typeof issue === "string") ||
      item.decision !== "excluir" || item.providerId !== providerId || !Array.isArray(item.evidenceUrls) ||
      !item.evidenceUrls.every((url: unknown) => typeof url === "string" && url.startsWith("https://")) ||
      !item.evidenceUrls.includes(item.sourceUrl) || references.has(item.reference)) {
      throw new Error(`Antecedentes de ${providerId}: exclusión vigente inválida`);
    }
    references.add(item.reference);
    const status = item.status;
    if (status !== "review" && status !== "identity" && status !== "intervention") {
      throw new Error(`Antecedentes de ${providerId}: estado inválido`);
    }
    result.push({ reference: item.reference, sourceUrl: item.sourceUrl, status,
      issues: item.issues, reason: item.reason, evidenceUrls: item.evidenceUrls });
  }
  return result;
};

export const preflightIndividualAccreditations = async (
  workspace: string, providers: readonly IndividualCatalogProvider[]
): Promise<readonly IndividualAccreditationProvider[]> => {
  const checked: IndividualAccreditationProvider[] = [];
  for (const providerId of providers) {
    try {
      const preparation = await requireIndividualPreparationContext(workspace, providerId);
      const options: IndividualEditorialOptions = {
        rootDirectory: resolve(workspace), providerId,
        catalogFile: preparation.sourceFile, preparationFile: preparation.preparationFile
      };
      const selection = await readIndividualSelection(providerId, options.catalogFile, options.preparationFile);
      const existing = await inspectIndividualEditorialIfExists(options);
      const antecedents = await historicalExclusions(preparation.activeFile, providerId);
      checked.push({ providerId, options, expected: selection.draft, existing,
        proposed: proposeIndividualExclusions(selection.draft), antecedents });
    } catch (error) {
      throw new Error(`ACREDITACIÓN | ${providerId.toUpperCase()} | Sin aprobación ni publicación. ${error instanceof Error ? error.message : String(error)}. Corrige la causa y repite catalogo:preparar o catalogo:publicar`, { cause: error });
    }
  }
  return checked;
};

export const openIndividualAccreditations = async (
  contexts: readonly IndividualAccreditationProvider[]
): Promise<readonly IndividualEditorialReview[]> => {
  const opened: IndividualEditorialReview[] = [];
  for (const context of contexts) {
    try {
      opened.push(await startIndividualEditorial(context.options));
    } catch (error) {
      throw new Error(`ACREDITACIÓN | ${context.providerId.toUpperCase()} | Borradores abiertos: ${opened.map((item) => item.accreditation.sources[0]?.providerId).join(", ") || "ninguno"}. Sin aprobaciones nuevas. Corrige el bloqueo y reanuda catalogo:publicar: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  return opened;
};

export const recordIndividualAccreditationDecision = async (
  context: IndividualAccreditationProvider, request: IndividualEditorialDecision
): Promise<IndividualEditorialReview> => decideIndividualEditorial(context.options, request);

export const validateIndividualAccreditations = async (
  contexts: readonly IndividualAccreditationProvider[]
): Promise<readonly IndividualEditorialReview[]> => {
  const inspected: IndividualEditorialReview[] = [];
  for (const context of contexts) {
    const current = await requireIndividualPreparationContext(context.options.rootDirectory, context.providerId);
    if (current.sourceFile !== context.options.catalogFile || current.preparationFile !== context.options.preparationFile) {
      throw new Error(`La preparación de ${context.providerId} cambió durante la sesión; no aprobar`);
    }
    const selection = await readIndividualSelection(context.providerId, context.options.catalogFile, context.options.preparationFile);
    if (!isDeepStrictEqual(selection.draft.sources, context.expected.sources) ||
      !isDeepStrictEqual(selection.draft.exclusions, context.expected.exclusions) ||
      selection.draft.runId !== context.expected.runId) {
      throw new Error(`El origen o las reglas de ${context.providerId} cambiaron durante la sesión; no aprobar`);
    }
    const review = await inspectIndividualEditorial(context.options);
    const inspection = inspectAccreditationDraft([selection.preparation], selection.sources, selection.runId, review.accreditation);
    if (inspection.issues.length) {
      throw new Error(`Decisiones pendientes de ${context.providerId}: ${inspection.issues.map((issue) => `${issue.reference}: ${issue.message}`).join("; ")}`);
    }
    inspected.push(review);
  }
  return inspected;
};

export const approveIndividualAccreditations = async (
  contexts: readonly IndividualAccreditationProvider[], reason: string
): Promise<readonly IndividualEditorialReview[]> => {
  if (reason.trim().length < 15) throw new Error("Se exige un motivo global de al menos 15 caracteres");
  const valid = await validateIndividualAccreditations(contexts);
  const approved: IndividualEditorialReview[] = [];
  const scope = contexts.map((context) => context.providerId).join(", ");
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    const review = valid[index];
    if (!context || !review) throw new Error("Sesión editorial incoherente");
    if (review.inspection.approved) {
      approved.push(review);
      continue;
    }
    try {
      approved.push(await approveIndividualEditorial(context.options, `Aprobación expresa del conjunto (${scope}): ${reason.trim()}`));
    } catch (error) {
      const completed = approved.filter((item) => item.inspection.approved).map((item) => item.accreditation.sources[0]?.providerId).join(", ");
      throw new Error(`Aprobación PARCIAL | completados: ${completed || "ninguno"} | falló ${context.providerId}. No se publicó nada. Consulta las acreditaciones y reanuda catalogo:publicar: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  return approved;
};
