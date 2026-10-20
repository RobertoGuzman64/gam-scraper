import { resolveCliSelection } from "./options/scrape.js";
import { ScrapeConsole } from "./reporting/scrape-progress.js";
import { runScrape } from "../pipeline/scrape-run.js";

const main = async (): Promise<void> => {
  const selection = resolveCliSelection(process.argv.slice(2));
  const { provider, options } = selection;
  const verbose = process.argv.includes("--verbose");
  if (verbose) console.log(`[config] mode=${selection.mode} provider=${provider.id} prefix=${options.outPrefix}`);
  const completed = await runScrape(selection, new ScrapeConsole(provider.id, options.outDir, options.outPrefix, verbose));
  if (!completed) process.exitCode = 1;
};

await main().catch((error: unknown) => {
  const message = String(error);
  console.error(`[SCRAPER] ERROR: ${message.length > 200 ? `${message.slice(0, 199)}…` : message}`);
  process.exitCode = 1;
});
