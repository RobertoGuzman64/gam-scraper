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

const successLabels = new Set([
  "APROBADA", "APROBADO", "CONFORME", "CORRECTO", "COMPLETA", "COMPLETO",
  "GUARDADA", "GUARDADO", "PUBLISHED", "VERIFIED", "PUBLICADA", "PUBLICADO", "READY",
  "VÁLIDA", "VÁLIDO", "INTEGRADA", "INTEGRADO", "FINALIZADA", "FINALIZADO"
]);

const warningLabels = new Set([
  "PENDIENTE", "PENDIENTE DE ACREDITACIÓN", "REVISIÓN", "PARCIAL", "SIMULACIÓN",
  "SIMULATION", "AUSENTE", "NO COMPLETA", "SIN CONFIRMAR", "BORRADOR",
  "EXCLUIDA", "EXCLUIDO", "WARN", "REVIEW", "IDENTITY"
]);

const failureLabels = new Set(["FAIL", "ERROR", "INVÁLIDA", "INVÁLIDO", "FAILED", "BLOQUEADA", "BLOQUEADO"]);

const sectionLabels = new Set([
  "DOCUMENTACIÓN Y RECURSOS ESENCIALES", "PROVEEDORES", "CAMPAÑAS CONSERVADAS",
  "CATALOGS/ VERSIONADOS", "OPCIONES DISPONIBLES", "ORIENTACIÓN OPERATIVA"
]);

const metricColors: Readonly<Record<string, TerminalColor>> = {
  "ready": "green",
  "review": "yellow",
  "publicables": "green",
  "publicadas": "green",
  "excluidas": "yellow",
  "excluidos": "yellow",
  "bloqueados": "yellow",
  "incidencias": "yellow",
  "fallos": "red",
  "errores": "red"
};

const labelColor = (value: string): TerminalColor | null => {
  if (successLabels.has(value)) return "green";
  if (warningLabels.has(value)) return "yellow";
  if (failureLabels.has(value)) return "red";
  if (value === "RUN" || value === "EN CURSO") return "cyan";
  return null;
};

const formatMetric = (label: string, value: string, enabled: boolean): string => {
  const color = metricColors[label.toLowerCase()];
  if (!color) return `${label}: ${value}`;
  const effectiveColor = value === "0" ? (["ready", "publicables", "publicadas"].includes(label.toLowerCase()) ? "yellow" : "green") : color;
  return `${tint(label, "muted", enabled)}: ${tint(value, effectiveColor, enabled)}`;
};

export const formatReportLine = (message: string, enabled = supportsTerminalColor()): string => {
  if (!enabled || message.includes("\u001b[") || message.trimStart().startsWith("{") || message.trimStart().startsWith("[")) return message;
  return message.split("\n").map((line) => {
    if (!line.trim()) return line;
    const trimmed = line.trim();
    if (sectionLabels.has(trimmed)) return tint(line, "cyan", enabled);
    const prefixMatch = /^(\s*)([^|:]+?)\s*\|\s*(.*)$/.exec(line);
    let formatted = line;
    if (prefixMatch && !prefixMatch[2]?.includes(":")) {
      const [, indent, label, rest] = prefixMatch;
      if (indent !== undefined && label !== undefined && rest !== undefined) {
        const color = labelColor(label.trim().toUpperCase());
        const leading = color ?? (indent.length === 0 ? "cyan" : "muted");
        formatted = `${indent}${tint(label.trimEnd(), leading, enabled)} | ${rest}`;
        const parts = formatted.split(" | ");
        formatted = parts.map((part, index) => {
          if (index === 0) return part;
          const partColor = labelColor(part.trim().toUpperCase());
          return partColor ? tint(part, partColor, enabled) : part;
        }).join(" | ");
      }
    } else {
      const fieldMatch = /^(\s+)([^:]+): (.*)$/.exec(line);
      if (fieldMatch) {
        const [, indent, label, value] = fieldMatch;
        if (indent !== undefined && label !== undefined && value !== undefined &&
          /^(JSON|ZIP verificado|CSV|Resumen|Origen|Preparación|Manifest|Borrador|Acreditación|SHA-256|Informe|Salida|Directorio|Carpeta|Fuente|Evidencia)$/.test(label)) {
          formatted = `${indent}${tint(label, label === "ZIP verificado" ? "green" : "cyan", enabled)}: ${value}`;
        }
      }
    }
    formatted = formatted.replace(/\b(ready|review|publicables|publicadas|excluidas|excluidos|bloqueados|incidencias|fallos|errores): (\d+)\b/gi,
      (_match, label: string, value: string) => formatMetric(label, value, enabled));
    formatted = formatted.replace(/\b(Decisiones válidas): (\d+)\/(\d+)\b/g,
      (_match, label: string, completed: string, total: string) =>
        `${tint(label, "muted", enabled)}: ${tint(`${completed}/${total}`, completed === total ? "green" : "yellow", enabled)}`);
    return formatted;
  }).join("\n");
};

export const printReportLine = (message: string): void => {
  console.log(formatReportLine(message));
};
