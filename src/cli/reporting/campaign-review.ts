import type { CampaignReview } from "../../pipeline/campaign/review.js";
import { formatStatus, printStatus, printReportLine } from "./terminal.js";

export const printCampaignReview = (result: CampaignReview): void => {
  printReportLine(`CAMPAÑA | ${result.campaign.runId ?? "sin lote"} | ${result.campaign.status}`);
  if (result.campaign.runFile) printReportLine(`  Lote: ${result.campaign.runFile}`);
  for (const issue of result.campaign.issues) printReportLine(`  AVISO | ${issue}`);
  for (const provider of result.providers) {
    if (provider.state !== "validated") {
      printReportLine(`  ${provider.providerId.toUpperCase()} | ${provider.state.toUpperCase()} | ${provider.message ?? "Pendiente"}`);
      continue;
    }
    printReportLine(`  ${formatStatus(provider.review === 0 ? "PASS" : "WARN", `${provider.providerId.toUpperCase()} | VALIDADO | ${provider.products} productos | Ready: ${provider.ready} | Review: ${provider.review}`)}`);
    printReportLine(`    Preparación: ${provider.preparationFile}`);
    for (const item of provider.items ?? []) {
      printReportLine(`    REVIEW | ${item.reference} | ${item.title}`);
      printReportLine(`      Fuente: ${item.url}`);
      for (const issue of item.issues) printReportLine(`      Campo/motivo: ${issue}`);
    }
  }
  if (result.complete) {
    const total = result.providers.reduce((sum, provider) => sum + (provider.review ?? 0), 0);
    printStatus(total === 0 ? "PASS" : "WARN", `REVISIÓN | ${total} fichas pendientes de criterio. ${total === 0 ? "Sin Review; pendiente de acreditar y seleccionar en el siguiente paso." : "No se cambian valores ni estados automáticamente."}`);
  } else {
    printStatus("FAIL", "REVISIÓN | NO CERRADA | Conservar archivos y resolver los errores antes de avanzar");
  }
};
