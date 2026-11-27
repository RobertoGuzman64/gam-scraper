import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { after } from "node:test";
import { copyTestWorkspace, createTemporaryTestWorkspace } from "./reusable-workspace-fixture.js";
import { prepareExplorerTechnicalEvidence } from "../../tools/catalog/prepare-explorer-technical-evidence.js";

export const createPanelEvidenceWorkspaceFixture = (prepareTechnicalEvidence = true): {
  readonly root: () => Promise<string>;
  readonly withCopy: (action: (workspace: string) => Promise<void>) => Promise<void>;
} => {
  let source: Promise<string> | null = null;
  const root = (): Promise<string> => {
    if (source === null) {
      source = (async (): Promise<string> => {
        const directory = await createTemporaryTestWorkspace("eqz-panel-evidence-");
        try {
          await copyTestWorkspace(resolve(process.cwd(), "catalogs"), join(directory, "catalogs"));
          if (prepareTechnicalEvidence) await prepareExplorerTechnicalEvidence(directory);
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
