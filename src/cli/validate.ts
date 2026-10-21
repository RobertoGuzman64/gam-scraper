import { readFile } from "node:fs/promises";
import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { formatReviewDiagnostics } from "./reporting/review-diagnostics.js";
import { parsePreparation } from "../catalog/import/preparation-document.js";
import { printCommandError } from "./reporting/errors.js";
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
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`VALIDACIÓN | ${providerId.toUpperCase()} | comprobando catálogo | ${values.get("outDir") ?? provider.defaultOptions.outDir}`);
  const outputDir = resolve(values.get("outDir") ?? provider.defaultOptions.outDir);
  const outputPrefix = values.get("outPrefix") ?? provider.defaultOptions.outPrefix;
  let result: Awaited<ReturnType<typeof validateCatalogPublication>>;
  try {
    result = await validateCatalogPublication({
      providerId,
      outputDir,
      outputPrefix,
      maxAgeHours
    });
  } finally {
    status.stop();
  }
  let diagnostics: readonly string[] = [];
  if (result.review > 0) {
    const preparationText = await readFile(resolve(outputDir, `${outputPrefix}-preparation.json`), "utf8");
    const preparation: unknown = JSON.parse(preparationText);
    const products = parsePreparation(preparation, providerId).products;
    if (products.length !== result.productCount || products.filter((entry) => entry.status === "review").length !== result.review) {
      throw new Error("La preparación cambió durante la validación; repetir el comando");
    }
    diagnostics = formatReviewDiagnostics(products);
  }
  console.log(`VALIDACIÓN | ${result.providerId.toUpperCase()} | ${result.status === "passed" ? "CONFORME" : "REVISIÓN"}`);
  console.log(`  Productos: ${result.productCount} | Listos: ${result.ready} | Revisar: ${result.review} | Posibles bajas: ${result.suspectedMissing}`);
  for (const warning of result.warnings) console.log(`  Aviso: ${warning}`);
  for (const line of diagnostics) console.log(line);
  console.log(`  Resumen: ${result.summaryFile} | Duración: ${formatDuration(Date.now() - startedAt)}`);
  if (result.status === "review") process.exitCode = 2;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPreflight(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("validate", error);
    process.exitCode = 1;
  });
}
