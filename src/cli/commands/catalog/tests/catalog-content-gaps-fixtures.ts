import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const createBaselineRoot = async (commercial = false): Promise<string> => {
  const temporary = join(root, "storage");
  await mkdir(temporary, { recursive: true });
  const destination = await mkdtemp(join(temporary, "huecos-baseline-"));
  try {
    await mkdir(join(destination, "data"), { recursive: true });
    const copies = [
      readFile(join(root, "data", "specification-improvement-exceptions.json"))
        .then((content) => writeFile(join(destination, "data", "specification-improvement-exceptions.json"), content)),
      ...(commercial ? [readFile(join(root, "data", "audit-finding-recognitions.json"))
        .then((content) => writeFile(join(destination, "data", "audit-finding-recognitions.json"), content))] : []),
      ...(!commercial ? [
        cp(join(root, "dist"), join(destination, "dist"), {
          recursive: true, mode: constants.COPYFILE_FICLONE,
          filter: (path) => !path.split(/[\\/]/u).includes("tests")
        }),
        cp(join(root, "scripts", "shared"), join(destination, "scripts", "shared"), {
          recursive: true, mode: constants.COPYFILE_FICLONE
        })
      ] : []),
      ...(["gam", "gomariz", "mercaeleva"] as const).map(async (providerId) => {
        const source = join(root, "catalogs", "providers", providerId);
        const target = join(destination, "catalogs", "providers", providerId);
        const published = providerId === "gomariz"
          ? join(root, "src", "testing", "fixtures", "gomariz", "regression-143", "publications", "ffe1f64cd24d")
          : await accreditedPublicationDirectory(root, providerId);
        await cp(published, join(target, "publications", basename(published)), {
          recursive: true, mode: constants.COPYFILE_FICLONE
        });
        if (commercial) {
          const index = providerId === "gomariz"
            ? join(root, "src", "testing", "fixtures", "gomariz", "regression-143", "publications", "active.json")
            : join(source, "publications", "active.json");
          await writeFile(join(target, "publications", "active.json"), await readFile(index));
        }
        if (providerId !== "mercaeleva" || commercial) {
          const original = providerId === "gomariz"
            ? join(root, "src", "testing", "fixtures", "gomariz", "regression-143")
            : join(source, "original");
          if (providerId === "gomariz") {
            const manifest: unknown = JSON.parse(await readFile(join(published, "manifest.json"), "utf8"));
            if (!manifest || typeof manifest !== "object" || !("source" in manifest) ||
              !manifest.source || typeof manifest.source !== "object" ||
              !("catalogSha256" in manifest.source) || typeof manifest.source.catalogSha256 !== "string" ||
              createHash("sha256").update(await readFile(join(original, "scrape-gomariz-catalog.json")))
                .digest("hex") !== manifest.source.catalogSha256) {
              throw new Error("La captura histórica Gomariz no coincide con la publicación acreditada");
            }
          }
          await cp(original, join(target, "original"), {
            recursive: true, mode: constants.COPYFILE_FICLONE
          });
        }
      })
    ];
    const completed = await Promise.allSettled(copies);
    const failure = completed.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    return destination;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
};
export const readCommercialBaselineRoot = async (): Promise<string> => {
  baselineRoot ??= await createBaselineRoot(true);
  return baselineRoot;
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

