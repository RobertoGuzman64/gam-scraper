import { basename, dirname, join, resolve } from "node:path";
import type { PrepareOptions } from "../../pipeline/preparation/prepare.js";
import type { ManainRecordOptions } from "../../pipeline/preparation/manain-record.js";

export const prepareHelp = `Uso:
  npm run preparar -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
  npm run preparar -- gam --source <catalog.json> --out <preparation.json> --dry-run
  npm run preparar -- gam --source <catalog.json> --out <preparation.json> --compare <preparacion-anterior.json>
  npm run preparar -- manain --origen storage/scraped/manain/scrape-manain-partial-all.csv --censo storage/diagnostics/manain/<censo-.json> [--simular]

Opciones: --source (obligatoria), --out, --dry-run, --compare, --help.
Sin --out, escribe en storage/prepared/<proveedor>/<prefijo>-preparation.json.
No realiza peticiones a portales ni importa productos. No sobrescribe archivos existentes.
Una preparación sin --dry-run escribe también -diagnostics.json y opcionalmente -comparison.json.
El catálogo canónico debe tener su manifest y resumen de publicación completos.
El registro offline de Manain no es catálogo canónico ni publicación acreditada.`;

export const parsePrepareOptions = (args: readonly string[]): PrepareOptions => {
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error("Falta proveedor para preparar");
  const options = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      if (dryRun) throw new Error("--dry-run repetido");
      dryRun = true;
      continue;
    }
    if (arg !== "--source" && arg !== "--out" && arg !== "--compare") throw new Error(`Opción desconocida: ${arg}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--") || options.has(arg)) throw new Error(`Opción repetida o sin valor: ${arg}`);
    options.set(arg, value);
    index += 1;
  }
  const input = options.get("--source");
  if (!input || !basename(input).endsWith("-catalog.json")) throw new Error("--source debe indicar un -catalog.json canónico");
  const prefix = basename(input).slice(0, -"-catalog.json".length);
  if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error("Prefijo de catálogo inválido");
  const out = options.get("--out") ?? join("storage", "prepared", providerId, `${prefix}-preparation.json`);
  if (!basename(out).endsWith("-preparation.json")) throw new Error("--out debe ser un -preparation.json");
  const compare = options.get("--compare") ?? null;
  if (compare && !basename(compare).endsWith("-preparation.json")) throw new Error("--compare debe ser un -preparation.json offline");
  if (compare && resolve(compare) === resolve(out)) throw new Error("No se puede comparar con la propia salida");
  return { providerId, source: resolve(input), out: resolve(out), dryRun, compare: compare ? resolve(compare) : null };
};

export const parseManainRecordOptions = (args: readonly string[]): ManainRecordOptions => {
  const [providerId, ...rest] = args;
  if (providerId !== "manain") throw new Error("El registro parcial solo admite Manain");
  const options = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      if (dryRun) throw new Error("--dry-run repetido");
      dryRun = true;
      continue;
    }
    if (arg !== "--source" && arg !== "--censo" && arg !== "--out") {
      throw new Error(`Opción de registro Manain desconocida: ${arg}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--") || options.has(arg)) throw new Error(`Opción repetida o sin valor: ${arg}`);
    options.set(arg, value);
    index += 1;
  }
  const source = options.get("--source");
  const census = options.get("--censo");
  if (!source || !basename(source).endsWith("-partial-all.csv") || !census || !basename(census).startsWith("censo-")) {
    throw new Error("Indica --origen <partial-all.csv> y --censo <censo-.json>");
  }
  const recordsDir = resolve("catalogs/providers/manain/records");
  const out = resolve(options.get("--out") ?? join(recordsDir, "manain-record.json"));
  if (dirname(out) !== recordsDir || !basename(out).endsWith("-record.json")) {
    throw new Error("El registro Manain debe guardarse en catalogs/providers/manain/records/*-record.json");
  }
  return { source: resolve(source), census: resolve(census), out, dryRun };
};
