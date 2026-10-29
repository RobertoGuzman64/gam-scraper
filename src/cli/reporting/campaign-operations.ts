import type { CampaignOperationsStatus } from "../../pipeline/campaign/operations-status.js";
import { formatHeader, formatStatus, printStatus, printReportLine } from "./terminal.js";

export const printCampaignOperations = (status: CampaignOperationsStatus): void => {
  printReportLine(formatHeader("ESTADO"));
  printReportLine(`ESTADO CAMPAÑA | ${status.campaign.runId ?? "sin lote"} | ${status.description}`);
  for (const issue of status.campaign.issues) printStatus("WARN", issue);
  for (const provider of status.campaign.providers) {
    if (provider.state === "prepared" || provider.state === "invalid" || provider.state === "failed") {
      printReportLine(`  ${formatStatus(provider.state === "prepared" ? "PASS" : "FAIL", `${provider.providerId.toUpperCase()} | ${provider.state}${provider.message ? ` | ${provider.message}` : ""}`)}`);
    }
  }
  if (status.reference.status === "absent") printStatus("WARN", "REFERENCIA | AUSENTE");
  else if (status.reference.status === "invalid") printStatus("FAIL", "REFERENCIA | INVÁLIDA");
  else printStatus(status.reference.status === "valid" ? "PASS" : "WARN", `REFERENCIA | ${status.reference.status === "valid" ? "VÁLIDA" : "RECUPERABLE"} | ${status.reference.reference.manifest.runId}`);
  for (const alert of status.alerts) printStatus("WARN", alert);
  for (const command of status.next) printReportLine(`  SIGUIENTE | ${command}`);
  printReportLine("  CONSULTA | Sin escrituras sobre campañas ni referencias");
};
