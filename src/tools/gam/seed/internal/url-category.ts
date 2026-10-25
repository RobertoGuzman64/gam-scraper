import { readFile } from "node:fs/promises";
import { isCategoryFlatRow } from "./category-index.js";
import { safeJsonParse } from "./json.js";
import { normalizeGamSlugBase } from "./slug.js";
import { normalizeSpace } from "./string.js";
import type { CategoryFlatRow, Report } from "./types.js";

type UrlCategoryReport = Pick<Report,
    "ambiguousUrlSlug" | "usedFallbackToCategoryKey" | "usedDirectSlugMatch" |
    "usedNormalizedSlugMatch" | "unknownUrlSlug">;

const inc = (obj: Record<string, number>, key: string): void => {
    if (!key) return;
    obj[key] = (obj[key] ?? 0) + 1;
};

export const loadUrlCategoryIndex = async (flatJsonPath: string): Promise<{
    byId: ReadonlyMap<number, CategoryFlatRow>;
    idsBySlug: ReadonlyMap<string, readonly number[]>;
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

    return { byId, idsBySlug };
};

const buildPath = (byId: ReadonlyMap<number, CategoryFlatRow>, id: number): string => {
    const slugs: string[] = [];
    let cur: CategoryFlatRow | undefined = byId.get(id);
    while (cur) {
        slugs.push(cur.slug);
        if (cur.parentId === null) break;
        cur = byId.get(cur.parentId);
    }
    return slugs.reverse().join("/");
};

const pickBestCandidate = (paths: readonly string[], categoryKey: string): string | null => {
    if (paths.length === 0) return null;
    if (paths.length === 1) return paths[0] ?? null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}` : "/maquinaria";
    const prioritized = paths.find((p) => p.toLowerCase().includes(target));
    return prioritized ?? (paths[0] ?? null);
};

const categoryKeyFallbackSlug = (categoryKey: string): string => {
    const k = normalizeSpace(categoryKey).toLowerCase();
    if (!k) return "maquinaria";
    if (k === "maquinaria") return "maquinaria";
    return k;
};

export const resolveUrlCategorySellId = (
    idx: { byId: ReadonlyMap<number, CategoryFlatRow>; idsBySlug: ReadonlyMap<string, readonly number[]> },
    categoryKey: string,
    urlCategorySlug: string,
    report: UrlCategoryReport
): number | null => {
    const slug = normalizeSpace(urlCategorySlug).toLowerCase();

    if (slug) {
        const directIds = idx.idsBySlug.get(slug) ?? [];
        if (directIds.length === 1) {
            inc(report.usedDirectSlugMatch, slug);
            return directIds[0] ?? null;
        }
        if (directIds.length > 1) {
            const paths = directIds.map((id) => buildPath(idx.byId, id));
            const best = pickBestCandidate(paths, categoryKey);
            if (best) {
                inc(report.ambiguousUrlSlug, slug);
                const bestId = directIds[paths.indexOf(best)] ?? null;
                return bestId;
            }
        }

        const normalized = normalizeGamSlugBase(slug);
        if (normalized) {
            const normIds = idx.idsBySlug.get(normalized) ?? [];
            if (normIds.length === 1) {
                inc(report.usedNormalizedSlugMatch, slug);
                return normIds[0] ?? null;
            }
            if (normIds.length > 1) {
                const paths = normIds.map((id) => buildPath(idx.byId, id));
                const best = pickBestCandidate(paths, categoryKey);
                if (best) {
                    inc(report.ambiguousUrlSlug, `${slug}=>${normalized}`);
                    const bestId = normIds[paths.indexOf(best)] ?? null;
                    return bestId;
                }
            }
        }

        inc(report.unknownUrlSlug, slug);
    }

    const fallbackSlug = categoryKeyFallbackSlug(categoryKey);
    const fallbackIds = fallbackSlug ? (idx.idsBySlug.get(fallbackSlug) ?? []) : [];
    if (fallbackIds.length === 1) {
        inc(report.usedFallbackToCategoryKey, categoryKey);
        return fallbackIds[0] ?? null;
    }

    return null;
};

