import { readFile } from "node:fs/promises";
import { normalizeSpace } from "./string.js";
import { safeJsonParse } from "./json.js";
import type { CategoryFlatRow } from "./category-path-types.js";
import { isCategoryFlatRow } from "./category-index.js";

const normalizePath = (path: string): string[] =>
    normalizeSpace(path)
        .replace(/\\/g, "/")
        .split("/")
        .map((p) => normalizeSpace(p))
        .filter((p) => p.length > 0);

export const loadCategoryResolver = async (flatJsonPath: string): Promise<(path: string) => number | null> => {
    const raw = await readFile(flatJsonPath, "utf8");
    const parsed = safeJsonParse(raw);

    if (!Array.isArray(parsed)) throw new Error("categorySell-flat.json no es un array.");

    const flat = parsed.filter(isCategoryFlatRow);
    if (flat.length === 0) throw new Error("categorySell-flat.json está vacío o inválido.");

    const byParentAndSlug = new Map<string, number>();
    for (const r of flat) {
        const key = `${r.parentId ?? "root"}|${r.slug}`;
        byParentAndSlug.set(key, r.id);
    }

    return (path: string): number | null => {
        const parts = normalizePath(path);
        if (parts.length === 0) return null;

        let parentId: number | null = null;
        let currentId: number | null = null;

        for (const slug of parts) {
            const key = `${parentId ?? "root"}|${slug}`;
            const id = byParentAndSlug.get(key);
            if (!id) return null;
            currentId = id;
            parentId = id;
        }

        return currentId;
    };
};

