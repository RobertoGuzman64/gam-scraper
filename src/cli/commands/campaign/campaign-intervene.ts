import { resolve } from "node:path";
import { readInterventionCatalog } from "../../../catalog/interventions/catalog.js";
import { fileURLToPath } from "node:url";
import { interveneActiveCampaign } from "../../../pipeline/campaign/intervention.js";
import { discoverCampaign } from "../../../pipeline/campaign/discovery/search.js";
import { discoverCampaignCatalogHistory } from "../../../pipeline/campaign/discovery/history.js";
import { assessInterventionMaintenance } from "../../../catalog/interventions/maintenance.js";
import { formatInterventionSimulation } from "../interventions/intervene.js";
import { formatInterventionComparison } from "../../reporting/intervention-comparison.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const help = `Uso:
  npm run intervenir -- gam --listar
  npm run intervenir -- gam --consultar gam-6002
  npm run intervenir -- gam --consultar gam:ref:6002
  npm run intervenir -- gam --mantenimiento
  npm run intervenir -- gam --script interventions/gam/6002.ts [--script <otro.ts> ...]
  npm run intervenir -- gam --script interventions/gam/6002.ts --aplicar

Las consultas y mantenimiento son de solo lectura, sin ejecutar scripts.
Los scripts antiguos en storage/interventions/<lote>/scripts/ solo se admiten por compatibilidad.
Mantenimiento requiere una campaña completa y compara hasta cinco lotes recientes verificables;
una ausencia aislada nunca justifica retirar un script. La retirada es manual y versionada en Git.
La simulación compara cada máquina con la extracción actual; no aplica nada por defecto.
Las correcciones ya presentes y las máquinas ausentes no se vuelven a aplicar.
Divergencias y correcciones parciales bloquean el plan.
--aplicar ejecuta exclusivamente los scripts indicados para el lote actual, verifica SHA y procedencia,
y prepara y valida el derivado. No aprueba productos ni modifica catálogos originales.`;

export const runCampaignIntervention = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  printReportLine(formatHeader("INTERVENCIONES"));
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("-")) throw new Error(help);
  if (rest.length === 1 && rest[0] === "--listar") {
    const catalog = readInterventionCatalog(providerId, root);
    printReportLine(`INTERVENCIONES | ${providerId.toUpperCase()} | ${catalog.length}`);
    for (const item of catalog) {
      printReportLine(`  ${item.metadata.id} | ${item.metadata.summary}`);
      printReportLine(`    Máquinas: ${item.identities.join(", ")} | Campos: ${item.fields.join(", ")}`);
      printReportLine(`    Script: ${item.script}`);
    }
    return;
  }
  if (rest.length === 2 && rest[0] === "--consultar" && rest[1] && !rest[1].startsWith("--")) {
    const id = rest[1];
    const catalog = readInterventionCatalog(providerId, root);
    const found = catalog.filter((entry) => entry.metadata.id === id || entry.identities.includes(id));
    if (!found.length) throw new Error(`No existe una intervención con identificador o referencia ${id} para ${providerId}`);
    for (const item of found) {
      printReportLine(`INTERVENCIÓN | ${item.metadata.id} | ${item.metadata.summary}`);
      printReportLine(`  Proveedor: ${item.providerId} | Script: ${item.script}`);
      for (const proposal of item.proposals) {
        printReportLine(`  ${proposal.identity} | ${proposal.field}`);
        printReportLine(`    Valor original: ${JSON.stringify(proposal.expected)} | Valor propuesto: ${JSON.stringify(proposal.next)}`);
        printReportLine(`    Motivo: ${proposal.reason}`);
        printReportLine(`    Evidencia: ${proposal.evidence}`);
      }
    }
    return;
  }
  if (rest.length === 1 && rest[0] === "--mantenimiento") {
    const campaign = await discoverCampaign(root);
    if (!campaign.runId || campaign.status !== "complete" || campaign.issues.length ||
      campaign.providers.some((provider) => !provider.catalog)) {
      throw new Error(`El mantenimiento requiere una campaña actual completa y verificable: ${campaign.issues.join("; ")}`);
    }
    const history = await discoverCampaignCatalogHistory(root, providerId);
    if (history[0]?.runId !== campaign.runId || !history[0].catalog) {
      throw new Error("El historial no coincide con la campaña vigente");
    }
    const interventions = readInterventionCatalog(providerId, root);
    const assessments = assessInterventionMaintenance(interventions, history);
    printReportLine(`MANTENIMIENTO | ${providerId.toUpperCase()} | Lote ${campaign.runId} | ${assessments.length} intervenciones`);
    printReportLine("Se analiza siempre el original; ninguna observación autoriza a reaplicar una intervención.");
    if (campaign.providers.find((provider) => provider.providerId === providerId)?.preparation?.intervened) {
      printReportLine("El lote ya tiene preparación intervenida; la comparación no modifica ni reabre su expediente.");
    }
    for (const entry of assessments) {
      const label = entry.assessment === "active" ? "VIGENTE: ORIGEN SIN CORREGIR" :
        entry.assessment === "inconsistent" ? "DIVERGENCIA: REVISIÓN OBLIGATORIA" :
          entry.assessment === "review" ? "CANDIDATA A REVISIÓN HUMANA" : "CONSERVAR: EVIDENCIA INSUFICIENTE";
      printReportLine(`  ${entry.intervention.metadata.id} | ${label}`);
      printReportLine(`    ${entry.intervention.metadata.summary}`);
      printReportLine(`    Máquina(s): ${entry.intervention.identities.join(", ")}`);
      printReportLine(`    Script: ${entry.intervention.script}`);
      printReportLine(`    Lotes consecutivos confirmados: ${entry.consecutiveObservations}`);
      for (const observation of entry.observations) {
        printReportLine(`    ${observation.runId}: ${observation.status}`);
      }
      if (entry.assessment === "review") {
        printReportLine("    Revisar presencia en la fuente, recurrencia y evidencia antes de decidir la retirada.");
        if (entry.intervention.identities.length === 1) {
          printReportLine(`    Solo tras autorización humana: git rm -- ${entry.intervention.script}`);
        } else {
          printReportLine("    El script afecta varias máquinas: separar responsabilidades antes de una retirada individual.");
        }
      }
    }
    printReportLine("Solo lectura | Ningún script, expediente ni catálogo ha sido modificado");
    return;
  }
  const scripts: string[] = [];
  let apply = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--aplicar" && !apply) { apply = true; continue; }
    if (arg === "--registrar") {
      throw new Error("--registrar fue retirado: guarda cada script en interventions/<proveedor>/ y selecciona --script");
    }
    if (arg !== "--script" || !rest[index + 1] || rest[index + 1]?.startsWith("--")) {
      throw new Error(`Opción desconocida, repetida o incompleta: ${arg ?? ""}`);
    }
    scripts.push(rest[index + 1]!);
    index += 1;
  }
  const result = await interveneActiveCampaign(root, providerId, scripts, apply, (simulation, comparison) => {
    printReportLine(formatInterventionComparison(comparison));
    if (simulation) printReportLine(formatInterventionSimulation(simulation, true));
  });
  printReportLine(`LOTE | ${result.runId}`);
  if (!result.applied) {
    printStatus("WARN", result.simulation ?
      "Solo simulación; para aplicar vuelve a ejecutar exactamente los mismos --script con --aplicar" :
      "Sin modificaciones pendientes; no se generó ningún plan ni archivo");
    return;
  }
  printStatus("PASS", `INTERVENCIÓN APLICADA | ${result.derivedFile}`);
  printStatus("PASS", `PREPARACIÓN VALIDADA | ${result.preparationFile}`);
  printReportLine(`  Ready ${result.ready} | Review ${result.review}`);
  printReportLine("  La publicación requiere acreditación editorial explícita; continúa con acreditar");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignIntervention(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("intervenir", error);
    process.exitCode = 1;
  });
}
