import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanCatalogExcess, cleanLegacyCatalogExcess, type RetentionCandidate } from "../infrastructure/filesystem/catalog-retention.js";
import { cleanBatchExcess } from "../infrastructure/filesystem/run-retention.js";
import { listProviders, getProvider } from "../scraping/registry.js";

export const cleanStorage = async (argv: readonly string[]): Promise<void> => {
  let dryRun = false;
  let legacy = false;
  let outRoot = "storage/scraped";
  let historyDir = "storage/runs";
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" && argv.length === 1) {
      console.log("Uso: npm run limpiar:almacen -- [--dry-run] [--legacy] [--outRoot ruta] [--historyDir ruta]");
      console.log("--legacy elimina salidas antiguas de prefijos alternativos; conserva sus snapshots.");
      return;
    }
    if (!arg || !["--dry-run", "--legacy", "--outRoot", "--historyDir"].includes(arg) || seen.has(arg)) {
      throw new Error(`Opción de limpieza no reconocida o repetida: ${arg ?? ""}`);
    }
    seen.add(arg);
    if (arg === "--dry-run") { dryRun = true; continue; }
    if (arg === "--legacy") { legacy = true; continue; }
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${arg}`);
    if (arg === "--outRoot") outRoot = value;
    else historyDir = value;
  }
  const results: RetentionCandidate[] = [];
  for (const id of listProviders()) {
    const provider = getProvider(id);
    const dir = resolve(outRoot, id);
    const prefix = provider.defaultOptions.outPrefix;
    results.push(...await cleanCatalogExcess(dir, prefix, dryRun));
    if (legacy) {
      results.push(...await cleanLegacyCatalogExcess(dir, prefix, dryRun));
    }
  }
  results.push(...await cleanBatchExcess(resolve(historyDir), dryRun));
  for (const item of results) console.log(`${dryRun ? "ELIMINARÍA" : "ELIMINADO"} | ${(item.bytes / (1024 * 1024)).toFixed(2)} MB | ${item.path}`);
  const bytes = results.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`LIMPIEZA | ${dryRun ? "SIMULACIÓN" : "COMPLETADA"} | ${results.length} elementos | ${(bytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log("Protegidos: catálogo actual, dos versiones anteriores y snapshots. Prefijos alternativos solo con --legacy.");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  cleanStorage(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
