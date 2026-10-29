import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { deliverIndividualArchive } from "../../../pipeline/publication/individual-archive.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const help = `Uso: npm run entregar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> [--simular | --verificar]
  --simular     Comprobar la selección aprobada sin escribir
  --verificar   Comprobar el JSON, la acreditación y el ZIP existente sin escribir
  sin modo      Guardar el JSON acreditado y generar el ZIP en el Escritorio
Requiere acreditación:proveedor aprobada y vigente; no altera campañas globales.`;

export const runDeliverProvider = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error(help);
  const options = new Map<string, string>();
  let mode: "simulation" | "publish" | "verify" = "publish";
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (key === "--dry-run" || key === "--verificar") {
      if (mode !== "publish") throw new Error(help);
      mode = key === "--dry-run" ? "simulation" : "verify";
    } else if (key === "--source" || key === "--preparation") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--") || options.has(key)) throw new Error(help);
      options.set(key, value);
      index += 1;
    } else throw new Error(help);
  }
  const source = options.get("--source");
  const preparation = options.get("--preparation");
  if (!source || !preparation) throw new Error(help);
  const desktop = mode === "simulation" ? "" : await findDesktopDirectory();
  const result = await deliverIndividualArchive({
    rootDirectory: root, providerId, catalogFile: resolve(source), preparationFile: resolve(preparation)
  }, desktop, mode);
  printReportLine(`ENTREGA INDIVIDUAL | ${providerId.toUpperCase()} | ${result.status.toUpperCase()}`);
  printReportLine(`  Publicables: ${result.publishable} | Excluidas: ${result.excluded}`);
  printReportLine(`  JSON: ${result.productFile}`);
  if (result.status === "simulation") printReportLine("  Solo simulación; no se escribieron archivos");
  else {
    printReportLine(`  Acreditación y manifiesto: ${result.publicationDirectory}`);
    printReportLine(`  ZIP verificado: ${result.zipFile}`);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runDeliverProvider(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("entregar:proveedor", error);
    process.exitCode = 1;
  });
}
