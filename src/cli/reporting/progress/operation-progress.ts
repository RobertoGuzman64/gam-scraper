import { LiveStatus, formatDuration } from "../live-status.js";
import { printStatus, type TerminalStatus } from "../terminal.js";

export class OperationProgress {
  private readonly live = new LiveStatus();
  private readonly startedAt = Date.now();
  private stageName: string | null = null;
  private stageStartedAt = this.startedAt;
  private closed = false;
  private lastCompleted = 0;
  private lastTotal: number | null = null;
  private activeDetail: string | null = null;
  private activeStartedAt: number | null = null;
  private lastFinishedDetail: string | null = null;

  constructor(private readonly operation: string, private readonly detailed = false) {}

  stage(name: string, detail?: string): void {
    if (this.closed) return;
    this.closeStage("PASS");
    this.stageName = name;
    this.stageStartedAt = Date.now();
    this.lastCompleted = 0;
    this.lastTotal = null;
    this.activeDetail = null;
    this.activeStartedAt = null;
    this.lastFinishedDetail = null;
    this.live.update(`${this.operation} | ${name} | ${detail ?? "en curso"}`);
  }

  update(detail: string, completed?: number, total?: number): void {
    if (this.closed || this.stageName === null) return;
    const prefix = `${this.operation} | ${this.stageName}`;
    const countIsValid = completed !== undefined && total !== undefined &&
      Number.isSafeInteger(completed) && Number.isSafeInteger(total) && total > 0 &&
      completed >= 0 && completed <= total;
    if (!countIsValid || completed === undefined || total === undefined) {
      this.live.update(`${prefix} | ${detail}`);
      return;
    }
    if (completed < this.lastCompleted) return;
    this.lastTotal = total;
    if (completed > this.lastCompleted) {
      const elapsed = this.activeDetail === detail && this.activeStartedAt !== null
        ? ` | ${formatDuration(Date.now() - this.activeStartedAt)}` : "";
      if (this.detailed) {
        this.live.stop();
        this.live.log(`  ${detail} | ${completed}/${total} procesados${elapsed}`);
      } else {
        this.live.update(`${prefix} | ${detail} | ${completed}/${total}`);
      }
      this.lastCompleted = completed;
      this.lastFinishedDetail = detail;
      this.activeDetail = null;
      this.activeStartedAt = null;
      return;
    }
    if (completed === this.lastCompleted && detail === this.lastFinishedDetail) return;
    if (this.activeDetail !== detail) {
      this.activeDetail = detail;
      this.activeStartedAt = Date.now();
    }
    this.live.update(`${prefix} | ${detail} | ${completed}/${total}`);
  }

  finish(result: TerminalStatus = "PASS"): void {
    if (this.closed) return;
    this.closeStage(result);
    this.closed = true;
    printStatus(result, `${this.operation} | TOTAL | ${formatDuration(Date.now() - this.startedAt)}`);
  }

  abort(): void {
    if (this.closed) return;
    this.closeStage("WARN");
    this.closed = true;
    printStatus("WARN", `${this.operation} | INTERRUMPIDA | ${formatDuration(Date.now() - this.startedAt)}`);
  }

  log(message: string): void {
    this.live.log(message);
  }

  private closeStage(status: TerminalStatus): void {
    this.live.stop();
    if (this.stageName === null) return;
    const count = !this.detailed && this.lastTotal !== null
      ? ` | ${this.lastCompleted}/${this.lastTotal} ${this.lastTotal === 1 ? "proveedor procesado" : "proveedores procesados"}` : "";
    printStatus(status, `${this.operation} | ${this.stageName}${count} | ${formatDuration(Date.now() - this.stageStartedAt)}`);
    this.stageName = null;
  }
}
