import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveGomarizVerifiedUnitSpecificTitle } from "../../../gomariz/editorial/mapping/verified-unit-specific-title.js";
import { resolveGamVerifiedSourceMatchedTitle } from "../../../gam/editorial/titles/verified-source-matched-title.js";
import { resolveGamConciseTitle } from "../../../gam/editorial/titles/concise-titles.js";
import { reconcileGamVerifiedCapacityTitle } from "../../../gam/editorial/titles/editorial-titles.js";
import { resolveGomarizEditorialTitle } from "../../../gomariz/editorial/mapping/editorial-title.js";
import { resolveMercaelevaEditorialTitle } from "../../../mercaeleva/editorial/mapping/editorial-title.js";
import { refineTechnicalTitle } from "./technical-title-refinement.js";

export const resolvePreparedEditorialTitle = (record: ProductRecord, sourceUnitRecord: ProductRecord) => {
  const mappedTitle = (resolveGomarizEditorialTitle(record) ?? resolveGamConciseTitle(record) ?? resolveMercaelevaEditorialTitle(record) ?? record.title?.trim()) || null;
  const title = refineTechnicalTitle(sourceUnitRecord, resolveGomarizVerifiedUnitSpecificTitle(sourceUnitRecord, mappedTitle) ?? resolveGamVerifiedSourceMatchedTitle(sourceUnitRecord, mappedTitle) ?? mappedTitle);
  return reconcileGamVerifiedCapacityTitle(sourceUnitRecord, title);
};
