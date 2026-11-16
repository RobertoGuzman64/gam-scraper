import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../options/individual-catalog.js";
import { printCommandHeader, printCommandSection, printCommandProvider, printCommandResult, printCommandDeliverable, printReportLine, printStatus } from "../../reporting/terminal.js";
import { LiveStatus } from "../../reporting/live-status.js";
import { printCommandError } from "../../reporting/errors.js";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { publishIndividualCatalogs } from "../../../publication/individual-finish.js";
import { completeIndividualFinishClosure } from "../../../publication/individual-finish-closure.js";
import { individualFinishClosurePhase, listIndividualFinishJournals } from "../../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import { inspectIndividualFinishPreflight } from "../../../publication/finish-preflight.js";
import type { IndividualFinishResult } from "../../../publication/individual-finish.js";
import type { IndividualCatalogProvider } from "../../../preparation/workflow/individual-context.js";
import { runCatalogContentGaps } from "./catalog-content-gaps.js";
import { deliverPublishedWorkReport } from "../../reporting/published-work-archive.js";
import { formatPublishedWorkTerminal } from "../../reporting/published-work.js";

export const publishIndividualHelp = `Uso:
  npm run catalogo:publicar
  npm run catalogo:publicar -- --proveedor gam
  npm run catalogo:publicar -- --simular
  npm run catalogo:publicar -- --proveedor gomariz --simular
  npm run catalogo:publicar -- --detalle
  npm run catalogo:publicar -- --estado

Paso 2/2: FINISH. Reutiliza automáticamente exclusiones históricas idénticas y acredita antes de publicar.
Verifica los ZIP y recibos antes de activar; activa proveedores individuales con diario de recuperación,
comprueba integridad, ejecuta retención, auditor e informe de trabajo original → publicado. --simular no escribe ni activa.
Repetir el comando recupera un conjunto parcial sin sobrescribir entregas.
No sustituye una campaña global de cuatro proveedores. --detalle muestra diferencias y rutas de entregas.
--estado consulta sin escritura el diario de activación, retención, auditoría e informe.`;

export const consolidate = async (workspace: string): Promise<void> => {
  const progress = new LiveStatus();
  progress.update("FINISH | RETENCIÓN | archivando históricos");
  try {
    const child = spawn(process.execPath,
      [join(workspace, "scripts", "maintenance", "consolidate-local-artifacts.mjs"), "--aplicar"],
      { cwd: workspace, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    const processResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; error: Error | null }>((resolve) => {
      let error: Error | null = null;
      child.once("error", (reason) => { error = reason; });
      child.once("close", (code, signal) => resolve({ code, signal, error }));
    });
    progress.stop();
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (processResult.error || processResult.code !== 0) {
      const reason = processResult.error?.message ?? (processResult.signal
        ? `señal ${processResult.signal}` : `código ${processResult.code}`);
      throw new Error(`ARCHIVADO PENDIENTE | Publicaciones activas conservadas. ${reason}. Corrige el bloqueo y repite catalogo:publicar`);
    }
  } finally {
    progress.stop();
  }
};

const previewWithFullDiagnostics = async (
  workspace: string, providers: readonly IndividualCatalogProvider[]
): Promise<IndividualFinishResult> => {
  try {
    return await publishIndividualCatalogs({ workspace, providers, dryRun: true, desktopDirectory: null });
  } catch (error) {
    const diagnostic = await inspectIndividualFinishPreflight(workspace, providers).catch(() => null);
    if (diagnostic && !diagnostic.complete) {
      for (const entry of diagnostic.providers) {
        printStatus(entry.evaluable ? "PASS" : "WARN",
          `PREFLIGHT | ${entry.providerId} | ${entry.blockers.length} impedimentos | ${entry.absences.length} ausencias contrastables`);
        for (const blocker of entry.blockers) {
          printReportLine(`  ${blocker.reference ?? "—"} | ${blocker.step} | ${blocker.reason}`);
        }
      }
      throw new Error(`FINISH / PREFLIGHT BLOQUEADO | ${diagnostic.providers.reduce((total, entry) => total + entry.blockers.length, 0)} impedimentos identificados en ${diagnostic.providers.length} proveedores. Sin nuevas publicaciones ni activaciones. Causa inicial: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    throw error;
  }
};

const describeResult = (result: IndividualFinishResult, detailed: boolean): void => {
  for (const item of result.providers) {
    const difference = item.difference;
    const removals = difference.removed.length;
    printCommandProvider(item.providerId, `${item.status} · ${item.publishable} publicables · ${item.excluded} excluidas · altas ${difference.added.length} · bajas ${removals} · cambios ${difference.modified.length}`);
    if (removals > 0) printStatus("WARN", `${item.providerId.toUpperCase()} | ${removals} bajas acreditadas en el alcance publicado`);
    if (detailed) {
      printReportLine(`    Especificaciones nuevas ${difference.addedSpecifications.length} · modificadas ${difference.changedSpecifications.length}`);
      if (item.zipFile) printCommandDeliverable("    ZIP y recibo verificados", item.zipFile);
    }
  }
};

export const runPublishIndividual = async (
  args: readonly string[], workspace: string,
  hooks: {
    readonly desktopDirectory?: string;
    readonly retention?: () => void | Promise<void>;
    readonly auditor?: () => Promise<void>;
    readonly reporter?: typeof deliverPublishedWorkReport;
  } = {}
): Promise<IndividualFinishResult | null> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(publishIndividualHelp);
    return null;
  }
  if (args.includes("--help")) throw new Error("--help no admite otras opciones");
  if (args.length === 1 && args[0] === "--estado") {
    const entries = await listIndividualFinishJournals(workspace);
    printCommandHeader("ESTADO DE FINISH", true);
    if (!entries.length) printStatus("WARN", "No hay diarios de FINISH en el workspace");
    for (const { path, journal } of entries) {
      const phase = journal.status === "pending" ?
        journal.candidatesVerified ? "CANDIDATO VERIFICADO · ACTIVACIÓN PENDIENTE" : "CANDIDATO PENDIENTE" :
        individualFinishClosurePhase(journal) === "activated" ? "ACTIVADA · RETENCIÓN PENDIENTE" :
        individualFinishClosurePhase(journal) === "retained" ? "RETENIDA · AUDITOR PENDIENTE" :
        individualFinishClosurePhase(journal) === "audited" ? "AUDITADA · INFORME PENDIENTE" : "CIERRE COMPLETO";
      printStatus(journal.status === "complete" && phase === "CIERRE COMPLETO" ? "PASS" : "WARN",
        `${phase} | ${journal.completed.length}/${journal.targets.length} activaciones | ${journal.targets.map((item) => item.providerId).join(", ")}`);
      printReportLine(`  Diario: ${path}`);
      if (journal.closure?.report) printCommandDeliverable("  Informe cerrado", journal.closure.report.path);
    }
    return null;
  }
  const detailed = args.includes("--detalle");
  if (args.filter((arg) => arg === "--detalle").length > 1) throw new Error("--detalle repetido");
  const parsed = parseIndividualCatalogProviders(args.filter((arg) => arg !== "--detalle"));
  printCommandHeader("PASO 2/2 · FINISH", parsed.dryRun);
  const root = resolve(workspace);
  if (!parsed.dryRun) {
    const preflight = await previewWithFullDiagnostics(root, parsed.providerIds);
    printStatus("PASS", `PREFLIGHT | ${preflight.providers.length} proveedores con exclusiones acreditadas y diferencias aceptadas`);
    if (detailed) describeResult(preflight, true);
  }
  const desktopDirectory = parsed.dryRun ? null : hooks.desktopDirectory ?? await findDesktopDirectory();
  const result = parsed.dryRun
    ? await previewWithFullDiagnostics(root, parsed.providerIds)
    : await publishIndividualCatalogs({
      workspace: root, providers: parsed.providerIds, dryRun: false,
      desktopDirectory
    });
  printCommandSection(parsed.dryRun ? "RESULTADO DE SIMULACIÓN" : "PUBLICACIONES");
  describeResult(result, detailed);
  if (parsed.dryRun) {
    printCommandResult("SIMULACIÓN COMPLETA · SIN ESCRITURAS");
    return result;
  }
  printCommandSection("CIERRE DE PUBLICACIÓN");
  const closure = await completeIndividualFinishClosure(root, result, {
    retention: async () => { await (hooks.retention ?? (() => consolidate(root)))(); },
    auditor: async () => { await (hooks.auditor ?? (() => runCatalogContentGaps(["--comparar", "--specs", "--top", "5"])))(); },
    reporter: async () => {
      if (!desktopDirectory) throw new Error("No se ha resuelto el Escritorio del informe");
      const delivery = await (hooks.reporter ?? deliverPublishedWorkReport)(root, desktopDirectory, result);
      printCommandSection("TRABAJO REALIZADO");
      for (const line of formatPublishedWorkTerminal(delivery.report, detailed)) printReportLine(line);
      return delivery;
    }
  });
  printStatus("PASS", closure.executed.includes("retained") ? "RETENCIÓN | ARCHIVADO COMPLETO" : "RETENCIÓN | CIERRE PREVIO CONSERVADO");
  printStatus("PASS", closure.executed.includes("audited") ? "AUDITORÍA | COMPLETADA" : "AUDITORÍA | CIERRE PREVIO CONSERVADO");
  printCommandDeliverable(closure.executed.includes("reported") ? "INFORME TÉCNICO · ZIP verificado" : "INFORME TÉCNICO · RECIBO YA CERRADO", closure.reportFile);
  if (detailed) printReportLine(`  Diario de cierre: ${closure.journalPath}`);
  printCommandResult(result.providers.every((item) => item.status === "YA VIGENTE")
    ? "FINISH COMPLETO · YA VIGENTE, sin nuevas publicaciones ni ZIP comerciales"
    : "FINISH COMPLETO · Publicaciones activadas, verificadas y archivadas; consultar cierre del auditor por separado");
  return result;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPublishIndividual(process.argv.slice(2), fileURLToPath(new URL("../../../../", import.meta.url))).catch((error: unknown) => {
    printCommandError("catalogo:publicar", error);
    process.exitCode = 1;
  });
}
