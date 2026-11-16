import { normalizeSpace } from "./string.js";

export const parseSeedScalar = (value: unknown): string | number | boolean => {
    if (typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value !== "string") return String(value);

    const text = normalizeSpace(value);
    if (text.toLowerCase() === "true") return true;
    if (text.toLowerCase() === "false") return false;
    return text;
};
