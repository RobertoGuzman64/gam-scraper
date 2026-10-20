import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvider } from "../scraping/registry.js";
import { validateCatalogPublication } from "../pipeline/validation/preflight.js";

export const validateHelp = `Uso:
  npm run validate -- gam
  npm run validate -- gomariz --prefix scrape-gomariz
  npm run validate -- mercaeleva --out storage/scraped/mercaeleva

Opciones: --out, --prefix, --maxAgeHours
Compatibilidad: --provider, --outDir, --outPrefix
Requiere catálogo completo publicado, sin errores, y antigüedad máxima de 48 h.
Código 0 = conforme, 2 = revisión manual, 1 = error.`;

export const runPreflight = async (args: readonly string[]): Promise<void> => {
  if (args.includes("--help")) {
    console.log(validateHelp);
    return;
  }
  const values = new Map<string, string>();
  const names: Readonly<Record<string, string>> = {
    "--provider": "provider", "--outDir": "outDir", "--out": "outDir",
    "--outPrefix": "outPrefix", "--prefix": "outPrefix", "--maxAgeHours": "maxAgeHours"
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      if (values.has("provider")) throw new Error(`Argumento no reconocido: ${arg}`);
      values.set("provider", arg);
      continue;
    }
    const key = names[arg];
    const value = args[index + 1];
    if (!key || !value || value.startsWith("--") || values.has(key)) {
      throw new Error(`Opción desconocida, repetida o sin valor: ${arg}`);
    }
    values.set(key, value);
    index += 1;
  }
  const providerId = values.get("provider");
  if (!providerId) throw new Error("Falta proveedor. Uso: npm run validate -- gam");
  const provider = getProvider(providerId);
  const age = values.get("maxAgeHours") ?? "48";
  const maxAgeHours = Number(age);
  const result = await validateCatalogPublication({
    providerId,
    outputDir: resolve(values.get("outDir") ?? provider.defaultOptions.outDir),
    outputPrefix: values.get("outPrefix") ?? provider.defaultOptions.outPrefix,
    maxAgeHours
  });
  console.log(`VALIDACIÓN | ${result.providerId.toUpperCase()} | ${result.status === "passed" ? "CONFORME" : "REVISIÓN"}`);
  console.log(`  Productos: ${result.productCount} | Listos: ${result.ready} | Revisar: ${result.review} | Posibles bajas: ${result.suspectedMissing}`);
  for (const warning of result.warnings) console.log(`  Aviso: ${warning}`);
  console.log(`  Resumen: ${result.summaryFile}`);
  if (result.status === "review") process.exitCode = 2;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPreflight(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
