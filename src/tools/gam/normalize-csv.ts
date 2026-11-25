import { randomUUID } from "node:crypto";
import { setImmediate as yieldToTerminal } from "node:timers/promises";
import { runToolTask } from "../../cli/reporting/tool-task.js";
import type { LiveStatus } from "../../cli/reporting/live-status.js";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCsv } from "../../shared/csv-parse.js";
import { toCsv } from "../../shared/csv.js";
import { normalizeGamRows, type Report } from "./normalization/normalize-rows.js";
import { formatNormalizationWork } from "../../cli/reporting/audits/normalization-work.js";
import { DEFAULT_OPTIONS } from "../../scraping/providers/gam/config.js";

type Args = {
  readonly input: string;
  readonly output: string;
  readonly report: string;
  readonly allowUnknown: boolean;
  readonly expandSpecColumns: boolean;
  readonly maxValuesPerKey: number;
};

const defaultInput = `storage/scraped/gam/${DEFAULT_OPTIONS.outPrefix}-all.csv`;
const defaultOutput = `storage/normalized/gam/${DEFAULT_OPTIONS.outPrefix}-all.normalized.csv`;
const defaultReport = "storage/normalized/gam/normalize.report.json";

const parseArgs = (argv: readonly string[]): Args => {
  const positional: string[] = [];
  let report = defaultReport;
  let allowUnknown = false;
  let expandSpecColumns = false;
  let maxValuesPerKey = 50;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (a === "--report") {
      const v = argv[i + 1];
      if (v) report = v;
      i += 1;
      continue;
    }
    if (a === "--max-values-per-key") {
      const v = argv[i + 1];
      if (v) {
        const n = Number(v);
        if (Number.isFinite(n)) maxValuesPerKey = Math.max(10, Math.min(200, Math.trunc(n)));
      }
      i += 1;
      continue;
    }
    if (a === "--allow-unknown") {
      allowUnknown = true;
      continue;
    }
    if (a === "--expand-spec-columns") {
      expandSpecColumns = true;
      continue;
    }
    if (a.startsWith("--")) continue;
    positional.push(a);
  }

  const input = positional[0] ?? defaultInput;
  const output = positional[1] ?? defaultOutput;

  return { input, output, report, allowUnknown, expandSpecColumns, maxValuesPerKey };
};

const ensureOutputDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

type StagedOutput = {
  readonly path: string;
  readonly stage: string;
  readonly backup: string;
  existed: boolean;
  committed: boolean;
};

const outputExists = async (path: string): Promise<boolean> =>
  stat(path).then(() => true, (error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
    throw error;
  });

const writeOutputs = async (files: readonly { readonly path: string; readonly contents: string }[]): Promise<void> => {
  const staged: StagedOutput[] = [];
  try {
    for (const file of files) {
      await ensureOutputDir(file.path);
      const entry: StagedOutput = {
        path: file.path,
        stage: `${file.path}.${randomUUID()}.tmp`,
        backup: `${file.path}.${randomUUID()}.bak`,
        existed: false,
        committed: false
      };
      staged.push(entry);
      await writeFile(entry.stage, file.contents, "utf8");
      if (await outputExists(entry.path)) {
        await copyFile(entry.path, entry.backup);
        entry.existed = true;
      }
    }
    for (const entry of staged) {
      await rename(entry.stage, entry.path);
      entry.committed = true;
    }
  } catch (error) {
    for (const entry of [...staged].reverse()) {
      if (!entry.committed) continue;
      if (entry.existed) await rename(entry.backup, entry.path);
      else await rm(entry.path, { force: true });
    }
    throw error;
  } finally {
    for (const entry of staged) {
      await rm(entry.stage, { force: true });
      await rm(entry.backup, { force: true });
    }
  }
};

const main = async (status: LiveStatus): Promise<string> => {
  const args = parseArgs(process.argv.slice(2));
  status.update(`NORMALIZACIÓN GAM | leyendo ${args.input}`);

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  const reportPath = resolve(args.report);

  if (inputPath === outputPath || inputPath === reportPath || outputPath === reportPath) {
    throw new Error("Las rutas de entrada, CSV normalizado e informe deben ser distintas");
  }

  const raw = await readFile(inputPath, "utf8");
  const parsed = parseCsv(raw);

  const headers = [...parsed.headers];
  const rows = parsed.rows;

  status.update(`NORMALIZACIÓN GAM | procesando 0/${rows.length} filas`);
  const stats = await normalizeGamRows(rows, headers, args, async (done, total) => {
    status.update(`NORMALIZACIÓN GAM | procesando ${done}/${total} filas`);
    await yieldToTerminal();
  });

  const unknownTotal = Object.values(stats.unknownKeys).reduce((acc, v) => acc + v, 0);
  const conflictTotal = Object.values(stats.aliasConflicts).reduce((acc, count) => acc + count, 0);
  const invalidTotal = stats.rowsWithInvalidSpecJson;
  if (invalidTotal > 0 || conflictTotal > 0 || (!args.allowUnknown && unknownTotal > 0)) {
    process.exitCode = 1;
    const examples = stats.issueExamples
      .filter((issue) => issue.reason === "invalid_spec_json" || issue.reason === "alias_conflict" || (!args.allowUnknown && issue.reason === "unknown_key"))
      .slice(0, 8)
      .map((issue) => `  Fila ${issue.row} | ${issue.reference ?? "sin referencia"} | ${issue.reason} | ${issue.sourceKey}: ${issue.originalValue ?? "null"}`);
    return [...formatNormalizationWork(stats), `${rows.length} filas | JSON inválidos: ${invalidTotal} | Claves desconocidas: ${unknownTotal} | Conflictos de alias: ${conflictTotal}`, ...examples, "  Normalización rechazada: sin CSV ni informe nuevos"].join("\n");
  }

  const report: Report = {
    inputCsv: args.input,
    outputCsv: args.output,
    reportPath: args.report,
    totalRows: rows.length,
    rowsWithSpecJson: stats.rowsWithSpecJson,
    rowsWithInvalidSpecJson: stats.rowsWithInvalidSpecJson,
    unknownKeys: stats.unknownKeys,
    aliasConflicts: stats.aliasConflicts,
    issueCounts: stats.issueCounts,
    issueExamples: stats.issueExamples,
    renamedKeysTop: stats.renamedKeysTop,
    specsSummary: stats.specsSummary
  };
  status.update(`NORMALIZACIÓN GAM | guardando CSV e informe`);
  await writeOutputs([
    { path: reportPath, contents: JSON.stringify(report, null, 2) },
    { path: outputPath, contents: toCsv(rows, headers) }
  ]);
  return [...formatNormalizationWork(stats), `${rows.length} filas | JSON inválidos: ${invalidTotal} | Claves desconocidas: ${unknownTotal} | Conflictos de alias: ${conflictTotal}`, `  CSV: ${outputPath}`, `  Informe: ${reportPath}`].join("\n");
};

await runToolTask("NORMALIZACIÓN GAM", main);
