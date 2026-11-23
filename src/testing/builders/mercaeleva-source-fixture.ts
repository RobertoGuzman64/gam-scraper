import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";

export const readMercaelevaSource = async () =>
  (await readCanonicalCatalog("src/testing/fixtures/mercaeleva/regression-221/mercaeleva-completa-20261029-234332-catalog.json")).products;
