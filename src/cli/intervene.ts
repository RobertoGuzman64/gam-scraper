import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readInterventionSource } from "../infrastructure/filesystem/intervention-source.js";
import { persistAppliedIntervention } from "../infrastructure/filesystem/intervention-application.js";
import { interventionScriptCampaign, loadInterventionScript } from "../manual-interventions/script-loader.js";
import { simulateIntervention } from "../manual-interventions/simulation.js";
import { validateInterventionProposals } from "../manual-interventions/proposals.js";
import type { InterventionSimulation } from "../manual-interventions/simulation.js";
import { interveneHelp, parseInterveneOptions } from "./options/intervene.js";
import { printCommandError } from "./reporting/errors.js";

const excerpt = (value: unknown, maxLength: number): string => {
  const text = JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export const formatInterventionSimulation = (simulation: InterventionSimulation, detail: boolean): string => {
  const lines = [
    `INTERVENCIÓN | ${simulation.providerId.toUpperCase()} | SIMULACIÓN`,
    `  Productos analizados: ${simulation.analyzedProducts}`,
    `  Productos afectados: ${simulation.affectedProducts}`,
    `  Campos propuestos: ${simulation.changes.length}`,
    `  Conflictos: 0 | Errores: 0`,
    `  SHA origen: ${simulation.catalogSha256}`,
    `  SHA plan: ${simulation.planSha256}`
  ];
  const visible = detail ? simulation.changes : simulation.changes.slice(0, 5);
  for (const change of visible) {
    lines.push(`  ${change.identity} | ${change.field}`);
    lines.push(`    ${excerpt(change.expected, detail ? 400 : 80)} → ${excerpt(change.next, detail ? 400 : 80)}`);
    if (detail) lines.push(`    Motivo: ${change.reason}\n    Evidencia: ${change.evidence}`);
  }
  if (visible.length !== simulation.changes.length) {
    lines.push(`  ${simulation.changes.length - visible.length} cambio(s) más; usa --detalle para revisarlos`);
  }
  lines.push("  Estado: SIMULACIÓN VÁLIDA | Sin archivos de datos escritos");
  return lines.join("\n");
};

export const runIntervene = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log(interveneHelp);
    return;
  }
  if (args.includes("--help")) throw new Error("--help no admite argumentos adicionales");
  const options = parseInterveneOptions(args);
  const campaigns = new Set(options.scripts.map((script) => interventionScriptCampaign(script)));
  if (campaigns.size !== 1 || (options.campaign !== null && !campaigns.has(options.campaign))) {
    throw new Error("Todos los scripts deben pertenecer a la misma campaña seleccionada");
  }
  const groups = await Promise.all(options.scripts.map((script) =>
    loadInterventionScript(script, options.providerId)));
  const proposals = validateInterventionProposals(groups.flat(), options.providerId);
  const { catalog, catalogSha256 } = await readInterventionSource(options.source);
  if (catalog.providerId !== options.providerId) {
    throw new Error(`El catálogo pertenece a ${catalog.providerId}, no a ${options.providerId}`);
  }
  const simulation = simulateIntervention(catalog, catalogSha256, proposals);
  if (!options.apply) {
    console.log(formatInterventionSimulation(simulation, options.detail));
    return;
  }
  if (options.campaign === null || options.plan === null) throw new Error("Faltan datos para aplicar el plan");
  const applied = await persistAppliedIntervention({
    source: options.source,
    scripts: options.scripts,
    campaign: options.campaign,
    confirmation: options.plan,
    simulation
  });
  console.log([
    `INTERVENCIÓN | ${simulation.providerId.toUpperCase()} | APLICADA`,
    `  Campaña: ${options.campaign}`,
    `  Productos analizados: ${simulation.analyzedProducts}`,
    `  Productos afectados: ${applied.affectedProducts}`,
    `  SHA origen: ${applied.catalogSha256}`,
    `  SHA plan: ${applied.planSha256}`,
    `  SHA derivado: ${applied.derivedSha256}`,
    `  Resultado: ${applied.path}`,
    "  Originales: SIN MODIFICAR | Salida derivada, no publicable aún"
  ].join("\n"));
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runIntervene(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("intervenir", error);
    process.exitCode = 1;
  });
}
