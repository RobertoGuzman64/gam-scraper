import { normalizeSpecsObject } from "../../../catalog/normalization/normalize-specs.js";
import { isSpecColumn, normalizeSpace, normalizedValueToScalar, toScalarString } from "./spec-scalar.js";

export type SpecSummary = {
  readonly total: number;
  readonly typeCounts: Readonly<Record<"string" | "number" | "boolean", number>>;
  readonly valueCountsTop: ReadonlyArray<{ readonly value: string; readonly count: number }>;
  readonly badValueExamples: ReadonlyArray<{ readonly value: string; readonly reference?: string }>;
};

export type Report = {
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

const safeJsonParse = (txt: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  const t = txt.trim();
  if (!t) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false };
  }
};

type NormalizeOptions = {
  readonly expandSpecColumns: boolean;
  readonly maxValuesPerKey: number;
};

export type NormalizationStatistics = Pick<Report, "rowsWithSpecJson" | "rowsWithInvalidSpecJson" | "unknownKeys" | "renamedKeysTop" | "specsSummary"> & {
  readonly rowsProcessed: number;
  readonly rowsTransformed: number;
  readonly renamedKeysTotal: number;
  readonly technicalValuesTransformed: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rowChanged = (before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): boolean =>
  Object.keys(before).length !== Object.keys(after).length ||
  Object.entries(before).some(([key, value]) => after[key] !== value);

const countTechnicalChanges = (
  raw: unknown,
  renamedKeys: ReadonlyArray<{ readonly from: string; readonly to: string }>,
  normalized: Readonly<Record<string, string | number | boolean>>
): { readonly renamed: number; readonly values: number } => {
  if (!isObject(raw)) return { renamed: 0, values: 0 };
  const mappings = new Map(renamedKeys.map(({ from, to }) => [from, to]));
  const sources = new Map<string, string[]>();
  for (const key of Object.keys(raw)) {
    const target = mappings.get(key) ?? key.trim();
    const existing = sources.get(target) ?? [];
    existing.push(key);
    sources.set(target, existing);
  }
  let renamed = 0;
  let values = 0;
  for (const [key, value] of Object.entries(normalized)) {
    const from = sources.get(key);
    if (!from || from.length !== 1) continue;
    const sourceKey = from[0];
    if (sourceKey === undefined) continue;
    if (sourceKey !== key) renamed += 1;
    const originalValue = raw[sourceKey];
    if ((typeof originalValue === "string" || typeof originalValue === "number" || typeof originalValue === "boolean") &&
      originalValue !== value) values += 1;
  }
  return { renamed, values };
};

export const normalizeGamRows = async (
  rows: readonly Record<string, string>[],
  headers: string[],
  options: NormalizeOptions,
  onProgress: (done: number, total: number) => Promise<void>
): Promise<NormalizationStatistics> => {
  let rowsWithSpecJson = 0;
  let rowsWithInvalidSpecJson = 0;
  let rowsTransformed = 0;
  let renamedKeysTotal = 0;
  let technicalValuesTransformed = 0;

  const unknownCounts = new Map<string, number>();
  const renamedCounts = new Map<string, { readonly from: string; readonly to: string; count: number }>();

  const allNormalizedSpecKeys = new Set<string>();
  const summaryMap: Record<string, SummaryWorking> = {};

  let processed = 0;
  for (const row of rows) {
    const before = { ...row };
    processed += 1;
    if (processed % 250 === 0) {
      await onProgress(processed, rows.length);
    }
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

    const changes = countTechnicalChanges(parsedSpec.value, norm.renamedKeys, scalarSpec);
    renamedKeysTotal += changes.renamed;
    technicalValuesTransformed += changes.values;
    row["specJson"] = JSON.stringify(scalarSpec);

    if (options.expandSpecColumns) {
      for (const [k, v] of Object.entries(scalarSpec)) {
        row[`spec__${k}`] = typeof v === "string" ? v : toScalarString(v);
      }

      for (const h of headers) {
        if (!isSpecColumn(h)) continue;
        const key = h.slice("spec__".length);
        if (!Object.prototype.hasOwnProperty.call(scalarSpec, key)) row[h] = "";
      }
    }
    if (rowChanged(before, row)) rowsTransformed += 1;
  }

  const unknownKeysObj: Record<string, number> = {};
  for (const [k, n] of Array.from(unknownCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    unknownKeysObj[k] = n;
  }

  const renamedTop = Array.from(renamedCounts.values())
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from, "es") || a.to.localeCompare(b.to, "es"))
    .slice(0, 50)
    .map((x) => ({ from: x.from, to: x.to, count: x.count }));

  if (options.expandSpecColumns) {
    const existingSpecCols = new Set(headers.filter(isSpecColumn));
    const additions = Array.from(allNormalizedSpecKeys)
      .map((k) => `spec__${k}`)
      .filter((h) => !existingSpecCols.has(h))
      .sort((a, b) => a.localeCompare(b, "es"));

    headers.push(...additions);
  }

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
      valueCountsTop: topCounts(s.valueCounts, options.maxValuesPerKey),
      badValueExamples: bad
    };
  }

  return {
    rowsProcessed: rows.length,
    rowsTransformed,
    renamedKeysTotal,
    technicalValuesTransformed,
    rowsWithSpecJson,
    rowsWithInvalidSpecJson,
    unknownKeys: unknownKeysObj,
    renamedKeysTop: renamedTop,
    specsSummary: specsSummaryOut
  };
};
