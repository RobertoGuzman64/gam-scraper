import type { ProductRecord, SpecsMap, SpecValue } from "../../../../contracts/catalog.js";
import { normalizeSpecKey } from "../../../../catalog/normalization/normalize-specs.js";
import { parseMeasuredLength } from "../../../../catalog/normalization/spec-parsers.js";
import { resolvedEditorialUnitFamilies } from "../../../editorial/identity/editorial-unit-provenance.js";
import { hasUnconditionalEditorialClaim } from "../../../editorial/claims/editorial-claim-evidence.js";
import { gamElevationIdentityConflict } from "../../identity/evidence/elevation-identity.js";
import { gamElevationHeightConflicts } from "../elevation.js";
import { gamWorkingHeightFromDescription } from "../working-height.js";
import type { TechnicalRecoveryObservation } from "../../../provenance/technical-recovery-observation.js";

const explicitHeight = /\baltura\s+(?:m[aá]xima\s+)?de\s+trabajo\s*(?::|de)\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:metros?|m)\b/giu;
const measuredHeight = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|metros?|m)\s*$/iu;
const knownWorkHeight = new Set(["Altura de trabajo", "Altura de trabajo (m)", "Altura de trabajo (mm)"]);

const toNumber = (value: string): number => Number(value.replace(",", "."));

const comparableHeight = (value: SpecValue | undefined): number | null => {
  if (typeof value !== "string") return null;
  const match = value.match(measuredHeight);
  if (!match?.[1] || !match[2]) return null;
  const amount = toNumber(match[1]);
  return match[2].toLowerCase() === "mm" ? amount / 1000 : amount;
};

export const recoverGamExplicitWorkHeightSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || (record.categoryKey !== "elevacion" && record.categoryKey !== "elevacion-nueva") ||
    Object.keys(source).some((key) => knownWorkHeight.has(key))) return source;

  const matches = [...(record.longDescription ?? "").matchAll(explicitHeight)];
  if (matches.length === 0 || !matches[0]?.[1]) return source;
  const height = toNumber(matches[0][1]);
  if (!Number.isFinite(height) || height <= 0 || matches.some((match) => !match[1] || toNumber(match[1]) !== height)) return source;

  const existingElevation = source["Altura de elevación (m)"] ?? source["Altura de elevación (mm)"];
  if (existingElevation !== undefined) {
    const elevation = comparableHeight(existingElevation);
    if (elevation === null || height === elevation || Math.abs(height - elevation) > 0.5 + Number.EPSILON) return source;
  }

  return { ...source, "Altura de trabajo (m)": `${matches[0][1]} m` };
};

export const reconcileGamWorkingHeightPresentation = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  if (original.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(original.categoryKey) ||
    !resolvedEditorialUnitFamilies(original, original)?.[0]?.startsWith("plataforma-") ||
    gamElevationIdentityConflict(original) || gamElevationHeightConflicts(original)) return specs;
  const source = "Altura de elevación (m)";
  const field = "Altura de trabajo (m)";
  const text = original.longDescription ?? "";
  const raw = original.specs?.[source];
  const value = specs[source];
  if (typeof raw !== "string" || typeof value !== "string" || !hasUnconditionalEditorialClaim(text, explicitHeight)) return specs;
  const height = gamWorkingHeightFromDescription(original);
  if (height === null || height !== parseMeasuredLength(raw, source, "m") ||
    height !== parseMeasuredLength(value, source, "m")) return specs;
  const competing = (key: string): boolean => key !== source && /^(?:Altura de trabajo|Altura de elevación)/u.test(normalizeSpecKey(key));
  if ([...Object.keys(original.specs ?? {}), ...Object.keys(specs)].some(competing)) return specs;
  const { [source]: removed, ...remaining } = specs;
  const result = { ...remaining, [field]: value };
  observe?.(specs, result, "src/preparation/gam/measurements/evidence/work-height-evidence.ts", { spec: source });
  return result;
};
