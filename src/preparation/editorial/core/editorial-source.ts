import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveManainEditorialDomainSource } from "../../manain/domain-source.js";
import { resolveGamEditorialDomainSource, verifiedGamUnbrandedEditorialSource } from "../../gam/domain-source.js";
import { resolveGomarizEditorialDomainSource, resolveGomarizLiteralTitleSource } from "../../gomariz/domain-source.js";
import { resolveMercaelevaEditorialDomainSource, verifiedMercaelevaUnbrandedEditorialSource, hasMercaelevaCorroboratedScissorHeights } from "../../mercaeleva/domain-source.js";

export const resolveEditorialSource = (record: ProductRecord) =>
  record.providerId === "gam" ? resolveGamEditorialDomainSource(record) :
    record.providerId === "gomariz" ? resolveGomarizEditorialDomainSource(record) :
      record.providerId === "mercaeleva" ? resolveMercaelevaEditorialDomainSource(record) :
        record.providerId === "manain" ? resolveManainEditorialDomainSource(record) : null;

export const verifiedUnbrandedEditorialSource = (record: ProductRecord): boolean =>
  verifiedGamUnbrandedEditorialSource(record) || verifiedMercaelevaUnbrandedEditorialSource(record);

export const hasCorroboratedEditorialDistinctWorkHeights = (record: ProductRecord): boolean =>
  record.providerId === "mercaeleva" && hasMercaelevaCorroboratedScissorHeights(record);

export const resolveEditorialLiteralTitleSource = (record: ProductRecord) =>
  record.providerId === "gomariz" ? resolveGomarizLiteralTitleSource(record) : null;
