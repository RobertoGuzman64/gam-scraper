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
const changedIdentityRoutes = new Set(["6002", "6003", "6004"]);
const f50GalleryReferences = new Set(["4988", "4989", "4990", "4991", "5998", "5999", "6000", "6001"]);
const f50RelatedImages = [
  "https://online.gamrentals.com/53434-product_main_2x/carretilla-elevadora-electrica-hyster-a13xnt.jpg",
  "https://online.gamrentals.com/133-product_main_2x/carretilla-elevadora-electrica-hyster-j16xn.jpg",
  "https://online.gamrentals.com/140-product_main_2x/carretilla-elevadora-electrica-hyster-j18xn.jpg",
  "https://online.gamrentals.com/147-product_main_2x/carretilla-elevadora-electrica-hyster-j20xn.jpg"
] as const;
const f50ShortDescription5996 = "La carretilla elevadora eléctrica Yale ERP6.0MXLG6 combina una capacidad de carga de 6.000 kg, con centro de carga de 600 mm, con la eficiencia de la tecnología de ion de litio y la robustez necesaria para afrontar operaciones de manutención de gran tonelaje en diferentes entornos industriales. Una de sus principales ventajas es su altura libre al suelo de 230 mm en el centro de la distancia entre ejes y 200 mm bajo el mástil con carga, combinada con neumáticos industriales de gran tamaño y ruedas delantera";
const preparations = originals.map((preparation) => {
  const providerId = preparation.source.providerId;
  const products = providerId === "gam"
    ? preparation.products.filter(({ product }) => !disappearing.has(product.reference ?? ""))
      .map((entry) => {
        const reference = entry.product.reference ?? "";
        const gallery = f50GalleryReferences.has(reference);
        const identity = changedIdentityRoutes.has(reference);
        const description = reference === "5996";
        if (!gallery && !identity && !description) return entry;
        const image = entry.product.image;
        if (gallery) assert.ok(image, reference);
        return {
          ...entry,
          product: {
            ...entry.product,
            sourceUrl: entry.product.sourceUrl
              .replace("/es/hyster/", "/es/carretillas-elevadoras-electricas-hyster/")
              .replace("/es/yale/", "/es/carretillas-elevadoras-electricas-yale/"),
            ...(gallery && image ? { images: [image, ...f50RelatedImages] } : {}),
            ...(description ? { description: f50ShortDescription5996 } : {})
          }
        };
      })
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

test("F50: retiene tres identidades adicionales sin cambiar las 1362 ready de preparación", () => {
  assert.equal(isNewEditorialCohort(preparations), true);
  const result = selectPublishableCatalog(preparations);
  assert.deepEqual(result.totals, { original: 1365, ready: 1362, review: 3, publishable: 1359, excluded: 6 });
  assert.deepEqual(result.exclusions.map((item) => `${item.providerId}:${item.reference}`), [
    "gam:6682", "gam:6703", "gam:6002", "gam:6003", "gam:6004", "mercaeleva:M827-8304"
  ]);
  assert.equal(result.products.filter((item) => item.providerId === "gomariz").length, 143);
  const identities = result.exclusions.filter(({ reference }) => changedIdentityRoutes.has(reference));
  assert.equal(identities.length, 3);
  assert.ok(identities.every(({ sourceUrl, evidenceUrls, issues }) =>
    sourceUrl.includes("/es/carretillas-elevadoras-electricas-hyster/") &&
    evidenceUrls.includes(sourceUrl) &&
    issues.some((issue) => issue.includes("marca HYSTER en anuncio y YALE en ficha técnica"))));
});

test("F50: el cambio de ruta exacto no autoriza otra ruta ni elimina la contradicción", () => {
  const changed = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "6002"
      ? { ...entry, product: { ...entry.product, sourceUrl: entry.product.sourceUrl.replace(
        "/carretillas-elevadoras-electricas-hyster/", "/carretillas-elevadoras-diesel-hyster/") } }
      : entry) });
  assert.throws(() => selectPublishableCatalog(changed), /exclusión de identidad caducada/);
  const oldRoute = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "6003"
      ? { ...entry, product: { ...entry.product, sourceUrl: entry.product.sourceUrl.replace(
        "/carretillas-elevadoras-electricas-hyster/", "/hyster/") } }
      : entry) });
  assert.throws(() => selectPublishableCatalog(oldRoute), /exclusión de identidad caducada/);
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

test("F50: rechaza una galería o una descripción distinta de la evidencia acreditada", () => {
  const gallery = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "4988"
      ? { ...entry, product: { ...entry.product, images: entry.product.images.slice(0, -1) } }
      : entry) });
  assert.throws(() => selectPublishableCatalog(gallery), /galería distinta de la evidencia acreditada/);
  const description = preparations.map((preparation) => preparation.source.providerId !== "gam"
    ? preparation
    : { ...preparation, products: preparation.products.map((entry) => entry.product.reference === "5996"
      ? { ...entry, product: { ...entry.product, description: `${entry.product.description} ` } }
      : entry) });
  assert.throws(() => selectPublishableCatalog(description), /resumen distinto de la evidencia acreditada/);
});
