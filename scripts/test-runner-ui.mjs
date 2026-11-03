import { relative } from "node:path";
import { clearLine, clearScreenDown, cursorTo, moveCursor } from "node:readline";

const tone = (value, code, enabled) => enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
const normalize = (value) => String(value).replaceAll("\\", "/");
const compact = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const formatRunnerTime = (milliseconds) => {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${String(minutes).padStart(2, "0")}:${remainder}`;
};

const shorten = (value, length) => {
  if (length <= 0) return "";
  if (value.length <= length) return value;
  if (length <= 3) return ".".repeat(length);
  const head = Math.max(1, Math.floor((length - 3) / 4));
  return `${value.slice(0, head)}...${value.slice(-(length - 3 - head))}`;
};

const lineWidth = (columns) => Math.max(1, columns - 1);
const laneName = (name) => name === "intensiva" ? "INTENSIVA" : name === "general" ? "GENERAL" : name.toUpperCase();
const laneStatus = ({ name, reported, files, finished_ms }) =>
  `${laneName(name)} ${reported}/${files}${finished_ms !== null ? ` (${formatRunnerTime(finished_ms)})` : ""}`;

export const formatRunnerProgress = ({ progress, counts, lanes, elapsed_ms, cachedTests, laneFinished }, columns = 100, color = false) => {
  const width = lineWidth(columns);
  const pending = progress.remaining;
  const state = pending === 0 ? laneFinished ? "finalizado" : "cerrando ejecutores" :
    counts.failed > 0 ? "fallos detectados" : "recibiendo informes";
  const barWidth = Math.max(5, Math.min(28, width - 49));
  const completed = Math.round(progress.reported / Math.max(1, progress.total) * barWidth);
  const bar = `${"█".repeat(completed)}${"░".repeat(barWidth - completed)}`;
  const oldest = progress.oldest_without_report[0];
  const oldestName = oldest ? normalize(relative(process.cwd(), oldest.file)) : "";
  const mostDelayed = oldest
    ? `SIN INFORME DESDE ${formatRunnerTime(oldest.elapsed_ms)}  ${shorten(oldestName, Math.max(3, width - 25))}`
    : pending === 0 && !laneFinished
      ? "ESPERANDO  Los informes llegaron; cerrando ejecutores"
      : pending === 0 ? "INFORMES  Todos recibidos" : "SIN INFORME  Ningún archivo iniciado pendiente";
  const laneLine = lanes.length
    ? `COLAS  ${lanes.map(laneStatus).join("  ·  ")}`
    : "COLAS  Sin ejecución; resultados reutilizados de caché";
  const totalExecuted = progress.total - progress.reused;
  const raw = width < 69 ? [
    `EQUIPZILLA / TESTS  ${formatRunnerTime(elapsed_ms)}  ${state}`,
    `${progress.reported}/${progress.total} informes · ${pending} pendientes`,
    `OK ${compact(counts.passed)} · KO ${counts.failed} · OMIT ${counts.skipped} · TODO ${counts.todo}`,
    `CACHÉ ${progress.reused} suites / ${compact(cachedTests)} tests`,
    `INICIADOS ${progress.started}/${totalExecuted} · SIN INFORME ${progress.without_report} · EN COLA ${progress.not_started}`,
    laneLine,
    mostDelayed
  ] : [
    `EQUIPZILLA  /  TESTS     ${formatRunnerTime(elapsed_ms)}  ·  ${state.toUpperCase()}`,
    `${bar}  ${progress.reported}/${progress.total} INFORMES  ·  ${pending} PENDIENTES`,
    `OK ${compact(counts.passed)}  ·  FALLOS ${counts.failed}  ·  OMITIDOS ${counts.skipped}  ·  TODO ${counts.todo}`,
    `CACHÉ ${progress.reused} suites / ${compact(cachedTests)} tests  ·  EJECUCIÓN ${totalExecuted} suites`,
    `INICIADOS ${progress.started}/${totalExecuted}  ·  SIN INFORME ${progress.without_report}  ·  EN COLA ${progress.not_started}`,
    laneLine,
    mostDelayed
  ];
  const lines = raw.map((line) => shorten(line, width));
  if (!color) return lines;
  return lines.map((line, index) => {
    if (index === 0) return tone(line, counts.failed > 0 ? "1;31" : "1;36", true);
    if (index === 1) return tone(line, "1;32", true);
    if (index === 2) return tone(line, counts.failed > 0 ? "1;31" : "1;37", true);
    if (index === 6 && oldest) return tone(line, "1;33", true);
    return tone(line, "2;37", true);
  });
};

export const formatRunnerCompletion = ({ success, progress, counts, lanes, cachedTests, elapsed_ms, slowest }, columns = 100, color = false) => {
  const width = lineWidth(columns);
  const executed = progress.total - progress.reused;
  const state = success ? "CORRECTO" : "FALLIDO";
  const slowestName = slowest ? normalize(slowest.file).split("/").at(-1) : "sin ejecución";
  const slowestDuration = slowest ? ` · ${formatRunnerTime(slowest.milliseconds)}` : "";
  const rows = [
    `${state}   ${progress.reported}/${progress.total} suites con informe   ·   ${formatRunnerTime(elapsed_ms)}`,
    `${compact(counts.passed)} correctos   ·   ${counts.failed} fallidos   ·   ${counts.skipped} omitidos   ·   ${counts.todo} TODO`,
    `Caché: ${progress.reused} suites / ${compact(cachedTests)} tests   ·   Ejecutadas: ${executed} suites`,
    lanes.length ? lanes.map(laneStatus).join("   ·   ") : "Sin ejecución: resultados reutilizados de caché",
    `Suite más lenta: ${slowestName}${slowestDuration}`
  ];
  if (width < 70) return [
    tone(`EQUIPZILLA  /  ${state}`, success ? "1;32" : "1;31", color),
    `${progress.reported}/${progress.total} suites con informe  ·  ${formatRunnerTime(elapsed_ms)}`,
    `${compact(counts.passed)} OK  ·  ${counts.failed} KO  ·  ${counts.skipped} OMIT  ·  ${counts.todo} TODO`,
    `Caché: ${progress.reused} suites / ${compact(cachedTests)} tests`,
    `Ejecutadas: ${executed} suites`,
    ...(lanes.length ? lanes.map((lane) => laneStatus(lane)) : ["Sin ejecución; resultados de caché"]),
    `Suite más lenta: ${slowest ? formatRunnerTime(slowest.milliseconds) : "sin ejecución"}`,
    ...(slowest ? [slowestName] : [])
  ].map((line) => shorten(line, width));
  const boxWidth = Math.min(width, 104);
  const border = (left, right) => `${left}${"─".repeat(boxWidth - 2)}${right}`;
  const innerWidth = boxWidth - 4;
  const content = rows.map((line, index) => {
    const text = shorten(index === 0 ? `EQUIPZILLA / TESTS   ${line}` : line, innerWidth);
    const padded = `│ ${text.padEnd(innerWidth)} │`;
    return index === 0 ? tone(padded, success ? "1;32" : "1;31", color) : padded;
  });
  return [tone(border("╭", "╮"), "2;37", color), ...content, tone(border("╰", "╯"), "2;37", color)];
};

export const formatRunnerLog = ({ progress, counts, lanes, elapsed_ms }) => {
  const closing = progress.remaining === 0 && lanes.some((lane) => lane.finished_ms === null);
  return `TESTS | ${progress.reported}/${progress.total} con informe | ${progress.without_report} sin informe | ${progress.not_started} sin iniciar | ${counts.passed} correctos | ${counts.failed} fallidos | ${counts.skipped} omitidos | caché ${progress.reused} suites | ${formatRunnerTime(elapsed_ms)}${closing ? " | cerrando ejecutores" : ""}`;
};

export const formatRunnerOmission = ({ name, file, line, reason }, platform = process.platform) => {
  const location = file ? ` (${relative(process.cwd(), file)}${line ? `:${line}` : ""})` : "";
  const knownWindowsSkip = platform === "win32" && name === "rechaza enlaces simbólicos a publicaciones antes de proponer el archivado";
  const explanation = typeof reason === "string" && reason.trim()
    ? reason.trim()
    : knownWindowsSkip
      ? "Windows: la creación de enlaces simbólicos puede requerir privilegios especiales"
      : "omisión sin motivo proporcionado por node:test";
  return `  - ${name}${location} | ${explanation}\n`;
};

export const formatRunnerRegression = ({ file, before, after }, columns = 100) => {
  const suffix = ` | ${Math.round(before)} -> ${Math.round(after)} ms`;
  const available = Math.max(4, lineWidth(columns) - suffix.length - 2);
  return `  ${shorten(normalize(file), available)}${suffix}\n`;
};

export const createRunnerDisplay = (stream, { interactive, getState, now, intervalMs = 10000 }) => {
  let linesShown = 0;
  let lastLog = 0;
  const color = interactive && process.env.NO_COLOR === undefined;

  const show = () => {
    if (!interactive) return;
    const lines = formatRunnerProgress(getState(), stream.columns || 100, color);
    if (linesShown) moveCursor(stream, 0, -(linesShown - 1));
    for (const [index, line] of lines.entries()) {
      cursorTo(stream, 0);
      clearLine(stream, 0);
      stream.write(line);
      if (index < lines.length - 1) stream.write("\n");
    }
    linesShown = lines.length;
  };

  const tick = () => {
    if (interactive) {
      show();
      return;
    }
    const elapsed = now();
    if (elapsed - lastLog < intervalMs) return;
    lastLog = elapsed;
    stream.write(`${formatRunnerLog(getState())}\n`);
  };

  const finish = () => {
    if (!linesShown) return;
    moveCursor(stream, 0, -(linesShown - 1));
    cursorTo(stream, 0);
    clearScreenDown(stream);
    linesShown = 0;
  };

  return { show, tick, finish };
};
