import { SPEC_KEY_NORMALIZATION, SPEC_RULES, type SpecRuleType } from "../../normalizer/specRules.js";
import { parseBoolean, parseDimension, parseDimensionRect, parseNumber, parseNumberArray } from "../../normalizer/specParsers.js";
import { normalizeSpace } from "./string.js";
import type { SpecValue } from "./types.js";

export const isNullLike = (v: unknown): boolean => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") {
        const t = normalizeSpace(v).toLowerCase();
        if (!t) return true;
        if (t === "null" || t === "undefined") return true;
        if (t === "n/a" || t === "na" || t === "no aplica") return true;
        if (t === "-" || t === "—") return true;
    }
    return false;
};

export const normalizeSpecKey = (rawKey: string): string => {
    const k0 = normalizeSpace(rawKey);
    if (!k0) return "";
    return SPEC_KEY_NORMALIZATION[k0.toLowerCase()] ?? k0;
};

export const parseSpecByRule = (key: string, value: unknown): SpecValue | null => {
    if (!key) return null;
    if (isNullLike(value)) return null;

    const rule: SpecRuleType = SPEC_RULES[key] ?? "string";

    if (rule === "number") {
        const n = parseNumber(value);
        return n === null ? null : n;
    }

    if (rule === "number_array") {
        const arr = parseNumberArray(value);
        return arr === null ? null : arr;
    }

    if (rule === "bool") {
        const b = parseBoolean(value);
        return b === null ? null : b;
    }

    if (rule === "dimension") {
        const d = parseDimension(value);
        if (!d) return null;
        const out: number[] = [];
        if (d.largo !== null) out.push(d.largo);
        if (d.ancho !== null) out.push(d.ancho);
        if (d.grosor !== null) out.push(d.grosor);
        return out.length >= 2 ? out : null;
    }

    if (rule === "dimension_rect") {
        const d = parseDimensionRect(value);
        if (!d) return null;
        if (d.ancho === null || d.largo === null) return null;
        return [d.ancho, d.largo];
    }

    const s = normalizeSpace(typeof value === "string" ? value : String(value));
    if (!s) return null;

    const lower = s.toLowerCase();
    if (lower === "null" || lower === "undefined" || lower === "n/a" || lower === "na" || lower === "no aplica") return null;

    if (key === "Nº de serie") return s;

    return s;
};
