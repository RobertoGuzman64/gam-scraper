import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { accreditedPublicationDirectory } from "../../../../testing/builders/accredited-publication-fixture.js";

const run = promisify(execFile);
export const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixture = (provider: string, prefix: string): string =>
  join(root, "src", "testing", "fixtures", provider, `${prefix}-catalog.json`);
export const gam = fixture("gam", "scrape-gam-marzo-2026");
export const gomariz = fixture("gomariz", "scrape-gomariz");
export const mercaeleva = fixture("mercaeleva", "scrape-mercaeleva");
const cli = join(root, "dist", "cli", "commands", "catalog", "catalog-content-gaps.js");

export const execute = async (args: readonly string[]): Promise<string> =>
  (await run(process.execPath, [cli, ...args], { cwd: root, maxBuffer: 16 * 1024 * 1024 })).stdout;

let baselineRoot: string | undefined;
const createBaselineRoot = async (): Promise<string> => {
  const temporary = join(root, "storage");
  await mkdir(temporary, { recursive: true });
  const destination = await mkdtemp(join(temporary, "huecos-baseline-"));
  try {
    await cp(join(root, "dist"), join(destination, "dist"), {
      recursive: true,
      filter: (path) => !path.split(/[\\/]/u).includes("tests")
    });
    await cp(join(root, "scripts", "shared"), join(destination, "scripts", "shared"), { recursive: true });
    for (const providerId of ["gam", "gomariz", "mercaeleva"] as const) {
      const source = join(root, "catalogs", "providers", providerId);
      const target = join(destination, "catalogs", "providers", providerId);
      const published = await accreditedPublicationDirectory(root, providerId);
      await cp(published, join(target, "publications", basename(published)), { recursive: true });
      if (providerId !== "mercaeleva") {
        await cp(join(source, "original"), join(target, "original"), { recursive: true });
      }
    }
    return destination;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
};
export const executeBaseline = async (args: readonly string[]): Promise<string> => {
  baselineRoot ??= await createBaselineRoot();
  const fixtureCli = join(baselineRoot, "dist", "cli", "commands", "catalog", "catalog-content-gaps.js");
  return (await run(process.execPath, [fixtureCli, ...args], { cwd: baselineRoot, maxBuffer: 16 * 1024 * 1024 })).stdout;
};
export const cleanupBaseline = async (): Promise<void> => {
  if (baselineRoot) await rm(baselineRoot, { recursive: true, force: true });
  baselineRoot = undefined;
};

