import type { CampaignOperationsStatus } from "../../pipeline/campaign/operations-status.js";

export const printCampaignOperations = (status: CampaignOperationsStatus): void => {
  console.log(`ESTADO CAMPAÑA | ${status.campaign.runId ?? "sin lote"} | ${status.description}`);
  for (const issue of status.campaign.issues) console.log(`  AVISO | ${issue}`);
  for (const provider of status.campaign.providers) {
    if (provider.state === "prepared" || provider.state === "invalid" || provider.state === "failed") {
      console.log(`  ${provider.providerId.toUpperCase()} | ${provider.state}${provider.message ? ` | ${provider.message}` : ""}`);
    }
  }
  if (status.reference.status === "absent") console.log("REFERENCIA | AUSENTE");
  else if (status.reference.status === "invalid") console.log("REFERENCIA | INVÁLIDA");
  else console.log(`REFERENCIA | ${status.reference.status === "valid" ? "VÁLIDA" : "RECUPERABLE"} | ${status.reference.reference.manifest.runId}`);
  for (const alert of status.alerts) console.log(`  AVISO | ${alert}`);
  for (const command of status.next) console.log(`  SIGUIENTE | ${command}`);
  console.log("  CONSULTA | Sin escrituras sobre campañas ni referencias");
};
