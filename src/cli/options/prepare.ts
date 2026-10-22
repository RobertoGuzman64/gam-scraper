import { basename, join, resolve } from "node:path";
import type { PrepareOptions } from "../../pipeline/preparation/prepare.js";

export const prepareHelp = `Uso:
  npm run prepare -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
  npm run prepare -- gam --source <catalog.json> --out <preparation.json> --dry-run
  npm run prepare -- gam --source <catalog.json> --out <preparation.json> --compare <preparacion-anterior.json>

Opciones: --source (obligatoria), --out, --dry-run, --compare, --help.
Sin --out, escribe en storage/prepared/<proveedor>/<prefijo>-preparation.json.
No realiza peticiones a portales ni importa productos. No sobrescribe archivos existentes.
Una preparación sin --dry-run escribe también -diagnostics.json y opcionalmente -comparison.json.
El catálogo canónico debe tener su manifest y resumen de publicación completos.`;

export const parsePrepareOptions = (args: readonly string[]): PrepareOptions => {
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error("Falta proveedor para prepare");
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
