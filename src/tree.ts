import type { CategoryConfig, ScrapeOptions } from "./types.js";
import { fetchHtml, sleep } from "./http.js";
import { normalizeSpace } from "./parsers.js";
import * as cheerio from "cheerio";

const BLOCKED_CATEGORY_IDS = new Set<string>(["3", "32"]);

const canonicalizeNoQueryNoHash = (url: string): string => {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
};

const extractCategoryKeyFromUrl = (url: string): string => {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).at(-1) ?? "unknown";
    const m = last.match(/^(\d+)-/);
    return m?.[1] ?? last;
};

const extractCategoryNameFromHtml = (html: string): string | null => {
    const $ = cheerio.load(html);
    const og = $('meta[property="og:title"]').attr("content");
    const ogTitle = og ? normalizeSpace(String(og)) : null;
    if (ogTitle) return ogTitle;

    const h1 = normalizeSpace($("h1").first().text());
    return h1 || null;
};

const isCategoryUrl = (url: string): boolean => {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    if (parts[0] !== "es") return false;
    return /^\d+-/.test(parts[1] ?? "");
};

const extractCandidateCategoryLinks = (baseUrl: string, html: string): readonly string[] => {
    const $ = cheerio.load(html);
    const out = new Set<string>();

    const addFromSelector = (selector: string): void => {
        $(selector).each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            try {
                const abs = new URL(href, baseUrl).toString();
                if (isCategoryUrl(abs)) out.add(abs);
            } catch {
                return;
            }
        });
    };

    const strongSelectors: readonly string[] = [
        "#subcategories a[href]",
        "section#subcategories a[href]",
        "div#subcategories a[href]",
        ".category-subcategories a[href]",
        ".subcategories a[href]"
    ];

    for (const s of strongSelectors) addFromSelector(s);

    if (out.size === 0) {
        addFromSelector('a[href*="segunda-mano"]');
    }

    return [...out.values()];
};

type JsonLdNode = Record<string, unknown>;

const extractBreadcrumbUrls = (baseUrl: string, html: string): readonly string[] => {
    const $ = cheerio.load(html);
    const out = new Set<string>();

    const addUrl = (href: string): void => {
        try {
            const abs = canonicalizeNoQueryNoHash(new URL(href, baseUrl).toString());
            out.add(abs);
        } catch {
            return;
        }
    };

    const breadcrumbSelectors: readonly string[] = [
        "nav.breadcrumb a[href]",
        ".breadcrumb a[href]",
        "ol.breadcrumb a[href]",
        'nav[aria-label="breadcrumb"] a[href]'
    ];

    for (const s of breadcrumbSelectors) {
        $(s).each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            addUrl(href);
        });
    }

    $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).text();
        if (!raw) return;

        const pushBreadcrumbList = (node: unknown): void => {
            if (!node || typeof node !== "object") return;
            const n = node as JsonLdNode;

            const typeVal = n["@type"];
            const isBreadcrumb =
                typeVal === "BreadcrumbList" ||
                (Array.isArray(typeVal) && typeVal.some((t) => t === "BreadcrumbList"));

            if (!isBreadcrumb) return;

            const items = n["itemListElement"];
            if (!Array.isArray(items)) return;

            for (const it of items) {
                if (!it || typeof it !== "object") continue;
                const itemNode = it as JsonLdNode;
                const item = itemNode["item"];

                if (typeof item === "string") {
                    addUrl(item);
                    continue;
                }

                if (item && typeof item === "object") {
                    const obj = item as JsonLdNode;
                    const id = obj["@id"];
                    if (typeof id === "string") addUrl(id);
                    const url = obj["url"];
                    if (typeof url === "string") addUrl(url);
                }
            }
        };

        try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                for (const node of parsed) pushBreadcrumbList(node);
            } else {
                pushBreadcrumbList(parsed);
            }
        } catch {
            return;
        }
    });

    return [...out.values()];
};

const pageBelongsToRoot = (rootCanonical: string, currentCanonical: string, html: string): boolean => {
    if (currentCanonical === rootCanonical) return true;

    const breadcrumbUrls = extractBreadcrumbUrls(currentCanonical, html);
    if (breadcrumbUrls.length === 0) return true;

    return breadcrumbUrls.includes(rootCanonical);
};

const isAbortError = (e: unknown): boolean => {
    if (!e || typeof e !== "object") return false;
    const name = (e as { readonly name?: unknown }).name;
    return name === "AbortError";
};

const fetchHtmlWithRetry = async (
    url: string,
    options: { readonly timeoutMs: number; readonly userAgent: string },
    retries: number
): Promise<string> => {
    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
        } catch (e: unknown) {
            lastErr = e;
            const shouldRetry = isAbortError(e);
            if (!shouldRetry || attempt === retries) break;
            await sleep(250 * (attempt + 1));
        }
    }

    throw lastErr instanceof Error ? lastErr : new Error("fetchHtml failed");
};

export const discoverCategoryTree = async (rootUrl: string, options: ScrapeOptions): Promise<readonly CategoryConfig[]> => {
    const rootCanonical = canonicalizeNoQueryNoHash(rootUrl);

    const visited = new Set<string>();
    const discovered = new Map<string, CategoryConfig>();
    const queue: string[] = [rootCanonical];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        const normalized = canonicalizeNoQueryNoHash(current);
        if (visited.has(normalized)) continue;
        visited.add(normalized);

        const currentId = extractCategoryKeyFromUrl(normalized);
        if (BLOCKED_CATEGORY_IDS.has(currentId)) {
            await sleep(options.delayMs);
            continue;
        }

        const html = await fetchHtmlWithRetry(
            normalized,
            { timeoutMs: options.timeoutMs, userAgent: options.userAgent },
            2
        );

        if (!pageBelongsToRoot(rootCanonical, normalized, html)) {
            await sleep(options.delayMs);
            continue;
        }

        const name = extractCategoryNameFromHtml(html) ?? currentId;
        const key = currentId;

        if (!discovered.has(normalized)) {
            discovered.set(normalized, { key, name, url: normalized });
        }

        const nextCategories = extractCandidateCategoryLinks(normalized, html);
        for (const next of nextCategories) {
            const nextNorm = canonicalizeNoQueryNoHash(next);
            const nextId = extractCategoryKeyFromUrl(nextNorm);
            if (BLOCKED_CATEGORY_IDS.has(nextId)) continue;
            if (!visited.has(nextNorm)) queue.push(nextNorm);
        }

        await sleep(options.delayMs);
    }

    return [...discovered.values()];
};