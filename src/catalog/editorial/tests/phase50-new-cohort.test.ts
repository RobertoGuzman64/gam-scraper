import assert from "node:assert/strict";
import test from "node:test";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { isNewEditorialCohort, selectPublishableCatalog } from "../select-publishable.js";

const sources = {
  gam: "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json",
  gomariz: "storage/scraped/gomariz/scrape-gomariz-catalog.json",
  mercaeleva: "storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json"
};
const ids = ["gam", "gomariz", "mercaeleva"] as const;
const originals = await Promise.all(ids.map(async (providerId) => (await prepareSavedCatalog({
  providerId, source: sources[providerId], out: `storage/prepared/${providerId}/${sources[providerId].split("/").at(-1)!.replace("-catalog.json", "-preparation.json")}`,
  dryRun: true, compare: null
})).preparation));
const checksums = {
  gam: "7f31ebee51f573401d6f20bbe850751c46ff1659a5a91ffcf4302e82ed11e11d",
  gomariz: "13a889861d03a86c4756d85e65f894b44c5097bcfbcb84d096c67786d0513e90",
  mercaeleva: "a0343988c4ebb46d10d87ec5d739f2d12364c6f29a74424b35140e2418fb591a"
};
const disappearing = new Set(["6942", "6948", "6366", "6676"]);
const preparations = originals.map((preparation) => {
  const providerId = preparation.source.providerId;
  const products = providerId === "gam"
    ? preparation.products.filter(({ product }) => !disappearing.has(product.reference ?? ""))
    : preparation.products;
  return {
    ...preparation,
    source: { ...preparation.source, catalogSha256: checksums[providerId as keyof typeof checksums], productCount: products.length },
    products,
    totals: {
      ready: products.filter(({ status }) => status === "ready").length,
      review: products.filter(({ status }) => status === "review").length
    }
  };
});

test("F50: admite cohorte acreditada de 1365, 1362 ready y tres exclusiones", () => {
  assert.equal(isNewEditorialCohort(preparations), true);
  const result = selectPublishableCatalog(preparations);
  assert.deepEqual(result.totals, { original: 1365, ready: 1362, review: 3, publishable: 1362, excluded: 3 });
  assert.deepEqual(result.exclusions.map((item) => `${item.providerId}:${item.reference}`), [
    "gam:6682", "gam:6703", "mercaeleva:M827-8304"
  ]);
  assert.equal(result.products.filter((item) => item.providerId === "gomariz").length, 143);
});

test("F50: rechaza mezclar catálogo y hash, reviews nuevas, totales alterados", () => {
  const mixed = preparations.map((preparation) => preparation.source.providerId === "gomariz"
    ? { ...preparation, source: originals[1]!.source } : preparation);
  assert.throws(() => selectPublishableCatalog(mixed), /cohorte desconocida/);
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gomariz" ? preparation : {
    ...preparation,
    products: preparation.products.map((entry) => entry.product.reference === "TE1858"
      ? { ...entry, status: "review" as const, issues: ["Altura no acreditada"] }
      : entry)
  });
  assert.throws(() => selectPublishableCatalog(changed), /review sin exclusión acreditada/);
});
