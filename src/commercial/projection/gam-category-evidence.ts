import type { ProductRecord } from "../../contracts/catalog.js";
import { isGamVerifiedHysterSGlp, reconcileGamVerifiedHysterSGlp } from "../../preparation/gam/technical/models/hyster-s-glp-evidence.js";
import { reconcileGamForPreparation } from "../../preparation/gam/technical/reconciliation/gam.js";

export { isGamVerifiedHysterSGlp, reconcileGamVerifiedHysterSGlp };

export const reconcileSourceForCommercialProjection = (source: ProductRecord): ProductRecord =>
  reconcileGamVerifiedHysterSGlp(source);

export const reconcileGamSourceForCommercialFallback = (source: ProductRecord): ProductRecord | null =>
  source.providerId === "gam" ? reconcileGamForPreparation(source) : null;
