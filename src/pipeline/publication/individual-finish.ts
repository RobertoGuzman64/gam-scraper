import { readFile, lstat, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import { readActiveCatalogIndex } from "../../infrastructure/filesystem/catalog/active-selection.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { isPublicationDirectoryName, publicationApprovalSha } from "../../infrastructure/filesystem/catalog/publication-identity.js";
import {
  openIndividualFinishJournal, updateIndividualFinishJournal, withIndividualFinishLock
} from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import type { IndividualFinishTarget, IndividualFinishJournal } from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import type { IndividualCatalogProvider } from "../preparation/individual-context.js";
import { preflightIndividualAccreditations } from "./individual-accreditation.js";
import { ensureAutomaticIndividualAccreditations, planAutomaticIndividualAccreditation } from "./automatic-individual-accreditation.js";
import { readIndividualSelection } from "./individual-selection.js";
import { readIndividualEditorialState } from "./individual-editorial.js";
import type { IndividualEditorialOptions } from "./individual-editorial.js";
import { selectIndividualPublishable } from "./individual-selection.js";
import { deliverIndividualArchive } from "./individual-archive.js";
import { deliverIndividualProvider } from "./individual-delivery.js";
import { selectActivePublication, differenceBetween } from "./active-publication.js";
import type { PublicationDifference } from "./active-publication.js";
import { evaluatePublicationDifference } from "./publication-acceptance.js";

export type IndividualFinishPreview = {
  readonly providerId: IndividualCatalogProvider;
  readonly approvalSha256: string;
  readonly activeSha256: string | null;
  readonly difference: PublicationDifference;
  readonly publishable: number;
  readonly excluded: number;
  readonly unchanged: boolean;
};

export type IndividualFinishResult = {
  readonly mode: "simulation" | "complete";
  readonly providers: readonly (IndividualFinishPreview & { readonly status: "SIMULACIÓN" | "YA VIGENTE" | "ACTIVADA Y VERIFICADA"; readonly zipFile: string | null })[];
};

type Checked = IndividualFinishPreview & { readonly options: IndividualEditorialOptions };

const missing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const activeSha = async (root: string, providerId: IndividualCatalogProvider, expected?: string): Promise<string | null> => {
  const global = await readActiveCatalogIndex(root);
  const globalRecord = global?.providers[providerId];
  if (globalRecord?.runId) {
    throw new Error(`${providerId}: campaña global vigente; el circuito individual no puede sustituirla parcialmente`);
  }
  if (globalRecord) return globalRecord.approvalSha256;
  const path = join(root, "catalogs", "providers", providerId, "publications", "active.json");
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (!missing(error)) throw error;
    const folder = join(root, "catalogs", "providers", providerId, "publications");
    let entries;
    try { entries = await readdir(folder); }
    catch (directoryError) { if (missing(directoryError)) return null; throw directoryError; }
    const versions = entries.filter(isPublicationDirectoryName);
    if (versions.length > 1) throw new Error(`${providerId}: varias publicaciones sin selección activa; usa publicacion:vigente para elegir una expresamente`);
    if (versions.length === 1) {
      const directory = join(folder, versions[0]!);
      const version = await publicationApprovalSha(directory);
      if (version !== expected) throw new Error(`${providerId}: publicación sin selección activa inequívoca; utiliza publicacion:vigente`);
    }
    return null;
  }
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Selección de ${providerId} no regular`);
  const json: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!json || typeof json !== "object" || Array.isArray(json) ||
    !("version" in json) || json.version !== 1 || !("providerId" in json) || json.providerId !== providerId ||
    !("approvalSha256" in json) || typeof json.approvalSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(json.approvalSha256) || Object.keys(json).length !== 3) {
    throw new Error(`Selección vigente inválida en ${providerId}`);
  }
  return json.approvalSha256;
};

const inspected = async (
  root: string, providers: readonly IndividualCatalogProvider[]
): Promise<readonly Checked[]> => {
  const contexts = await preflightIndividualAccreditations(root, providers);
  const checked: Checked[] = [];
  const blockers: string[] = [];
  for (const context of contexts) {
    const planned = planAutomaticIndividualAccreditation(context);
    const selectionContext = await readIndividualSelection(context.providerId, context.options.catalogFile, context.options.preparationFile);
    if (planned.runId !== selectionContext.runId) throw new Error(`${context.providerId}: preparación cambiada durante el preflight`);
    const raw = context.existing?.inspection.approved
      ? (await readIndividualEditorialState(context.options)).raw
      : JSON.stringify(planned, null, 2);
    const selection = selectIndividualPublishable(selectionContext, raw);
    const approvalSha256 = sha256(raw);
    const currentSha256 = await activeSha(root, context.providerId, approvalSha256);
    const activeFile = currentSha256 ? await resolveAccreditedPublication(root, context.providerId) : null;
    if (currentSha256 && !activeFile) throw new Error(`${context.providerId}: índice activo sin publicación acreditada`);
    if (activeFile && await publicationApprovalSha(dirname(activeFile)) !== currentSha256) {
      throw new Error(`${context.providerId}: índice activo y SHA acreditado no concuerdan`);
    }
    const before = activeFile ? (await readAccreditedPublication(activeFile)).products : [];
    const difference = differenceBetween(currentSha256, approvalSha256, before, selection.products);
    const acceptance = evaluatePublicationDifference(difference);
    for (const blocker of acceptance.blockers) blockers.push(`${context.providerId}: ${blocker}`);
    checked.push({ providerId: context.providerId, options: context.options, approvalSha256,
      activeSha256: currentSha256, difference, publishable: selection.totals.publishable,
      excluded: selection.totals.excluded, unchanged: currentSha256 === approvalSha256 });
  }
  if (blockers.length) throw new Error(`FINISH / PREFLIGHT BLOQUEADO | Sin publicaciones ni activaciones nuevas. ${blockers.join("; ")}. Corrige la evidencia o las reglas y vuelve a simular`);
  if (checked.length !== providers.length) throw new Error("FINISH / PREFLIGHT: conjunto incompleto");
  return checked;
};

const preview = (checked: Checked): IndividualFinishPreview => ({
  providerId: checked.providerId, approvalSha256: checked.approvalSha256, activeSha256: checked.activeSha256,
  difference: checked.difference, publishable: checked.publishable, excluded: checked.excluded,
  unchanged: checked.unchanged
});

const reconcile = async (
  root: string, journal: IndividualFinishJournal
): Promise<readonly IndividualCatalogProvider[]> => {
  const completed: IndividualCatalogProvider[] = [];
  for (const item of journal.targets) {
    const current = await activeSha(root, item.providerId, item.approvalSha256);
    if (current === item.approvalSha256) {
      const path = await resolveAccreditedPublication(root, item.providerId);
      if (!path || await publicationApprovalSha(dirname(path)) !== item.approvalSha256) {
        throw new Error(`FINISH | ${item.providerId}: activación incompleta, revisar índice vigente`);
      }
      completed.push(item.providerId);
    } else if (current !== item.previousSha256) {
      throw new Error(`FINISH | ${item.providerId}: el índice activo cambió fuera del ciclo; recuperación manual necesaria`);
    } else if (journal.completed.includes(item.providerId)) {
      throw new Error(`FINISH | ${item.providerId}: se perdió una activación ya confirmada; recuperación manual necesaria`);
    }
  }
  return completed;
};

export const publishIndividualCatalogs = async (options: {
  readonly workspace: string;
  readonly providers: readonly IndividualCatalogProvider[];
  readonly dryRun: boolean;
  readonly desktopDirectory: string | null;
  readonly activate?: typeof selectActivePublication;
}): Promise<IndividualFinishResult> => {
  const root = resolve(options.workspace);
  const execute = async (): Promise<IndividualFinishResult> => {
    const checked = await inspected(root, options.providers);
    if (options.dryRun) {
      return { mode: "simulation", providers: checked.map((item) => ({ ...preview(item), status: "SIMULACIÓN", zipFile: null })) };
    }
    if (!options.desktopDirectory) throw new Error("FINISH: falta directorio de ZIP; no se activa ningún proveedor");
    const targets: readonly IndividualFinishTarget[] = checked.map((item) => ({
      providerId: item.providerId, approvalSha256: item.approvalSha256, previousSha256: item.activeSha256
    }));
    const { path: journalPath, journal: original } = await openIndividualFinishJournal(root, targets);
    let journal = original;
    let completed = await reconcile(root, journal);
    journal = await updateIndividualFinishJournal(journalPath, journal, completed);
    const zipFiles = new Map<IndividualCatalogProvider, string | null>();
    try {
      for (const item of checked) {
        if (completed.includes(item.providerId)) {
          await deliverIndividualProvider(item.options, "verify");
          zipFiles.set(item.providerId, null);
          continue;
        }
        const delivered = await deliverIndividualArchive(item.options, options.desktopDirectory, "publish");
        if (!delivered.zipFile) throw new Error(`${item.providerId}: falta ZIP acreditado`);
        zipFiles.set(item.providerId, delivered.zipFile);
      }
      for (const item of checked) {
        if (completed.includes(item.providerId)) continue;
        const result = await selectActivePublication(root, item.providerId, item.approvalSha256, false);
        if (!result.acceptance.accepted) throw new Error(`${item.providerId}: diferencias no aceptadas: ${result.acceptance.blockers.join("; ")}`);
      }
      for (const item of checked) {
        if (completed.includes(item.providerId)) continue;
        const activated = await (options.activate ?? selectActivePublication)(root, item.providerId, item.approvalSha256, true);
        if (!activated.acceptance.accepted) throw new Error(`${item.providerId}: activación no autorizada`);
        if (await activeSha(root, item.providerId, item.approvalSha256) !== item.approvalSha256) {
          throw new Error(`${item.providerId}: no se pudo verificar el índice tras la activación`);
        }
        const path = await resolveAccreditedPublication(root, item.providerId);
        if (!path || await publicationApprovalSha(dirname(path)) !== item.approvalSha256) {
          throw new Error(`${item.providerId}: publicación activa no coincide con la aprobación`);
        }
        completed = [...completed, item.providerId];
        journal = await updateIndividualFinishJournal(journalPath, journal, completed);
      }
      return { mode: "complete", providers: checked.map((item) => ({
        ...preview(item), status: item.unchanged ? "YA VIGENTE" : "ACTIVADA Y VERIFICADA",
        zipFile: zipFiles.get(item.providerId) ?? null
      })) };
    } catch (error) {
      const actual = await reconcile(root, journal).catch(() => completed);
      throw new Error(`FINISH PARCIAL/BLOQUEADO | Activados y comprobados: ${actual.join(", ") || "ninguno"}. ` +
        `Las publicaciones anteriores no se han reescrito. Diario: ${journalPath}. ` +
        `Corrige la causa y repite catalogo:publicar para recuperar el mismo conjunto: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  };
  if (options.dryRun) return execute();
  await inspected(root, options.providers);
  return withIndividualFinishLock(root, async () => {
    await ensureAutomaticIndividualAccreditations(root, options.providers);
    return execute();
  });
};
