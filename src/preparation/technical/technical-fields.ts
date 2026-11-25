import type { Attribute } from "../classification/attribute-types.js";
import { liftingTechnicalFields } from "./technical-fields-lifting.js";
import { handlingTechnicalFields } from "./technical-fields-handling.js";
import { earthmovingTechnicalFields } from "./technical-fields-earthmoving.js";
import { cleaningTechnicalFields } from "./technical-fields-cleaning.js";
import { energyTechnicalFields } from "./technical-fields-energy.js";
import { mobilityTechnicalFields } from "./technical-fields-mobility.js";
import { modularTechnicalFields } from "./technical-fields-modular.js";
import { generalTechnicalFields } from "./technical-fields-general.js";

export const SOURCE_TECHNICAL_FIELDS: readonly Attribute[] = [
  ...liftingTechnicalFields,
  ...handlingTechnicalFields,
  ...earthmovingTechnicalFields,
  ...cleaningTechnicalFields,
  ...energyTechnicalFields,
  ...mobilityTechnicalFields,
  ...modularTechnicalFields,
  ...generalTechnicalFields
];
