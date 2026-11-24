import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { resolveGomarizEditorialDomainSource } from "./domain-source.js";

const articulated: ProductRecord = {
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/brazo-articulado/haulotte-ha16rtj-copia/",
  title: "HAULOTTE HA16RTJ PRO", brand: "Haulotte", model: "HA16RTJ PRO", reference: "BA1348",
  condition: "Segunda mano", price: null, shortDescription: null,
  longDescription: "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
  year: "2014", yearSource: "ficha", location: null, country: null,
  horometer: null, serialNumber: null,
  image: "https://www.gomarizrent.com/wp-content/uploads/2024/04/BA1348-HAULOTTE-HA16RTJPRO-23.jpg",
  images: [
    "https://www.gomarizrent.com/wp-content/uploads/2024/04/BA1348-HAULOTTE-HA16RTJPRO-23.jpg",
    "https://www.gomarizrent.com/wp-content/uploads/2024/04/BA1348-HAULOTTE-HA16RTJPRO-20.jpg"
  ],
  specs: { "Altura": "16 metros", "Altura plataforma": "14 m", "Altura de trabajo": "16 m",
    "Alcance lateral": "8.30 m", "Altura almacenaje": "2.30 m", "Longitud": "6.75 m",
    "Anchura": "2.30 m", "Peso": "6450 kg", "Motor": "Diésel", "Capacidad": "230 kg" }
};

const scissor: ProductRecord = {
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/1/",
  title: "LGMG AS1012E", brand: "LGMG", model: "AS1012E", reference: "TE1382",
  condition: "Segunda mano", price: null, shortDescription: null,
  longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
  year: "2022", yearSource: "ficha", location: null, country: null,
  horometer: null, serialNumber: null,
  image: "https://www.gomarizrent.com/wp-content/uploads/2024/04/TE1382-LGMG-AS1012E-22.jpg",
  images: [
    "https://www.gomarizrent.com/wp-content/uploads/2024/04/TE1382-LGMG-AS1012E-22.jpg",
    "https://www.gomarizrent.com/wp-content/uploads/2024/04/TE1382-LGMG-AS1012E-20.jpg"
  ],
  specs: { "Altura": "12 metros", "Altura plataforma": "10 m", "Altura de trabajo": "12 m",
    "Alcance lateral": "0 m", "Altura almacenaje": "2.43 m", "Longitud": "2.47 m",
    "Anchura": "1.18 m", "Peso": "3000 kg", "Motor": "Eléctrico", "Capacidad": "320 kg" }
};

test("Gomariz: galerías inequívocas recuperan la fuente cuando el enlace es genérico o una copia parcial", () => {
  for (const source of [articulated, scissor]) {
    const before = JSON.stringify(source);
    assert.ok(resolveGomarizEditorialDomainSource(source), source.reference ?? "");
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.equal(prepared.issues.length, 0);
    assert.match(prepared.product.description ?? "", new RegExp(source.model ?? ""));
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), before);
  }
});

test("Gomariz: una galería incorrecta o un origen contradictorio no acreditan la identidad", () => {
  for (const source of [articulated, scissor]) {
    const otherReference = source.reference === "BA1348" ? "TE1382" : "BA1348";
    const image = source.images?.[0] ?? "";
    const otherImage = image.replace(source.reference ?? "", otherReference);
    const mismatches: readonly ProductRecord[] = [
      { ...source, images: [image] },
      { ...source, images: [image, image] },
      { ...source, images: [image, otherImage] },
      { ...source, images: [image, source.images?.[1]?.replace("www.gomarizrent.com", "example.invalid") ?? ""] },
      { ...source, image: otherImage },
      { ...source, reference: otherReference },
      { ...source, model: "MODELO DIFERENTE" },
      { ...source, title: "MODELO DIFERENTE" },
      { ...source, url: `${source.url}?test=1` },
      { ...source, url: source.url.replace("www.gomarizrent.com", "example.invalid") },
      { ...source, longDescription: "Las carretillas diésel realizan operaciones de carga." },
      { ...source, specs: { ...source.specs, Modelo: "OTRO MODELO" } },
      { ...source, condition: "Nuevo" },
      { ...source, providerId: "gam" }
    ];
    for (const incompatible of mismatches) {
      assert.equal(resolveGomarizEditorialDomainSource(incompatible), null,
        `${source.reference}: ${incompatible.url}`);
    }
  }
});

test("Gomariz: el enlace genérico no atribuye una variante ni una familia por semejanza", () => {
  assert.equal(resolveGomarizEditorialDomainSource({ ...articulated,
    url: articulated.url.replace("haulotte-ha16rtj-copia", "haulotte-ha12rtj-copia") }), null);
  assert.equal(resolveGomarizEditorialDomainSource({ ...articulated,
    url: articulated.url.replace("brazo-articulado", "elevador-tijera") }), null);
  assert.equal(resolveGomarizEditorialDomainSource({ ...scissor,
    url: scissor.url.replace("elevador-tijera", "brazo-articulado") }), null);
  assert.equal(resolveGomarizEditorialDomainSource({ ...scissor,
    url: scissor.url.replace("/1/", "/otra-maquina/") }), null);
});
