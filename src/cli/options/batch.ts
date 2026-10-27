import { getProvider, listProviders } from "../../scraping/registry.js";
import type { BatchOptions } from "../../pipeline/batch/types.js";

export const batchHelp = `Uso:
  npm run extraer:todos
  npm run extraer:todos -- --simular
  npm run extraer:todos -- --proveedores gam,gomariz

Opciones: --providers <ids>, --outRoot <directorio>, --historyDir <directorio>, --dry-run
Sin --providers se ejecutan todos los proveedores registrados, secuencialmente.
--dry-run solo muestra rutas; no modifica archivos.`;

const requireValue = (args: readonly string[], position: number, flag: string): string => {
  const value = args[position + 1];
  if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${flag}`);
  return value;
};

export const parseBatchOptions = (args: readonly string[]): BatchOptions | "help" => {
  let providers: string | null = null;
  let outRoot = "storage/scraped";
  let historyDir = "storage/runs";
  let dryRun = false;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help") {
      if (args.length !== 1) throw new Error("--help debe utilizarse sin otros argumentos");
      return "help";
    }
    if (!arg || !["--providers", "--outRoot", "--historyDir", "--dry-run"].includes(arg)) {
      throw new Error(`Argumento no reconocido: ${arg ?? ""}`);
    }
    if (seen.has(arg)) throw new Error(`Argumento duplicado: ${arg}`);
    seen.add(arg);
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    const value = requireValue(args, index, arg);
    if (arg === "--providers") providers = value;
    if (arg === "--outRoot") outRoot = value;
    if (arg === "--historyDir") historyDir = value;
    index += 1;
  }

  if (!outRoot.trim() || !historyDir.trim()) throw new Error("Las rutas de salida e historial no pueden estar vacías");
  const providerIds = providers === null ? [...listProviders()] : providers.split(",").map((id) => id.trim());
  if (providerIds.length === 0 || providerIds.some((id) => id.length === 0)) {
    throw new Error("--providers requiere una lista de identificadores separados por comas");
  }
  if (new Set(providerIds).size !== providerIds.length) throw new Error("Hay proveedores duplicados");
  for (const id of providerIds) getProvider(id);
  return { providerIds, outRoot, historyDir, dryRun };
};
