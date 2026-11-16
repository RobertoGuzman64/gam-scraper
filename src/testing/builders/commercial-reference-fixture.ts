import { cleanupBaseline, readCommercialBaselineRoot } from "../../cli/commands/catalog/tests/catalog-content-gaps-fixtures.js";

export type CommercialReferenceFixture = {
  readonly root: string;
  readonly cleanup: () => Promise<void>;
};

export const createCommercialReferenceFixture = async (): Promise<CommercialReferenceFixture> => ({
  root: await readCommercialBaselineRoot(), cleanup: cleanupBaseline
});
