import { createIndividualWorkspaceFixture } from "./individual-workspace-fixture.js";
import { preflightIndividualAccreditations } from "../../pipeline/publication/individual-accreditation.js";
import { startIndividualEditorial, decideIndividualEditorial, approveIndividualEditorial } from "../../pipeline/publication/individual-editorial.js";
import { publishIndividualCatalogs } from "../../pipeline/publication/individual-finish.js";

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

export const createIndividualFinishWorkspace = () => createIndividualWorkspaceFixture({
  prefix: "equipzilla-finish con espacios ", serialNumber: "SERIAL-REPETIDO",
  defaultState: "approved", approve
});

export const publishIndividualTestWorkspace = (root: string, desktop: string) => publishIndividualCatalogs({
  workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop
});
