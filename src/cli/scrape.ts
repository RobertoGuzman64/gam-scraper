import { printCommandError } from "./reporting/errors.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs, resolveCliSelection, scrapeHelp } from "./options/scrape.js";
import { ScrapeConsole } from "./reporting/scrape-progress.js";
import { runScrape } from "../pipeline/scrape-run.js";

export const runSingleScrape = async (args: readonly string[]): Promise<void> => {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(scrapeHelp);
    return;
  }
  const selection = resolveCliSelection(args);
  const { provider, options } = selection;
  const verbose = parseArgs(args).verbose === true;
  if (verbose) console.log(`[config] mode=${selection.mode} provider=${provider.id} prefix=${options.outPrefix}`);
  const reporter = new ScrapeConsole(provider.id, options.outDir, options.outPrefix, verbose);
  try {
    reporter.stage("preparando extracción", options.outDir);
    const completed = await runScrape(selection, reporter);
    if (!completed) process.exitCode = 1;
  } catch (error) {
    reporter.abort(error);
    throw error;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSingleScrape(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("scrape", error);
    process.exitCode = 1;
  });
}
