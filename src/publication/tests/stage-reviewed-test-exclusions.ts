import { writeFile } from "node:fs/promises";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import type { IndividualEditorialReview } from "../individual/individual-editorial.js";

export const stageReviewedTestExclusions = async (review: IndividualEditorialReview): Promise<void> => {
  const next: CampaignAccreditation = {
    ...review.accreditation,
    exclusions: review.accreditation.exclusions.map((item) => item.decision !== null ? item : ({
      ...item,
      decision: "excluir",
      reason: "Revisión de origen no acreditada para publicar esta unidad",
      evidenceUrls: [item.sourceUrl]
    }))
  };
  await writeFile(review.draftFile, JSON.stringify(next, null, 2));
};
