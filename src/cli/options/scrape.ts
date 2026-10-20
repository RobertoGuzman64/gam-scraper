import type { ScrapeOptions } from "../../contracts/scraping.js";
import type { ScrapeRunSelection } from "../../pipeline/scrape-run.js";
import { getProvider } from "../../scraping/registry.js";

type ArgValue = string | boolean;
type ArgMap = Record<string, ArgValue | undefined>;

const valueOptions = new Set([
  "provider", "outDir", "outPrefix", "maxPages", "stallStopAfter", "concurrencyPages",
  "concurrencyProducts", "timeoutMs", "delayMs", "userAgent", "rootUrl", "url", "key", "name", "categoryKey"
]);
const booleanOptions = new Set(["onlyCategories", "discoverSubcategories", "discoverTree", "verbose"]);
const aliases: Readonly<Record<string, string>> = {
  out: "outDir", prefix: "outPrefix", pages: "maxPages", category: "categoryKey"
};

export const scrapeHelp = `Uso:
  npm run scrape -- gam
  npm run scrape -- gomariz --category venta
  npm run scrape -- mercaeleva --pages 2 --prefix prueba-mercaeleva
  npm run scrape -- all [--dry-run | --providers gam,gomariz]

Opciones: --category, --pages, --out, --prefix, --verbose, --help
Compatibilidad: --provider, --categoryKey, --maxPages, --outDir, --outPrefix
Avanzadas: --url, --rootUrl, --discoverTree, --discoverSubcategories,
           --onlyCategories, --stallStopAfter, --concurrencyPages,
           --concurrencyProducts, --timeoutMs, --delayMs, --userAgent

--pages limita las páginas: los resultados de diagnóstico no deben importarse.
Sin proveedor se utiliza GAM, como en el comando original.`;

export const parseArgs = (argv: readonly string[]): ArgMap => {
  const out: ArgMap = {};
  let position = 0;
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (!argument) continue;
    if (!argument.startsWith("--")) {
      if (position > 0 || out.provider !== undefined) throw new Error(`Argumento no reconocido: ${argument}`);
      out.provider = argument;
      position += 1;
      continue;
    }
    const raw = argument.slice(2);
    const key = aliases[raw] ?? raw;
    if (out[key] !== undefined) throw new Error(`Opción duplicada: --${raw}`);
    if (booleanOptions.has(key)) {
      const value = argv[i + 1];
      if (value === "true" || value === "false") {
        out[key] = value === "true";
        i += 1;
      } else {
        out[key] = true;
      }
      continue;
    }
    if (!valueOptions.has(key)) throw new Error(`Opción desconocida: --${raw}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Falta valor para --${raw}`);
    out[key] = value;
    i += 1;
  }
  return out;
};

const toNumber = (value: ArgValue | undefined, fallback: number, key: string, allowZero: boolean): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.trim() === "" || !Number.isSafeInteger(Number(value)) ||
    Number(value) < (allowZero ? 0 : 1)) throw new Error(`--${key} debe ser un entero ${allowZero ? "no negativo" : "positivo"}`);
  return Number(value);
};

const toStringOr = (value: ArgValue | undefined, fallback: string): string => typeof value === "string" ? value : fallback;
const toBoolean = (value: ArgValue | undefined): boolean => value === true;

export type CliSelection = ScrapeRunSelection;

export const resolveCliSelection = (argv: readonly string[]): CliSelection => {
  const args = parseArgs(argv);
  const provider = getProvider(toStringOr(args.provider, "gam"));
  const defaults = provider.defaultOptions;
  const options: ScrapeOptions = {
    outDir: toStringOr(args.outDir, defaults.outDir),
    outPrefix: toStringOr(args.outPrefix, defaults.outPrefix),
    maxPages: toNumber(args.maxPages, defaults.maxPages, "pages", false),
    stallStopAfter: toNumber(args.stallStopAfter, defaults.stallStopAfter, "stallStopAfter", false),
    concurrencyPages: toNumber(args.concurrencyPages, defaults.concurrencyPages, "concurrencyPages", false),
    concurrencyProducts: toNumber(args.concurrencyProducts, defaults.concurrencyProducts, "concurrencyProducts", false),
    timeoutMs: toNumber(args.timeoutMs, defaults.timeoutMs, "timeoutMs", false),
    delayMs: toNumber(args.delayMs, defaults.delayMs, "delayMs", true),
    userAgent: toStringOr(args.userAgent, defaults.userAgent)
  };
  if (!options.outDir.trim() || !options.outPrefix.trim()) throw new Error("--out y --prefix no pueden estar vacíos");
  if ([".", ".."].includes(options.outPrefix) || /[\\/]/.test(options.outPrefix)) {
    throw new Error("--prefix debe ser un nombre de archivo, sin barras ni rutas relativas");
  }

  const onlyCategories = toBoolean(args.onlyCategories);
  const discoverSubcategories = toBoolean(args.discoverSubcategories);
  if (toBoolean(args.discoverTree)) {
    const rootUrl = typeof args.rootUrl === "string" ? args.rootUrl : typeof args.url === "string" ? args.url : null;
    if (!rootUrl) throw new Error("Falta --rootUrl (o --url) para --discoverTree");
    return { mode: "tree", rootUrl, onlyCategories, options, provider };
  }
  const url = typeof args.url === "string" ? args.url : null;
  if (url) {
    const key = toStringOr(args.key, "custom");
    const name = toStringOr(args.name, "Custom");
    return { mode: "single", category: { key, name, url }, discoverSubcategories, onlyCategories, options, provider };
  }
  if (args.rootUrl !== undefined || args.key !== undefined || args.name !== undefined) {
    throw new Error("--rootUrl requiere --discoverTree; --key y --name requieren --url");
  }
  const categoryKey = typeof args.categoryKey === "string" ? args.categoryKey : null;
  const categories = categoryKey ? provider.categories.filter((category) => category.key === categoryKey) : provider.categories;
  if (categoryKey && categories.length === 0) throw new Error(`Categoría no encontrada: ${categoryKey}. Disponibles: ${provider.categories.map((category) => category.key).join(", ")}`);
  return { mode: "config", categories, discoverSubcategories, onlyCategories, options, provider };
};
