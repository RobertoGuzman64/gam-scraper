import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { applyInterventionToCatalog } from "../../manual-interventions/application.js";
import { simulateIntervention } from "../../manual-interventions/simulation.js";
import type { InterventionSimulation } from "../../manual-interventions/simulation.js";
import { readInterventionSource } from "./intervention-source.js";

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

const isWithin = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`);
};

const validateCampaign = async (campaign: string, script: string, root: string): Promise<string> => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(campaign)) throw new Error("Identificador de campaña inválido");
  const workspace = await realpath(root);
  const interventions = await realpath(join(workspace, "storage", "interventions"));
  const campaignDir = await realpath(join(interventions, campaign));
  if (!isWithin(interventions, campaignDir) || basename(campaignDir) !== campaign) {
    throw new Error("La campaña sale del directorio de intervenciones");
  }
  const scriptPath = await realpath(resolve(workspace, script));
  if (relative(join(campaignDir, "scripts"), scriptPath).startsWith("..") ||
    !isWithin(join(campaignDir, "scripts"), scriptPath) ||
    !(await stat(scriptPath)).isFile()) {
    throw new Error("El script no pertenece a la campaña solicitada");
  }
  return campaignDir;
};

export type AppliedIntervention = {
  readonly path: string;
  readonly catalogSha256: string;
  readonly derivedSha256: string;
  readonly planSha256: string;
  readonly affectedProducts: number;
};

export const persistAppliedIntervention = async (options: {
  readonly source: string;
  readonly script: string;
  readonly campaign: string;
  readonly confirmation: string;
  readonly simulation: InterventionSimulation;
  readonly workspaceRoot?: string;
}): Promise<AppliedIntervention> => {
  const { source, script, campaign, confirmation, simulation } = options;
  if (confirmation !== simulation.planSha256) throw new Error("El SHA del plan no coincide con la simulación actual");
  if (simulation.changes.length === 0) throw new Error("No hay cambios que aplicar");
  const root = options.workspaceRoot ?? process.cwd();
  const campaignDir = await validateCampaign(campaign, script, root);
  const latest = await readInterventionSource(source);
  if (latest.catalogSha256 !== simulation.catalogSha256) throw new Error("El catálogo original ha cambiado desde la simulación");
  const verifiedPlan = simulateIntervention(latest.catalog, latest.catalogSha256, simulation.changes);
  if (verifiedPlan.planSha256 !== simulation.planSha256 ||
    verifiedPlan.affectedProducts !== simulation.affectedProducts ||
    verifiedPlan.analyzedProducts !== simulation.analyzedProducts ||
    verifiedPlan.prefix !== simulation.prefix || verifiedPlan.scope !== simulation.scope) {
    throw new Error("El plan no coincide con la extracción verificada");
  }
  const derived = applyInterventionToCatalog(latest.catalog, verifiedPlan);
  const data = JSON.stringify({
    kind: "manual-intervention-derived-catalog",
    version: 1,
    source: {
      providerId: latest.catalog.providerId,
      prefix: latest.catalog.prefix,
      scope: latest.catalog.scope,
      catalogSha256: latest.catalogSha256
    },
    planSha256: simulation.planSha256,
    catalog: derived
  }, null, 2);
  const derivedSha256 = sha256(data);
  const record = JSON.stringify({
    version: 1,
    status: "applied",
    campaign,
    appliedAt: new Date().toISOString(),
    providerId: latest.catalog.providerId,
    sourceCatalogSha256: latest.catalogSha256,
    planSha256: simulation.planSha256,
    derivedCatalogSha256: derivedSha256,
    analyzedProducts: simulation.analyzedProducts,
    affectedProducts: simulation.affectedProducts,
    changes: simulation.changes
  }, null, 2);

  const resultRoot = join(campaignDir, "results");
  await mkdir(resultRoot, { recursive: true });
  if (await realpath(resultRoot) !== resultRoot) throw new Error("El directorio de resultados no es seguro");
  const finalDir = join(resultRoot, simulation.planSha256);
  const stage = join(resultRoot, `.pending-${randomUUID()}`);
  await mkdir(stage);
  try {
    await writeFile(join(stage, "catalog-derived.json"), data, { flag: "wx" });
    await writeFile(join(stage, "intervention-record.json"), record, { flag: "wx" });
    if (sha256(await readFile(join(stage, "catalog-derived.json"))) !== derivedSha256) {
      throw new Error("Fallo de integridad al preparar el catálogo derivado");
    }
    const current = await readInterventionSource(source);
    if (current.catalogSha256 !== simulation.catalogSha256) throw new Error("El origen cambió durante la aplicación");
    try {
      await stat(finalDir);
      throw new Error("Ya existe un resultado para este plan; no se sobrescribe");
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== "ENOENT") throw error;
    }
    await rename(stage, finalDir);
    return {
      path: finalDir,
      catalogSha256: latest.catalogSha256,
      derivedSha256,
      planSha256: simulation.planSha256,
      affectedProducts: simulation.affectedProducts
    };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
};
