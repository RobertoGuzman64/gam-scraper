import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveManainEditorialDomainSource } from "../../../manain/editorial/mapping/domain-source.js";
import { resolveGamEditorialDomainSource, verifiedGamUnbrandedEditorialSource } from "../../../gam/editorial/source/domain-source.js";
import { resolveGomarizEditorialDomainSource } from "../../../gomariz/editorial/mapping/domain-source.js";
import { resolveMercaelevaEditorialDomainSource, verifiedMercaelevaUnbrandedEditorialSource, hasMercaelevaCorroboratedScissorHeights } from "../../../mercaeleva/editorial/mapping/domain-source.js";

export const resolveEditorialSource = (record: ProductRecord) =>
  record.providerId === "gam" ? resolveGamEditorialDomainSource(record) :
    record.providerId === "gomariz" ? resolveGomarizEditorialDomainSource(record) :
      record.providerId === "mercaeleva" ? resolveMercaelevaEditorialDomainSource(record) :
        record.providerId === "manain" ? resolveManainEditorialDomainSource(record) : null;

export const verifiedUnbrandedEditorialSource = (record: ProductRecord): boolean =>
  verifiedGamUnbrandedEditorialSource(record) || verifiedMercaelevaUnbrandedEditorialSource(record);

export const hasCorroboratedEditorialDistinctWorkHeights = (record: ProductRecord): boolean =>
  record.providerId === "mercaeleva" && hasMercaelevaCorroboratedScissorHeights(record);
