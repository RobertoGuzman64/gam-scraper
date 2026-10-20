import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvider } from "../scraper/providers/index.js";
import { validateCatalogPublication } from "./preflight.js";

export const runPreflight = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run validate:catalog -- --provider <id> --outDir <dir> --outPrefix <prefijo> [--maxAgeHours 48]");
    return;
  }
  const values = new Map<string, string>();
  const flags = new Set(["--provider", "--outDir", "--outPrefix", "--maxAgeHours"]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag || !flags.has(flag) || !value || value.startsWith("--") || values.has(flag)) {
      throw new Error(`Opción desconocida, repetida o sin valor: ${flag ?? ""}`);
    }
    values.set(flag, value);
  }
  for (const required of ["--provider", "--outDir", "--outPrefix"]) {
    if (!values.has(required)) throw new Error(`Falta ${required}`);
  }
  const providerId = values.get("--provider") ?? "";
  getProvider(providerId);
  const maxAgeHours = Number(values.get("--maxAgeHours") ?? "48");
  const result = await validateCatalogPublication({
    providerId,
    outputDir: resolve(values.get("--outDir") ?? ""),
    outputPrefix: values.get("--outPrefix") ?? "",
    maxAgeHours
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "review") {
    console.error("Validación técnica correcta, con revisión manual obligatoria antes de importar");
    process.exitCode = 2;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPreflight(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
