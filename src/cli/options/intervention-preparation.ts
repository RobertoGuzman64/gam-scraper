import { basename, dirname, join, resolve } from "node:path";

export const interventionPreparationHelp = `Uso:
  npm run intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> [--simular] [--salida <archivo-preparation.json>]
  npm run intervenir:validar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> --preparacion <archivo-preparation.json>

Comandos manuales: nunca forman parte de las extracciones ni de la publicación automática.
La preparación derivada se revalida contra el catálogo original, el expediente y las reglas vigentes.
La selección editorial sigue bloqueada hasta una autorización específica.`;

export type InterventionPreparationOptions = {
  readonly providerId: string;
  readonly source: string;
  readonly originalSource: string;
  readonly out: string;
  readonly dryRun: boolean;
};

export type InterventionValidationOptions = {
  readonly providerId: string;
  readonly source: string;
  readonly originalSource: string;
  readonly preparation: string;
};

const parseValues = (args: readonly string[], mode: "prepare" | "validate") => {
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("-")) throw new Error(`Falta proveedor.\n${interventionPreparationHelp}`);
  const values = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (option === "--dry-run" && mode === "prepare") {
      if (dryRun) throw new Error("--simular repetido");
      dryRun = true;
      continue;
    }
    if (!option || !["--derived", "--source", mode === "prepare" ? "--out" : "--preparation"].includes(option)) {
      throw new Error(`Opción desconocida: ${option}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--") || values.has(option)) throw new Error(`Opción duplicada o sin valor: ${option}`);
    values.set(option, value);
    index += 1;
  }
  const derived = values.get("--derived");
  const original = values.get("--source");
  if (!derived || basename(derived) !== "catalog-derived.json" ||
    !original || !basename(original).endsWith("-catalog.json")) {
    throw new Error("Se requieren --derivado catalog-derived.json y --origen <original-catalog.json>");
  }
  return { providerId, source: resolve(derived), originalSource: resolve(original), values, dryRun };
};

export const parseInterventionPreparationOptions = (args: readonly string[]): InterventionPreparationOptions => {
  const options = parseValues(args, "prepare");
  const out = options.values.get("--out") ?? join(dirname(options.source), "prepared", "intervention-preparation.json");
  if (!basename(out).endsWith("-preparation.json") || resolve(out) === options.source ||
    resolve(out) === options.originalSource) throw new Error("La salida de preparación es inválida");
  return {
    providerId: options.providerId,
    source: options.source,
    originalSource: options.originalSource,
    out: resolve(out), dryRun: options.dryRun
  };
};

export const parseInterventionValidationOptions = (args: readonly string[]): InterventionValidationOptions => {
  const options = parseValues(args, "validate");
  const preparation = options.values.get("--preparation");
  if (!preparation || !basename(preparation).endsWith("-preparation.json")) {
    throw new Error("Se requiere --preparacion <archivo-preparation.json>");
  }
  return {
    providerId: options.providerId, source: options.source,
    originalSource: options.originalSource, preparation: resolve(preparation)
  };
};
