import { printReportLine } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describeBatch, runBatch } from "../../../pipeline/batch/run.js";
import { batchHelp, parseBatchOptions } from "../../options/batch.js";
import { BatchConsole } from "../../reporting/batch-progress.js";
import { formatBatchSummary } from "../../reporting/batch-summary.js";

export const runBatchCli = async (args: readonly string[]): Promise<void> => {
  const options = parseBatchOptions(args);
  if (options === "help") {
    printReportLine(batchHelp);
    return;
  }
  if (options.dryRun) {
    printReportLine(`LOTE | Simulación | ${options.providerIds.length} proveedor${options.providerIds.length === 1 ? "" : "es"}`);
    for (const provider of describeBatch(options)) printReportLine(`  ${provider.providerId} | ${provider.outputDir} | ${provider.outputPrefix}`);
    return;
  }
  const scraperScript = fileURLToPath(new URL("../extraction/scrape.js", import.meta.url));
  const { report, reportFile } = await runBatch(options, scraperScript, new BatchConsole());
  for (const line of formatBatchSummary(report, reportFile)) printReportLine(line);
  if (report.status !== "complete") process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runBatchCli(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("batch", error);
    process.exitCode = 1;
  });
}
