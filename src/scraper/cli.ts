import { DEFAULT_CATEGORIES, DEFAULT_OPTIONS } from "./config.js";
import type { CategoryConfig, ScrapeOptions } from "./types.js";

type ArgValue = string | boolean;
type ArgMap = Record<string, ArgValue | undefined>;

const isFlag = (s: string): boolean => s.startsWith("--");

export const parseArgs = (argv: readonly string[]): ArgMap => {
  const out: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a || !isFlag(a)) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || isFlag(next)) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
};

const toNumber = (v: ArgValue | undefined, fallback: number): number => {
  if (typeof v !== "string") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStringOr = (v: ArgValue | undefined, fallback: string): string => {
  if (typeof v !== "string") return fallback;
  return v;
};

const toBoolean = (v: ArgValue | undefined): boolean => {
  if (v === true) return true;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
};

export type CliSelection =
  | { readonly mode: "tree"; readonly rootUrl: string; readonly onlyCategories: boolean; readonly options: ScrapeOptions }
  | {
    readonly mode: "config";
    readonly categories: readonly CategoryConfig[];
    readonly discoverSubcategories: boolean;
    readonly onlyCategories: boolean;
    readonly options: ScrapeOptions;
  }
  | {
    readonly mode: "single";
    readonly category: CategoryConfig;
    readonly discoverSubcategories: boolean;
    readonly onlyCategories: boolean;
    readonly options: ScrapeOptions;
  };

export const resolveCliSelection = (argv: readonly string[]): CliSelection => {
  const args = parseArgs(argv);

  const options: ScrapeOptions = {
    outDir: toStringOr(args.outDir, DEFAULT_OPTIONS.outDir),
    outPrefix: toStringOr(args.outPrefix, DEFAULT_OPTIONS.outPrefix),
    maxPages: toNumber(args.maxPages, DEFAULT_OPTIONS.maxPages),
    stallStopAfter: toNumber(args.stallStopAfter, DEFAULT_OPTIONS.stallStopAfter),
    concurrencyPages: toNumber(args.concurrencyPages, DEFAULT_OPTIONS.concurrencyPages),
    concurrencyProducts: toNumber(args.concurrencyProducts, DEFAULT_OPTIONS.concurrencyProducts),
    timeoutMs: toNumber(args.timeoutMs, DEFAULT_OPTIONS.timeoutMs),
    delayMs: toNumber(args.delayMs, DEFAULT_OPTIONS.delayMs),
    userAgent: toStringOr(args.userAgent, DEFAULT_OPTIONS.userAgent)
  };

  const onlyCategories = toBoolean(args.onlyCategories);
  const discoverSubcategories = toBoolean(args.discoverSubcategories);

  const discoverTree = toBoolean(args.discoverTree);
  if (discoverTree) {
    const rootUrl =
      (typeof args.rootUrl === "string" ? args.rootUrl : null) ??
      (typeof args.url === "string" ? args.url : null);

    if (!rootUrl) throw new Error("Falta --rootUrl (o --url) para --discoverTree");

    return { mode: "tree", rootUrl, onlyCategories, options };
  }

  const url = typeof args.url === "string" ? args.url : null;
  if (url) {
    const key = typeof args.key === "string" ? args.key : "custom";
    const name = typeof args.name === "string" ? args.name : "Custom";
    return { mode: "single", category: { key, name, url }, discoverSubcategories, onlyCategories, options };
  }

  const categoryKey = typeof args.categoryKey === "string" ? args.categoryKey : null;
  const categories = categoryKey ? DEFAULT_CATEGORIES.filter((c) => c.key === categoryKey) : DEFAULT_CATEGORIES;

  return { mode: "config", categories, discoverSubcategories, onlyCategories, options };
};
