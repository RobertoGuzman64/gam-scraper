import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createAccreditationDraft, inspectAccreditationDraft, selectAccreditedPublishable, sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { AccreditedSource, CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { PublishableSelection } from "../../catalog/editorial/select-publishable.js";
import { readCampaignAccreditationSources } from "../../infrastructure/filesystem/campaign-accreditation.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";
import { validateOfflinePreparation } from "../validation/offline.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";

export type CampaignFinalizationResult = {
  readonly runId: string;
  readonly draftFile: string;
  readonly status: "draft" | "pending" | "simulation" | "selected";
  readonly decisions: number;
  readonly selection?: PublishableSelection;
  readonly selectionDir?: string;
};

const exists = async (path: string): Promise<boolean> => {
  try { await stat(path); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};

const selectionFiles = (selection: PublishableSelection): readonly { path: string; content: string }[] => [
  ...CAMPAIGN_PROVIDERS.map((id) => ({
    path: `${id}-publishable.json`,
    content: JSON.stringify(selection.products.filter((product) => product.providerId === id), null, 2)
  })),
  { path: "selection.json", content: JSON.stringify(selection, null, 2) }
];

const saveSelection = async (root: string, files: readonly { path: string; content: string }[]): Promise<void> => {
  if (await exists(root)) {
    for (const file of files) {
      if (await readFile(join(root, file.path), "utf8") !== file.content) {
        throw new Error("La selección de esta acreditación existe, pero sus archivos han cambiado");
      }
    }
    return;
  }
  const parent = dirname(root);
  await mkdir(parent, { recursive: true });
  const stage = join(parent, `.pending-${randomUUID()}`);
  await mkdir(stage);
  try {
    for (const file of files) await writeFile(join(stage, file.path), file.content, { flag: "wx" });
    if (await exists(root)) throw new Error("Otra ejecución creó la selección; no se sobrescribe");
    await rename(stage, root);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
};

export type CampaignFinalizationContext = {
  readonly runId: string;
  readonly draftFile: string;
  readonly expected: CampaignAccreditation;
  readonly preparations: readonly OfflinePreparation[];
  readonly sources: readonly AccreditedSource[];
  readonly paths: readonly { readonly providerId: string; readonly path: string }[];
};

export const readCampaignFinalizationContext = async (
  rootDirectory: string
): Promise<CampaignFinalizationContext> => {
  const root = resolve(rootDirectory);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length ||
    campaign.providers.length !== CAMPAIGN_PROVIDERS.length ||
    campaign.providers.some((provider) => !provider.catalog || !provider.preparation)) {
    throw new Error(`No se puede finalizar: faltan tres preparaciones verificables del lote actual. ${campaign.issues.join("; ")}`);
  }
  const paths = CAMPAIGN_PROVIDERS.map((providerId) => {
    const provider = campaign.providers.find((item) => item.providerId === providerId);
    if (!provider?.catalog || !provider.preparation) throw new Error(`Falta preparación ${providerId}`);
    return { providerId, path: provider.preparation.path, original: provider.catalog.path,
      intervened: provider.preparation.intervened };
  });
  for (const item of paths) {
    const source = item.intervened ? join(dirname(dirname(item.path)), "catalog-derived.json") : item.original;
    await validateOfflinePreparation(item.providerId, item.path, source, null,
      item.intervened ? item.original : undefined);
  }
  const preparations = await Promise.all(paths.map((item) => readOfflinePreparation(item.path, item.providerId)));
  const { runId, sources } = await readCampaignAccreditationSources(campaign.runFile, preparations, paths, root);
  if (runId !== campaign.runId) throw new Error("El lote cambió durante la acreditación");
  const expected = createAccreditationDraft(preparations, sources, runId);
  const fingerprint = sha256(JSON.stringify(sources));
  const editorialDir = join(root, "storage", "campaigns", runId, "editorial");
  const draftFile = join(editorialDir, `accreditation-${fingerprint}.json`);
  return { runId, draftFile, expected, preparations, sources, paths };
};

export const finalizeActiveCampaign = async (
  rootDirectory: string, dryRun: boolean
): Promise<CampaignFinalizationResult> => {
  const root = resolve(rootDirectory);
  const { runId, draftFile, expected, preparations, sources, paths } = await readCampaignFinalizationContext(root);
  if (!await exists(draftFile)) {
    if (!dryRun) {
      await mkdir(dirname(draftFile), { recursive: true });
      await writeFile(draftFile, JSON.stringify(expected, null, 2), { flag: "wx" });
    }
    return { runId, draftFile, status: "draft", decisions: expected.exclusions.length };
  }
  const raw = await readFile(draftFile, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("sources" in parsed) ||
    !("runId" in parsed) || parsed.runId !== runId ||
    !isDeepStrictEqual(parsed.sources, expected.sources)) {
    throw new Error("La acreditación no corresponde a las preparaciones actuales; no se reutiliza");
  }
  if (!("approved" in parsed) || parsed.approved !== true) {
    inspectAccreditationDraft(preparations, sources, runId, parsed);
    return { runId, draftFile, status: "pending", decisions: expected.exclusions.length };
  }
  const selection = selectAccreditedPublishable(preparations, sources, runId, parsed, sha256(raw));
  if (dryRun) return { runId, draftFile, status: "simulation", decisions: expected.exclusions.length, selection };
  const selectionDir = join(root, "storage", "campaigns", runId, "selection", sha256(raw));
  await saveSelection(selectionDir, selectionFiles(selection));
  const current = await discoverCampaign(root);
  if (current.runId !== runId || current.issues.length ||
    CAMPAIGN_PROVIDERS.some((id) => current.providers.find((item) => item.providerId === id)?.preparation?.path !==
      paths.find((item) => item.providerId === id)?.path)) {
    throw new Error("Las entradas de la selección han cambiado; no se puede dar por finalizada la campaña");
  }
  return { runId, draftFile, status: "selected", decisions: expected.exclusions.length, selection, selectionDir };
};
