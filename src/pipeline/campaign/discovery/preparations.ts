import { createHash } from "node:crypto";
import { CAMPAIGN_PROVIDERS, isReferenceProviderSet } from "../../../contracts/campaign-providers.js";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-derived.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import type { OfflinePreparation } from "../../../catalog/preparation/offline-document.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { BatchReport, ProviderRun } from "../../../contracts/batch-report.js";

import { isRecord, isCampaignProvider } from "./report.js";
import type { ProviderDiscovery, Artifact, Preparation } from "./search.js";

export const directories = async (path: string): Promise<readonly string[]> => {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(path, entry.name));
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
};

const filesInCampaign = async (path: string, depth: number): Promise<readonly string[]> => {
  if (depth === 0) return [];
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isFile() && entry.name.endsWith("-preparation.json")) files.push(file);
    else if (entry.isDirectory()) files.push(...await filesInCampaign(file, depth - 1));
  }
  return files;
};

const preparationPaths = async (root: string, providerId: string, runId: string, includeHistorical: boolean): Promise<readonly string[]> => {
  const paths = [join(root, "storage", "prepared", providerId)];
  for (const resultDir of await directories(join(root, "storage", "interventions", runId, "results"))) {
      if (/^[a-f0-9]{64}$/.test(basename(resultDir))) paths.push(join(resultDir, "prepared"));
  }
  const files: string[] = [];
  for (const path of paths) {
    try {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith("-preparation.json")) files.push(join(path, entry.name));
      }
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") continue;
      throw error;
    }
  }
  files.push(...await filesInCampaign(join(root, "storage", "campaigns", includeHistorical ? "" : runId), 5));
  return files;
};

const selectPreparation = async (
  root: string, run: ProviderRun, runId: string, includeHistorical: boolean, original: Artifact, scope: string, productCount: number
): Promise<{ preparation?: Preparation; issues: readonly string[] }> => {
  const paths = await preparationPaths(root, run.providerId, runId, includeHistorical);
  const candidates: Preparation[] = [];
  const issues: string[] = [];
  for (const path of paths) {
    if (!basename(path).startsWith(run.outputPrefix)) {
      if (basename(dirname(path)) !== "prepared") continue;
      const filename = basename(path);
      const named = CAMPAIGN_PROVIDERS.find((id) => filename.startsWith(`${id}-intervention-preparation.json`));
      if (named && named !== run.providerId) continue;
      if (!named && filename === "intervention-preparation.json") {
        try {
          const raw: unknown = JSON.parse(await readFile(path, "utf8"));
          if (isRecord(raw) && isRecord(raw.source) && isCampaignProvider(raw.source.providerId) &&
            raw.source.providerId !== run.providerId) continue;
        } catch {
          issues.push(`Preparación no verificable (${path}): contenido ilegible`);
          continue;
        }
      }
    }
    let preparation: OfflinePreparation;
    try {
      preparation = await readOfflinePreparation(path, run.providerId);
    } catch (error) {
      issues.push(`Preparación no verificable (${path}): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (preparation.source.prefix !== run.outputPrefix || preparation.source.scope !== scope ||
      preparation.source.productCount !== productCount) continue;
    const intervention = preparation.source.intervention;
    if (intervention ? intervention.sourceCatalogSha256 !== original.sha256 :
      preparation.source.catalogSha256 !== original.sha256) continue;
    if (intervention) {
      try {
        const verified = await readAppliedIntervention(join(dirname(dirname(path)), "catalog-derived.json"), original.path);
        if (verified.catalogSha256 !== preparation.source.catalogSha256 ||
          verified.provenance.campaign !== intervention.campaign ||
          verified.provenance.planSha256 !== intervention.planSha256 ||
          verified.provenance.derivedCatalogSha256 !== intervention.derivedCatalogSha256) {
          throw new Error("La procedencia del derivado no coincide");
        }
      } catch (error) {
        issues.push(`Intervención no verificable (${path}): ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }
    candidates.push({
      path, sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
      preparedAt: preparation.preparedAt, intervened: intervention !== undefined
    });
  }
  candidates.sort((left, right) => {
    const local = (path: string): boolean => path.includes(`${join("storage", "campaigns", runId)}${sep}`) ||
      path.includes(`${join("storage", "interventions", runId)}${sep}`);
    return Number(local(right.path)) - Number(local(left.path)) ||
      Date.parse(right.preparedAt) - Date.parse(left.preparedAt);
  });
  if (candidates.length > 1 && candidates[0]?.preparedAt === candidates[1]?.preparedAt &&
    candidates[0]?.sha256 !== candidates[1]?.sha256) {
    issues.push(`Varias preparaciones vigentes con la misma fecha para ${run.providerId}; requiere revisión`);
    return { issues };
  }
  const preparation = candidates[0];
  return { ...(preparation ? { preparation } : {}), issues };
};

export const inspectProvider = async (
  root: string, report: BatchReport, providerId: string, includeHistorical: boolean
): Promise<{ provider: ProviderDiscovery; issues: readonly string[] }> => {
  const run = report.providers.find((entry) => entry.providerId === providerId);
  if (!run) return {
    provider: { providerId, state: "not-started", message: "Sin extracción en este lote" }, issues: []
  };
  if (run.status === "failed") return {
    provider: { providerId, state: "failed", message: run.error ?? "Extracción fallida" }, issues: []
  };
  const path = resolve(root, run.outputDir, `${run.outputPrefix}-catalog.json`);
  try {
    const catalog = await readCanonicalCatalog(path);
    if (catalog.providerId !== providerId || catalog.prefix !== run.outputPrefix ||
      Date.parse(catalog.startedAt) < Date.parse(run.startedAt) ||
      Date.parse(catalog.endedAt) > Date.parse(run.endedAt)) {
      throw new Error("El catálogo no pertenece a la ejecución indicada en run.json");
    }
    const original = { path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") };
    const result = await selectPreparation(root, run, report.runId, includeHistorical, original, catalog.scope, catalog.productCount);
    return {
      provider: { providerId, state: result.preparation ? "prepared" : "catalog", catalog: original,
        ...(result.preparation ? { preparation: result.preparation } : {}) },
      issues: result.issues
    };
  } catch (error) {
    return {
      provider: { providerId, state: "invalid", message: error instanceof Error ? error.message : String(error) },
      issues: []
    };
  }
};
