import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectPublishableCatalog } from "../catalog/editorial/select-publishable.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/offline-preparation.js";
import { printCommandError } from "./reporting/errors.js";

const help = `Uso:
  npm run select:publishable -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --out <seleccion.json>
  npm run select:publishable -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --dry-run

Genera una selección editorial de la cohorte F47; no cambia el estado ready/review,
no altera catálogos originales, no consulta portales ni valida requisitos de importación.
Cada preparación requiere su manifest íntegro. Rechaza cohorts distintas o revisiones nuevas.`;

export const runSelectPublishable = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log(help);
    return;
  }
  const options = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--dry-run") {
      if (dryRun) throw new Error("--dry-run repetido");
      dryRun = true;
      continue;
    }
    if (!key || !["--gam", "--gomariz", "--mercaeleva", "--out"].includes(key)) throw new Error(`Opción desconocida: ${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--") || options.has(key)) throw new Error(`Opción sin valor o repetida: ${key}`);
    options.set(key, resolve(value));
    index += 1;
  }
  if ((!dryRun && !options.has("--out")) || (dryRun && options.has("--out"))) {
    throw new Error("Se requiere --out, salvo con --dry-run; no combinar ambos");
  }
  const providers = ["gam", "gomariz", "mercaeleva"] as const;
  const paths = providers.map((providerId) => {
    const path = options.get(`--${providerId}`);
    if (!path || !path.endsWith("-preparation.json")) throw new Error(`Preparación inválida: ${providerId}`);
    return { providerId, path };
  });
  if (new Set(paths.map((entry) => entry.path)).size !== paths.length) throw new Error("Preparaciones repetidas");
  const preparations = await Promise.all(paths.map(({ providerId, path }) => readOfflinePreparation(path, providerId)));
  const selection = selectPublishableCatalog(preparations);
  console.log(`SELECCIÓN EDITORIAL F48 | originales ${selection.totals.original} | publicables ${selection.totals.publishable} | excluidos ${selection.totals.excluded} | quality review ${selection.totals.review}`);
  for (const excluded of selection.exclusions) console.log(`  Excluida ${excluded.providerId}:${excluded.reference} | ${excluded.reason}`);
  if (dryRun) {
    console.log("  Simulación: ningún archivo escrito");
    return;
  }
  const out = options.get("--out");
  if (!out) throw new Error("Falta --out");
  if (paths.some((entry) => entry.path === out) || !out.endsWith(".json")) throw new Error("Ruta de salida inválida");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(selection, null, 2), { flag: "wx" });
  console.log(`  Selección: ${out}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSelectPublishable(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("select:publishable", error);
    process.exitCode = 1;
  });
}
