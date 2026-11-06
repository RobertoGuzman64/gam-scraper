import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readAppliedIntervention } from "../interventions/intervention-derived.js";
import type { PublishableSelection } from "../../../catalog/editorial/select-publishable.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { readActiveCatalogIndex, withActiveCatalogLock } from "./active-selection.js";
import { campaignRoot, directoryExists, fileContent, inspectCampaign, record, sha } from "./portable-campaign-inspection.js";
import type { PortableCampaignManifest } from "./portable-campaign-inspection.js";

export type { PortableCampaignManifest } from "./portable-campaign-inspection.js";

const sourceFileNames = (prefix: string): readonly string[] => [
  `${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`
];

/** The run already has a different, immutable portable campaign snapshot. */
export class PortableCampaignConflictError extends Error {
  constructor(readonly runId: string) {
    super("La campaña portátil ya existe con un contenido diferente");
    this.name = "PortableCampaignConflictError";
  }
}

export const readPortableCampaign = async (workspace: string, runId: string): Promise<PortableCampaignManifest> =>
  inspectCampaign(campaignRoot(workspace, runId), runId);

/** Copies a previously selected, approved campaign into an immutable portable snapshot. */
export const consolidatePortableCampaign = async (args: {
  readonly workspace: string;
  readonly runId: string;
  readonly selection: PublishableSelection;
  readonly accreditationFile: string;
  readonly originals: readonly { readonly providerId: string; readonly path: string }[];
  readonly interventions: readonly { readonly providerId: string; readonly derivedFile: string }[];
}): Promise<boolean> => {
  const { workspace, runId, selection, accreditationFile, originals, interventions } = args;
  if (selection.accreditation?.runId !== runId ||
    originals.length !== CAMPAIGN_PROVIDERS.length ||
    CAMPAIGN_PROVIDERS.some((provider) => originals.filter((entry) => entry.providerId === provider).length !== 1) ||
    interventions.some((entry) => !CAMPAIGN_PROVIDERS.some((id) => id === entry.providerId) ||
      interventions.filter((item) => item.providerId === entry.providerId).length !== 1)) {
    throw new Error("No se puede consolidar una campaña sin sus cuatro originales acreditados");
  }
  const approval = await fileContent(accreditationFile);
  const parsedApproval: unknown = JSON.parse(approval);
  if (!record(parsedApproval) || parsedApproval.runId !== runId || parsedApproval.approved !== true ||
    sha(approval) !== selection.accreditation.approvalSha256) {
    throw new Error("La aprobación de la campaña no coincide con la selección");
  }
  const destination = campaignRoot(workspace, runId);
  const parent = dirname(destination);
  const catalogs = join(resolve(workspace), "catalogs");
  for (const dir of [catalogs, parent]) {
    if (!await directoryExists(dir)) await mkdir(dir);
    if (!await directoryExists(dir)) throw new Error("Destino de campañas no regular");
  }
  const stage = join(parent, `.pending-${randomUUID()}`);
  await mkdir(stage);
  try {
    const files = new Map<string, string>();
    files.set("selection.json", JSON.stringify(selection, null, 2));
    files.set("accreditation.json", approval);
    for (const provider of CAMPAIGN_PROVIDERS) {
      const source = originals.find((item) => item.providerId === provider);
      if (!source) throw new Error(`Falta el original de ${provider}`);
      const canonical = await readCanonicalCatalog(source.path);
      const expectedSource = selection.source.find((item) => item.providerId === provider);
      const original = await fileContent(source.path);
      const sourceHash = expectedSource?.intervention?.sourceCatalogSha256 ?? expectedSource?.catalogSha256;
      if (canonical.providerId !== provider || canonical.productCount !== expectedSource?.productCount ||
        sha(original) !== sourceHash) {
        throw new Error(`Original de ${provider} no corresponde a la selección`);
      }
      const prefix = basename(source.path).slice(0, -"-catalog.json".length);
      for (const name of sourceFileNames(prefix)) {
        files.set(`${provider}/${name}`, await fileContent(join(dirname(source.path), name)));
      }
      const intervention = expectedSource.intervention;
      const interventionFile = interventions.find((entry) => entry.providerId === provider);
      if ((intervention === undefined) !== (interventionFile === undefined)) {
        throw new Error(`No coincide la procedencia de intervención para ${provider}`);
      }
      if (intervention !== undefined && interventionFile !== undefined) {
        const verified = await readAppliedIntervention(interventionFile.derivedFile, source.path);
        if (!isDeepStrictEqual(verified.provenance, intervention)) {
          throw new Error(`Intervención ${provider} distinta de la acreditada`);
        }
        files.set(`${provider}/catalog-derived.json`, await fileContent(interventionFile.derivedFile));
        files.set(`${provider}/intervention-record.json`,
          await fileContent(join(dirname(interventionFile.derivedFile), "intervention-record.json")));
      }
      files.set(`${provider}/publishable.json`, JSON.stringify(selection.products.filter((entry) =>
        entry.providerId === provider), null, 2));
    }
    for (const [name, content] of files) {
      const path = join(stage, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, { flag: "wx" });
    }
    const manifest: PortableCampaignManifest = {
      version: 1, runId,
      approvalSha256: sha(approval),
      selectionSha256: sha(files.get("selection.json") ?? ""),
      files: Object.fromEntries([...files].map(([name, content]) => [name, sha(content)]))
    };
    await writeFile(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
    // Verify the complete snapshot before making it visible.
    await inspectCampaign(stage, runId);
    if (await directoryExists(destination)) {
      const existing = await readPortableCampaign(workspace, runId);
      if (!isDeepStrictEqual(existing, manifest)) {
        throw new PortableCampaignConflictError(runId);
      }
      return false;
    }
    await rename(stage, destination);
    return true;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};

/**
 * Retires only the portable snapshot of a campaign already scheduled for removal
 * by the accredited, journaled campaign rotation. Never discovers candidates
 * by age or changes the retained campaign.
 */
export const verifyPortableCampaignRetirement = async (
  workspace: string, retiredId: string, retainedId: string | null
): Promise<boolean> => {
  if (retiredId === retainedId) throw new Error("No se puede retirar la campaña portátil conservada");
  const retired = campaignRoot(workspace, retiredId);
  const active = await readActiveCatalogIndex(workspace);
  if (Object.values(active?.providers ?? {}).some((source) => source.runId === retiredId)) {
    throw new Error(`La campaña portátil ${retiredId} está vigente; activa otra versión antes de retirarla`);
  }
  if (!await directoryExists(retired)) return false;
  await readPortableCampaign(workspace, retiredId);
  if (retainedId === null) {
    throw new Error(`La campaña portátil ${retiredId} no tiene sucesora acreditada; se conserva`);
  }
  await readPortableCampaign(workspace, retainedId);
  return true;
};

export const retirePortableCampaign = async (
  workspace: string, retiredId: string, retainedId: string | null
): Promise<boolean> => {
  if (!await directoryExists(campaignRoot(workspace, retiredId))) return false;
  return withActiveCatalogLock(workspace, async () => {
    if (!await verifyPortableCampaignRetirement(workspace, retiredId, retainedId)) return false;
    await rm(campaignRoot(workspace, retiredId), { recursive: true });
    return true;
  });
};
