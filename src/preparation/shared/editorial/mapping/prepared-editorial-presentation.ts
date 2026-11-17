import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { reconcileGamCorroboratedSummaryModel } from "../../../gam/identity/reconciliation/gam-corroborated-summary-model.js";
import { reconcileGamVerifiedUnitYear } from "../../../gam/technical/reconciliation/gam-verified-unit-year.js";
import { normalizeEditorialGeneral, normalizeEditorialSummary, normalizeEditorialTitle } from "../domain/editorial-normalization.js";
import { presentCommercialMotorization } from "../domain/editorial-motorization.js";
import { normalizeCorroboratedEditorialFuel } from "../domain/editorial-fuel-coherence.js";
import { hasUncorroboratedSignedMotor } from "../domain/editorial-signed-motor-caution.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { assessCommercialHeight } from "../domain/editorial-height-consistency.js";
import { normalizeCommercialYearDescription } from "./source-year-presentation.js";
import { normalizeVerifiedEditorialCapacity } from "../domain/editorial-capacity-coherence.js";
import { removeSourceTitleBranding, removeSourceSummaryBranding } from "./source-editorial-branding.js";
import { restoreCorroboratedEditorialIdentity } from "../domain/editorial-crossed-identity.js";
import { normalizeCorroboratedTowingSummary } from "../domain/editorial-towing-summary.js";
import { removeSourcedSaleWording } from "../domain/editorial-source-brief.js";
import { resolveSourcedShortDiscrepancy } from "../domain/editorial-sourced-short-discrepancy.js";

export const normalizePreparedEditorialPresentation = (
  source: ProductRecord, prepared: ImportCandidate
): ImportCandidate => {
  if (source.providerId !== prepared.providerId || source.reference !== prepared.reference ||
    source.url !== prepared.sourceUrl) throw new Error(`Identidad editorial discordante: ${prepared.sourceUrl}`);
  const verifiedSource = reconcileGamVerifiedUnitYear(source);
  const restoredIdentity = restoreCorroboratedEditorialIdentity(source, prepared.title, prepared.description);
  const sourceMotorConflict = hasUncorroboratedSignedMotor(resolveKnowledgeEditorial(source, source).fallbackGeneral);
  const motorized = sourceMotorConflict ? { ...prepared, spec: { ...prepared.spec, Motor: undefined } } : prepared;
  const baseTitle = presentCommercialMotorization(
    normalizeEditorialTitle(removeSourceTitleBranding(source, restoredIdentity?.title ?? prepared.title), source.model), motorized
  );
  const summary = normalizeCorroboratedTowingSummary(source, prepared,
    normalizeEditorialSummary(removeSourceSummaryBranding(source, restoredIdentity?.short ?? prepared.description), source.model));
  const coherentSummary = reconcileGamCorroboratedSummaryModel(source);
  const correctedSummary = coherentSummary !== source && summary === normalizeEditorialSummary(source.shortDescription, source.model)
    ? normalizeEditorialSummary(coherentSummary.shortDescription, source.model) : summary;
  const yearSummary = verifiedSource !== source && source.year && verifiedSource.year && correctedSummary
    ? correctedSummary.replace(new RegExp(`\\bAño\\s+${source.year}\\b`, "u"), `Año ${verifiedSource.year}`)
    : correctedSummary;
  const height = assessCommercialHeight({ ...prepared, title: baseTitle, description: yearSummary });
  const fuel = normalizeCorroboratedEditorialFuel(source, {
    ...prepared,
    title: height.title,
    description: height.description
  });
  const capacity = normalizeVerifiedEditorialCapacity(source, {
    ...prepared,
    title: fuel.title,
    description: fuel.description,
    description_general: normalizeCommercialYearDescription(
      { ...verifiedSource, longDescription: source.longDescription }, prepared.description_general
    )
  });
  const title = capacity.title;
  const currentShort = capacity.description ?? height.description;
  const sourceShort = source.shortDescription?.trim();
  const incompleteSummary = sourceShort?.length === 512 && !/[.!?]$/u.test(sourceShort) &&
    currentShort === normalizeEditorialSummary(sourceShort, source.model) ?
      resolveSourcedShortDiscrepancy(source, source, sourceShort, true) : null;
  const sourcedSaleSummary = removeSourcedSaleWording(source, currentShort);
  const descriptionTitle = prepared.description_title?.trim() === prepared.title?.trim() ||
    !prepared.description_title?.trim() ? title :
      normalizeEditorialTitle(removeSourceTitleBranding(source, prepared.description_title), source.model);
  return {
    ...prepared,
    title,
    description_title: descriptionTitle,
    description: incompleteSummary ?? sourcedSaleSummary ?? currentShort,
    description_general: normalizeEditorialGeneral(capacity.description_general, source.model)
  };
};
