import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoverageReview, verifyCoverageReview } from "../catalog/coverage/review.js";
import { isNewEditorialCohort, selectPublishableCatalog } from "../catalog/editorial/select-publishable.js";
import type { PublishableSelection } from "../catalog/editorial/select-publishable.js";
import { readCanonicalCatalog } from "../infrastructure/filesystem/canonical-catalog.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/offline-preparation.js";
import { printCommandError } from "./reporting/errors.js";

const help = `Uso:
  npm run select:publishable -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --out <seleccion.json>
  npm run select:publishable -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --outDir <directorio>
  npm run select:publishable -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --dry-run

En la cohorte de 25/10/2026 se exigen además --baseline <gam-catalog.json>,
--catalog <gam-catalog.json> y --coverage-review <revision.json> para escribir archivos.
La revisión debe justificar todas las ausencias y diferencias; no restaura máquinas,
no modifica los originales ni convierte las tres exclusiones técnicas en ready.
--outDir genera tres JSON de productos por proveedor y selection.json con trazabilidad.`;

const sha = (content: string): string => createHash("sha256").update(content).digest("hex");

const ensureCoverageReview = async (
  options: ReadonlyMap<string, string>,
  expectedGamSha: string
): Promise<void> => {
  const baseline = options.get("--baseline");
  const catalog = options.get("--catalog");
  const review = options.get("--coverage-review");
  if (!baseline || !catalog || !review || baseline === catalog) {
    throw new Error("F50: la nueva cohorte requiere --baseline, --catalog y --coverage-review aprobada");
  }
  const [previous, current, previousText, currentText, reviewText] = await Promise.all([
    readCanonicalCatalog(baseline), readCanonicalCatalog(catalog),
    readFile(baseline, "utf8"), readFile(catalog, "utf8"), readFile(review, "utf8")
  ]);
  if (current.providerId !== "gam" || previous.providerId !== "gam" || sha(currentText) !== expectedGamSha) {
    throw new Error("F50: el catálogo GAM no coincide con la preparación seleccionada");
  }
  const report = createCoverageReview(previous, current, sha(previousText), sha(currentText));
  if (report.missing.length !== 4 || report.changed.length !== 24 ||
    new Set(report.missing.map(({ reference }) => reference)).size !== 4 ||
    !["6942", "6948", "6366", "6676"].every((reference) =>
      report.missing.some((entry) => entry.reference === reference))) {
    throw new Error("F50: la cobertura no coincide con las cuatro ausencias y los 24 cambios observados");
  }
  const value: unknown = JSON.parse(reviewText);
  verifyCoverageReview(value, report);
};

const writePublishable = async (dir: string, selection: PublishableSelection): Promise<void> => {
  const files = [
    ...["gam", "gomariz", "mercaeleva"].map((providerId) => ({
      path: join(dir, `${providerId}-publishable.json`),
      text: JSON.stringify(selection.products.filter((item) => item.providerId === providerId), null, 2)
    })),
    { path: join(dir, "selection.json"), text: JSON.stringify(selection, null, 2) }
  ];
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  try {
    for (const file of files) {
      await writeFile(file.path, file.text, { flag: "wx" });
      written.push(file.path);
    }
  } catch (error) {
    await Promise.all(written.map((path) => rm(path, { force: true })));
    throw error;
  }
  for (const file of files) console.log(`  JSON generado: ${file.path}`);
};

export const runSelectPublishable = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  const options = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--dry-run") {
      if (dryRun) throw new Error("--dry-run repetido");
      dryRun = true;
      continue;
    }
    if (!key || !["--gam", "--gomariz", "--mercaeleva", "--out", "--outDir", "--baseline", "--catalog", "--coverage-review"].includes(key)) {
      throw new Error(`Opción desconocida: ${key}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--") || options.has(key)) throw new Error(`Opción sin valor o repetida: ${key}`);
    options.set(key, resolve(value));
    index += 1;
  }
  const out = options.get("--out");
  const outDir = options.get("--outDir");
  if ((dryRun && (out || outDir)) || (!dryRun && Boolean(out) === Boolean(outDir))) {
    throw new Error("Se requiere --out o --outDir, salvo con --dry-run; no combinar salidas");
  }
  const providers = ["gam", "gomariz", "mercaeleva"] as const;
  const paths = providers.map((providerId) => {
    const path = options.get(`--${providerId}`);
    if (!path || !path.endsWith("-preparation.json")) throw new Error(`Preparación inválida: ${providerId}`);
    return { providerId, path };
  });
  if (new Set(paths.map((entry) => entry.path)).size !== paths.length) throw new Error("Preparaciones repetidas");
  if (out && (paths.some((entry) => entry.path === out) || !out.endsWith(".json"))) throw new Error("Ruta de salida inválida");
  if (outDir && paths.some((entry) => entry.path.startsWith(`${outDir}/`) || entry.path.startsWith(`${outDir}\\`))) {
    throw new Error("Directorio de salida contiene una preparación de entrada");
  }
  const preparations = await Promise.all(paths.map(({ providerId, path }) => readOfflinePreparation(path, providerId)));
  const selection = selectPublishableCatalog(preparations);
  const isNew = isNewEditorialCohort(preparations);
  console.log(`SELECCIÓN EDITORIAL ${isNew ? "F50" : "F48"} | originales ${selection.totals.original} | publicables ${selection.totals.publishable} | excluidos ${selection.totals.excluded} | quality review ${selection.totals.review}`);
  for (const excluded of selection.exclusions) console.log(`  Excluida ${excluded.providerId}:${excluded.reference} | ${excluded.reason}`);
  if (dryRun) {
    if (isNew) console.log("  Simulación provisional: cobertura GAM requiere revisión editorial de cuatro ausencias y 24 cambios");
    console.log("  Ningún archivo escrito");
    return;
  }
  if (isNew) {
    const source = preparations.find((item) => item.source.providerId === "gam");
    if (!source) throw new Error("F50: preparación GAM no encontrada");
    await ensureCoverageReview(options, source.source.catalogSha256);
  } else if (["--baseline", "--catalog", "--coverage-review"].some((key) => options.has(key))) {
    throw new Error("La revisión F50 solo corresponde a la nueva cohorte");
  }
  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(selection, null, 2), { flag: "wx" });
    console.log(`  Selección: ${out}`);
  } else if (outDir) {
    await writePublishable(outDir, selection);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSelectPublishable(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("select:publishable", error);
    process.exitCode = 1;
  });
}
