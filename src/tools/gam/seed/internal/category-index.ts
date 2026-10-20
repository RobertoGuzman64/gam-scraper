import { readFile } from "node:fs/promises";
import { normalizeSpace } from "./string.js";
import { safeJsonParse } from "./json.js";
import type { CategoryFlatRow } from "./types.js";

export const isCategoryFlatRow = (v: unknown): v is CategoryFlatRow => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o["id"] === "number" &&
        (typeof o["parentId"] === "number" || o["parentId"] === null) &&
        typeof o["name"] === "string" &&
        typeof o["slug"] === "string"
    );
};

export const toTokens = (slug: string): readonly string[] => {
    const stop = new Set([
        "segunda",
        "mano",
        "de",
        "la",
        "el",
        "y",
        "a",
        "en",
        "por",
        "para",
        "venta",
        "ocasion",
        "usado",
        "usada",
        "alquiler",
        "diesel",
        "diésel",
        "electricas",
        "eléctricas",
        "electricos",
        "eléctricos",
        "manuales",
        "manual"
    ]);

    const parts = normalizeSpace(slug)
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ-]/g, " ")
        .replace(/-+/g, "-")
        .split(/[-\s]+/g)
        .map((p) => normalizeSpace(p))
        .filter((p) => p.length > 0);

    const filtered: string[] = [];
    for (const p of parts) {
        if (!stop.has(p)) filtered.push(p);
    }
    return filtered;
};

export const loadCategoryIndex = async (
    flatJsonPath: string
): Promise<{
    idsBySlug: ReadonlyMap<string, readonly number[]>;
    pathById: ReadonlyMap<number, string>;
    tokensById: ReadonlyMap<number, readonly string[]>;
}> => {
    const raw = await readFile(flatJsonPath, "utf8");
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) throw new Error("categorySell-flat.json no es un array.");

    const flat = parsed.filter(isCategoryFlatRow);
    if (flat.length === 0) throw new Error("categorySell-flat.json está vacío o inválido.");

    const byId = new Map<number, CategoryFlatRow>();
    const idsBySlug = new Map<string, number[]>();

    for (const r of flat) {
        byId.set(r.id, r);
        const slug = normalizeSpace(r.slug).toLowerCase();
        const prev = idsBySlug.get(slug) ?? [];
        idsBySlug.set(slug, [...prev, r.id]);
    }

    const buildPath = (id: number): string => {
        const slugs: string[] = [];
        let cur: CategoryFlatRow | undefined = byId.get(id);
        while (cur) {
            slugs.push(cur.slug);
            if (cur.parentId === null) break;
            cur = cur.parentId === null ? undefined : byId.get(cur.parentId);
        }
        return slugs.reverse().join("/");
    };

    const pathById = new Map<number, string>();
    const tokensById = new Map<number, readonly string[]>();

    for (const id of byId.keys()) {
        const p = buildPath(id).toLowerCase();
        pathById.set(id, p);
        tokensById.set(id, toTokens(p));
    }

    return { idsBySlug, pathById, tokensById };
};
