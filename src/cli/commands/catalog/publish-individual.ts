import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../options/individual-catalog.js";
import { formatHeader, printReportLine, printStatus } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { publishIndividualCatalogs } from "../../../pipeline/publication/individual-finish.js";
import type { IndividualFinishResult } from "../../../pipeline/publication/individual-finish.js";
import { runCatalogContentGaps } from "./catalog-content-gaps.js";

export const publishIndividualHelp = `Uso:
  npm run catalogo:publicar
  npm run catalogo:publicar -- --proveedor gam
  npm run catalogo:publicar -- --simular
  npm run catalogo:publicar -- --proveedor gomariz --simular

Paso 2/2: FINISH. Reutiliza automáticamente exclusiones históricas idénticas y acredita antes de publicar.
Verifica los ZIP y recibos antes de activar; activa proveedores individuales con diario de recuperación,
comprueba integridad, ejecuta retención y auditor de huecos. --simular no escribe ni activa.
Repetir el comando recupera un conjunto parcial sin sobrescribir entregas.
No sustituye una campaña global de cuatro proveedores.`;

const consolidate = (workspace: string): void => {
  const processResult = spawnSync(process.execPath,
    [join(workspace, "scripts", "maintenance", "consolidate-local-artifacts.mjs"), "--aplicar"],
    { cwd: workspace, stdio: "inherit", windowsHide: true });
  if (processResult.error || processResult.status !== 0) {
    throw new Error(`ARCHIVADO PENDIENTE | Publicaciones activas conservadas. ${processResult.error?.message ?? `código ${processResult.status}`}. Corrige el bloqueo y repite catalogo:publicar`);
  }
};

const describeResult = (result: IndividualFinishResult): void => {
  for (const item of result.providers) {
    const difference = item.difference;
    printStatus(item.status === "SIMULACIÓN" ? "RUN" : "PASS",
      `${item.providerId.toUpperCase()} | ${item.status} | publicables ${item.publishable} | excluidas ${item.excluded}`);
    printReportLine(`  DIFERENCIAS | altas ${difference.added.length} | bajas ${difference.removed.length} | ` +
      `cambios ${difference.modified.length} | specs nuevas ${difference.addedSpecifications.length} | ` +
      `specs modificadas ${difference.changedSpecifications.length}`);
    if (item.zipFile) printReportLine(`  ZIP y recibo comprobados | ${item.zipFile}`);
    if (result.mode === "simulation") printReportLine("  Solo consulta; ninguna candidata, ZIP o selección se ha escrito");
  }
};

export const runPublishIndividual = async (
  args: readonly string[], workspace: string,
  hooks: {
    readonly desktopDirectory?: string;
    readonly retention?: () => void | Promise<void>;
    readonly auditor?: () => Promise<void>;
  } = {}
): Promise<IndividualFinishResult | null> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(publishIndividualHelp);
    return null;
  }
  if (args.includes("--help")) throw new Error("--help no admite otras opciones");
  const parsed = parseIndividualCatalogProviders(args);
  printReportLine(formatHeader(`PASO 2/2 · FINISH${parsed.dryRun ? " · SIMULACIÓN" : ""}`));
  const root = resolve(workspace);
  if (!parsed.dryRun) {
    const preflight = await publishIndividualCatalogs({
      workspace: root, providers: parsed.providerIds, dryRun: true, desktopDirectory: null
    });
    printStatus("PASS", `PREFLIGHT | ${preflight.providers.length} proveedores con exclusiones acreditadas y diferencias aceptadas`);
    describeResult(preflight);
  }
  const result = await publishIndividualCatalogs({
    workspace: root, providers: parsed.providerIds, dryRun: parsed.dryRun,
    desktopDirectory: parsed.dryRun ? null : hooks.desktopDirectory ?? await findDesktopDirectory()
  });
  describeResult(result);
  if (parsed.dryRun) {
    printStatus("PASS", "PREFLIGHT COMPLETO | Tres proveedores o alcance seleccionado sin bajas no acreditadas. Sin escrituras");
    return result;
  }
  printStatus("PASS", "PUBLICACIÓN | ACTIVADA Y VERIFICADA; ejecutando retención y auditor independientes");
  await (hooks.retention ?? (() => consolidate(root)))();
  printStatus("PASS", "RETENCIÓN | ARCHIVADO COMPLETO");
  try {
    await (hooks.auditor ?? (() => runCatalogContentGaps(["--comparar", "--specs", "--top", "5"])) )();
  } catch (error) {
    throw new Error(`AUDITOR PENDIENTE | Publicaciones activadas y archivado completo. ` +
      `Repite catalogo:publicar para comprobar el auditor sin volver a publicar: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  printStatus("PASS", result.providers.every((item) => item.status === "YA VIGENTE")
    ? "FINISH COMPLETO | YA VIGENTE, sin crear nuevas publicaciones ni ZIP"
    : "FINISH COMPLETO | Publicaciones activadas, verificadas y archivadas");
  return result;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPublishIndividual(process.argv.slice(2), fileURLToPath(new URL("../../../../", import.meta.url))).catch((error: unknown) => {
    printCommandError("catalogo:publicar", error);
    process.exitCode = 1;
  });
}
