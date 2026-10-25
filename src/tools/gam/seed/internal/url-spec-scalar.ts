import { normalizeSpace } from "./string.js";

const parseNumberLike = (s: string): number | null => {
    const t = normalizeSpace(s);
    if (!t) return null;

    const pure = t.replace(/\./g, "").replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(pure)) return Number(pure);

    const m = pure.match(/^(\d+(?:\.\d+)?)(?:\s*(?:mm|cm|m|kg|kW|w|%|h|horas))$/i);
    if (m?.[1]) return Number(m[1]);

    const m2 = pure.match(/^(\d+(?:\.\d+)?)/);
    if (m2?.[1] && /(?:mm|cm|m|kg|%|h|horas)\b/i.test(pure)) return Number(m2[1]);

    return null;
};

export const parseUrlSpecScalar = (v: unknown): string | number | boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return String(v);

    const t = normalizeSpace(v);
    if (!t) return "";

    const lower = t.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;

    const n = parseNumberLike(t);
    if (n !== null && Number.isFinite(n)) return n;

    return t;
};

