import { setImmediate as yieldToTerminal } from "node:timers/promises";
import { runToolTask } from "../../cli/reporting/tool-task.js";
import type { LiveStatus } from "../../cli/reporting/live-status.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCsv } from "../../shared/csv-parse.js";
import { toCsv } from "../../shared/csv.js";
import { normalizeGamRows, type Report } from "./normalization/normalize-rows.js";

type Args = {
  readonly input: string;
  readonly output: string;
  readonly report: string;
  readonly allowUnknown: boolean;
  readonly expandSpecColumns: boolean;
  readonly maxValuesPerKey: number;
};

const defaultInput = "storage/scraped/gam/scrape-gam-marzo-2026-all.csv";
const defaultOutput = "storage/normalized/gam/scrape-gam-marzo-2026-all.normalized.csv";
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

const main = async (status: LiveStatus): Promise<string> => {
  const args = parseArgs(process.argv.slice(2));
  status.update(`NORMALIZACIÓN GAM | leyendo ${args.input}`);

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  const reportPath = resolve(args.report);

  const raw = await readFile(inputPath, "utf8");
  const parsed = parseCsv(raw);

  const headers = [...parsed.headers];
  const rows = parsed.rows;

  status.update(`NORMALIZACIÓN GAM | procesando 0/${rows.length} filas`);
  const stats = await normalizeGamRows(rows, headers, args, async (done, total) => {
    status.update(`NORMALIZACIÓN GAM | procesando ${done}/${total} filas`);
    await yieldToTerminal();
  });

  status.update(`NORMALIZACIÓN GAM | guardando CSV | ${outputPath}`);
  await ensureOutputDir(outputPath);
  const csvOut = toCsv(rows, headers);
  await writeFile(outputPath, csvOut, "utf8");

  status.update(`NORMALIZACIÓN GAM | guardando informe | ${reportPath}`);
  await ensureOutputDir(reportPath);
  const report: Report = {
    inputCsv: args.input,
    outputCsv: args.output,
    reportPath: args.report,
    totalRows: rows.length,
    rowsWithSpecJson: stats.rowsWithSpecJson,
    rowsWithInvalidSpecJson: stats.rowsWithInvalidSpecJson,
    unknownKeys: stats.unknownKeys,
    renamedKeysTop: stats.renamedKeysTop,
    specsSummary: stats.specsSummary
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  const unknownTotal = Object.values(stats.unknownKeys).reduce((acc, v) => acc + v, 0);
  if (!args.allowUnknown && (unknownTotal > 0 || stats.rowsWithInvalidSpecJson > 0)) {
    process.exitCode = 1;
  }
  return `${rows.length} filas | JSON inválidos: ${stats.rowsWithInvalidSpecJson} | Claves desconocidas: ${unknownTotal}\n  CSV: ${outputPath}\n  Informe: ${reportPath}`;
};

await runToolTask("NORMALIZACIÓN GAM", main);
