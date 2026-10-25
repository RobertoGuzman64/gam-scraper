import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessNewGamCoverage } from "../catalog/coverage/gam-review-gate.js";
import { isNewEditorialCohort, selectPublishableCatalog } from "../catalog/editorial/select-publishable.js";
import { createAccreditationDraft, selectAccreditedPublishable, sha256 as accreditationSha } from "../catalog/editorial/campaign-accreditation.js";
import { readCampaignAccreditationSources } from "../infrastructure/filesystem/campaign-accreditation.js";
import type { PublishableSelection } from "../catalog/editorial/select-publishable.js";
import { readCanonicalCatalog } from "../infrastructure/filesystem/canonical-catalog.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/offline-preparation.js";
import { printCommandError } from "./reporting/errors.js";

const help = `Uso:
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --out <seleccion.json>
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --outDir <directorio>
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --borrador <acreditacion.json>
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --acreditacion <acreditacion.json> --dry-run
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --acreditacion <acreditacion.json> --outDir <directorio>
  npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --dry-run

La vía de acreditación exige un lote global completo, un borrador revisado y
aprobación manual de cada exclusión. No modifica imágenes ni reutiliza URL antiguas.
Las preparaciones derivadas de intervenciones no se aprueban por esta vía.
En la cohorte de 25/10/2026 se exigen además --baseline <gam-catalog.json>,
--catalog <gam-catalog.json> y --coverage-review <revision.json> para escribir archivos.
Con --dry-run se pueden proporcionar --baseline y --catalog para inspeccionar
las incidencias reales, y añadir --coverage-review para validar las decisiones
sin escribir archivos.
La revisión exige retiradas confirmadas o ausencias de listado acreditadas;
"no_acreditado" mantiene bloqueada la publicación. También deben aprobarse
los cambios con evidencia; no restaura máquinas,
no modifica los originales ni convierte las exclusiones técnicas en ready.
La selección también retiene las fichas GAM 6002, 6003 y 6004 por
contradicciones de identidad preexistentes, sin alterar su preparación.
--outDir genera tres JSON de productos por proveedor y selection.json con trazabilidad.`;

const sha = (content: string): string => createHash("sha256").update(content).digest("hex");

const ensureCoverageReview = async (
  options: ReadonlyMap<string, string>,
  expectedGamSha: string,
  allowPending: boolean
): Promise<void> => {
  const baseline = options.get("--baseline");
  const catalog = options.get("--catalog");
  const review = options.get("--coverage-review");
  if (!baseline || !catalog || baseline === catalog || (!allowPending && !review)) {
    throw new Error("Selección editorial GAM: la nueva cohorte requiere --baseline, --catalog y --coverage-review aprobada");
  }
  const [previous, current, previousText, currentText] = await Promise.all([
    readCanonicalCatalog(baseline), readCanonicalCatalog(catalog),
    readFile(baseline, "utf8"), readFile(catalog, "utf8")
  ]);
  if (current.providerId !== "gam" || previous.providerId !== "gam" ||
    sha(previousText) !== "945e218ad93782e868a50b8ecaad99e225242274d9a32ed7b8203cb426e6af87" ||
    sha(currentText) !== expectedGamSha) {
    throw new Error("Selección editorial GAM: el catálogo GAM o su línea base no coincide con la cohorte seleccionada");
  }
  const value: unknown = review ? JSON.parse(await readFile(review, "utf8")) : undefined;
  const report = assessNewGamCoverage(previous, current, sha(previousText), sha(currentText), value);
  const sensitiveChecks = report.changed.reduce((total, entry) => total + entry.fieldChecks.length, 0);
  console.log(`  Cobertura GAM: ${report.missing.length} ausencias, ${report.changed.length} cambios, ${sensitiveChecks} revisiones de campo`);
  console.log(review
    ? "  Revisión de cobertura validada contra los catálogos y sus huellas"
    : "  Expediente sin aprobar: no se ha aportado una revisión de cobertura validada");
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
    if (!key || !["--gam", "--gomariz", "--mercaeleva", "--out", "--outDir", "--baseline", "--catalog", "--coverage-review", "--lote", "--borrador", "--acreditacion"].includes(key)) {
      throw new Error(`Opción desconocida: ${key}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--") || options.has(key)) throw new Error(`Opción sin valor o repetida: ${key}`);
    options.set(key, resolve(value));
    index += 1;
  }
  const out = options.get("--out");
  const outDir = options.get("--outDir");
  const draftPath = options.get("--borrador");
  const accreditationPath = options.get("--acreditacion");
  const runPath = options.get("--lote");
  if ((draftPath && (dryRun || out || outDir || accreditationPath)) ||
    ((draftPath || accreditationPath) && !runPath) ||
    (runPath && !draftPath && !accreditationPath) ||
    (accreditationPath && options.has("--coverage-review"))) {
    throw new Error("Opciones de acreditación incompatibles o incompletas");
  }
  if ((dryRun && (out || outDir)) || (!dryRun && !draftPath && Boolean(out) === Boolean(outDir))) {
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
  if (runPath) {
    const { runId, sources } = await readCampaignAccreditationSources(runPath, preparations, paths);
    if (draftPath) {
      if (paths.some((item) => item.path === draftPath)) throw new Error("Borrador coincide con una preparación");
      const draft = createAccreditationDraft(preparations, sources, runId);
      await mkdir(dirname(draftPath), { recursive: true });
      await writeFile(draftPath, JSON.stringify(draft, null, 2), { flag: "wx" });
      console.log(`BORRADOR EDITORIAL | ${draft.exclusions.length} decisiones pendientes | ${draftPath}`);
      console.log("  Ningún producto aprobado ni archivo original modificado");
      return;
    }
    if (!accreditationPath) throw new Error("Falta acreditación editorial");
    const accreditationText = await readFile(accreditationPath, "utf8");
    const accreditation: unknown = JSON.parse(accreditationText);
    const selection = selectAccreditedPublishable(preparations, sources, runId, accreditation, accreditationSha(accreditationText));
    console.log(`SELECCIÓN EDITORIAL ACREDITADA | originales ${selection.totals.original} | publicables ${selection.totals.publishable} | excluidos ${selection.totals.excluded}`);
    if (dryRun) { console.log("  Ningún archivo escrito"); return; }
    if (out) {
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(selection, null, 2), { flag: "wx" });
      console.log(`  Selección: ${out}`);
    } else if (outDir) {
      await writePublishable(outDir, selection);
    }
    return;
  }
  const selection = selectPublishableCatalog(preparations);
  const isNew = isNewEditorialCohort(preparations);
  console.log(`SELECCIÓN EDITORIAL ${isNew ? "ACTUALIZADA" : "BASE"} | originales ${selection.totals.original} | publicables ${selection.totals.publishable} | excluidos ${selection.totals.excluded} | quality review ${selection.totals.review}`);
  for (const excluded of selection.exclusions) console.log(`  Excluida ${excluded.providerId}:${excluded.reference} | ${excluded.reason}`);
  const coverageOptions = ["--baseline", "--catalog", "--coverage-review"] as const;
  if (isNew) {
    const supplied = coverageOptions.filter((key) => options.has(key));
    if (!dryRun || supplied.length) {
      const source = preparations.find((item) => item.source.providerId === "gam");
      if (!source) throw new Error("Selección editorial GAM: preparación GAM no encontrada");
      await ensureCoverageReview(options, source.source.catalogSha256, dryRun);
    } else {
      console.log("  Cobertura GAM pendiente: 4 ausencias y 24 cambios sin revisión aportada");
    }
  } else if (coverageOptions.some((key) => options.has(key))) {
    throw new Error("La revisión de cobertura solo corresponde a la nueva cohorte");
  }
  if (dryRun) {
    console.log("  Ningún archivo escrito");
    return;
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
