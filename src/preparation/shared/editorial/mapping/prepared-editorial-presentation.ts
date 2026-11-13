import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { reconcileGamVerifiedUnitYear } from "../../../gam/technical/reconciliation/gam-verified-unit-year.js";
import { normalizeEditorialGeneral, normalizeEditorialSummary, normalizeEditorialTitle } from "../domain/editorial-normalization.js";
import { presentCommercialMotorization } from "../domain/editorial-motorization.js";
import { normalizeCorroboratedEditorialFuel } from "../domain/editorial-fuel-coherence.js";
import { assessCommercialHeight } from "../domain/editorial-height-consistency.js";
import { normalizeCommercialYearDescription } from "./source-year-presentation.js";
import { normalizeVerifiedEditorialCapacity } from "../domain/editorial-capacity-coherence.js";
import { removeSourceTitleBranding, removeSourceSummaryBranding } from "./source-editorial-branding.js";
import { restoreCorroboratedEditorialIdentity } from "../domain/editorial-crossed-identity.js";
import { normalizeCorroboratedTowingSummary } from "../domain/editorial-towing-summary.js";

export const normalizePreparedEditorialPresentation = (
  source: ProductRecord, prepared: ImportCandidate
): ImportCandidate => {
  if (source.providerId !== prepared.providerId || source.reference !== prepared.reference ||
    source.url !== prepared.sourceUrl) throw new Error(`Identidad editorial discordante: ${prepared.sourceUrl}`);
  const verifiedSource = reconcileGamVerifiedUnitYear(source);
  const restoredIdentity = restoreCorroboratedEditorialIdentity(source, prepared.title, prepared.description);
  const baseTitle = presentCommercialMotorization(
    normalizeEditorialTitle(removeSourceTitleBranding(source, restoredIdentity?.title ?? prepared.title), source.model), prepared
  );
  const summary = normalizeCorroboratedTowingSummary(source, prepared,
    normalizeEditorialSummary(removeSourceSummaryBranding(source, restoredIdentity?.short ?? prepared.description), source.model));
  const yearSummary = verifiedSource !== source && source.year && verifiedSource.year && summary
    ? summary.replace(new RegExp(`\\bAño\\s+${source.year}\\b`, "u"), `Año ${verifiedSource.year}`)
    : summary;
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
  const descriptionTitle = prepared.description_title?.trim() === prepared.title?.trim() ||
    !prepared.description_title?.trim() ? title :
      normalizeEditorialTitle(removeSourceTitleBranding(source, prepared.description_title), source.model);
  return {
    ...prepared,
    title,
    description_title: descriptionTitle,
    description: capacity.description ?? height.description,
    description_general: normalizeEditorialGeneral(capacity.description_general, source.model)
  };
};
