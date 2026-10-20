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
