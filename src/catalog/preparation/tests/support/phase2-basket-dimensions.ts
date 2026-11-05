export const phase2BasketCorrections: ReadonlyMap<string, string> = new Map([
  ["5855", "1,8 x 0,8 m"],
  ["6139", "1,83 x 0,76 m"],
  ["6206", "1,2 x 0,92 m"],
  ["6158", "1,63 x 0,81 m"],
  ["6196", "1,87 x 0,76 m"],
  ["6195", "1,87 x 0,76 m"],
  ["6486", "1,87 x 0,76 m"],
  ["4738", "2,27 x 1,12 m"],
  ["4739", "2,27 x 1,12 m"],
  ["4740", "2,27 x 1,12 m"],
  ["4741", "2,27 x 1,12 m"],
  ["4742", "2,27 x 1,12 m"],
  ["4743", "2,27 x 1,12 m"],
  ["4745", "2,27 x 1,12 m"],
  ["6162", "1,4 x 0,7 x 1,1 m"],
  ["6166", "1,4 x 0,7 x 1,1 m"],
  ["6185", "1,4 x 0,7 x 1,1 m"],
  ["6188", "1,4 x 0,7 x 1,1 m"],
  ["6168", "1,4 x 0,7 x 1,1 m"],
  ["6163", "1,4 x 0,7 x 1,1 m"],
  ["6874", "1,4 x 0,7 x 1,1 m"],
  ["6873", "1,4 x 0,7 x 1,1 m"],
  ["6164", "1,4 x 0,7 x 1,1 m"],
  ["6167", "1,4 x 0,7 x 1,1 m"]
]);

export const campaign1VerifiedBasketCorrections: ReadonlyMap<string, string> = new Map([
  ["6607", "1,83 x 0,76 m"],
  ["6630", "1,8 x 0,8 m"], ["6632", "1,8 x 0,8 m"],
  ["6614", "3,81 x 2,18 m"], ["6615", "3,81 x 2,18 m"], ["6616", "3,81 x 2,18 m"],
  ["6617", "1,83 x 0,76 m"], ["6631", "1,2 x 0,96 m"]
]);

export const campaign2VerifiedBasketCorrections: ReadonlyMap<string, string> = new Map([
  ["6622", "3,98 x 1,83 m"], ["6625", "3,98 x 1,83 m"],
  ["6626", "1,83 x 0,91 m"], ["6169", "1,4 x 0,7 x 1,1 m"],
  ["6171", "1,4 x 0,7 x 1,1 m"]
]);

export const phase2BasketReviewReferences: ReadonlySet<string> = new Set([
  "6642", "6669"
]);

export const phase2ExpectedSpecValue = (reference: string | null, key: string, original: unknown): unknown =>
  key === "Dimensiones Cesta" && reference !== null
    ? campaign2VerifiedBasketCorrections.get(reference) ?? campaign1VerifiedBasketCorrections.get(reference) ?? phase2BasketCorrections.get(reference) ?? original
    : key === "Capacidad de carga (kg)" && reference === "6625" ? "680 KG" : original;
