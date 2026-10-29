import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parseCanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import { applyInterventionToCatalog } from "../../../catalog/interventions/application.js";
import { parseAppliedInterventionRecord } from "../../../catalog/interventions/record.js";
import { simulateIntervention } from "../../../catalog/interventions/simulation.js";
import { readAppliedIntervention } from "../interventions/intervention-derived.js";
import type { PublishableSelection } from "../../../catalog/editorial/select-publishable.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";

const sha = (data: string): string => createHash("sha256").update(data).digest("hex");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type PortableCampaignManifest = {
  readonly version: 1;
  readonly runId: string;
  readonly approvalSha256: string;
  readonly selectionSha256: string;
  readonly files: Readonly<Record<string, string>>;
};

const campaignRoot = (workspace: string, runId: string): string => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}$/.test(runId)) {
    throw new Error("Identificador de campaña no portátil");
  }
  return join(resolve(workspace), "catalogs", "campaigns", runId);
};

const isMissing = (error: unknown): boolean => error instanceof Error &&
  "code" in error && error.code === "ENOENT";

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio no regular: ${path}`);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const fileContent = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo no regular: ${path}`);
  return readFile(path, "utf8");
};

const sourceFileNames = (prefix: string): readonly string[] => [
  `${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`
];

const checkManifest = (value: unknown, runId: string): PortableCampaignManifest => {
  if (!record(value) || value.version !== 1 || value.runId !== runId ||
    typeof value.approvalSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.approvalSha256) ||
    typeof value.selectionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.selectionSha256) ||
    !record(value.files) || (Object.keys(value.files).length < CAMPAIGN_PROVIDERS.length * 4 + 2 ||
      Object.keys(value.files).length > CAMPAIGN_PROVIDERS.length * 6 + 2 ||
      Object.keys(value.files).length % 2 !== 0) ||
    Object.entries(value.files).some(([name, hash]) =>
      !/^(?:selection\.json|accreditation\.json|(?:gam|gomariz|mercaeleva|manain)\/(?:[a-zA-Z0-9_-]+-catalog(?:\.manifest)?\.json|[a-zA-Z0-9_-]+-summary\.json|publishable\.json|catalog-derived\.json|intervention-record\.json))$/.test(name) ||
      typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Manifiesto portátil de campaña inválido");
  }
  const files: Record<string, string> = {};
  for (const [name, hash] of Object.entries(value.files)) {
    if (typeof hash !== "string") throw new Error("Huella de archivo inválida");
    files[name] = hash;
  }
  return {
    version: 1, runId,
    approvalSha256: value.approvalSha256,
    selectionSha256: value.selectionSha256,
    files
  };
};

/** Self-contained approved selection. No paths to storage/ or the local machine. */
const inspectCampaign = async (directory: string, runId: string): Promise<PortableCampaignManifest> => {
  if (!await directoryExists(directory)) throw new Error(`Campaña portátil ausente: ${runId}`);
  const rawManifest = await fileContent(join(directory, "manifest.json"));
  const manifest = checkManifest(JSON.parse(rawManifest), runId);
  const entries = (await readdir(directory)).sort();
  if (!isDeepStrictEqual(entries, ["accreditation.json", ...CAMPAIGN_PROVIDERS, "manifest.json", "selection.json"].sort())) {
    throw new Error("Campaña portátil con archivos o proveedores inesperados");
  }
  for (const provider of CAMPAIGN_PROVIDERS) {
    const dir = join(directory, provider);
    if (!await directoryExists(dir)) throw new Error(`Falta carpeta ${provider}`);
    const actual = (await readdir(dir)).sort();
    const expected = Object.keys(manifest.files).filter((name) => name.startsWith(`${provider}/`))
      .map((name) => basename(name)).sort();
    if ((expected.length !== 4 && expected.length !== 6) ||
      !isDeepStrictEqual(actual, expected) || !actual.includes("publishable.json")) {
      throw new Error(`Archivos del proveedor ${provider} incompletos`);
    }
  }
  for (const [relative, expected] of Object.entries(manifest.files)) {
    if (sha(await fileContent(join(directory, relative))) !== expected) {
      throw new Error(`Integridad de campaña portátil incorrecta: ${relative}`);
    }
  }
  const rawSelection = await fileContent(join(directory, "selection.json"));
  const rawApproval = await fileContent(join(directory, "accreditation.json"));
  if (sha(rawSelection) !== manifest.selectionSha256 || sha(rawApproval) !== manifest.approvalSha256) {
    throw new Error("Selección y aprobación no coinciden con el manifiesto");
  }
  const selected: unknown = JSON.parse(rawSelection);
  const approved: unknown = JSON.parse(rawApproval);
  if (!record(selected) || !record(selected.accreditation) || selected.accreditation.runId !== runId ||
    selected.accreditation.approvalSha256 !== manifest.approvalSha256 ||
    !record(approved) || approved.runId !== runId || approved.approved !== true ||
    !Array.isArray(selected.products) || !Array.isArray(selected.source) || !record(selected.totals) ||
    selected.totals.publishable !== selected.products.length ||
    (typeof selected.totals.original !== "number" || typeof selected.totals.excluded !== "number" ||
      selected.totals.original !== selected.totals.publishable + selected.totals.excluded) ||
    selected.source.length !== CAMPAIGN_PROVIDERS.length) {
    throw new Error("Campaña portátil sin aprobación o selección coherente");
  }
  for (const provider of CAMPAIGN_PROVIDERS) {
    const sources = selected.source.filter((item: unknown) => record(item) && item.providerId === provider);
    if (sources.length !== 1 || !record(sources[0]) || typeof sources[0].catalogSha256 !== "string") {
      throw new Error(`Procedencia de ${provider} incorrecta`);
    }
    const names = Object.keys(manifest.files).filter((name) => name.startsWith(`${provider}/`));
    const canonical = names.find((name) => name.endsWith("-catalog.json"));
    if (!canonical) throw new Error(`Falta original de ${provider}`);
    const catalog = await readCanonicalCatalog(join(directory, canonical));
    const sourceHash = record(sources[0].intervention) ? sources[0].intervention.sourceCatalogSha256 : sources[0].catalogSha256;
    if (typeof sourceHash !== "string" || catalog.providerId !== provider ||
      catalog.productCount !== sources[0].productCount || manifest.files[canonical] !== sourceHash) {
      throw new Error(`Original y selección de ${provider} no coinciden`);
    }
    const products = selected.products.filter((item: unknown) => record(item) && item.providerId === provider);
    const intervention = sources[0].intervention;
    const derivedPath = join(directory, provider, "catalog-derived.json");
    const interventionPath = join(directory, provider, "intervention-record.json");
    if (intervention === undefined) {
      if (names.some((name) => name.endsWith("catalog-derived.json") || name.endsWith("intervention-record.json"))) {
        throw new Error(`Intervención inesperada en ${provider}`);
      }
    } else {
      if (!record(intervention) || names.length !== 6 ||
        typeof intervention.planSha256 !== "string" || typeof intervention.derivedCatalogSha256 !== "string" ||
        intervention.sourceCatalogSha256 !== sourceHash || intervention.campaign !== runId ||
        intervention.derivedCatalogSha256 !== sources[0].catalogSha256) {
        throw new Error(`Procedencia de intervención inválida: ${provider}`);
      }
      const applied = parseAppliedInterventionRecord(JSON.parse(await fileContent(interventionPath)));
      const rawDerived = await fileContent(derivedPath);
      const parsedDerived: unknown = JSON.parse(rawDerived);
      if (!record(parsedDerived) || parsedDerived.kind !== "manual-intervention-derived-catalog" ||
        parsedDerived.version !== 1 || !record(parsedDerived.source) || !record(parsedDerived.catalog) ||
        applied.campaign !== runId || applied.providerId !== provider ||
        applied.sourceCatalogSha256 !== sourceHash ||
        applied.derivedCatalogSha256 !== sha(rawDerived) ||
        applied.planSha256 !== intervention.planSha256 || sha(rawDerived) !== intervention.derivedCatalogSha256 ||
        !isDeepStrictEqual(parsedDerived.source, {
          providerId: provider, prefix: catalog.prefix, scope: catalog.scope,
          catalogSha256: sourceHash
        }) || parsedDerived.planSha256 !== intervention.planSha256) {
        throw new Error(`Expediente de intervención incoherente: ${provider}`);
      }
      const simulated = simulateIntervention(catalog, sourceHash, applied.changes);
      if (simulated.planSha256 !== applied.planSha256 ||
        simulated.affectedProducts !== applied.affectedProducts ||
        simulated.analyzedProducts !== applied.analyzedProducts ||
        !isDeepStrictEqual(parseCanonicalCatalog(parsedDerived.catalog), applyInterventionToCatalog(catalog, simulated))) {
        throw new Error(`Derivado de intervención no acreditado: ${provider}`);
      }
    }
    const published: unknown = JSON.parse(await fileContent(join(directory, provider, "publishable.json")));
    if (!isDeepStrictEqual(products, published)) throw new Error(`Publicables de ${provider} alterados`);
  }
  return manifest;
};

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
        throw new Error("La campaña portátil ya existe con un contenido diferente");
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
  if (!await verifyPortableCampaignRetirement(workspace, retiredId, retainedId)) return false;
  await rm(campaignRoot(workspace, retiredId), { recursive: true });
  return true;
};
