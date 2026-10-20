import { getProvider, listProviders } from "../scraper/providers/index.js";

export type BatchOptions = {
  readonly providerIds: readonly string[];
  readonly outRoot: string;
  readonly historyDir: string;
  readonly dryRun: boolean;
};

export const batchHelp = `Uso: npm run scrape:all -- [--providers gam,gomariz] [--outRoot storage/scraped] [--historyDir storage/runs] [--dry-run]

Sin --providers ejecuta todos los proveedores registrados. Cada proveedor mantiene su prefijo de salida y su snapshot.
--dry-run solo muestra los proveedores y las rutas, sin lanzar extracciones ni modificar archivos.`;

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
