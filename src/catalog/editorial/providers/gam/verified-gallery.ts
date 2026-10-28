import type { ImportCandidate } from "../../../legacy-export/contracts.js";

const contaminatedImages = [
  "https://online.gamrentals.com/53434-product_main_2x/carretilla-elevadora-electrica-hyster-a13xnt.jpg",
  "https://online.gamrentals.com/133-product_main_2x/carretilla-elevadora-electrica-hyster-j16xn.jpg",
  "https://online.gamrentals.com/140-product_main_2x/carretilla-elevadora-electrica-hyster-j18xn.jpg",
  "https://online.gamrentals.com/147-product_main_2x/carretilla-elevadora-electrica-hyster-j20xn.jpg"
] as const;

const galleryCases: Readonly<Record<string, { readonly url: string; readonly image: string }>> = {
  "4988": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4988-carretilla-elevadora-electrica-hyster-j20xtlg",
    image: "https://online.gamrentals.com/41847-product_main_2x/carretilla-elevadora-electrica-hyster-j20xtlg.jpg"
  },
  "4989": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4989-carretilla-elevadora-electrica-hyster-j25xtlg",
    image: "https://online.gamrentals.com/41848-product_main_2x/carretilla-elevadora-electrica-hyster-j25xtlg.jpg"
  },
  "4990": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4990-carretilla-elevadora-electrica-hyster-j30xtlg",
    image: "https://online.gamrentals.com/41849-product_main_2x/carretilla-elevadora-electrica-hyster-j30xtlg.jpg"
  },
  "4991": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4991-carretilla-elevadora-electrica-hyster-j35xtlg",
    image: "https://online.gamrentals.com/41850-product_main_2x/carretilla-elevadora-electrica-hyster-j35xtlg.jpg"
  },
  "5998": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/5998-carretilla-elevadora-electrica-hyster-j40xtlg",
    image: "https://online.gamrentals.com/49235-product_main_2x/carretilla-elevadora-electrica-hyster-j40xtlg.jpg"
  },
  "5999": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/5999-carretilla-elevadora-electrica-hyster-j45xtlg",
    image: "https://online.gamrentals.com/49234-product_main_2x/carretilla-elevadora-electrica-hyster-j45xtlg.jpg"
  },
  "6000": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6000-carretilla-elevadora-electrica-hyster-j50xtlg",
    image: "https://online.gamrentals.com/49233-product_main_2x/carretilla-elevadora-electrica-hyster-j50xtlg.jpg"
  },
  "6001": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/6001-carretilla-elevadora-electrica-hyster-j50xtlgs6",
    image: "https://online.gamrentals.com/49232-product_main_2x/carretilla-elevadora-electrica-hyster-j50xtlgs6.jpg"
  }
};

export const hasGamGalleryCorrection = (reference: string): boolean =>
  Object.hasOwn(galleryCases, reference);

export const curateGamGallery = (product: ImportCandidate): ImportCandidate => {
  const item = product.reference ? galleryCases[product.reference] : undefined;
  if (product.providerId !== "gam" || !item) return product;
  const expectedImages = [item.image, ...contaminatedImages];
  if (product.sourceUrl !== item.url || product.image !== item.image ||
    product.images.length !== expectedImages.length ||
    product.images.some((url, index) => url !== expectedImages[index])) {
    throw new Error(`Galería GAM: galería distinta de la evidencia acreditada (${product.reference})`);
  }
  return { ...product, images: [item.image] };
};
