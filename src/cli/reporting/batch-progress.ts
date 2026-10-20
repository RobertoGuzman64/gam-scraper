import type { ScrapeEvent } from "../../contracts/progress.js";
import type { ProviderRun } from "../../pipeline/batch/report.js";
import type { BatchObserver } from "../../pipeline/batch/run.js";
import { formatCategoryProgress } from "./scrape-progress.js";
import { LiveStatus, formatDuration } from "./live-status.js";

export class BatchConsole implements BatchObserver {
  private readonly status = new LiveStatus();
  private current = "";
  private loggedFailure = false;

  start(runDir: string, total: number): void {
    console.log(`LOTE | ${total} proveedor${total === 1 ? "" : "es"} | logs e historial en ${runDir}`);
  }

  begin(providerId: string, position: number, count: number): void {
    this.current = providerId;
    this.loggedFailure = false;
    this.status.log(`  [${position}/${count}] ${providerId} | iniciando`);
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
      this.status.log(`  [ERROR] ${providerId} | ${event.stage} | ${event.resource}\n  Causa: ${event.reason}`, true);
    }
  }

  end(result: ProviderRun): void {
    this.status.stop();
    if (result.status === "complete") {
      console.log(`  [OK] ${result.providerId} | ${result.products ?? 0} productos | ${formatDuration(result.durationMs)}`);
    } else {
      if (this.loggedFailure) console.error(`  [ERROR] ${result.providerId} | ${formatDuration(result.durationMs)} | fallo confirmado`);
      else console.error(`  [ERROR] ${result.providerId} | ${formatDuration(result.durationMs)}\n  Causa: ${result.error ?? "Error no identificado"}`);
      console.error(`  Log: ${result.logFile}`);
      if (result.archivedErrorsFile) console.error(`  Errores: ${result.archivedErrorsFile}`);
      if (result.archivedSummaryFile) console.error(`  Resumen: ${result.archivedSummaryFile}`);
    }
  }

  cancelled(): void {
    this.status.stop();
    console.error("[CANCELADO] Lote interrumpido | no se ejecutan más proveedores");
  }

  stop(): void {
    this.status.stop();
  }
}
