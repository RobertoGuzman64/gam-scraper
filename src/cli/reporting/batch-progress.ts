import type { ScrapeEvent } from "../../contracts/progress.js";
import type { ProviderRun } from "../../pipeline/batch/report.js";
import type { BatchObserver } from "../../pipeline/batch/run.js";
import { formatCategoryProgress } from "./scrape-progress.js";
import { LiveStatus, formatDuration } from "./live-status.js";
import { formatProgressBar, formatStatus, printStatus, printReportLine } from "./terminal.js";

export class BatchConsole implements BatchObserver {
  private readonly status = new LiveStatus();
  private current = "";
  private loggedFailure = false;
  private completed = 0;
  private total = 0;

  start(runDir: string, total: number): void {
    this.total = total;
    this.completed = 0;
    printReportLine(`LOTE | ${total} proveedor${total === 1 ? "" : "es"} | logs e historial en ${runDir}`);
  }

  recoveredLock(pid: number): void {
    printReportLine(`LOTE | Recuperado bloqueo abandonado | PID anterior: ${pid}`);
  }

  begin(providerId: string, position: number, count: number): void {
    this.current = providerId;
    this.loggedFailure = false;
    this.status.log(`  ${formatProgressBar(this.completed, this.total)} | ${providerId} | iniciando`);
    this.status.update(`[${position}/${count}] ${providerId} | iniciando scraper`);
  }

  progress(providerId: string, event: ScrapeEvent): void {
    if (providerId !== this.current) return;
    if (event.type === "stage") {
      this.status.update(`${providerId} | ${event.stage}${event.resource ? ` | ${event.resource}` : ""}`);
    } else if (event.type === "progress") {
      this.status.update(`${providerId} | ${formatCategoryProgress(event.progress, "").trim()}`);
    } else {
      this.loggedFailure = true;
      this.status.log(`  ${formatStatus("FAIL", `${providerId} | ${event.stage} | ${event.resource}`)}\n  Causa: ${event.reason}`, true);
    }
  }

  end(result: ProviderRun): void {
    this.status.stop();
    this.completed += 1;
    if (result.status === "complete") {
      printStatus("PASS", `${result.providerId.toUpperCase()} | ${result.products ?? 0} productos | ${formatDuration(result.durationMs)} | ${formatProgressBar(this.completed, this.total)}`);
    } else {
      if (this.loggedFailure) printStatus("FAIL", `${result.providerId} | ${formatDuration(result.durationMs)} | fallo confirmado`);
      else printStatus("FAIL", `${result.providerId} | ${formatDuration(result.durationMs)}\n  Causa: ${result.error ?? "Error no identificado"}`);
      console.error(`  Log: ${result.logFile}`);
      if (result.archivedErrorsFile) console.error(`  Errores: ${result.archivedErrorsFile}`);
      if (result.archivedSummaryFile) console.error(`  Resumen: ${result.archivedSummaryFile}`);
    }
  }

  cancelled(): void {
    this.status.stop();
    printStatus("WARN", "Lote interrumpido | no se ejecutan más proveedores");
  }

  stop(): void {
    this.status.stop();
  }
}
