import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readCatalogIntervention } from "./catalog.js";
import type { ManualInterventionProposal } from "./contracts.js";
import { loadInterventionScript } from "./script-loader.js";
import { resolveInterventionScriptLocation } from "./script-location.js";
import type { VersionedInterventionScript } from "./record.js";

export type SelectedInterventionScript = {
  readonly script: string;
  readonly proposals: readonly ManualInterventionProposal[];
  readonly version: VersionedInterventionScript | null;
};

const digest = (script: string): string => createHash("sha256").update(readFileSync(script)).digest("hex");

export const readInterventionScriptVersions = (
  scripts: readonly string[], workspaceRoot: string
): readonly VersionedInterventionScript[] => scripts.flatMap((script) => {
  const location = resolveInterventionScriptLocation(script, workspaceRoot);
  if (location.providerId === null) return [];
  const initialSha = digest(location.path);
  const intervention = readCatalogIntervention(location.path, workspaceRoot);
  const currentSha = digest(location.path);
  if (initialSha !== currentSha) throw new Error(`El script cambió durante la lectura: ${basename(script)}`);
  return [{ id: intervention.metadata.id, script: intervention.script, sha256: initialSha }];
}).sort((a, b) => a.script.localeCompare(b.script));

export const readSelectedInterventionScripts = async (
  scripts: readonly string[], providerId: string, workspaceRoot: string
): Promise<readonly SelectedInterventionScript[]> => Promise.all(scripts.map(async (script) => {
  const location = resolveInterventionScriptLocation(script, workspaceRoot);
  if (location.providerId === null) {
    return { script, proposals: await loadInterventionScript(script, providerId, workspaceRoot), version: null };
  }
  const initialSha = digest(location.path);
  const catalog = readCatalogIntervention(location.path, workspaceRoot);
  if (catalog.providerId !== providerId) throw new Error(`Script de otro proveedor: ${catalog.providerId}`);
  const proposals = await loadInterventionScript(script, providerId, workspaceRoot);
  if (initialSha !== digest(location.path) || !isDeepStrictEqual(proposals, catalog.proposals)) {
    throw new Error(`El script cambió o difiere de su catálogo estático: ${basename(script)}`);
  }
  return {
    script, proposals,
    version: { id: catalog.metadata.id, script: catalog.script, sha256: initialSha }
  };
}));
