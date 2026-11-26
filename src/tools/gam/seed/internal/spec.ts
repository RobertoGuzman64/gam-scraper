import { normalizeSpecKey, normalizeSpecsObject, reconcileSourceSpecsForNormalization } from "../../../../catalog/normalization/normalize-specs.js";
import { SPEC_RULES } from "../../../../catalog/normalization/spec-rules.js";
import { normalizeSpace } from "./string.js";
import type { SpecValue } from "./types.js";

export { normalizeSpecKey };

export const isNullLike = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value !== "string") return false;
    const text = normalizeSpace(value).toLowerCase();
    return !text || ["null", "undefined", "n/a", "na", "no aplica", "-", "—"].includes(text);
};

export const parseSpecByRule = (rawKey: string, value: unknown): SpecValue | null => {
    if (!rawKey || isNullLike(value)) return null;
    const key = normalizeSpecKey(rawKey);
    if (!Object.hasOwn(SPEC_RULES, key)) {
        if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
        if (typeof value === "boolean") return String(value);
        return typeof value === "string" ? normalizeSpace(value) : JSON.stringify(value) ?? null;
    }

    const parsed = normalizeSpecsObject({ [rawKey]: value }).normalized[key];
    if (parsed === undefined || parsed === null) return null;
    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") return parsed;
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && "largo" in parsed && "ancho" in parsed) {
        const parts = SPEC_RULES[key] === "dimension_rect"
            ? [parsed.ancho, parsed.largo]
            : [parsed.largo, parsed.ancho, "grosor" in parsed ? parsed.grosor : null];
        const numbers = parts.filter((part): part is number => typeof part === "number");
        return numbers.length >= (SPEC_RULES[key] === "dimension_rect" ? 2 : 1) ? numbers : null;
    }
    return null;
};

export const assertUnambiguousSpecs = (spec: Readonly<Record<string, unknown>>, reference: string): void => {
    const conflicts = normalizeSpecsObject(spec).conflictingKeys;
    if (conflicts.length > 0) {
        throw new Error(`Especificaciones incompatibles en ${reference}: ${conflicts.map(({ key }) => key).join(", ")}`);
    }
};

export const normalizeSeedSpecs = (spec: Readonly<Record<string, unknown>>, reference: string): Record<string, SpecValue> => {
    const reconciled = reconcileSourceSpecsForNormalization(spec).specs;
    assertUnambiguousSpecs(reconciled, reference);
    const normalized: Record<string, SpecValue> = {};
    for (const [rawKey, value] of Object.entries(reconciled)) {
        const key = normalizeSpecKey(normalizeSpace(rawKey));
        if (!key) continue;
        const parsed = parseSpecByRule(rawKey, value);
        if (parsed !== null) normalized[key] = parsed;
    }
    return normalized;
};
