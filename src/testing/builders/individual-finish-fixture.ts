import assert from "node:assert/strict";
import { basename, join } from "node:path";
import type { IndividualFinishResult } from "../../publication/individual-finish.js";
import { createIndividualWorkspaceFixture } from "./individual-workspace-fixture.js";
import { preflightIndividualAccreditations } from "../../publication/individual-accreditation.js";
import { startIndividualEditorial, decideIndividualEditorial, approveIndividualEditorial } from "../../publication/individual-editorial.js";
import { publishIndividualCatalogs } from "../../publication/individual-finish.js";

export const finishProviders = ["gam", "gomariz", "mercaeleva"] as const;
const reason = "Contraste editorial realizado con evidencia de origen";
const approve = async (root: string): Promise<void> => {
  const contexts = await preflightIndividualAccreditations(root, finishProviders);
  for (const context of contexts) {
    await startIndividualEditorial(context.options);
    for (const entry of context.expected.exclusions) {
      const proposal = context.proposed.exclusions.find((item) => item.reference === entry.reference);
      await decideIndividualEditorial(context.options, {
        reference: entry.reference, decision: "excluir",
        reason: proposal?.reason ?? reason, evidenceUrls: [entry.sourceUrl]
      });
    }
    await approveIndividualEditorial(context.options, reason);
  }
};

const finishFixtureOptions = {
  prefix: "equipzilla-finish con espacios ", serialNumber: "SERIAL-REPETIDO",
  defaultState: "approved" as const, approve
};

export const createIndividualFinishWorkspace = () => createIndividualWorkspaceFixture(finishFixtureOptions);

export const createPublishedIndividualFinishWorkspace = () => {
  const withWorkspace = createIndividualWorkspaceFixture({
    ...finishFixtureOptions,
    defaultState: "published" as const,
    publish: publishIndividualTestWorkspace
  });
  return async (action: (root: string, desktop: string, result: IndividualFinishResult) => Promise<void>): Promise<void> => {
    await withWorkspace(async (root, desktop, published) => {
      assert.ok(published);
      const snapshot = structuredClone(published);
      const result: IndividualFinishResult = {
        ...snapshot,
        providers: snapshot.providers.map((item) => ({
          ...item,
          zipFile: item.zipFile ? join(desktop, basename(item.zipFile)) : null
        }))
      };
      await action(root, desktop, result);
    });
  };
};

export const publishIndividualTestWorkspace = (root: string, desktop: string) => publishIndividualCatalogs({
  workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop
});
