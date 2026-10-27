export type TerminalStatus = "PASS" | "WARN" | "FAIL" | "RUN";

type TerminalColor = "cyan" | "green" | "yellow" | "red" | "muted";

type OutputStream = Pick<NodeJS.WriteStream, "isTTY">;

const colors: Readonly<Record<TerminalColor, string>> = {
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  muted: "\u001b[90m"
};

const statusColors: Readonly<Record<TerminalStatus, TerminalColor>> = {
  PASS: "green",
  WARN: "yellow",
  FAIL: "red",
  RUN: "cyan"
};

export const supportsTerminalColor = (stream: OutputStream = process.stdout): boolean =>
  stream.isTTY === true && process.env.NO_COLOR === undefined &&
  process.env.CI !== "true" && process.env.TERM !== "dumb";

export const supportsAnimation = (stream: OutputStream = process.stdout): boolean =>
  stream.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";

export const tint = (text: string, color: TerminalColor, enabled = supportsTerminalColor()): string =>
  enabled ? `${colors[color]}${text}\u001b[0m` : text;

export const formatStatus = (status: TerminalStatus, message: string, enabled = supportsTerminalColor()): string =>
  `${tint(status, statusColors[status], enabled)} | ${message}`;

export const printStatus = (status: TerminalStatus, message: string): void => {
  const output = status === "FAIL" ? process.stderr : process.stdout;
  output.write(`${formatStatus(status, message, supportsTerminalColor(output))}\n`);
};

export const formatHeader = (section: string, enabled = supportsTerminalColor()): string =>
  `${tint("◆ EQUIPZILLA", "cyan", enabled)} ${tint(`/ ${section}`, "muted", enabled)}`;

export const formatProgressBar = (completed: number, total: number, width = 12): string => {
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(total) || total <= 0 ||
    completed < 0 || completed > total || !Number.isSafeInteger(width) || width < 1 || width > 60) return "";
  const filled = Math.floor((completed / total) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${completed}/${total}`;
};
