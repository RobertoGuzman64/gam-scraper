import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readIndividualSelection } from "../../../pipeline/publication/individual-selection.js";
import { printCommandError } from "../../reporting/errors.js";

const help = `Uso:
  npm run seleccionar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json>

Consulta la preparación canónica verificada de un solo proveedor y sus decisiones editoriales pendientes.
No aprueba decisiones, genera JSON finales ni escribe archivos.`;

export const runSelectProvider = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error("Falta proveedor");
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key || !["--source", "--preparation"].includes(key) || !value || value.startsWith("--") || options.has(key)) {
      throw new Error(`Opción desconocida, repetida o sin valor: ${key}`);
    }
    options.set(key, value);
  }
  const source = options.get("--source");
  const preparation = options.get("--preparation");
  if (!source || !preparation) throw new Error("Se requieren --origen y --preparacion");
  const context = await readIndividualSelection(providerId, resolve(source), resolve(preparation));
  console.log(`SELECCIÓN INDIVIDUAL | ${providerId.toUpperCase()} | PENDIENTE DE ACREDITACIÓN`);
  console.log(`  Originales: ${context.preparation.source.productCount} | Ready: ${context.preparation.totals.ready} | Review: ${context.preparation.totals.review}`);
  console.log(`  Decisiones editoriales necesarias: ${context.draft.exclusions.length}`);
  for (const item of context.draft.exclusions) {
    console.log(`  Pendiente ${item.providerId}:${item.reference} | ${item.status} | ${item.issues.join("; ")}`);
  }
  console.log("  Solo lectura; ninguna ficha publicada ni decisión aprobada");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSelectProvider(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("select:provider", error);
    process.exitCode = 1;
  });
}
