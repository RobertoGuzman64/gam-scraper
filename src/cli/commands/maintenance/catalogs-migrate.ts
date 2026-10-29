import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPortableMigration, planPortableMigration } from "../../../pipeline/campaign/portable-migration.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runPortableMigration = async (args: readonly string[], rootDirectory: string = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run migrar:catalogos [-- --aplicar]\nSimula por defecto; --aplicar consolida únicamente fuentes acreditadas. Nunca borra storage/ ni concede aprobaciones.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--aplicar" && args[0] !== "--dry-run")) {
    throw new Error("Opciones admitidas: --aplicar o --simular");
  }
  const apply = args[0] === "--aplicar";
  const result = apply ? await applyPortableMigration(rootDirectory) : await planPortableMigration(rootDirectory);
  console.log(`◆ EQUIPZILLA / MIGRACIÓN DE CATÁLOGOS | ${apply ? "APLICADA" : "SIMULACIÓN"}`);
  for (const item of result.providers) {
    console.log(`  ${item.providerId.toUpperCase()} | ${item.status.toUpperCase()}${item.count === null ? "" : ` | ${item.count} fichas`}`);
  }
  for (const item of result.campaigns) console.log(`  CAMPAÑA ${item.runId} | ${item.status.toUpperCase()}${item.zipStatus ? ` | ZIP ${item.zipStatus}` : ""}`);
  console.log(`  CAMPAÑAS PORTÁTILES | ${result.campaigns.length}/2`);
  console.log("  DATOS OPERATIVOS | no se han eliminado ni modificado");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPortableMigration(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("migrar:catalogos", error);
    process.exitCode = 1;
  });
}
