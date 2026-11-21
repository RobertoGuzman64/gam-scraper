import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { after } from "node:test";
import { readZipArchive } from "../../infrastructure/archive/zip.js";
import { copyTestWorkspace, createTemporaryTestWorkspace } from "./reusable-workspace-fixture.js";
import { prepareExplorerTechnicalEvidence } from "../../tools/catalog/prepare-explorer-technical-evidence.js";

export const createPanelEvidenceWorkspaceFixture = (): {
  readonly root: () => Promise<string>;
  readonly withCopy: (action: (workspace: string) => Promise<void>) => Promise<void>;
} => {
  let source: Promise<string> | null = null;
  const root = (): Promise<string> => {
    if (source === null) {
      source = (async (): Promise<string> => {
        const directory = await createTemporaryTestWorkspace("eqz-panel-evidence-");
        try {
          const location = resolve(process.cwd(), "src", "testing", "fixtures", "panel", "published-snapshot.evidence");
          const files = readZipArchive(await readFile(location));
          for (const file of files) {
            const parts = file.name.split("/");
            if (parts[0] !== "catalogs" || parts.some((part) => !part || part === "." || part === "..")) {
              throw new Error(`Entrada de evidencia de panel no permitida: ${file.name}`);
            }
            const path = join(directory, ...parts);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, file.data, { flag: "wx" });
          }
          await prepareExplorerTechnicalEvidence(directory);
          return directory;
        } catch (error) {
          await rm(directory, { recursive: true, force: true });
          throw error;
        }
      })();
    }
    return source;
  };
  after(async () => {
    if (source !== null) {
      const directory = await source.catch(() => null);
      if (directory !== null) await rm(directory, { recursive: true, force: true });
    }
  });
  return {
    root,
    withCopy: async (action): Promise<void> => {
      const sourceRoot = await root();
      const directory = await createTemporaryTestWorkspace("eqz-panel-case-");
      try {
        await copyTestWorkspace(join(sourceRoot, "catalogs"), join(directory, "catalogs"));
        await action(directory);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  };
};
