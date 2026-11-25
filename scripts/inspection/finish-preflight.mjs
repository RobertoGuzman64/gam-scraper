import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const build = spawnSync(process.execPath, ["scripts/build/run-build.mjs", "--quiet", "--if-needed"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", windowsHide: true
});
if (build.status !== 0 || build.error) {
  const detail = build.error?.message ?? (build.stderr || build.stdout || `build código ${build.status}`);
  process.stderr.write(`FINISH | PREFLIGHT NO EJECUTADO | ${detail}\n`);
  process.exit(1);
}
try {
  const [{ parseIndividualCatalogProviders }, { inspectIndividualFinishPreflight }] = await Promise.all([
    import(pathToFileURL(resolve(root, "dist/cli/options/individual-catalog.js")).href),
    import(pathToFileURL(resolve(root, "dist/publication/individual/finish-preflight.js")).href)
  ]);
  const { providerIds } = parseIndividualCatalogProviders(process.argv.slice(2));
  const report = await inspectIndividualFinishPreflight(root, providerIds);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  for (const item of report.providers) {
    const types = [...new Set(item.absences.map((entry) => entry.classification))].map((type) =>
      `${type}:${item.absences.filter((entry) => entry.classification === type).length}`).join(", ");
    process.stderr.write(`FINISH | ${item.providerId} | ${item.evaluable ? "EVALUABLE" : "BLOQUEADO"} | ${item.blockers.length} impedimentos | ${item.absences.length} ausencias contrastables${types ? ` (${types})` : ""}\n`);
    for (const blocker of item.blockers) {
      process.stderr.write(`  ${blocker.reference ?? "—"} | ${blocker.step} | ${blocker.reason}\n`);
    }
  }
  process.exitCode = report.complete ? 0 : 1;
} catch (error) {
  process.stderr.write(`FINISH | ERROR | ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
