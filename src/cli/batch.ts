import { fileURLToPath } from "node:url";
import { describeBatch, runBatch } from "../pipeline/batch/run.js";
import { batchHelp, parseBatchOptions } from "./options/batch.js";

const main = async (): Promise<void> => {
  const options = parseBatchOptions(process.argv.slice(2));
  if (options === "help") {
    console.log(batchHelp);
    return;
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ dryRun: true, providers: describeBatch(options) }, null, 2));
    return;
  }

  const scraperScript = fileURLToPath(new URL("../pipeline/scrape-run.js", import.meta.url));
  const { report, reportFile } = await runBatch(options, scraperScript);
  console.log(`[batch] status=${report.status} history=${reportFile}`);
  if (report.status !== "complete") process.exitCode = 1;
};

await main().catch((error: unknown) => {
  console.error(`[batch] error=${String(error)}`);
  process.exitCode = 1;
});
