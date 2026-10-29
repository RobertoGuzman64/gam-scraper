import type { CampaignOperationsStatus } from "../../pipeline/campaign/operations-status.js";
import type { InventoryItem, OperationsInventory } from "../../pipeline/campaign/operations-inventory.js";
import { formatHeader, printStatus } from "./terminal.js";

const printItem = (label: string, item: InventoryItem): void => {
  if (item.state === "ausente") {
    console.log(`  ${label} | AUSENTE | ${item.detail}`);
    return;
  }
  const level = item.state === "correcto" ? "PASS" : item.state === "error" ? "FAIL" : "WARN";
  printStatus(level, `${label} | ${item.state.toUpperCase()} | ${item.detail}`);
};

export const printOperationsInventory = (status: CampaignOperationsStatus, inventory: OperationsInventory): void => {
  console.log(formatHeader("ESTADO OPERATIVO"));
  console.log(`LOTE RECONOCIDO | ${status.campaign.runId ?? "sin lote"} | ${status.description}`);
  for (const issue of status.campaign.issues) printStatus("WARN", issue);
  printItem("REFERENCIA", status.reference.status === "valid"
    ? { state: "correcto", detail: "Válida" }
    : status.reference.status === "absent" ? { state: "ausente", detail: "No existe referencia" }
      : { state: status.reference.status === "recoverable" ? "parcial" : "error",
        detail: status.reference.reason });
  console.log("\nDOCUMENTACIÓN Y RECURSOS ESENCIALES");
  for (const entry of inventory.essentials) printItem(entry.path, entry.status);
  console.log("\nPROVEEDORES");
  for (const provider of inventory.providers) {
    console.log(`  ${provider.providerId.toUpperCase()}`);
    printItem("  ORIGINAL OPERATIVO", provider.original);
    printItem("  ORIGINAL REPOSITORIO", provider.portableOriginal);
    if (provider.consistency.state !== "ausente") printItem("  COHERENCIA", provider.consistency);
    printItem("  PREPARACIÓN", provider.preparation);
    printItem("  JSON FINAL", provider.final);
  }
  console.log("\nCAMPAÑAS CONSERVADAS");
  console.log(`  ENTREGAS ACREDITADAS | ${inventory.retainedDeliveries}/2`);
  for (const campaign of inventory.campaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.campaigns.length) console.log("  Sin campañas registradas");
  for (const issue of inventory.campaignIssues) printStatus("FAIL", issue);
  console.log("\nCATALOGS/ VERSIONADOS");
  console.log(`  CAMPAÑAS ACREDITADAS | ${inventory.portableDeliveries}/2`);
  for (const campaign of inventory.portableCampaigns) printItem(`  ${campaign.runId}`, campaign.status);
  if (!inventory.portableCampaigns.length) console.log("  Sin campañas portátiles registradas");
  for (const issue of inventory.portableIssues) printStatus("FAIL", issue);
  console.log("  CONSULTA | Sin escrituras, extracciones ni recomendaciones operativas");
};
