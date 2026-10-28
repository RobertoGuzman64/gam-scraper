import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareActiveCampaignReference } from "../../../pipeline/campaign/reference/compare.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus } from "../../reporting/terminal.js";
import type { ReferenceFieldValue, ReferenceIdentity } from "../../../catalog/reference/compare.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const display = (value: ReferenceFieldValue): string => value.present ? JSON.stringify(value.value) ?? "sin valor" : "(ausente)";
const label = (product: ReferenceIdentity): string =>
  `${product.identity} | ${product.reference ?? "sin referencia"} | ${product.url}`;

export const runCampaignComparison = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run comparar\nCompara los originales completos de la campaña actual con la última entrega íntegra conservada (referencia legada si no existe), sin escribir ni actualizar archivos.");
    return;
  }
  if (args.length > 0) throw new Error("comparar no acepta argumentos");
  const report = await compareActiveCampaignReference(root);
  console.log(formatHeader("COMPARACIÓN"));
  printStatus("PASS", `Comparación calculada | REFERENCIA ${report.baseline === "initial" ? "inicial (todavía no existe)" : report.previousRunId} | CAMPAÑA ${report.currentRunId}`);
  for (const provider of report.providers) {
    console.log(`${provider.providerId.toUpperCase()} | anterior ${provider.previousCount} | actual ${provider.currentCount} | altas ${provider.added.length} | ausencias ${provider.missing.length} | modificaciones ${provider.modified.length} | sin cambios ${provider.unchanged}`);
    if (report.baseline === "initial") continue;
    for (const item of provider.added) console.log(`  ALTA | ${label(item)}`);
    for (const item of provider.missing) console.log(`  AUSENCIA | ${label(item)}`);
    for (const item of provider.modified) {
      console.log(`  MODIFICADA | ${label(item)}`);
      for (const field of item.fields) console.log(`    ${field.field}: ${display(field.previous)} -> ${display(field.current)}`);
    }
  }
  if (report.baseline === "initial") console.log("Sin entrega previa de referencia: comparación inicial; no se requiere actualizar una copia.");
  else if (report.previousRunId === report.currentRunId) {
    console.log("Consulta terminada sin escrituras. Este lote ya es la referencia vigente; no procede actualizarlo otra vez.");
  } else console.log("Consulta terminada sin escrituras. La referencia es la última campaña entregada e íntegra.");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignComparison(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("comparar", error);
    process.exitCode = 1;
  });
}
