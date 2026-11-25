import { writeFile } from "node:fs/promises";
import { printReportLine } from "../../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorial, readIndividualEditorialState,
  prepareIndividualEditorialProposals, startIndividualEditorial
} from "../../../../publication/individual/individual-editorial.js";
import type { IndividualEditorialOptions, IndividualEditorialReview } from "../../../../publication/individual/individual-editorial.js";
import { printCommandError } from "../../../reporting/errors.js";
import { formatAccreditationIssues } from "../../../reporting/individual/individual-accreditation.js";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const help = `Uso: npm run acreditar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> [modo]
  sin modo                                   Crear o consultar borrador individual
  --listar                                   Consultar decisiones, motivos y evidencias
  --detalle                                  Mostrar todos los requisitos por decisión
  --exportar <archivo.json>                   Exportar copia exacta para revisión humana, sin aprobar
  --proponer                                 Preparar exclusiones justificadas sin aprobar
  --consultar <referencia>                   Consultar ficha y URL original
  --validar                                  Validar todas las decisiones sin escribir
  --decidir <referencia> excluir --motivo "..." --evidencia <https-url>
                                            Guardar decisión humana sin aprobar
  --aprobar --motivo "..."                  Aprobar el conjunto explícitamente
La vía individual no crea JSON comerciales ni modifica campañas globales.`;

const parse = (args: readonly string[], workspace: string): { options: IndividualEditorialOptions; action: readonly string[] } => {
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error(help);
  const recognized = new Map<string, string>();
  const action: string[] = [];
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--source" || arg === "--preparation") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--") || recognized.has(arg)) throw new Error(help);
      recognized.set(arg, value);
      index += 1;
    } else if (arg !== undefined) action.push(arg);
  }
  const source = recognized.get("--source");
  const preparation = recognized.get("--preparation");
  if (!source || !preparation) throw new Error(help);
  return { options: { rootDirectory: workspace, providerId, catalogFile: resolve(source), preparationFile: resolve(preparation) }, action };
};

const show = (review: IndividualEditorialReview, detailed = false): void => {
  printReportLine(`ACREDITACIÓN INDIVIDUAL | ${review.accreditation.sources[0]?.providerId.toUpperCase()} | ${review.inspection.approved ? "APROBADA" : "PENDIENTE"}`);
  printReportLine(`  Borrador: ${review.draftFile}`);
  printReportLine(`  Decisiones válidas: ${review.inspection.completed}/${review.inspection.total}`);
  for (const line of formatAccreditationIssues(review.inspection.issues, detailed)) printReportLine(line);
  if (review.inspection.approved) printReportLine("  Aprobación guardada; JSON comercial pendiente de entrega individual");
};

const showDecisions = (review: IndividualEditorialReview): void => {
  for (const item of review.accreditation.exclusions) {
    const issues = review.inspection.issues.filter((issue) =>
      issue.providerId === item.providerId && issue.reference === item.reference);
    printReportLine(`  FICHA | ${item.providerId}:${item.reference} | ${item.status} | ${issues.length ? "PENDIENTE" : item.decision ?? "pendiente"}`);
    printReportLine(`    Origen: ${item.sourceUrl}`);
    printReportLine(`    Incidencias: ${item.issues.join("; ")}`);
    printReportLine(`    Decisión: ${item.decision ?? "sin decisión humana"}`);
    printReportLine(`    Motivo: ${item.reason ?? "pendiente"}`);
    for (const evidence of item.evidenceUrls) printReportLine(`    Evidencia: ${evidence}`);
    if (issues.length) printReportLine(`    Por acreditar: ${issues.map((issue) => issue.message).join("; ")}`);
  }
};

export const runAccreditProvider = async (args: readonly string[], workspace = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  const { options, action: rawAction } = parse(args, workspace);
  const detailed = rawAction.includes("--detalle");
  const action = rawAction.filter((argument) => argument !== "--detalle");
  if (rawAction.filter((argument) => argument === "--detalle").length > 1) throw new Error(help);
  if (action.length === 0) { show(await startIndividualEditorial(options), detailed); return; }
  if (action.length === 1 && action[0] === "--proponer") {
    await startIndividualEditorial(options);
    const review = await prepareIndividualEditorialProposals(options);
    show(review, detailed);
    showDecisions(review);
    printReportLine("  Propuestas sin aprobación humana ni contraste externo adicional");
    return;
  }
  if (action.length === 2 && action[0] === "--exportar" && action[1] && !action[1].startsWith("--")) {
    const state = await readIndividualEditorialState(options);
    const target = resolve(action[1]);
    await writeFile(target, state.raw, { flag: "wx" });
    printReportLine(`BORRADOR EXPORTADO | ${target} | ${state.inspection.completed}/${state.inspection.total} decisiones válidas`);
    printReportLine("  Copia del expediente actual; no genera decisiones ni aprobación, no sustituye al borrador vigente");
    return;
  }
  if (action.length === 1 && action[0] === "--listar") {
    const review = await inspectIndividualEditorial(options);
    show(review, detailed);
    showDecisions(review);
    return;
  }
  if (action.length === 2 && action[0] === "--consultar" && action[1]) {
    const review = await inspectIndividualEditorial(options);
    const item = review.accreditation.exclusions.find((entry) => entry.reference === action[1]);
    if (!item) throw new Error("La ficha no necesita acreditación editorial individual");
    printReportLine(`FICHA | ${options.providerId}:${item.reference} | ${item.status}`);
    printReportLine(`  Fuente: ${item.sourceUrl}`);
    for (const issue of item.issues) printReportLine(`  Incidencia: ${issue}`);
    printReportLine(`  Decisión: ${item.decision ?? "pendiente"}`);
    printReportLine(`  Motivo: ${item.reason ?? "pendiente"}`);
    for (const evidence of item.evidenceUrls) printReportLine(`  Evidencia: ${evidence}`);
    return;
  }
  if (action.length === 1 && action[0] === "--validar") {
    const review = await inspectIndividualEditorial(options);
    show(review, detailed);
    if (review.inspection.issues.length) throw new Error(`${review.inspection.issues.length} incidencias editoriales pendientes`);
    return;
  }
  if (action[0] === "--decidir" && action[1] && action[2] === "excluir" && action[3] === "--motivo" && action[4]) {
    const evidenceUrls: string[] = [];
    for (let index = 5; index < action.length; index += 2) {
      if (action[index] !== "--evidencia" || !action[index + 1]) throw new Error(help);
      evidenceUrls.push(action[index + 1]!);
    }
    if (!evidenceUrls.length) throw new Error(help);
    show(await decideIndividualEditorial(options, {
      reference: action[1], decision: "excluir", reason: action[4], evidenceUrls
    }), detailed);
    return;
  }
  if (action.length === 3 && action[0] === "--aprobar" && action[1] === "--motivo" && action[2]) {
    show(await approveIndividualEditorial(options, action[2]), detailed);
    return;
  }
  throw new Error(help);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runAccreditProvider(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("acreditar:proveedor", error);
    process.exitCode = 1;
  });
}
