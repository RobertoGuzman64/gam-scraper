import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { interveneActiveCampaign } from "../pipeline/campaign/intervention.js";
import { discoverCampaign } from "../pipeline/campaign/discovery.js";
import { registerInterventionScripts } from "../infrastructure/filesystem/intervention-script-registration.js";
import { formatInterventionSimulation } from "./intervene.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const help = `Uso:
  npm run campana:intervenir -- gam --script storage/interventions/<id-lote>/scripts/cambio.ts [--script <otro.ts> ...]
  npm run campana:intervenir -- gam --registrar <archivo.ts> [--registrar <otro.ts> ...]
  npm run campana:intervenir -- gam (--script <archivo.ts> | --registrar <archivo.ts>) --aplicar

Primero muestra todos los cambios con valores anteriores y posteriores.
--aplicar ejecuta exclusivamente los scripts indicados para el lote actual, verifica SHA y procedencia,
y prepara y valida el derivado. No aprueba productos ni modifica catálogos originales.`;

export const runCampaignIntervention = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("-")) throw new Error(help);
  const scripts: string[] = [];
  const sources: string[] = [];
  let apply = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--aplicar" && !apply) { apply = true; continue; }
    if ((arg !== "--script" && arg !== "--registrar") || !rest[index + 1] || rest[index + 1]?.startsWith("--")) {
      throw new Error(`Opción desconocida, repetida o incompleta: ${arg ?? ""}`);
    }
    if (arg === "--registrar") sources.push(rest[index + 1]!);
    else scripts.push(rest[index + 1]!);
    index += 1;
  }
  if (sources.length) {
    const campaign = await discoverCampaign(root);
    if (!campaign.runId || campaign.status !== "complete" || campaign.issues.length ||
      campaign.providers.some((provider) => !provider.catalog)) {
      throw new Error("No se pueden registrar scripts sin un lote actual completo y verificado");
    }
    scripts.push(...await registerInterventionScripts(root, campaign.runId, sources));
  }
  const result = await interveneActiveCampaign(root, providerId, scripts, apply, (simulation) => {
    console.log(formatInterventionSimulation(simulation, true));
  });
  console.log(`LOTE | ${result.runId}`);
  if (!result.applied) {
    console.log("  Solo simulación; para aplicar vuelve a ejecutar exactamente los mismos --script con --aplicar");
    return;
  }
  console.log(`  INTERVENCIÓN APLICADA | ${result.derivedFile}`);
  console.log(`  PREPARACIÓN VALIDADA | ${result.preparationFile}`);
  console.log(`  Ready ${result.ready} | Review ${result.review}`);
  console.log("  La publicación requiere acreditación editorial explícita; continúa con campana:finalizar");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignIntervention(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("campana:intervenir", error);
    process.exitCode = 1;
  });
}
