import { isDeepStrictEqual } from "node:util";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { preflightIndividualAccreditations } from "./individual-accreditation.js";
import type { IndividualAccreditationProvider } from "./individual-accreditation.js";
import {
  approveAutomaticIndividualEditorial
} from "./individual-editorial.js";
import type { IndividualEditorialReview } from "./individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "./individual-selection.js";
import type { IndividualCatalogProvider } from "../preparation/individual-context.js";

const approvalReason = "Acreditación automática de exclusiones históricas coincidentes, con evidencia y preparación verificadas";

export const planAutomaticIndividualAccreditation = (
  context: IndividualAccreditationProvider
): CampaignAccreditation => {
  if (context.existing?.inspection.approved) {
    if (context.existing.inspection.issues.length) throw new Error(`${context.providerId}: aprobación existente inválida`);
    return context.existing.accreditation;
  }
  const exclusions = context.expected.exclusions.map((entry): CampaignAccreditation["exclusions"][number] => {
    const historical = context.antecedents.find((item) => item.reference === entry.reference);
    if (!historical || entry.status === "intervention" || historical.status !== entry.status ||
      historical.sourceUrl !== entry.sourceUrl || !isDeepStrictEqual(historical.issues, entry.issues)) {
      throw new Error(`${context.providerId}:${entry.reference}: incidencia nueva o distinta de la exclusión vigente; ` +
        "publicación bloqueada hasta acreditar el caso mediante los mecanismos existentes");
    }
    const recorded = context.existing?.accreditation.exclusions.find((item) => item.reference === entry.reference);
    if (recorded?.decision !== null && recorded !== undefined &&
      (recorded.decision !== "excluir" || !recorded.reason || recorded.reason.trim().length < 15 ||
        !recorded.evidenceUrls.includes(entry.sourceUrl))) {
      throw new Error(`${context.providerId}:${entry.reference}: decisión editorial previa incompatible; publicación bloqueada`);
    }
    return { ...entry, decision: "excluir",
      reason: recorded?.decision === "excluir" ? recorded.reason : historical.reason,
      evidenceUrls: recorded?.decision === "excluir" ? recorded.evidenceUrls : historical.evidenceUrls };
  });
  const planned: CampaignAccreditation = {
    ...context.expected, exclusions, approved: true, approvalReason
  };
  return planned;
};

export const ensureAutomaticIndividualAccreditations = async (
  workspace: string, providers: readonly IndividualCatalogProvider[]
): Promise<readonly IndividualEditorialReview[]> => {
  const contexts = await preflightIndividualAccreditations(workspace, providers);
  const plans = contexts.map(planAutomaticIndividualAccreditation);
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    const planned = plans[index];
    if (!context || !planned) throw new Error("Acreditación automática: conjunto incompleto");
    const selection = await readIndividualSelection(context.providerId, context.options.catalogFile, context.options.preparationFile);
    if (!isDeepStrictEqual(selection.draft, context.expected)) {
      throw new Error(`${context.providerId}: preparación modificada durante la acreditación automática`);
    }
    selectIndividualPublishable(selection, JSON.stringify(planned, null, 2));
  }
  const reviews: IndividualEditorialReview[] = [];
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    const planned = plans[index];
    if (!context || !planned) throw new Error("Acreditación automática: conjunto incompleto");
    if (context.existing?.inspection.approved) {
      reviews.push(context.existing);
      continue;
    }
    reviews.push(await approveAutomaticIndividualEditorial(context.options, planned));
  }
  return reviews;
};
