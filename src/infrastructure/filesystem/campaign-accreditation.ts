import { readFile, realpath } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { readAppliedIntervention } from "./intervention-derived.js";
import { validateOfflinePreparation } from "../../pipeline/validation/offline.js";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { AccreditedSource } from "../../catalog/editorial/campaign-accreditation.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { BatchReport } from "../../pipeline/batch/report-types.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isCompleteBatch = (value: unknown): value is BatchReport => {
  if (!isRecord(value) || value.version !== 1 || value.status !== "complete" ||
    typeof value.runId !== "string" || !Array.isArray(value.requestedProviders) ||
    !Array.isArray(value.providers)) return false;
  const required = CAMPAIGN_PROVIDERS;
  const requested: readonly unknown[] = value.requestedProviders;
  const providers: readonly unknown[] = value.providers;
  return requested.length === required.length &&
    required.every((provider) => requested.includes(provider)) &&
    providers.length === required.length &&
    providers.every((item) => isRecord(item) && item.status === "complete" &&
      typeof item.providerId === "string" && required.some((id) => id === item.providerId) &&
      typeof item.outputDir === "string" && typeof item.outputPrefix === "string" &&
      typeof item.startedAt === "string" && typeof item.endedAt === "string") &&
    new Set(providers.map((item) => isRecord(item) ? item.providerId : undefined)).size === required.length;
};

const interventionForPreparation = async (
  file: string,
  originalFile: string,
  preparation: OfflinePreparation, workspaceRoot: string
): Promise<AccreditedSource["intervention"]> => {
  const root = await realpath(resolve(workspaceRoot, "storage", "interventions"));
  const realFile = await realpath(file);
  const inputDir = dirname(realFile);
  const resultDir = dirname(inputDir);
  const inside = relative(root, resultDir);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`) ||
    basename(inputDir) !== "prepared" || !/^[a-f0-9]{64}$/.test(basename(resultDir)) ||
    basename(dirname(resultDir)) !== "results") {
    throw new Error("Acreditación editorial: preparación intervenida fuera de un resultado permitido");
  }
  const verified = await readAppliedIntervention(join(resultDir, "catalog-derived.json"), originalFile);
  const intervention = preparation.source.intervention;
  if (!intervention || !isDeepStrictEqual(verified.provenance, intervention) ||
    verified.catalogSha256 !== preparation.source.catalogSha256) {
    throw new Error("Acreditación editorial: intervención no acreditada o alterada");
  }
  const changed = new Set(verified.changes.map((item) => item.identity));
  const references = verified.catalog.products
    .filter((product) => changed.has(buildProductIdentity(product).key))
    .map((product) => product.reference);
  if (references.length !== changed.size || references.some((reference) => reference === null)) {
    throw new Error("Acreditación editorial: cambios sin referencia verificable");
  }
  return {
    ...intervention,
    affectedReferences: references.filter((reference): reference is string => reference !== null).sort()
  };
};

export const readCampaignAccreditationSources = async (
  runPath: string,
  preparations: readonly OfflinePreparation[],
  paths: readonly { readonly providerId: string; readonly path: string }[],
  workspaceRoot = process.cwd()
): Promise<{ readonly runId: string; readonly sources: readonly AccreditedSource[] }> => {
  const report: unknown = JSON.parse(await readFile(runPath, "utf8"));
  if (!isCompleteBatch(report)) {
    throw new Error("Acreditación editorial: el lote no acredita todos los proveedores de campaña");
  }
  const sources: AccreditedSource[] = [];
  for (const path of paths) {
    const run = report.providers.find((item) => item.providerId === path.providerId);
    const preparation = preparations.find((item) => item.source.providerId === path.providerId);
    if (!run || !preparation || sources.some((item) => item.providerId === path.providerId)) {
      throw new Error(`Acreditación editorial: proveedor no acreditado (${path.providerId})`);
    }
    const catalogPath = resolve(workspaceRoot, run.outputDir, `${run.outputPrefix}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogPath);
    const catalogSha256 = sha256(await readFile(catalogPath, "utf8"));
    if (catalog.providerId !== path.providerId || catalog.prefix !== run.outputPrefix ||
      catalog.scope !== preparation.source.scope || preparation.source.prefix !== run.outputPrefix ||
      catalog.productCount !== preparation.source.productCount ||
      catalog.startedAt < run.startedAt || catalog.endedAt > run.endedAt ||
      !resolve(path.path).endsWith("-preparation.json")) {
      throw new Error(`Acreditación editorial: catálogo o preparación ajena al lote (${path.providerId})`);
    }
    const intervention = preparation.source.intervention === undefined ? undefined :
      await interventionForPreparation(path.path, catalogPath, preparation, workspaceRoot);
    if ((intervention === undefined && preparation.source.catalogSha256 !== catalogSha256) ||
      (intervention !== undefined && intervention.sourceCatalogSha256 !== catalogSha256)) {
      throw new Error(`Acreditación editorial: catálogo o preparación ajena al lote (${path.providerId})`);
    }
    if (intervention !== undefined) {
      const derivedFile = join(dirname(dirname(path.path)), "catalog-derived.json");
      await validateOfflinePreparation(path.providerId, path.path, derivedFile, null, catalogPath);
    }
    sources.push({
      providerId: path.providerId,
      catalogSha256,
      preparationSha256: sha256(await readFile(path.path, "utf8")),
      productCount: catalog.productCount,
      ...(intervention ? { intervention } : {})
    });
  }
  return { runId: report.runId, sources };
};
