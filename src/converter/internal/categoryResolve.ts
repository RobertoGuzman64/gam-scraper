import { normalizeSpace } from "./string.js";
import { normalizeGamSlugBase, slugCandidatesFromUrlSlug } from "./slug.js";
import { toTokens } from "./categoryIndex.js";
import type { Report } from "./types.js";

const inc = (obj: Record<string, number>, key: string): void => {
    if (!key) return;
    obj[key] = (obj[key] ?? 0) + 1;
};

const pickBestCandidate = (
    candidateIds: readonly number[],
    idx: { pathById: ReadonlyMap<number, string> },
    categoryKey: string
): number | null => {
    if (candidateIds.length === 0) return null;
    if (candidateIds.length === 1) return candidateIds[0] ?? null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}/` : "/maquinaria/";
    for (const id of candidateIds) {
        const path = idx.pathById.get(id) ?? "";
        if (path.includes(target)) return id;
    }
    return candidateIds[0] ?? null;
};

const fuzzyFindBestId = (
    urlSlug: string,
    categoryKey: string,
    idx: {
        pathById: ReadonlyMap<number, string>;
        tokensById: ReadonlyMap<number, readonly string[]>;
    }
): number | null => {
    const base = normalizeGamSlugBase(urlSlug);
    const wanted = toTokens(base);
    if (wanted.length === 0) return null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}/` : "/maquinaria/";

    let bestId: number | null = null;
    let bestScore = 0;

    for (const [id, tokens] of idx.tokensById.entries()) {
        const path = idx.pathById.get(id) ?? "";
        if (!path.includes(target)) continue;

        let inter = 0;
        const tokenSet = new Set(tokens);
        for (const w of wanted) if (tokenSet.has(w)) inter += 1;

        if (inter === 0) continue;

        const score = inter / wanted.length;
        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    }

    if (bestId !== null && bestScore >= 0.5) return bestId;

    return null;
};

const categoryKeyFallbackSlug = (categoryKey: string): string => {
    const k = normalizeSpace(categoryKey).toLowerCase();
    if (!k) return "maquinaria";
    if (k === "maquinaria") return "maquinaria";
    return k;
};

export const resolveCategorySellIdAuto = (
    idx: {
        idsBySlug: ReadonlyMap<string, readonly number[]>;
        pathById: ReadonlyMap<number, string>;
        tokensById: ReadonlyMap<number, readonly string[]>;
    },
    categoryKey: string,
    urlCategorySlug: string,
    report: Report,
    candidatesFromUrlSlug?: (urlSlug: string) => readonly string[]
): number | null => {
    const slug = normalizeSpace(urlCategorySlug).toLowerCase();

    const getCandidates = candidatesFromUrlSlug ?? slugCandidatesFromUrlSlug;

    if (slug) {
        const directIds = idx.idsBySlug.get(slug) ?? [];
        if (directIds.length > 0) {
            const chosen = pickBestCandidate(directIds, { pathById: idx.pathById }, categoryKey);
            if (chosen !== null) {
                inc(report.usedDirectSlugMatch, slug);
                return chosen;
            }
        }

        const candidates = getCandidates(slug);
        for (const c of candidates) {
            const ids = idx.idsBySlug.get(c) ?? [];
            if (ids.length > 0) {
                const chosen = pickBestCandidate(ids, { pathById: idx.pathById }, categoryKey);
                if (chosen !== null) {
                    inc(report.usedAliasSlugMatch, slug);
                    return chosen;
                }
            }
        }

        const fuzzy = fuzzyFindBestId(slug, categoryKey, { pathById: idx.pathById, tokensById: idx.tokensById });
        if (fuzzy !== null) {
            inc(report.usedFuzzySlugMatch, slug);
            return fuzzy;
        }

        inc(report.unknownUrlSlug, slug);
    }

    const fallbackSlug = categoryKeyFallbackSlug(categoryKey);
    const fallbackIds = fallbackSlug ? (idx.idsBySlug.get(fallbackSlug) ?? []) : [];
    if (fallbackIds.length > 0) {
        const chosen = pickBestCandidate(fallbackIds, { pathById: idx.pathById }, categoryKey);
        if (chosen !== null) {
            inc(report.usedFallbackToCategoryKey, categoryKey);
            return chosen;
        }
    }

    return null;
};
