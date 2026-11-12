import type { ProductRecord } from "../../../../contracts/catalog.js";
import { reconcileGamSourceIdentity } from "../../identity/reconciliation/gam-source-identity.js";
import { reconcileGamVerifiedClassicVehicleIdentity } from "../../identity/evidence/used-classic-vehicle-identity.js";
import { reconcileGamVerifiedHysterH45fts5Title } from "./gam-hyster-h45fts5.js";
import { reconcileGamVerifiedUnitYear } from "./gam-verified-unit-year.js";
import { reconcileGamVerifiedZeroSerial } from "../../identity/evidence/musoshi-serial-evidence.js";

export const reconcileGamInitialIdentity = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedZeroSerial(record);

export const reconcileGamForPreparation = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedClassicVehicleIdentity(
    reconcileGamSourceIdentity(
      reconcileGamVerifiedHysterH45fts5Title(
        reconcileGamVerifiedUnitYear(record)
      )
    )
  );
