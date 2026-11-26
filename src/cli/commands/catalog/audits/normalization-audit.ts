import { inspectGamSerialization } from "./normalization-serialization.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNormalizationAudit } from "../../../../infrastructure/filesystem/preparation/normalization-audit.js";
import { readPublicationTechnicalProvenance } from "../../../../panel/evidence/read-technical-provenance.js";
import { markAuditProviderFailures } from "../../../../shared/audit-provider-results.js";
import { printNormalizationAudit, writeNormalizationAuditJson } from "../../../reporting/audits/normalization-audit.js";
import { errorDetail, printCommandError } from "../../../reporting/errors.js";

export const parseNormalizationAuditOptions = (args: readonly string[]) => {
  let limit = 20;
  let detailed = false;
  let json = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const option = argument?.split("=")[0];
    if (!option || seen.has(option)) throw new Error(`Opción repetida o inválida: ${argument}`);
    seen.add(option);
    if (argument === "--detalle") detailed = true;
    else if (argument === "--json") json = true;
    else if (option === "--top") {
      const value = argument === "--top" ? args[++index] : argument?.slice("--top=".length);
      if (!value || !/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error("--top requiere un entero positivo seguro");
      }
      limit = Number(value);
    } else throw new Error(`Opción de normalización desconocida: ${argument}`);
  }
  if (json && (detailed || seen.has("--top"))) throw new Error("--json entrega el diagnóstico completo; no se combina con --detalle ni --top");
  return { limit, detailed, json };
};

export const runNormalizationAudit = async (args: readonly string[], workspace = fileURLToPath(new URL("../../../../../", import.meta.url))): Promise<void> => {
  const options = parseNormalizationAuditOptions(args);
  const report = await buildNormalizationAudit(workspace, undefined, readPublicationTechnicalProvenance, inspectGamSerialization);
  if (options.json) {
    try { await writeNormalizationAuditJson(report); }
    catch (error) {
      printCommandError("normalizar:auditar", error);
      process.exitCode = 1;
      return;
    }
  } else printNormalizationAudit(report, options);
  markAuditProviderFailures([...report.auditCoverage.failures, ...report.diagnostics.failures.map(({ check, providerId, reason, count }) => ({
    source: check, providerId, category: "ERROR" as const, detail: `${check}: ${reason} (${count} fichas)`
  }))]);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runNormalizationAudit(process.argv.slice(2)).catch((error: unknown) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify({ version: 1, complete: false, status: "ERROR", error: errorDetail(error) }));
    printCommandError("normalizar:auditar", error);
    process.exitCode = 1;
  });
}
