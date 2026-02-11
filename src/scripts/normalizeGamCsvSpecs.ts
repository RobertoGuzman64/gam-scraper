import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCsv } from "../shared/csvParse.js";
import { toCsv } from "../shared/csv.js";
import { normalizeSpecsObject, type NormalizedSpecValue } from "../normalizer/normalizeSpecs.js";

type Report = {
  readonly inputCsv: string;
  readonly outputCsv: string;
  readonly reportPath: string;
  readonly totalRows: number;
  readonly rowsWithSpecJson: number;
  readonly rowsWithInvalidSpecJson: number;
  readonly unknownKeys: Readonly<Record<string, number>>;
  readonly renamedKeysTop: ReadonlyArray<{ readonly from: string; readonly to: string; readonly count: number }>;
};

type Args = {
  readonly input: string;
  readonly output: string;
  readonly report: string;
  readonly allowUnknown: boolean;
  readonly expandSpecColumns: boolean;
};

const defaultInput = "storage/scraped/gam/scrape-gam-marzo-2026-all.csv";
const defaultOutput = "storage/normalized/gam/scrape-gam-marzo-2026-all.normalized.csv";
const defaultReport = "storage/normalized/gam/normalize.report.json";

const parseArgs = (argv: readonly string[]): Args => {
  const positional: string[] = [];
  let report = defaultReport;
  let allowUnknown = false;
  let expandSpecColumns = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (a === "--report") {
      const v = argv[i + 1];
      if (v) report = v;
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

  return { input, output, report, allowUnknown, expandSpecColumns };
};

const safeJsonParse = (txt: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  const t = txt.trim();
  if (!t) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false };
  }
};

const specScalarToString = (v: string | number | boolean): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const normalizedValueToString = (v: NormalizedSpecValue): string => {
  if (v === null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return specScalarToString(v);
  if (Array.isArray(v)) return v.map((n) => specScalarToString(n)).join(" | ");
  return JSON.stringify(v);
};

const isSpecColumn = (h: string): boolean => h.startsWith("spec__");

const ensureOutputDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  const reportPath = resolve(args.report);

  const raw = await readFile(inputPath, "utf8");
  const parsed = parseCsv(raw);

  const headers = [...parsed.headers];
  const rows = parsed.rows;

  let rowsWithSpecJson = 0;
  let rowsWithInvalidSpecJson = 0;

  const unknownCounts = new Map<string, number>();
  const renamedCounts = new Map<string, { readonly from: string; readonly to: string; count: number }>();

  const allNormalizedSpecKeys = new Set<string>();

  for (const row of rows) {
    const specJson = row["specJson"] ?? "";
    if (specJson.trim()) rowsWithSpecJson += 1;

    const parsedSpec = safeJsonParse(specJson);
    if (!parsedSpec.ok) {
      rowsWithInvalidSpecJson += 1;
      continue;
    }

    const norm = normalizeSpecsObject(parsedSpec.value);

    for (const k of norm.unknownKeys) unknownCounts.set(k, (unknownCounts.get(k) ?? 0) + 1);

    for (const r of norm.renamedKeys) {
      const key = `${r.from}→${r.to}`;
      const existing = renamedCounts.get(key) ?? { from: r.from, to: r.to, count: 0 };
      renamedCounts.set(key, { from: existing.from, to: existing.to, count: existing.count + 1 });
    }

    row["specJson"] = JSON.stringify(norm.normalized);

    if (args.expandSpecColumns) {
      for (const [k, v] of Object.entries(norm.normalized)) {
        allNormalizedSpecKeys.add(k);
        row[`spec__${k}`] = normalizedValueToString(v);
      }

      for (const h of headers) {
        if (!isSpecColumn(h)) continue;
        const key = h.slice("spec__".length);
        if (!Object.prototype.hasOwnProperty.call(norm.normalized, key)) row[h] = "";
      }
    }
  }

  const unknownKeysObj: Record<string, number> = {};
  for (const [k, n] of Array.from(unknownCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    unknownKeysObj[k] = n;
  }

  const renamedTop = Array.from(renamedCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
    .map((x) => ({ from: x.from, to: x.to, count: x.count }));

  if (args.expandSpecColumns) {
    const existingSpecCols = new Set(headers.filter(isSpecColumn));
    const additions = Array.from(allNormalizedSpecKeys)
      .map((k) => `spec__${k}`)
      .filter((h) => !existingSpecCols.has(h))
      .sort((a, b) => a.localeCompare(b, "es"));

    headers.push(...additions);
  }

  await ensureOutputDir(outputPath);
  const csvOut = toCsv(rows, headers);
  await writeFile(outputPath, csvOut, "utf8");

  await ensureOutputDir(reportPath);
  const report: Report = {
    inputCsv: args.input,
    outputCsv: args.output,
    reportPath: args.report,
    totalRows: rows.length,
    rowsWithSpecJson,
    rowsWithInvalidSpecJson,
    unknownKeys: unknownKeysObj,
    renamedKeysTop: renamedTop
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  const unknownTotal = Object.values(unknownKeysObj).reduce((acc, v) => acc + v, 0);
  if (!args.allowUnknown && (unknownTotal > 0 || rowsWithInvalidSpecJson > 0)) {
    process.exitCode = 1;
  }
};

void main();
