import assert from "node:assert/strict";
import test from "node:test";
import { structuredProductImages } from "../gallery.js";

const productUrl = "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp";
const equivalentUrl = "https://online.gamrentals.com/en/used-articulated-boom-lifts/6934-2007-jlg-e300ajp";
const relatedUrl = "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e";
const ownImage = "https://online.gamrentals.com/60451-product_main_2x/2007-jlg-e300ajp.jpg";
const relatedImage = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";

test("prioriza productos identificados por la referencia de la página frente a otros sin identidad", () => {
  const products: readonly unknown[] = [{ "@graph": [
    { "@type": "Product", url: equivalentUrl, image: ownImage },
    { "@type": "Product", image: relatedImage }
  ] }];
  assert.deepEqual(structuredProductImages(products, productUrl), [ownImage]);
});

test("selecciona la coincidencia exacta cuando existen productos con la misma referencia y otras rutas", () => {
  const products: readonly unknown[] = [{ "@graph": [
    { "@type": "Product", url: equivalentUrl, image: relatedImage },
    { "@type": "Product", url: productUrl, image: ownImage }
  ] }];
  assert.deepEqual(structuredProductImages(products, productUrl), [ownImage]);
});

test("reconoce @id de la misma referencia y descarta productos identificados como ajenos", () => {
  const products: readonly unknown[] = [{ "@graph": [
    { "@type": "Product", "@id": `${equivalentUrl}#product`, image: ownImage },
    { "@type": "Product", url: relatedUrl, image: relatedImage }
  ] }];
  assert.deepEqual(structuredProductImages(products, productUrl), [ownImage]);
  assert.deepEqual(structuredProductImages([{ "@type": "Product", url: relatedUrl, image: relatedImage }], productUrl), []);
});

test("conserva el respaldo sin identidad cuando no existe otra evidencia", () => {
  assert.deepEqual(structuredProductImages([{ "@type": "Product", image: ownImage }], productUrl), [ownImage]);
  assert.deepEqual(structuredProductImages([{ "@type": "Product", url: productUrl, image: [ownImage, relatedImage] }], productUrl),
    [ownImage, relatedImage]);
});
