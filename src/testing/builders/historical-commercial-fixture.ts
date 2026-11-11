import { cleanupBaseline, readCommercialBaselineRoot } from "../../cli/commands/catalog/tests/catalog-content-gaps-fixtures.js";

export type HistoricalCommercialFixture = {
  readonly root: string;
  readonly cleanup: () => Promise<void>;
};

export const createHistoricalCommercialFixture = async (): Promise<HistoricalCommercialFixture> => ({
  root: await readCommercialBaselineRoot(), cleanup: cleanupBaseline
});
