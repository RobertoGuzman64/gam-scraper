import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCsv } from "../shared/csvParse.js";
import { toCsv } from "../shared/csv.js";
import { normalizeSpecsObject, type NormalizedSpecValue } from "../normalizer/normalizeSpecs.js";

type SpecSummary = {
  readonly total: number;
  readonly typeCounts: Readonly<Record<"string" | "number" | "boolean", number>>;
  readonly valueCountsTop: ReadonlyArray<{ readonly value: string; readonly count: number }>;
  readonly badValueExamples: ReadonlyArray<{ readonly value: string; readonly reference?: string }>;
};

type Report = {
  readonly inputCsv: string;
  readonly outputCsv: string;
  readonly reportPath: string;
  readonly totalRows: number;
  readonly rowsWithSpecJson: number;
  readonly rowsWithInvalidSpecJson: number;
  readonly unknownKeys: Readonly<Record<string, number>>;
  readonly renamedKeysTop: ReadonlyArray<{ readonly from: string; readonly to: string; readonly count: number }>;
  readonly specsSummary: Readonly<Record<string, SpecSummary>>;
};

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

const normalizeSpace = (s: string): string => s.replace(/\s+/g, " ").trim();

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

const safeJsonParse = (txt: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  const t = txt.trim();
  if (!t) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false };
  }
};

const isSpecColumn = (h: string): boolean => h.startsWith("spec__");

const ensureOutputDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

const toScalarString = (v: string | number | boolean): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const hasRawString = (v: Record<string, unknown>): v is Record<string, unknown> & { raw: string } =>
  typeof v.raw === "string";

const readNumKey = (obj: Record<string, unknown>, key: string): number | null => {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

const formatDimParts = (parts: readonly (number | null)[]): string | null => {
  const cleaned = parts.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (cleaned.length === 0) return null;
  return cleaned.join("x");
};

const normalizedValueToScalar = (v: NormalizedSpecValue): string | number | boolean | null => {
  if (v === null) return null;

  if (typeof v === "string") {
    const t = normalizeSpace(v);
    if (!t) return null;
    if (t === "[object Object]") return null;
    return t;
  }

  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    const parts = v
      .map((n) => (typeof n === "number" && Number.isFinite(n) ? String(n) : ""))
      .filter((x) => x.length > 0);
    if (parts.length === 0) return null;
    return parts.join(" | ");
  }

  if (isPlainObject(v)) {
    if (hasRawString(v)) {
      const t = normalizeSpace(v.raw);
      if (!t || t === "[object Object]") return null;
      return t;
    }

    const largo = readNumKey(v, "largo");
    const ancho = readNumKey(v, "ancho");
    const grosor = readNumKey(v, "grosor");

    const dim3 = formatDimParts([largo, ancho, grosor]);
    if (dim3) return dim3;

    const dim2 = formatDimParts([largo, ancho]);
    if (dim2) return dim2;

    const dim1 = formatDimParts([largo]);
    if (dim1) return dim1;

    const s = JSON.stringify(v);
    const t = normalizeSpace(s);
    if (!t || t === "{}" || t === "[object Object]") return null;
    return t;
  }

  const s = String(v);
  const t = normalizeSpace(s);
  if (!t || t === "[object Object]") return null;
  return t;
};

const addCount = (map: Record<string, number>, key: string, inc = 1): void => {
  map[key] = (map[key] ?? 0) + inc;
};

const topCounts = (
  counts: Record<string, number>,
  limit: number
): ReadonlyArray<{ readonly value: string; readonly count: number }> => {
  const arr = Object.entries(counts).map(([value, count]) => ({ value, count }));
  arr.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"));
  return arr.slice(0, limit);
};

type SummaryWorking = {
  total: number;
  typeCounts: Record<"string" | "number" | "boolean", number>;
  valueCounts: Record<string, number>;
  badValueExamples: Array<{ value: string; reference?: string }>;
};

const ensureSummary = (m: Record<string, SummaryWorking>, key: string): SummaryWorking => {
  const existing = m[key];
  if (existing) return existing;
  const created: SummaryWorking = {
    total: 0,
    typeCounts: { string: 0, number: 0, boolean: 0 },
    valueCounts: {},
    badValueExamples: []
  };
  m[key] = created;
  return created;
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
  const summaryMap: Record<string, SummaryWorking> = {};

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

    const refMaybe = typeof row["reference"] === "string" ? normalizeSpace(row["reference"]) : "";
    const reference = refMaybe ? refMaybe : undefined;

    const scalarSpec: Record<string, string | number | boolean> = {};

    for (const [k, v] of Object.entries(norm.normalized)) {
      const scalar = normalizedValueToScalar(v);

      if (scalar === null) {
        const s = ensureSummary(summaryMap, k);
        const badValue = typeof v === "string" ? v : JSON.stringify(v);
        if (reference) s.badValueExamples.push({ value: badValue, reference });
        else s.badValueExamples.push({ value: badValue });
        continue;
      }

      if (k === "Nº de serie") {
        const forced = typeof scalar === "string" ? scalar : String(scalar);
        const t = normalizeSpace(forced);
        if (!t) continue;
        scalarSpec[k] = t;
      } else {
        scalarSpec[k] = scalar;
      }

      const s = ensureSummary(summaryMap, k);
      s.total += 1;

      const tt = typeof scalar;
      if (tt === "string" || tt === "number" || tt === "boolean") s.typeCounts[tt] += 1;

      let valueKey: string;
      if (typeof scalar === "string") valueKey = normalizeSpace(scalar);
      else valueKey = toScalarString(scalar);
      addCount(s.valueCounts, valueKey, 1);

      allNormalizedSpecKeys.add(k);
    }

    row["specJson"] = JSON.stringify(scalarSpec);

    if (args.expandSpecColumns) {
      for (const [k, v] of Object.entries(scalarSpec)) {
        row[`spec__${k}`] = typeof v === "string" ? v : toScalarString(v);
      }

      for (const h of headers) {
        if (!isSpecColumn(h)) continue;
        const key = h.slice("spec__".length);
        if (!Object.prototype.hasOwnProperty.call(scalarSpec, key)) row[h] = "";
      }
    }
  }

  const unknownKeysObj: Record<string, number> = {};
  for (const [k, n] of Array.from(unknownCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    unknownKeysObj[k] = n;
  }

  const renamedTop = Array.from(renamedCounts.values())
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from, "es") || a.to.localeCompare(b.to, "es"))
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

  const specsSummaryOut: Record<string, SpecSummary> = {};
  for (const [k, s] of Object.entries(summaryMap)) {
    const bad = s.badValueExamples
      .filter((x) => normalizeSpace(x.value))
      .slice(0, 10)
      .map((x) => {
        const value = normalizeSpace(x.value);
        if (x.reference) return { value, reference: x.reference };
        return { value };
      });

    specsSummaryOut[k] = {
      total: s.total,
      typeCounts: s.typeCounts,
      valueCountsTop: topCounts(s.valueCounts, args.maxValuesPerKey),
      badValueExamples: bad
    };
  }

  await ensureOutputDir(reportPath);
  const report: Report = {
    inputCsv: args.input,
    outputCsv: args.output,
    reportPath: args.report,
    totalRows: rows.length,
    rowsWithSpecJson,
    rowsWithInvalidSpecJson,
    unknownKeys: unknownKeysObj,
    renamedKeysTop: renamedTop,
    specsSummary: specsSummaryOut
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  const unknownTotal = Object.values(unknownKeysObj).reduce((acc, v) => acc + v, 0);
  if (!args.allowUnknown && (unknownTotal > 0 || rowsWithInvalidSpecJson > 0)) {
    process.exitCode = 1;
  }
};

void main();
