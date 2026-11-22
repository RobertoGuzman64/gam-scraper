import { LiveStatus, formatDuration } from "./live-status.js";
import { formatProgressBar, formatStatus, printStatus, type TerminalStatus } from "./terminal.js";

export class OperationProgress {
  private readonly live = new LiveStatus();
  private readonly startedAt = Date.now();
  private stageName: string | null = null;
  private stageStartedAt = this.startedAt;
  private closed = false;
  private lastCompleted = 0;

  constructor(private readonly operation: string) {}

  stage(name: string, detail?: string): void {
    if (this.closed) return;
    this.closeStage("PASS");
    this.stageName = name;
    this.stageStartedAt = Date.now();
    this.lastCompleted = 0;
    this.update(detail ?? "en curso");
  }

  update(detail: string, completed?: number, total?: number): void {
    if (this.closed || this.stageName === null) return;
    const bar = completed !== undefined && total !== undefined ? formatProgressBar(completed, total) : "";
    const message = [this.operation, this.stageName, detail, bar].filter(Boolean).join(" | ");
    this.live.update(message);
    if (bar && completed !== undefined && completed > this.lastCompleted) {
      this.lastCompleted = completed;
      this.live.log(formatStatus("RUN", message));
    }
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
    printStatus(status, `${this.operation} | ${this.stageName} | ${formatDuration(Date.now() - this.stageStartedAt)}`);
    this.stageName = null;
  }
}
