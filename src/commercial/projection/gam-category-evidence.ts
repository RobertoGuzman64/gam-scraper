import type { ProductRecord } from "../../contracts/catalog.js";
import { isGamVerifiedHysterSGlp, reconcileGamVerifiedHysterSGlp } from "../../preparation/gam/technical/models/hyster-s-glp-evidence.js";
import { reconcileGamForPreparation } from "../../preparation/gam/technical/reconciliation/gam.js";
import { reconcileGamForeignCategoryTitle } from "../../preparation/gam/identity/reconciliation/gam-foreign-category-title.js";

export { isGamVerifiedHysterSGlp, reconcileGamVerifiedHysterSGlp };

export const reconcileSourceForCommercialProjection = (source: ProductRecord): ProductRecord =>
  reconcileGamVerifiedHysterSGlp(reconcileGamForeignCategoryTitle(source));

export const reconcileGamSourceForCommercialFallback = (source: ProductRecord): ProductRecord | null =>
  source.providerId === "gam" ? reconcileGamForPreparation(reconcileGamForeignCategoryTitle(source)) : null;
