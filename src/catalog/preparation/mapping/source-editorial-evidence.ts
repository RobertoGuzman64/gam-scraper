import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveGamShortDescription } from "./providers/gam/editorial-descriptions/short-description.js";
import { resolveGamCrossedIdentityEditorial } from "./providers/gam/identity/crossed-identity-editorial.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../evidence/providers/gam/editorial/verified-source-condensed-generals.js";
import { resolveGamFamilyTechnicalDescription } from "./providers/gam/editorial-descriptions/family-technical-description.js";

export const captureSourceEditorialEvidence = (record: ProductRecord) => {
  const crossedIdentity = resolveGamCrossedIdentityEditorial(record);
  const verifiedGamCondensedGeneral = resolveGamVerifiedSourceCondensedGeneral(record);
  const conciseGamShort = resolveGamShortDescription(record);
  const verifiedGamFamilyGeneral = resolveGamFamilyTechnicalDescription(record);
  return { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral };
};

export type SourceEditorialEvidence = ReturnType<typeof captureSourceEditorialEvidence>;
