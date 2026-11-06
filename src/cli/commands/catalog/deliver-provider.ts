import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { completeIndividualDelivery } from "../../../publication/complete-individual-delivery.js";
import type { IndividualClosureMode } from "../../../publication/complete-individual-delivery.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const help = `Uso: npm run entregar:proveedor -- gam --source <catalog.json> --preparation <preparation.json> [--dry-run | --verificar | --solo-candidata] [--solo-json]
  --dry-run         Simular sin escribir ni activar
  --verificar       Comprobar la entrega existente sin activar
  --solo-candidata  Generar y verificar una candidata sin hacerla vigente
  --solo-json       No crear ni exigir ZIP; en modo definitivo sí activa
  sin modo          Verificar JSON, aprobación, ZIP y recibo; evaluar diferencias y activar si es seguro
Una aprobación individual válida es obligatoria. No sustituye campañas globales ni admite pérdidas sin evidencia.`;

export const runDeliverProvider = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("--")) throw new Error(help);
  const options = new Map<string, string>();
  let mode: IndividualClosureMode = "publish";
  let jsonOnly = false;
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (key === "--dry-run" || key === "--verificar" || key === "--solo-candidata") {
      if (mode !== "publish") throw new Error(help);
      mode = key === "--dry-run" ? "simulation" : key === "--verificar" ? "verify" : "candidate";
    } else if (key === "--solo-json") {
      if (jsonOnly) throw new Error(help);
      jsonOnly = true;
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
  const delivery = { rootDirectory: root, providerId, catalogFile: resolve(source), preparationFile: resolve(preparation) };
  const result = await completeIndividualDelivery(delivery,
    jsonOnly || mode === "simulation" ? null : await findDesktopDirectory(), mode);
  const { delivery: files, activation } = result;
  const status = activation === "blocked" ? "BLOQUEADA" : activation === "activated" ? "COMPLETADA" :
    activation === "unchanged" ? "YA VIGENTE" : mode === "candidate" ? "CANDIDATA VERIFICADA" :
      mode === "verify" ? "VERIFICADA" : "SIMULACIÓN";
  printReportLine(`ENTREGA INDIVIDUAL | ${providerId.toUpperCase()} | ${status}`);
  printReportLine(`  Publicables: ${files.publishable} | Excluidas: ${files.excluded}`);
  printReportLine(`  JSON: ${files.productFile}`);
  if (mode === "simulation") printReportLine("  Sin escrituras ni activación");
  else {
    printReportLine(`  Acreditación y manifiesto: ${files.publicationDirectory}`);
    if (files.zipFile) printReportLine(`  ZIP verificado: ${files.zipFile}`);
    else printReportLine("  Solo JSON; ZIP no solicitado");
    printReportLine(`  Vigente: ${activation === "activated" ? "ACTIVADA" : activation === "unchanged" ?
      "YA VIGENTE" : activation === "blocked" ? "BLOQUEADA" : "SIN CAMBIOS DE VIGENCIA (MODO DE CONSULTA/CANDIDATA)"}`);
  }
  for (const blocker of result.blockers) printReportLine(`  Bloqueo: ${blocker}`);
  if (activation === "blocked") throw new Error("Entrega verificada, pero la política de aceptación impide activarla");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const finish = (code: number): void => {
    process.exitCode = code;
    setTimeout(() => {
      console.error("WARN | Entrega finalizada, pero el proceso mantuvo recursos abiertos; cierre controlado");
      process.exit(code);
    }, 2000).unref();
  };
  runDeliverProvider(process.argv.slice(2)).then(
    () => finish(0),
    (error: unknown) => {
      printCommandError("entregar:proveedor", error);
      finish(1);
    }
  );
}
