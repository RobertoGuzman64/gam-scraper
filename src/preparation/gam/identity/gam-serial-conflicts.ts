import type { findSerialNumberCollisions } from "../../../catalog/identity-conflicts.js";
import { describeHysterH35ftStockConflict } from "./evidence/hyster-h35ft-serial-evidence.js";
import { verifiedMusoshiSerialOwner, verifiedZeroMisattributedSerial } from "./evidence/musoshi-serial-evidence.js";
import { verifiedYaleErp35vlCrossListing, verifiedYaleErp35vlSerialOwner } from "./evidence/yale-erp35vl-serial-evidence.js";

export const gamVerifiedSerialCollision = (collision: ReturnType<typeof findSerialNumberCollisions>[number]) => {
  if (verifiedYaleErp35vlCrossListing(collision)) return {
    skip: true, owner: null, correctedSerial: null, stockConflict: null
  };
  return {
    skip: false,
    owner: verifiedMusoshiSerialOwner(collision) ?? verifiedYaleErp35vlSerialOwner(collision),
    correctedSerial: verifiedZeroMisattributedSerial(collision),
    stockConflict: describeHysterH35ftStockConflict(collision)
  };
};
