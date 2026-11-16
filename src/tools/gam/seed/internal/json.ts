import { normalizeSpace } from "./string.js";

export const safeJsonParse = (s: string): unknown => {
    const t = normalizeSpace(s);
    if (!t) return {};
    try {
        return JSON.parse(t);
    } catch {
        return {};
    }
};

export const ensureString = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v === null || v === undefined) return "";
    return String(v);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const parseSeedSpecJson = (raw: string, reference: string): Record<string, unknown> => {
    if (!raw.trim()) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new Error(`specJson inválido en ${reference}: JSON malformado`);
    }
    if (!isRecord(parsed)) {
        throw new Error(`specJson inválido en ${reference}: se esperaba un objeto`);
    }
    return parsed;
};
