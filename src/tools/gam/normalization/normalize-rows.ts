import { normalizeSpecKey, normalizeSpecsObject, type DiscardReason } from "../../../catalog/normalization/normalize-specs.js";
import { SPEC_RULES } from "../../../catalog/normalization/spec-rules.js";
import { isSpecColumn, normalizeSpace, normalizedValueToScalar, toScalarString } from "./spec-scalar.js";

export type SpecSummary = {
  readonly total: number;
  readonly typeCounts: Readonly<Record<"string" | "number" | "boolean", number>>;
  readonly valueCountsTop: ReadonlyArray<{ readonly value: string; readonly count: number }>;
  readonly badValueExamples: ReadonlyArray<{ readonly value: string; readonly reference?: string }>;
};

export type NormalizationIssueReason = DiscardReason | "unknown_key" | "invalid_spec_json";

export type NormalizationIssue = {
  readonly row: number;
  readonly reference: string | null;
  readonly key: string;
  readonly sourceKey: string;
  readonly reason: NormalizationIssueReason;
  readonly originalValue: string | null;
};

export type Report = {
  readonly inputCsv: string;
  readonly outputCsv: string;
  readonly reportPath: string;
  readonly totalRows: number;
  readonly rowsWithSpecJson: number;
  readonly rowsWithInvalidSpecJson: number;
  readonly unknownKeys: Readonly<Record<string, number>>;
  readonly aliasConflicts: Readonly<Record<string, number>>;
  readonly issueCounts: Readonly<Record<NormalizationIssueReason, number>>;
  readonly issueExamples: ReadonlyArray<NormalizationIssue>;
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

export type NormalizationStatistics = Pick<Report, "rowsWithSpecJson" | "rowsWithInvalidSpecJson" | "unknownKeys" | "aliasConflicts" | "issueCounts" | "issueExamples" | "renamedKeysTop" | "specsSummary"> & {
  readonly rowsProcessed: number;
  readonly rowsTransformed: number;
  readonly renamedKeysTotal: number;
  readonly technicalValuesTransformed: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const reportValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return typeof text === "string" ? normalizeSpace(text).slice(0, 160) : null;
};

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
  const conflictCounts = new Map<string, number>();
  const renamedCounts = new Map<string, { readonly from: string; readonly to: string; count: number }>();

  const allNormalizedSpecKeys = new Set<string>();
  const summaryMap: Record<string, SummaryWorking> = {};
  const issueCounts: Record<NormalizationIssueReason, number> = {
    null_like: 0,
    invalid_value: 0,
    unit_mismatch: 0,
    conditional_value: 0,
    alias_conflict: 0,
    unknown_key: 0,
    invalid_spec_json: 0
  };
  const issueExamples: NormalizationIssue[] = [];

  let processed = 0;
  for (const row of rows) {
    const before = { ...row };
    processed += 1;
    if (processed % 250 === 0) {
      await onProgress(processed, rows.length);
    }
    const refMaybe = typeof row["reference"] === "string" ? normalizeSpace(row["reference"]) : "";
    const reference = refMaybe || null;
    const recordIssue = (key: string, sourceKey: string, reason: NormalizationIssueReason, value: unknown): void => {
      issueCounts[reason] += 1;
      if (issueExamples.length < 80) {
        issueExamples.push({ row: processed, reference, key, sourceKey, reason, originalValue: reportValue(value) });
      }
    };
    const specJson = row["specJson"] ?? "";
    if (specJson.trim()) rowsWithSpecJson += 1;

    const parsedSpec = safeJsonParse(specJson);
    if (!parsedSpec.ok || !isObject(parsedSpec.value)) {
      rowsWithInvalidSpecJson += 1;
      recordIssue("specJson", "specJson", "invalid_spec_json", specJson);
      continue;
    }

    const norm = normalizeSpecsObject(parsedSpec.value);

    for (const k of norm.unknownKeys) unknownCounts.set(k, (unknownCounts.get(k) ?? 0) + 1);
    for (const [sourceKey, originalValue] of Object.entries(parsedSpec.value)) {
      const key = normalizeSpecKey(sourceKey);
      if (!Object.hasOwn(SPEC_RULES, key)) recordIssue(key, sourceKey, "unknown_key", originalValue);
    }
    for (const discarded of norm.discardedSpecs) {
      recordIssue(discarded.key, discarded.rawKey, discarded.reason, discarded.value);
      if (discarded.reason !== "null_like") {
        const summary = ensureSummary(summaryMap, discarded.key);
        const badValue = reportValue(discarded.value);
        if (badValue && summary.badValueExamples.length < 10) {
          summary.badValueExamples.push(reference ? { value: badValue, reference } : { value: badValue });
        }
      }
    }
    for (const conflict of norm.conflictingKeys) {
      conflictCounts.set(conflict.key, (conflictCounts.get(conflict.key) ?? 0) + 1);
    }

    for (const r of norm.renamedKeys) {
      const key = `${r.from}→${r.to}`;
      const existing = renamedCounts.get(key) ?? { from: r.from, to: r.to, count: 0 };
      renamedCounts.set(key, { from: existing.from, to: existing.to, count: existing.count + 1 });
    }

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
    const conflictKeys = new Set(norm.conflictingKeys.map(({ key }) => key));
    const preserved = isObject(parsedSpec.value)
      ? Object.fromEntries(Object.entries(parsedSpec.value).filter(([rawKey]) => {
        const key = normalizeSpecKey(rawKey);
        return !Object.hasOwn(SPEC_RULES, key) || conflictKeys.has(key);
      }))
      : {};
    row["specJson"] = JSON.stringify({ ...preserved, ...scalarSpec });

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

  const aliasConflicts: Record<string, number> = {};
  for (const [key, count] of Array.from(conflictCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    aliasConflicts[key] = count;
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
    aliasConflicts,
    issueCounts,
    issueExamples,
    renamedKeysTop: renamedTop,
    specsSummary: specsSummaryOut
  };
};
