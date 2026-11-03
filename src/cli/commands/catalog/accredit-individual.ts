import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../options/individual-catalog.js";
import { formatHeader, printReportLine, printStatus } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";
import {
  approveIndividualAccreditations, openIndividualAccreditations, preflightIndividualAccreditations,
  recordIndividualAccreditationDecision, validateIndividualAccreditations
} from "../../../pipeline/publication/individual-accreditation.js";
import type { IndividualAccreditationProvider } from "../../../pipeline/publication/individual-accreditation.js";
import { inspectIndividualEditorial } from "../../../pipeline/publication/individual-editorial.js";
import type { IndividualEditorialReview } from "../../../pipeline/publication/individual-editorial.js";

export type EditorialSessionInput = {
  readonly ask: (question: string) => Promise<string>;
  readonly close: () => void;
};

export const accreditIndividualHelp = `Uso:
  npm run catalogo:acreditar
  npm run catalogo:acreditar -- --proveedor gam
  npm run catalogo:acreditar -- --simular
  npm run catalogo:acreditar -- --proveedor gomariz --simular

Paso 2/3: una sesión interactiva para GAM, Gomariz y Mercaeleva (o uno seleccionado).
Requiere npm run catalogo:preparar y un terminal interactivo para guardar decisiones.
Consultar, excluir con evidencia, aceptar expresamente propuesta fundada, rechazar/aplazar y aprobar
con confirmación global. --simular solo consulta, no escribe borradores.
No modifica originales, no publica ni activa. Las intervenciones técnicas derivadas no están habilitadas. `;

const printEntry = (
  context: IndividualAccreditationProvider,
  entry: IndividualAccreditationProvider["expected"]["exclusions"][number],
  detail: boolean
): void => {
  const current = context.existing?.accreditation.exclusions.find((item) => item.reference === entry.reference) ?? entry;
  const proposal = context.proposed.exclusions.find((item) => item.reference === entry.reference);
  const antecedent = context.antecedents.find((item) => item.reference === entry.reference);
  printReportLine(`FICHA | ${context.providerId.toUpperCase()}:${entry.reference} | ${entry.status} | ${current.decision ?? "PENDIENTE"}`);
  if (detail) {
    printReportLine(`  Fuente: ${entry.sourceUrl}`);
    for (const issue of entry.issues) printReportLine(`  Incidencia: ${issue}`);
    if (current.reason) printReportLine(`  Decisión registrada: ${current.reason}`);
    for (const url of current.evidenceUrls) printReportLine(`  Evidencia registrada: ${url}`);
    if (antecedent) {
      printReportLine(`  ANTECEDENTE | Exclusión de publicación vigente (NO reaprobada): ${antecedent.reason}`);
      for (const url of antecedent.evidenceUrls) printReportLine(`  Evidencia histórica: ${url}`);
    }
    if (proposal?.decision === "excluir" && proposal.reason && current.decision === null) {
      printReportLine(`  PROPUESTA | ${proposal.reason}`);
      for (const url of proposal.evidenceUrls) printReportLine(`  Evidencia propuesta: ${url}`);
      printReportLine("  Propuesta basada en la preparación; no equivale a una revisión externa ni a aprobación humana");
    }
    if (current.decision === null) printReportLine("  Falta decisión humana con motivo de al menos 15 caracteres y evidencia HTTPS original");
  }
};

const printQueue = (contexts: readonly IndividualAccreditationProvider[], dryRun: boolean): void => {
  let decisions = 0;
  let resolved = 0;
  for (const context of contexts) {
    const actual = context.existing?.accreditation ?? context.expected;
    printStatus(context.existing?.inspection.approved ? "PASS" : "WARN",
      `${context.providerId.toUpperCase()} | ${context.existing?.inspection.approved ? "APROBADA" : context.existing ? "BORRADOR / SIN APROBAR" : "SIN BORRADOR"} | ${actual.exclusions.length} fichas con decisión`);
    for (const entry of context.expected.exclusions) printEntry(context, entry, true);
    decisions += actual.exclusions.length;
    resolved += context.existing?.inspection.completed ?? 0;
  }
  printReportLine(`COLA | ${contexts.length} ${contexts.length === 1 ? "proveedor" : "proveedores"} | decisiones válidas: ${resolved}/${decisions} | ${dryRun ? "SIMULACIÓN sin escrituras" : "sesión pendiente de confirmación"}`);
};

const promptForDecisions = async (
  contexts: readonly IndividualAccreditationProvider[], input: EditorialSessionInput
): Promise<boolean> => {
  for (const context of contexts) {
    let review = await inspectIndividualEditorial(context.options);
    if (review.inspection.approved) continue;
    for (const expected of context.expected.exclusions) {
      while (true) {
        const entry = review.accreditation.exclusions.find((item) => item.reference === expected.reference);
        if (!entry) throw new Error(`No se encontró la decisión ${context.providerId}:${expected.reference}`);
        const pending = review.inspection.issues.some((issue) => issue.reference === expected.reference);
        if (!pending) break;
        printEntry({ ...context, existing: review }, expected, true);
        const action = (await input.ask("Acción [c consultar / p aceptar propuesta / e excluir con evidencia / r rechazar propuesta / s aplazar / q salir]: ")).trim().toLowerCase();
        if (action === "q") return false;
        if (action === "s") {
          printStatus("WARN", `${context.providerId}:${expected.reference} | APLAZADA, no se aprueba`);
          break;
        }
        if (action === "r") {
          printStatus("WARN", "PROPUESTA RECHAZADA | Sigue pendiente; aporta evidencia propia o aplaza");
          continue;
        }
        if (action === "c") {
          printEntry({ ...context, existing: review }, expected, true);
          continue;
        }
        let reason: string;
        let evidenceUrls: readonly string[];
        if (action === "p") {
          const proposal = context.proposed.exclusions.find((item) => item.reference === expected.reference);
          if (proposal?.decision !== "excluir" || !proposal.reason || !proposal.evidenceUrls.length) {
            printStatus("WARN", "No hay propuesta justificable. Necesita decisión y evidencia manuales");
            continue;
          }
          printReportLine(`PROPUESTA | ${proposal.reason}`);
          printReportLine(`  Evidencia: ${proposal.evidenceUrls.join(", ")}`);
          const confirm = await input.ask("Escribe EXCLUIR para registrar personalmente esta propuesta (otra respuesta la descarta): ");
          if (confirm.trim() !== "EXCLUIR") continue;
          reason = proposal.reason;
          evidenceUrls = proposal.evidenceUrls;
        } else if (action === "e") {
          reason = (await input.ask("Motivo fundamentado de exclusión (mínimo 15 caracteres): ")).trim();
          printReportLine(`  Es obligatorio incluir la URL original: ${expected.sourceUrl}`);
          evidenceUrls = (await input.ask("Evidencias HTTPS separadas por espacios (incluye URL original): "))
            .trim().split(/\s+/).filter(Boolean);
        } else {
          printStatus("WARN", "Acción desconocida; la decisión sigue pendiente");
          continue;
        }
        try {
          review = await recordIndividualAccreditationDecision(context, {
            reference: expected.reference, decision: "excluir", reason, evidenceUrls
          });
          printStatus("PASS", `DECISIÓN REGISTRADA | ${context.providerId}:${expected.reference} | ${review.inspection.completed}/${review.inspection.total}`);
        } catch (error) {
          printStatus("FAIL", `Decisión no guardada | ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  return true;
};

export const runAccreditIndividual = async (
  args: readonly string[], workspace: string, providedInput?: EditorialSessionInput
): Promise<boolean> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(accreditIndividualHelp);
    return true;
  }
  if (args.includes("--help")) throw new Error("--help no admite otros argumentos");
  const parsed = parseIndividualCatalogProviders(args);
  printReportLine(formatHeader(`PASO 2/3 · ACREDITAR${parsed.dryRun ? " · SIMULACIÓN" : ""}`));
  const contexts = await preflightIndividualAccreditations(workspace, parsed.providerIds);
  if (parsed.dryRun) {
    printQueue(contexts, true);
    printStatus("PASS", "SIMULACIÓN COMPLETA | No se crearon ni modificaron acreditaciones");
    return true;
  }
  if (!providedInput && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    printQueue(contexts, false);
    printStatus("FAIL", "No hay terminal interactivo. Sin escrituras ni aprobaciones. Usa una terminal con TTY o --simular para consultar");
    return false;
  }
  const input = providedInput ?? (() => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.on("SIGINT", () => rl.close());
    return { ask: (question: string) => rl.question(question), close: () => rl.close() };
  })();
  try {
    await openIndividualAccreditations(contexts);
    const latest = await preflightIndividualAccreditations(workspace, parsed.providerIds);
    printQueue(latest, false);
    if (!await promptForDecisions(latest, input)) {
      printStatus("WARN", "SESIÓN INTERRUMPIDA | Decisiones ya registradas conservadas; ninguna aprobación nueva");
      return false;
    }
    let valid: readonly IndividualEditorialReview[];
    try { valid = await validateIndividualAccreditations(latest); }
    catch (error) {
      printStatus("WARN", `VALIDACIÓN BLOQUEADA | ${error instanceof Error ? error.message : String(error)}`);
      printReportLine("  Sin nuevas aprobaciones. Completa la evidencia pendiente y reanuda catalogo:acreditar");
      return false;
    }
    const newApprovals = valid.filter((item) => !item.inspection.approved);
    if (!newApprovals.length) {
      printStatus("PASS", "YA APROBADAS | Mismas fuentes y preparaciones; no se escribe una aprobación redundante");
      return true;
    }
    printReportLine("VALIDACIÓN | Fuentes, preparaciones, borradores y todas las decisiones conformes");
    for (const item of valid) {
      const source = item.accreditation.sources[0];
      if (!source) throw new Error("Fuente editorial ausente");
      printReportLine(`  ${source.providerId.toUpperCase()} | ${item.inspection.completed}/${item.inspection.total} decisiones | original SHA ${source.catalogSha256} | preparación SHA ${source.preparationSha256} | ${item.inspection.approved ? "aprobada previamente" : "requiere confirmación"}`);
    }
    const reason = (await input.ask("Motivo global de aprobación (mínimo 15 caracteres): ")).trim();
    if (reason.length < 15) {
      printStatus("WARN", "CONFIRMACIÓN DENEGADA | Motivo insuficiente, no se aprobó ningún conjunto nuevo");
      return false;
    }
    const confirmed = await input.ask("Para aprobar expresamente el conjunto escribe APROBAR (otra respuesta cancela): ");
    if (confirmed.trim() !== "APROBAR") {
      printStatus("WARN", "CONFIRMACIÓN DENEGADA | Los borradores quedan sin nueva aprobación");
      return false;
    }
    const approved = await approveIndividualAccreditations(latest, reason);
    for (const item of approved) {
      printStatus("PASS", `${item.accreditation.sources[0]?.providerId.toUpperCase()} | APROBADA | ${item.inspection.completed}/${item.inspection.total} decisiones | ${item.runId}`);
    }
    printStatus("PASS", "PASO 2 COMPLETO | No se publicó ni activó ningún catálogo. Siguiente: catalogo:publicar (fase 4)");
    return true;
  } catch (error) {
    if (error instanceof Error && /closed|aborted/i.test(error.message)) {
      printStatus("WARN", "SESIÓN CANCELADA | Ninguna aprobación implícita. Reanuda catalogo:acreditar");
      return false;
    }
    throw error;
  } finally {
    input.close();
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
  runAccreditIndividual(process.argv.slice(2), root).then((ok) => {
    if (!ok) process.exitCode = 1;
  }).catch((error: unknown) => {
    printCommandError("catalogo:acreditar", error);
    process.exitCode = 1;
  });
}
