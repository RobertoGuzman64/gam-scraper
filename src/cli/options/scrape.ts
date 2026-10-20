import { getProvider } from "../../scraping/registry.js";

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

import type { ScrapeOptions } from "../../contracts/scraping.js";
import type { ScrapeRunSelection } from "../../pipeline/scrape-run.js";

export type CliSelection = ScrapeRunSelection;

export const resolveCliSelection = (argv: readonly string[]): CliSelection => {
  const args = parseArgs(argv);
  const provider = getProvider(toStringOr(args.provider, "gam"));
  const defaults = provider.defaultOptions;

  const options: ScrapeOptions = {
    outDir: toStringOr(args.outDir, defaults.outDir),
    outPrefix: toStringOr(args.outPrefix, defaults.outPrefix),
    maxPages: toNumber(args.maxPages, defaults.maxPages),
    stallStopAfter: toNumber(args.stallStopAfter, defaults.stallStopAfter),
    concurrencyPages: toNumber(args.concurrencyPages, defaults.concurrencyPages),
    concurrencyProducts: toNumber(args.concurrencyProducts, defaults.concurrencyProducts),
    timeoutMs: toNumber(args.timeoutMs, defaults.timeoutMs),
    delayMs: toNumber(args.delayMs, defaults.delayMs),
    userAgent: toStringOr(args.userAgent, defaults.userAgent)
  };

  const onlyCategories = toBoolean(args.onlyCategories);
  const discoverSubcategories = toBoolean(args.discoverSubcategories);

  const discoverTree = toBoolean(args.discoverTree);
  if (discoverTree) {
    const rootUrl =
      (typeof args.rootUrl === "string" ? args.rootUrl : null) ??
      (typeof args.url === "string" ? args.url : null);

    if (!rootUrl) throw new Error("Falta --rootUrl (o --url) para --discoverTree");

    return { mode: "tree", rootUrl, onlyCategories, options, provider };
  }

  const url = typeof args.url === "string" ? args.url : null;
  if (url) {
    const key = typeof args.key === "string" ? args.key : "custom";
    const name = typeof args.name === "string" ? args.name : "Custom";
    return { mode: "single", category: { key, name, url }, discoverSubcategories, onlyCategories, options, provider };
  }

  const categoryKey = typeof args.categoryKey === "string" ? args.categoryKey : null;
  const categories = categoryKey ? provider.categories.filter((c) => c.key === categoryKey) : provider.categories;

  return { mode: "config", categories, discoverSubcategories, onlyCategories, options, provider };
};
