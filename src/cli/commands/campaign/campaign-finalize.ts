import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeActiveCampaign } from "../../../pipeline/campaign/finalization.js";
import {
  approveActiveCampaignEditorial, decideActiveCampaignEditorial, inspectActiveCampaignEditorial
} from "../../../pipeline/campaign/editorial.js";
import type { EditorialDecisionRequest, EditorialReview } from "../../../pipeline/campaign/editorial.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const usage = `Uso: npm run acreditar [-- --simular]
  --listar                                        Consultar decisiones del borrador actual
  --consultar <proveedor> <referencia>             Consultar una ficha editorial
  --validar                                       Revisar TODAS las decisiones, sin escribir
  --decidir <proveedor> <referencia> <excluir|incluir> --motivo "..." --evidencia <https-url>
                                                  Guarda la decisión humana, sin aprobar
  --aprobar --motivo "..."                        Aprueba explícitamente todo el conjunto válido
  --simular                                       Verificar selección aprobada sin escribir
El primer uso sin opciones crea el borrador si falta. Ningún otro modo crea borradores.
Las evidencias deben incluir la URL original de la ficha. Repite --evidencia para más URLs.`;

const showReview = (review: EditorialReview): void => {
  printStatus(review.inspection.approved ? "PASS" : "WARN", `CAMPAÑA | ${review.runId} | EDITORIAL ${review.inspection.approved ? "APROBADA" : "PENDIENTE"}`);
  printReportLine(`  Acreditación: ${review.draftFile}`);
  printReportLine(`  Decisiones válidas: ${review.inspection.completed}/${review.inspection.total}`);
  if (review.inspection.issues.length) {
    for (const issue of review.inspection.issues) {
      printReportLine(`  PENDIENTE | ${issue.providerId && issue.reference ? `${issue.providerId}:${issue.reference}` : "global"} | ${issue.message}`);
    }
  } else {
    printReportLine(review.inspection.approved
      ? "  La acreditación está aprobada y lista para seleccionar"
      : "  Decisiones válidas; falta aprobar explícitamente el conjunto");
  }
};

const readOption = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${name}`);
  return value;
};

export const runCampaignFinalization = async (args: readonly string[], rootDirectory: string = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(usage);
    return;
  }
  printReportLine(formatHeader("ACREDITACIÓN"));
  if (!args.length || (args.length === 1 && args[0] === "--dry-run")) {
    const result = await finalizeActiveCampaign(rootDirectory, args.length === 1);
    printStatus(result.status === "selected" ? "PASS" : "WARN", `CAMPAÑA | ${result.runId} | ${result.status.toUpperCase()}`);
    printReportLine(`  Borrador asociado a las preparaciones vigentes: ${result.draftFile}`);
    printReportLine(`  Decisiones editoriales necesarias: ${result.decisions}`);
    if (result.status === "draft") printReportLine("  Consulta las fichas mediante npm run acreditar -- --listar");
    else if (result.status === "pending") printReportLine("  Ejecuta --validar para consultar las decisiones pendientes");
    else if (result.selection) {
      printReportLine(`  Originales ${result.selection.totals.original} | Publicables ${result.selection.totals.publishable} | Excluidos ${result.selection.totals.excluded}`);
      printReportLine(result.selectionDir ? `  Selección íntegra: ${result.selectionDir}` : "  Simulación sin escrituras");
      if (result.selectionDir) printReportLine("  SIGUIENTE | npm run entregar");
    }
    return;
  }
  if (args.length === 1 && args[0] === "--listar") {
    const review = await inspectActiveCampaignEditorial(rootDirectory);
    showReview(review);
    for (const entry of review.accreditation.exclusions) {
      printReportLine(`  FICHA | ${entry.providerId}:${entry.reference} | ${entry.status} | ${entry.decision ?? "pendiente"}`);
    }
    return;
  }
  if (args.length === 3 && args[0] === "--consultar") {
    const review = await inspectActiveCampaignEditorial(rootDirectory);
    const entry = review.accreditation.exclusions.find((item) => item.providerId === args[1] && item.reference === args[2]);
    if (!entry) throw new Error("La ficha solicitada no requiere acreditación en este lote");
    printReportLine(`FICHA | ${entry.providerId}:${entry.reference} | ${entry.status}`);
    printReportLine(`  Fuente: ${entry.sourceUrl}`);
    for (const issue of entry.issues) printReportLine(`  Incidencia: ${issue}`);
    printReportLine(`  Decisión: ${entry.decision ?? "pendiente"}`);
    printReportLine(`  Motivo: ${entry.reason ?? "pendiente"}`);
    for (const evidence of entry.evidenceUrls) printReportLine(`  Evidencia: ${evidence}`);
    return;
  }
  if (args.length === 1 && args[0] === "--validar") {
    const review = await inspectActiveCampaignEditorial(rootDirectory);
    showReview(review);
    if (review.inspection.issues.length) throw new Error(`${review.inspection.issues.length} incidencias editoriales sin resolver`);
    return;
  }
  if (args[0] === "--decidir") {
    if (args.length < 8 || args[1]?.startsWith("--") || args[2]?.startsWith("--") ||
      (args[3] !== "incluir" && args[3] !== "excluir") || args[4] !== "--motivo") {
      throw new Error(usage);
    }
    const reason = readOption(args, "--motivo");
    const evidenceUrls: string[] = [];
    for (let index = 6; index < args.length; index += 2) {
      if (args[index] !== "--evidencia" || !args[index + 1] || args[index + 1]?.startsWith("--")) {
        throw new Error("Usa --evidencia <https-url> una o varias veces");
      }
      evidenceUrls.push(args[index + 1]!);
    }
    if (!reason || !evidenceUrls.length || args[5] !== reason) throw new Error(usage);
    const request: EditorialDecisionRequest = {
      providerId: args[1]!, reference: args[2]!, decision: args[3], reason, evidenceUrls
    };
    showReview(await decideActiveCampaignEditorial(rootDirectory, request));
    return;
  }
  if (args.length === 3 && args[0] === "--aprobar" && args[1] === "--motivo" && args[2]) {
    const review = await approveActiveCampaignEditorial(rootDirectory, args[2]);
    showReview(review);
    printReportLine("  Ejecuta npm run acreditar para generar la selección acreditada");
    return;
  }
  throw new Error(usage);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignFinalization(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("acreditar", error);
    process.exitCode = 1;
  });
}
