import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { deliverGrouped, type GroupedDeliveryRequest } from "../../reporting/grouped-delivery.js";
import { deliverActiveCampaign } from "../../../campaign/delivery/execute.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const parseGroupedDelivery = (args: readonly string[]): GroupedDeliveryRequest | null => {
  if (args.length === 0) return null;
  if (args.length === 1 && args[0] === "--publicos") return { kind: "publicos" };
  if (args.length === 3 && args[0] === "--informes" && (args[1] === "--environment" || args[1] === "--entorno") &&
    (args[2] === "develop" || args[2] === "production")) return { kind: "informes", environment: args[2] };
  throw new Error("Uso: entregar [--publicos | --informes --entorno develop|production]");
};

export const runCampaignDelivery = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run entregar\nValida la selección acreditada del lote actual y entrega en el Escritorio equipzilla-AAAA-MM-DD.zip con los cuatro JSON publicables. Conserva la entrega anterior si falla.\n  --publicos: cuatro publicaciones vigentes acreditadas.\n  --informes --entorno develop|production: informes internos vigentes.");
    return;
  }
  const grouped = parseGroupedDelivery(args);
  const desktop = await findDesktopDirectory();
  if (grouped) {
    const zip = await deliverGrouped(root, desktop, grouped);
    printStatus("PASS", `ZIP comprobado: ${zip}`);
    return;
  }
  const delivery = await deliverActiveCampaign(root, desktop);
  printReportLine(formatHeader("ENTREGA"));
  printStatus("PASS", `ENTREGA | ${delivery.runId} | ${delivery.date}`);
  printReportLine(`  GAM ${delivery.products.gam} | Gomariz ${delivery.products.gomariz} | Mercaeleva ${delivery.products.mercaeleva} | Manain ${delivery.products.manain}`);
  printStatus("PASS", `ZIP comprobado: ${delivery.zipFile}`);
  printReportLine("  SIGUIENTE | npm run comparar (origen: últimos originales acreditados; no hace falta actualizar referencia)");
  printReportLine("  SIGUIENTE | npm run extraer (admisión y rotación automática seguras)");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignDelivery(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("entregar", error);
    process.exitCode = 1;
  });
}
