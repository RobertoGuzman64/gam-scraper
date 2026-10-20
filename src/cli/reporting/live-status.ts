import { clearLine, cursorTo } from "node:readline";

const frames = ["|", "/", "-", "\\"] as const;

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};

export class LiveStatus {
  private readonly interactive: boolean;
  private readonly startedAt = Date.now();
  private updatedAt = this.startedAt;
  private printedAt = 0;
  private frame = 0;
  private label = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private openLine = false;

  constructor(disableAnimation = false) {
    this.interactive = !disableAnimation && process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
  }

  update(label: string, changed = true): void {
    if (this.label === label && !changed) return;
    this.label = label;
    if (changed) this.updatedAt = Date.now();
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), this.interactive ? 160 : 1000);
      this.timer.unref();
    }
    if (this.interactive) this.render();
    else if (this.printedAt === 0 || (changed && Date.now() - this.printedAt >= 3000)) this.print();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.openLine) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
      this.openLine = false;
    }
    this.label = "";
  }

  log(message: string, error = false): void {
    this.clearLine();
    if (error) console.error(message);
    else console.log(message);
    if (this.interactive && this.label) this.render();
  }

  private clearLine(): void {
    if (!this.openLine) return;
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    this.openLine = false;
  }

  private tick(): void {
    if (!this.label) return;
    if (this.interactive) this.render();
    else if (Date.now() - this.printedAt >= 15_000) this.print();
  }

  private content(): string {
    const now = Date.now();
    const idle = now - this.updatedAt >= 25_000 ? ` | sin novedades ${formatDuration(now - this.updatedAt)}` : "";
    return `${this.label} | ${formatDuration(now - this.startedAt)}${idle}`;
  }

  private print(): void {
    this.printedAt = Date.now();
    console.log(this.content());
  }

  private render(): void {
    this.clearLine();
    const width = Math.max(20, (process.stdout.columns ?? 100) - 1);
    const prefix = `${frames[this.frame++ % frames.length]} `;
    const content = `${prefix}${this.content()}`;
    process.stdout.write(content.length > width ? `${content.slice(0, width - 1)}…` : content);
    this.openLine = true;
  }
}
