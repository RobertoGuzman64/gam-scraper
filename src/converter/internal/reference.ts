import { normalizeSpace } from "./string.js";

export const refWithPrefix = (raw: string, prefix: string): string => {
    const t = normalizeSpace(raw);
    if (!t) return "";
    const upper = t.toUpperCase();
    if (upper.startsWith(prefix.toUpperCase())) return t;
    if (/^[A-Z]{1,5}-/.test(t)) return t;
    return `${prefix}${t}`;
};
