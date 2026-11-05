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

export const phase2BasketReviewReferences: ReadonlySet<string> = new Set([
  "6607", "6630", "6632", "6631", "6614", "6616", "6615", "6642", "6622", "6625", "6669", "6617", "6626", "6169", "6171"
]);

export const phase2ExpectedSpecValue = (reference: string | null, key: string, original: unknown): unknown =>
  key === "Dimensiones Cesta" && reference !== null
    ? phase2BasketCorrections.get(reference) ?? original
    : original;
