import assert from "node:assert/strict";

import test from "node:test";

import { gamBasketDimensionsFromRepeatedFragments } from "./basket.js";

test("ninguna cifra se reconstruye con trozos sueltos, unidades supuestas o ruido contradictorio", () => {
  for (const raw of [
    "1 76 83X0 metros",
    "1 8 8 x 0 metros",
    "1 2x0 96 metros",
    "18 3 81X2 metros",
    "4 83 88x1 metros",
    "1 1,83 x 0,76 76 82 x 0 metros",
    "1 1,83 x 0,76 76 83 x 0 mm",
    "1 1,83 x 0,76 76 83 x 0",
    "1 1,83 x 0,76 76 83 x 0 metros 2 x 1 metros",
    "2 1,83 x 0,76 76 83 x 0 metros",
    "1 1,83 x 0,76 76 83 x 0 centimetros",
    "1 1,83 x 0,76 76 83 x 0 metros 190º"
  ]) {
    assert.equal(gamBasketDimensionsFromRepeatedFragments(raw), null, raw);
  }
});
