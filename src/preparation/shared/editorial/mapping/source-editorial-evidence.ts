import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveGamShortDescription } from "../../../gam/editorial/short/short-description.js";
import { resolveGamCrossedIdentityEditorial } from "../../../gam/identity/mapping/crossed-identity-editorial.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../../../gam/editorial/source/verified-source-condensed-generals.js";
import { resolveGamFamilyTechnicalDescription } from "../../../gam/editorial/general/family-technical-description.js";

export const captureSourceEditorialEvidence = (record: ProductRecord) => {
  const crossedIdentity = resolveGamCrossedIdentityEditorial(record);
  const verifiedGamCondensedGeneral = resolveGamVerifiedSourceCondensedGeneral(record);
  const conciseGamShort = resolveGamShortDescription(record);
  const verifiedGamFamilyGeneral = resolveGamFamilyTechnicalDescription(record);
  return { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral };
};

export type SourceEditorialEvidence = ReturnType<typeof captureSourceEditorialEvidence>;
