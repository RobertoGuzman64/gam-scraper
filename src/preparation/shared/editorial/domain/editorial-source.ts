import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveGamEditorialDomainSource } from "../../../gam/editorial/source/domain-source.js";
import { resolveGomarizEditorialDomainSource } from "../../../gomariz/editorial/mapping/domain-source.js";
import { resolveMercaelevaEditorialDomainSource } from "../../../mercaeleva/editorial/mapping/domain-source.js";

export const resolveEditorialSource = (record: ProductRecord) =>
  record.providerId === "gam" ? resolveGamEditorialDomainSource(record) :
    record.providerId === "gomariz" ? resolveGomarizEditorialDomainSource(record) :
      record.providerId === "mercaeleva" ? resolveMercaelevaEditorialDomainSource(record) : null;
