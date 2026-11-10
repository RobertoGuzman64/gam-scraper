import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ProductDescriptions } from "../../../catalog/normalization/descriptions.js";
import { resolveGamVerifiedConciseGeneral } from "./general/verified-concise-long.js";
import { resolveGamVerifiedElevationGeneral } from "./general/verified-elevation-general.js";
import { resolveGamSpecialtyEditorial } from "./models/specialty-editorial.js";
import { resolveGamWarehouseTechnicalEditorial } from "./source/warehouse-technical-editorial.js";
import { resolveGamHandlingSourceEditorial } from "./general/handling-source-editorial.js";
import { resolveGamVerifiedSourceMatchedEditorial } from "./source/verified-source-matched-editorial.js";
import { resolveGamVerifiedExtendedGeneral } from "./general/verified-extended-general.js";
import { resolveGamVerifiedIndustrialCleaningGeneral } from "./general/verified-industrial-cleaning-editorial.js";

export const resolvePreparedEditorialCompletion = (record: ProductRecord, descriptions: ProductDescriptions, residualCleaningShort: string | null, editorialGeneral: string | null) => {
  const conciseVerifiedGeneral = resolveGamVerifiedConciseGeneral(record, editorialGeneral);
  const elevationGeneral = resolveGamVerifiedElevationGeneral(record, conciseVerifiedGeneral ?? editorialGeneral);
  const residualCleaningGeneral = resolveGamVerifiedIndustrialCleaningGeneral(record, elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
  const specialtyEditorial = resolveGamSpecialtyEditorial(
    record, residualCleaningShort ?? descriptions.short,
    residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const warehouseEditorial = resolveGamWarehouseTechnicalEditorial(
    record, specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const handlingEditorial = resolveGamHandlingSourceEditorial(
    record, warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const verifiedResidualEditorial = resolveGamVerifiedSourceMatchedEditorial(
    record, handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const extendedGeneral = resolveGamVerifiedExtendedGeneral(record, verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
  const preparedShort = verifiedResidualEditorial?.short ?? handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short;
  const preparedLong = extendedGeneral ?? verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral;
  return { preparedShort, preparedLong };
};
