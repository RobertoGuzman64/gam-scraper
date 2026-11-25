import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../../options/individual-catalog.js";
import { formatCommandColumns, printCommandHeader, printCommandSection, printCommandProvider, printCommandResult, printCommandDeliverable, printReportLine, printStatus } from "../../../reporting/terminal.js";
import { LiveStatus, formatDuration } from "../../../reporting/live-status.js";
import { OperationProgress } from "../../../reporting/progress/operation-progress.js";
import { printCommandError } from "../../../reporting/errors.js";
import { publishIndividualCatalogs } from "../../../../publication/individual/individual-finish.js";
import { completeIndividualFinishClosure } from "../../../../publication/individual/individual-finish-closure.js";
import { individualFinishClosurePhase, listIndividualFinishJournals } from "../../../../infrastructure/filesystem/catalog/publications/individual-finish-journal.js";
import { inspectIndividualFinishPreflight } from "../../../../publication/individual/finish-preflight.js";
import type { IndividualFinishResult, IndividualFinishProgress } from "../../../../publication/individual/individual-finish.js";
import type { IndividualCatalogProvider } from "../../../../preparation/workflow/individual-context.js";
import { retainPublishedWorkReport } from "../../../reporting/individual/published-work-archive.js";
import { formatPublishedWorkTerminal } from "../../../reporting/individual/published-work.js";

export const publishIndividualHelp = `Uso:
  npm run catalogo:publicar
  npm run catalogo:publicar -- --proveedor gam
  npm run catalogo:publicar -- --simular
  npm run catalogo:publicar -- --proveedor gomariz --simular
  npm run catalogo:publicar -- --proveedor manain --simular
  npm run catalogo:publicar -- --detalle
  npm run catalogo:publicar -- --estado

Paso 2/2: FINISH. Reutiliza automáticamente exclusiones históricas idénticas y acredita antes de publicar.
Verifica la publicación interna acreditada antes de activar; activa proveedores individuales con diario de recuperación,
comprueba integridad, ejecuta retención e informe de trabajo original → publicado. --simular no escribe ni activa.
Repetir el comando recupera un conjunto parcial sin sobrescribir entregas.
No sustituye una campaña global de cuatro proveedores. --detalle muestra progreso por proveedor y diferencias. FINISH no genera ZIP externos.
--estado consulta sin escritura el diario de activación, retención e informe.`;

export const consolidate = async (workspace: string): Promise<void> => {
  const progress = new LiveStatus();
  progress.update("FINISH | RETENCIÓN | retirando históricos elegibles");
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
      throw new Error(`RETENCIÓN PENDIENTE | Publicaciones activas conservadas. ${reason}. Corrige el bloqueo; si hay una transacción interrumpida, resuelve primero con node scripts/maintenance/consolidate-local-artifacts.mjs --aplicar y repite catalogo:publicar`);
    }
  } finally {
    progress.stop();
  }
};

const withFullDiagnostics = async (
  workspace: string, providers: readonly IndividualCatalogProvider[],
  action: () => Promise<IndividualFinishResult>
): Promise<IndividualFinishResult> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FINISH PARCIAL/BLOQUEADO")) throw error;
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
  const summaries = formatCommandColumns(result.providers.map((item) => [
    `${item.publishable} publicables`, `${item.excluded} excluidas`, `altas ${item.difference.added.length}`,
    `bajas ${item.difference.removed.length}`, `cambios ${item.difference.modified.length}`
  ]));
  for (const [index, item] of result.providers.entries()) {
    const difference = item.difference;
    const removals = difference.removed.length;
    if (detailed && index > 0) printReportLine("");
    printCommandProvider(item.providerId, `${item.status} · ${summaries[index] ?? ""}`);
    if (removals > 0) printStatus("WARN", `${item.providerId.toUpperCase()} | ${removals} bajas acreditadas en el alcance publicado`);
    if (detailed) {
      printReportLine(`    Especificaciones nuevas ${difference.addedSpecifications.length} · modificadas ${difference.changedSpecifications.length}`);
    }
  }
};

export const runPublishIndividual = async (
  args: readonly string[], workspace: string,
  hooks: {
    readonly desktopDirectory?: string;
    readonly retention?: () => void | Promise<void>;
    readonly reporter?: typeof retainPublishedWorkReport;
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
        individualFinishClosurePhase(journal) === "retained" ? "RETENIDA · INFORME PENDIENTE" : "CIERRE COMPLETO";
      printStatus(journal.status === "complete" && phase === "CIERRE COMPLETO" ? "PASS" : "WARN",
        `${phase} | ${journal.completed.length}/${journal.targets.length} activaciones | ${journal.targets.map((item) => item.providerId).join(", ")}`);
      printReportLine(`  Diario: ${path}`);
      if (journal.closure?.report) printCommandDeliverable("  Informe cerrado", journal.closure.report.path);
    }
    return null;
  }
  const detailed = args.includes("--detalle");
  if (args.filter((arg) => arg === "--detalle").length > 1) throw new Error("--detalle repetido");
  const parsed = parseIndividualCatalogProviders(args.filter((arg) => arg !== "--detalle"), true);
  printCommandHeader("PASO 2/2 · FINISH", parsed.dryRun);
  const root = resolve(workspace);
  printReportLine("VALIDACIÓN Y ACREDITACIÓN");
  const progress = new OperationProgress("FINISH", detailed);
  let result: IndividualFinishResult;
  try {
    progress.stage(parsed.dryRun ? "ACREDITACIÓN" : "PREFLIGHT", `${parsed.providerIds.length} ${parsed.providerIds.length === 1 ? "proveedor" : "proveedores"}`);
    let previewStage: Parameters<IndividualFinishProgress>[0] = "ACREDITACIÓN";
    const previewProgress: IndividualFinishProgress = (stage, providerId, completed, total) => {
      if (stage !== previewStage) {
        progress.stage(stage, `${total} ${total === 1 ? "proveedor" : "proveedores"}`);
        previewStage = stage;
      }
      progress.update(providerId.toUpperCase(), completed, total);
    };
    if (parsed.dryRun) {
      result = await withFullDiagnostics(root, parsed.providerIds, () => publishIndividualCatalogs({
        workspace: root, providers: parsed.providerIds, dryRun: true, desktopDirectory: null,
        onProgress: previewProgress
      }));
    } else {
      let activeStage = "PREFLIGHT";
      let preflightComplete = false;
      const publishingProgress: IndividualFinishProgress = (stage, providerId, completed, total) => {
        if (stage === "ACREDITACIÓN") {
          const name = preflightComplete ? "ACREDITACIÓN BAJO BLOQUEO" : "PREFLIGHT";
          if (name !== activeStage) {
            progress.stage(name, `${total} ${total === 1 ? "proveedor" : "proveedores"}`);
            activeStage = name;
          }
        } else if (stage === "INSPECCIÓN") {
          const name = preflightComplete ? "REVALIDACIÓN" : "INSPECCIÓN";
          if (name !== activeStage) {
            progress.stage(name, `${total} ${total === 1 ? "proveedor" : "proveedores"}`);
            activeStage = name;
          }
          if (completed === total && !preflightComplete) preflightComplete = true;
        } else if (stage !== activeStage) {
          progress.stage(stage, `${total} ${total === 1 ? "proveedor" : "proveedores"}`,
            stage === "ENTREGA" ? "ENTREGA Y ACTIVACIÓN" : undefined);
          activeStage = stage;
        }
        progress.update(providerId.toUpperCase(), completed, total);
      };
      result = await withFullDiagnostics(root, parsed.providerIds, () => publishIndividualCatalogs({
        workspace: root, providers: parsed.providerIds, dryRun: false,
        desktopDirectory: null, onProgress: publishingProgress
      }));
    }
    progress.finish();
  } catch (error) {
    progress.abort();
    throw error;
  }
  printCommandSection(parsed.dryRun ? "RESULTADO DE SIMULACIÓN" : "PUBLICACIONES");
  describeResult(result, detailed);
  if (parsed.dryRun) {
    printCommandResult("SIMULACIÓN COMPLETA · SIN ESCRITURAS");
    return result;
  }
  printCommandSection("CIERRE DE PUBLICACIÓN");
  const closeStep = async (name: string, task: () => Promise<void>): Promise<void> => {
    const startedAt = Date.now();
    if (detailed || hooks.retention) printStatus("RUN", `FINISH | ${name} | en curso`);
    await task();
    printStatus("PASS", `FINISH | ${name} | ${formatDuration(Date.now() - startedAt)}`);
  };
  const closure = await completeIndividualFinishClosure(root, result, {
    retention: async () => { await closeStep("RETENCIÓN", async () => { await (hooks.retention ?? (() => consolidate(root)))(); }); },
    reporter: async () => {
      const startedAt = Date.now();
      if (detailed) printStatus("RUN", "FINISH | INFORME | actualizando informe técnico interno");
      const delivery = await (hooks.reporter ?? retainPublishedWorkReport)(root, result);
      printStatus("PASS", `FINISH | INFORME | ${formatDuration(Date.now() - startedAt)}`);
      printCommandSection("TRABAJO REALIZADO");
      for (const line of formatPublishedWorkTerminal(delivery.report, detailed)) printReportLine(line);
      return delivery;
    }
  });
  if (!closure.executed.includes("retained")) printStatus("PASS", "RETENCIÓN | CIERRE PREVIO CONSERVADO");
  printCommandDeliverable(closure.executed.includes("reported") ? "INFORME TÉCNICO · versión interna verificada" : "INFORME TÉCNICO · RECIBO YA CERRADO", closure.reportFile);
  if (detailed) printReportLine(`  Diario de cierre: ${closure.journalPath}`);
  printCommandResult(result.providers.every((item) => item.status === "YA VIGENTE")
    ? "FINISH COMPLETO · YA VIGENTE, sin nuevas publicaciones ni ZIP externos"
    : "FINISH COMPLETO · Publicaciones activadas y verificadas, retención e informe completados");
  return result;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPublishIndividual(process.argv.slice(2), fileURLToPath(new URL("../../../../../", import.meta.url))).catch((error: unknown) => {
    printCommandError("catalogo:publicar", error);
    process.exitCode = 1;
  });
}
