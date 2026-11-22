import { basename, dirname, resolve } from "node:path";
import { readCanonicalCatalogWithFingerprint } from "../catalog/canonical-catalog.js";
import { readManainStocklist } from "../catalog/manain-stocklist.js";
import { readManainHistoricalTechnicalEvidence } from "../catalog/manain-historical-technical.js";
import { manainStocklistRecords } from "../../../preparation/manain/source/records.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { DocumentOriginal } from "../../../preparation/offline-document.js";

export type PreparationOriginal = {
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly productCount: number;
  readonly products: readonly ProductRecord[];
  readonly catalogSha256: string;
  readonly document?: DocumentOriginal;
};

export const readPreparationOriginal = async (sourceFile: string): Promise<PreparationOriginal> => {
  const source = resolve(sourceFile);
  if (basename(source) === "manain-stocklist.json") {
    const { stocklist, stocklistSha256 } = await readManainStocklist(dirname(source));
    const historical = await readManainHistoricalTechnicalEvidence(resolve(dirname(source), "..", "evidence"));
    return {
      providerId: "manain",
      prefix: "manain-stocklist",
      scope: stocklistSha256.slice(0, 16),
      productCount: stocklist.productos.length,
      products: manainStocklistRecords(stocklist, historical?.evidence),
      catalogSha256: stocklistSha256,
      document: {
        kind: "stocklist",
        pdfSha256: stocklist.fuente.sha256,
        pageCount: stocklist.fuente.paginas,
        ...(historical === null ? {} : { technicalEvidenceSha256: historical.evidenceSha256 })
      }
    };
  }
  const { catalog, catalogSha256 } = await readCanonicalCatalogWithFingerprint(source);
  return {
    providerId: catalog.providerId,
    prefix: catalog.prefix,
    scope: catalog.scope,
    productCount: catalog.productCount,
    products: catalog.products,
    catalogSha256
  };
};
