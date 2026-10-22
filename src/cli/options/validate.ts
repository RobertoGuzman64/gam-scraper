import { getProvider } from "../../scraping/registry.js";
import { join, resolve } from "node:path";

export const validateHelp = `Uso:
  npm run validate -- gam
  npm run validate -- gomariz --prefix scrape-gomariz
  npm run validate -- mercaeleva --out storage/scraped/mercaeleva
  npm run validate -- gam --stage catalog --prefix scrape-gam
  npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-preparation.json
  npm run validate -- gam --stage preparation --preparation <archivo-preparation.json> --source <archivo-catalog.json>

Opciones heredadas: --out, --prefix, --maxAgeHours
Compatibilidad: --provider, --outDir, --outPrefix
Opciones nuevas: --stage catalog|preparation, --source, --preparation
La validación heredada conserva su contrato y límite de 48 horas.
La validación de preparación no requiere acceso a portales ni inventario.
Código 0 = conforme, 2 = revisión manual, 1 = error.`;

export const parseValidateOptions = (args: readonly string[]) => {
  const values = new Map<string, string>();
  const names: Readonly<Record<string, string>> = {
    "--provider": "provider", "--outDir": "outDir", "--out": "outDir",
    "--outPrefix": "outPrefix", "--prefix": "outPrefix", "--maxAgeHours": "maxAgeHours",
    "--stage": "stage", "--source": "source", "--preparation": "preparation"
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
  const stage = values.get("stage") ?? "legacy";
  if ((stage !== "legacy" && stage !== "catalog" && stage !== "preparation") ||
    (values.has("stage") && stage === "legacy")) {
    throw new Error("--stage debe ser catalog o preparation");
  }
  if (stage === "legacy" && (values.has("source") || values.has("preparation"))) {
    throw new Error("--source y --preparation requieren --stage");
  }
  if (stage === "catalog" && values.has("preparation")) {
    throw new Error("--preparation solo es compatible con --stage preparation");
  }
  if (stage === "preparation" && !values.has("preparation")) {
    throw new Error("--stage preparation requiere --preparation");
  }
  const age = values.get("maxAgeHours") ?? "48";
  const maxAgeHours = Number(age);
  const outputDir = resolve(values.get("outDir") ?? provider.defaultOptions.outDir);
  const outputPrefix = values.get("outPrefix") ?? provider.defaultOptions.outPrefix;
  const preparation = values.has("preparation") ? resolve(values.get("preparation") ?? "") : null;
  const source = resolve(values.get("source") ?? join(outputDir,
    `${stage === "preparation" ? preparation?.split(/[\\/]/).at(-1)?.replace(/-preparation\.json$/, "") ?? "" : outputPrefix}-catalog.json`));
  if (stage !== "legacy" && !source.endsWith("-catalog.json")) throw new Error("--source debe ser -catalog.json");
  if (preparation && !preparation.endsWith("-preparation.json")) throw new Error("--preparation debe ser -preparation.json");
  return {
    providerId, stage, source, preparation,
    outputDir, outputPrefix, maxAgeHours,
    displayedOutputDir: values.get("outDir") ?? provider.defaultOptions.outDir
  };
};
