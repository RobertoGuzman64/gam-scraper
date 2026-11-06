import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveGamShortDescription } from "../../../gam/editorial/mapping/short-description.js";
import { resolveGamCrossedIdentityEditorial } from "../../../gam/identity/mapping/crossed-identity-editorial.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../../../gam/editorial/evidence/verified-source-condensed-generals.js";
import { resolveGamFamilyTechnicalDescription } from "../../../gam/editorial/mapping/family-technical-description.js";

export const captureSourceEditorialEvidence = (record: ProductRecord) => {
  const crossedIdentity = resolveGamCrossedIdentityEditorial(record);
  const verifiedGamCondensedGeneral = resolveGamVerifiedSourceCondensedGeneral(record);
  const conciseGamShort = resolveGamShortDescription(record);
  const verifiedGamFamilyGeneral = resolveGamFamilyTechnicalDescription(record);
  return { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral };
};

export type SourceEditorialEvidence = ReturnType<typeof captureSourceEditorialEvidence>;
