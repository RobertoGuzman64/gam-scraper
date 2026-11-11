import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readActiveTechnicalPublication, listTechnicalVersions } from "../../../infrastructure/filesystem/catalog/technical-publication.js";
import { compareWithTechnicalVersion, publishTechnicalSnapshot } from "../../../publication/technical-publication.js";
import { isCampaignProvider } from "../../../contracts/campaign-providers.js";
import { printCommandError } from "../../reporting/errors.js";
import { printCommandHeader, printReportLine } from "../../reporting/terminal.js";
import type { TechnicalDifference } from "../../../publication/technical-snapshot.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const help = `Uso: npm run publicacion:tecnica -- <proveedor> --preparacion <preparation.json> [--activar] [--json]
     npm run publicacion:tecnica -- manain --csv <partial-all.csv> --censo <censo.json> [--activar] [--json]
     npm run publicacion:tecnica -- <proveedor> --ver [--json]
     npm run publicacion:tecnica -- <proveedor> --listar [--json]
     npm run publicacion:tecnica -- <proveedor> --comparar <sha256> [--json]
Sin --activar se simula sin escrituras. La publicación técnica nunca activa la comercial.`;

const showDifference = (value: TechnicalDifference): void => {
  printReportLine(`  Versión anterior: ${value.previous ?? "ninguna"} | candidata: ${value.candidate}`);
  printReportLine(`  Altas ${value.added.length} · bajas ${value.removed.length} · modificadas ${value.changed.length} · estados ${value.changedStatus.length} · incidencias ${value.changedIssues.length} · pérdidas de especificación ${value.lostSpecifications.length}`);
  for (const [name, list] of [
    ["Bajas", value.removed], ["Estados", value.changedStatus], ["Incidencias", value.changedIssues],
    ["Pérdidas de especificaciones", value.lostSpecifications]
  ] as const) {
    if (list.length) printReportLine(`  ${name}: ${list.slice(0, 20).join(", ")}${list.length > 20 ? ` (+${list.length - 20})` : ""}`);
  }
};

export const runTechnicalPublication = async (args: readonly string[], workspace: string = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  const [providerId, ...rest] = args;
  if (!isCampaignProvider(providerId)) throw new Error(help);
  let preparation: string | undefined;
  let csv: string | undefined;
  let census: string | undefined;
  let mode: "publish" | "view" | "list" | "compare" = "publish";
  let other: string | undefined;
  let activate = false;
  let json = false;
  for (let index = 0; index < rest.length; index++) {
    const argument = rest[index];
    if (argument === "--activar" && !activate) activate = true;
    else if (argument === "--json" && !json) json = true;
    else if ((argument === "--preparacion" || argument === "--csv" || argument === "--censo") &&
      rest[index + 1] && !rest[index + 1]!.startsWith("--")) {
      const value = rest[++index]!;
      if (argument === "--preparacion" && !preparation) preparation = value;
      else if (argument === "--csv" && !csv) csv = value;
      else if (argument === "--censo" && !census) census = value;
      else throw new Error(help);
    } else if ((argument === "--ver" || argument === "--listar") && mode === "publish") {
      mode = argument === "--ver" ? "view" : "list";
    } else if (argument === "--comparar" && mode === "publish" &&
      rest[index + 1] && /^[a-f0-9]{64}$/.test(rest[index + 1]!)) {
      mode = "compare";
      other = rest[++index];
    } else throw new Error(help);
  }
  if (mode !== "publish") {
    if (activate || preparation || csv || census) throw new Error(help);
    if (mode === "list") {
      const versions = await listTechnicalVersions(workspace, providerId);
      if (json) { console.log(JSON.stringify({ providerId, versions }, null, 2)); return; }
      printReportLine(`PUBLICACIONES TÉCNICAS | ${providerId} | ${versions.length} versiones verificadas`);
      for (const version of versions) printReportLine(`  ${version}`);
      return;
    }
    if (mode === "compare") {
      const difference = await compareWithTechnicalVersion(workspace, providerId, other!);
      if (json) { console.log(JSON.stringify(difference, null, 2)); return; }
      printCommandHeader(`PUBLICACIÓN TÉCNICA | ${providerId} | COMPARACIÓN`);
      showDifference(difference);
      return;
    }
    const active = await readActiveTechnicalPublication(workspace, providerId);
    if (json) { console.log(JSON.stringify(active, null, 2)); return; }
    printReportLine(active ? `PUBLICACIÓN TÉCNICA | ${providerId} | ${active.sha256} | ${active.snapshot.quality} | ${active.snapshot.products.length} fichas · ${active.snapshot.totals.ready} ready · ${active.snapshot.totals.review} review`
      : `PUBLICACIÓN TÉCNICA | ${providerId} | sin versión vigente`);
    return;
  }
  const result = await publishTechnicalSnapshot(workspace, providerId, {
    ...(preparation === undefined ? {} : { preparation }),
    ...(csv === undefined ? {} : { csv }),
    ...(census === undefined ? {} : { census })
  }, activate);
  if (json) { console.log(JSON.stringify(result, null, 2)); return; }
  printCommandHeader(`PUBLICACIÓN TÉCNICA | ${providerId} | ${result.status.toUpperCase()}`);
  printReportLine(`  Origen ${result.snapshot.quality} · ${result.snapshot.products.length} fichas · ${result.snapshot.totals.ready} ready · ${result.snapshot.totals.review} review`);
  printReportLine(`  Huella SHA-256: ${result.sha256}`);
  showDifference(result.difference);
  if (result.historicalComparisonWarning) {
    printReportLine(`  AVISO | No se pudo comparar con la publicación comercial histórica: ${result.historicalComparisonWarning}`);
  }
  if (result.historicalSpecificationLosses.length) {
    printReportLine(`  Diagnóstico histórico comercial: ${result.historicalSpecificationLosses.length} especificaciones ausentes del candidato (sin reconciliación automática)`);
    printReportLine(`  ${result.historicalSpecificationLosses.slice(0, 20).join(", ")}`);
  }
  if (result.status === "simulated") printReportLine("  Simulación sin escrituras; --activar selecciona solo esta versión técnica");
  else printReportLine("  La publicación comercial y sus índices no se han activado");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runTechnicalPublication(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("publicacion:tecnica", error);
    process.exitCode = 1;
  });
}
