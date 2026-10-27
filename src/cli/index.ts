import { printCommandError } from "./reporting/errors.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBatchCli } from "./batch.js";
import { runExport } from "./export.js";
import { runPrepare } from "./prepare.js";
import { runSingleScrape } from "./scrape.js";
import { runPreflight } from "./validate.js";
import { batchHelp } from "./options/batch.js";
import { scrapeHelp } from "./options/scrape.js";
import { validateHelp } from "./validate.js";

export const cliHelp = `EQUIPZILLA SCRAPER

  npm run extraer:proveedor -- gam                   Extraer GAM
  npm run extraer:proveedor -- gomariz               Extraer Gomariz
  npm run extraer:proveedor -- mercaeleva            Extraer Mercaeleva
  npm run extraer:todos                    Extraer los tres proveedores
  npm run extraer:todos -- --simular          Simular el lote
  npm run validar -- gam                 Validar último catálogo de GAM
  npm run preparar -- --help               Preparación independiente offline
  npm run exportar -- --help                Consultar exportación segura

  npm run ayuda -- extraer:proveedor                Ayuda extracción
  npm run ayuda -- extraer:todos          Ayuda extracción por lote
  npm run validar -- --help              Ayuda validación

El lote no importa nada en el backend; los productos requieren revisión antes de importar.`;

export const runCli = async (argv: readonly string[]): Promise<void> => {
  const [command, ...args] = argv;
  if (!command || command === "help" || command === "--help") {
    if (args.length) throw new Error("No combine ayuda general con otras opciones");
    console.log(cliHelp);
    return;
  }
  switch (command) {
    case "scrape":
      return runSingleScrape(args);
    case "batch": return runBatchCli(args);
    case "validate": return runPreflight(args);
    case "export": return runExport(args);
    case "prepare": return runPrepare(args);
    case "help-scrape": console.log(scrapeHelp); return;
    case "help-batch": console.log(batchHelp); return;
    case "help-validate": console.log(validateHelp); return;
    default: throw new Error(`Comando desconocido: ${command}. Usa npm run ayuda`);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError(process.argv[2] ?? "cli", error);
    process.exitCode = 1;
  });
}
