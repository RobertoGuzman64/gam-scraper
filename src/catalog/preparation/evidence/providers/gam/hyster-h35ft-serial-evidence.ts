import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { findSerialNumberCollisions } from "../../../../identity-conflicts.js";

type SerialNumberCollision = ReturnType<typeof findSerialNumberCollisions>[number];

const serial = "P177B10585U";
const digest = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify(Object.entries(record).filter(([key]) => key !== "scrapedAt")))
  .digest("hex");

const originals: Readonly<Record<string, { readonly stock: string; readonly fingerprints: readonly string[] }>> = {
  "6682": {
    stock: "GAM-11596",
    fingerprints: ["c30c386ca4abe5b497389b0cbb5f39d053108dd53bbab998bb7daa0b73c838e7", "ee8977c5f2544941c19ff280e3286f857fbb8dad28050eb656947fe2865bdbf3"]
  },
  "6703": {
    stock: "GAM-11594",
    fingerprints: ["03c6aebf495d2383fe4903c968a9976cf2a24a24644bbbe1ba31251dc99c4735", "bd794e40d7218f6d7bd18e7a23cd79127f44e71ecd723bd2dc768c71399c45e2"]
  }
};

export const describeHysterH35ftStockConflict = (collision: SerialNumberCollision): string | null => {
  if (collision.providerId !== "gam" || collision.serialNumber !== serial || collision.products.length !== 2) return null;
  const references = new Set<string>();
  for (const product of collision.products) {
    const reference = product.reference;
    if (reference === null || references.has(reference)) return null;
    const expected = originals[reference];
    if (!expected || product.externalReference !== expected.stock || !expected.fingerprints.includes(digest(product))) return null;
    references.add(reference);
  }
  if (!references.has("6682") || !references.has("6703")) return null;
  return "Stock GAM diferenciado: GAM-11596 (6682, 22192 horas) y GAM-11594 (6703, 22498 horas) publican el mismo número de serie; verificar la placa de cada equipo antes de asignarlo o considerar una republicación";
};
