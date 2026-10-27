import type { CampaignReview } from "../../pipeline/campaign/review.js";
import { formatStatus, printStatus } from "./terminal.js";

export const printCampaignReview = (result: CampaignReview): void => {
  console.log(`CAMPAÑA | ${result.campaign.runId ?? "sin lote"} | ${result.campaign.status}`);
  if (result.campaign.runFile) console.log(`  Lote: ${result.campaign.runFile}`);
  for (const issue of result.campaign.issues) console.log(`  AVISO | ${issue}`);
  for (const provider of result.providers) {
    if (provider.state !== "validated") {
      console.log(`  ${provider.providerId.toUpperCase()} | ${provider.state.toUpperCase()} | ${provider.message ?? "Pendiente"}`);
      continue;
    }
    console.log(`  ${formatStatus(provider.review === 0 ? "PASS" : "WARN", `${provider.providerId.toUpperCase()} | VALIDADO | ${provider.products} productos | Ready: ${provider.ready} | Review: ${provider.review}`)}`);
    console.log(`    Preparación: ${provider.preparationFile}`);
    for (const item of provider.items ?? []) {
      console.log(`    REVIEW | ${item.reference} | ${item.title}`);
      console.log(`      Fuente: ${item.url}`);
      for (const issue of item.issues) console.log(`      Campo/motivo: ${issue}`);
    }
  }
  if (result.complete) {
    const total = result.providers.reduce((sum, provider) => sum + (provider.review ?? 0), 0);
    printStatus(total === 0 ? "PASS" : "WARN", `REVISIÓN | ${total} fichas pendientes de criterio. ${total === 0 ? "Sin Review; pendiente de acreditar y seleccionar en el siguiente paso." : "No se cambian valores ni estados automáticamente."}`);
  } else {
    printStatus("FAIL", "REVISIÓN | NO CERRADA | Conservar archivos y resolver los errores antes de avanzar");
  }
};
