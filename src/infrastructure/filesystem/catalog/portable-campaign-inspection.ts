import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parseCanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import { applyInterventionToCatalog } from "../../../catalog/interventions/application.js";
import { parseAppliedInterventionRecord } from "../../../catalog/interventions/record.js";
import { simulateIntervention } from "../../../catalog/interventions/simulation.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";

export const sha = (data: string): string => createHash("sha256").update(data).digest("hex");
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type PortableCampaignManifest = {
  readonly version: 1;
  readonly runId: string;
  readonly approvalSha256: string;
  readonly selectionSha256: string;
  readonly files: Readonly<Record<string, string>>;
};

export const campaignRoot = (workspace: string, runId: string): string => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}$/.test(runId)) {
    throw new Error("Identificador de campaña no portátil");
  }
  return join(resolve(workspace), "catalogs", "campaigns", runId);
};

const isMissing = (error: unknown): boolean => error instanceof Error &&
  "code" in error && error.code === "ENOENT";

export const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio no regular: ${path}`);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

export const fileContent = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo no regular: ${path}`);
  return readFile(path, "utf8");
};

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
export const inspectCampaign = async (directory: string, runId: string): Promise<PortableCampaignManifest> => {
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

