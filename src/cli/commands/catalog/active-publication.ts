import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectActiveCampaign } from "../../../pipeline/publication/active-campaign.js";
import { selectActivePublication } from "../../../pipeline/publication/active-publication.js";
import { printCommandError } from "../../reporting/errors.js";
import { printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const help = `Uso: npm run publicacion:vigente -- <proveedor> --sha <sha256> [--activar] [--json]
     npm run publicacion:vigente -- --campana <runId> [--activar] [--json]
  sin --activar  Simular la selección y comparar la publicación vigente con la candidata
  --activar      Activar expresamente una publicación individual ya acreditada
  --json         Mostrar diferencias y referencias en JSON
No crea ni acredita JSON finales. La activación de campaña exige un snapshot portátil aprobado y es atómica para los cuatro proveedores. Las publicaciones históricas siguen inmutables.`;

export const runActivePublication = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  if (args[0] === "--campana") {
    const runId = args[1];
    const rest = args.slice(2);
    if (!runId || rest.some((arg) => arg !== "--activar" && arg !== "--json") ||
      new Set(rest).size !== rest.length) throw new Error(help);
    const result = await selectActiveCampaign(root, runId, rest.includes("--activar"));
    if (rest.includes("--json")) { console.log(JSON.stringify(result, null, 2)); return; }
    printReportLine(`PUBLICACIÓN GLOBAL | ${runId} | ${result.status} | aprobación ${result.approvalSha256}`);
    for (const [id, diff] of Object.entries(result.differences)) {
      printReportLine(`  ${id} | ${diff.previousProducts} -> ${diff.candidateProducts} | altas ${diff.added.length} | bajas ${diff.removed.length} | modificadas ${diff.modified.length} | descripciones perdidas ${diff.lostDescriptions.length} | especificaciones retiradas ${diff.removedSpecifications.length}`);
    }
    if (result.status === "simulation") printReportLine("  Simulación; requiere --activar para cambiar el conjunto vigente");
    return;
  }
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error(help);
  let sha: string | undefined;
  let activate = false;
  let json = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--sha" && !sha) sha = rest[++index];
    else if (arg === "--activar" && !activate) activate = true;
    else if (arg === "--json" && !json) json = true;
    else throw new Error(help);
  }
  if (!sha || !/^[a-f0-9]{64}$/.test(sha)) throw new Error(help);
  const result = await selectActivePublication(root, providerId, sha, activate);
  if (json) { console.log(JSON.stringify(result, null, 2)); return; }
  const d = result.difference;
  printReportLine(`PUBLICACIÓN VIGENTE | ${providerId} | ${result.status}`);
  printReportLine(`  Anterior: ${d.previous ?? "sin selección inequívoca"} | Candidata: ${d.candidate}`);
  printReportLine(`  Fichas: ${d.previousProducts} -> ${d.candidateProducts} | Altas: ${d.added.length} | Ausencias: ${d.removed.length} | Modificadas: ${d.modified.length}`);
  printReportLine(`  Pérdidas de descripción: ${d.lostDescriptions.length} | Especificaciones retiradas: ${d.removedSpecifications.length}`);
  for (const [label, ids] of [["Altas", d.added], ["Ausencias", d.removed], ["Cambios", d.modified],
  ["Descripciones perdidas", d.lostDescriptions], ["Especificaciones retiradas", d.removedSpecifications]] as const) {
    if (ids.length) printReportLine(`  ${label}: ${ids.slice(0, 20).join(", ")}${ids.length > 20 ? ` (+${ids.length - 20}; consulta --json)` : ""}`);
  }
  if (result.status === "simulation") printReportLine("  Simulación de solo lectura; requiere --activar para cambiar la versión vigente");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runActivePublication(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("publicacion:vigente", error);
    process.exitCode = 1;
  });
}
