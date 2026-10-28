import { realpathSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

export type InterventionScriptLocation = {
  readonly path: string;
  readonly campaign: string | null;
  readonly providerId: string | null;
};

const isScriptName = (value: string): boolean =>
  value.length > 3 && value.endsWith(".ts") && !value.endsWith(".d.ts");

const isIdentifier = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);

export const resolveInterventionScriptLocation = (
  input: string, workspaceRoot = process.cwd()
): InterventionScriptLocation => {
  const workspace = realpathSync(resolve(workspaceRoot));
  const path = realpathSync(resolve(workspace, input));
  if (!statSync(path).isFile()) throw new Error("La ruta del script no es un archivo");
  const permanentParts = relative(workspace, path).split(sep);
  if (permanentParts.length === 3 && permanentParts[0] === "interventions" &&
    permanentParts[1] && isIdentifier(permanentParts[1]) &&
    permanentParts[2] && isScriptName(permanentParts[2])) {
    return { path, campaign: null, providerId: permanentParts[1] };
  }
  const campaignParts = relative(join(workspace, "storage", "interventions"), path).split(sep);
  if (campaignParts.length === 3 && campaignParts[0] && isIdentifier(campaignParts[0]) &&
    campaignParts[1] === "scripts" && campaignParts[2] && isScriptName(campaignParts[2])) {
    return { path, campaign: campaignParts[0], providerId: null };
  }
  throw new Error("El script debe estar en storage/interventions/<campaña>/scripts/<archivo>.ts o interventions/<proveedor>/<archivo>.ts");
};

export const validateInterventionScriptSelection = (
  scripts: readonly string[], providerId: string, campaign: string | null, workspaceRoot = process.cwd()
): readonly string[] => {
  if (scripts.length === 0) throw new Error("Selecciona al menos un script distinto para esta intervención");
  const paths = new Set<string>();
  const names = new Set<string>();
  let selectedCampaign: string | null = campaign;
  for (const script of scripts) {
    const location = resolveInterventionScriptLocation(script, workspaceRoot);
    if (location.providerId !== null && location.providerId !== providerId) {
      throw new Error(`El script versionado pertenece a ${location.providerId}, no a ${providerId}`);
    }
    if (location.campaign !== null) {
      if (selectedCampaign !== null && location.campaign !== selectedCampaign) {
        if (campaign !== null) throw new Error(`El script no pertenece al lote actual ${campaign}: campaña distinta`);
        throw new Error("Todos los scripts temporales deben pertenecer a la misma campaña seleccionada");
      }
      selectedCampaign = location.campaign;
    }
    const name = basename(location.path);
    if (paths.has(location.path) || names.has(name)) {
      throw new Error("Script repetido: los nombres de los scripts seleccionados deben ser únicos");
    }
    paths.add(location.path);
    names.add(name);
  }
  return [...paths];
};
