import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { analyzePresentationConsistency } from "../presentation-consistency.js";

const machine = (reference: string, providerId = "gam"): ImportCandidate => ({
  providerId,
  sourceUrl: `https://example.org/${providerId}/${reference}`,
  reference,
  title: "Carretilla elevadora MARCA MODELO10",
  categorySellID: null,
  category: null,
  condition: "Nuevo",
  price: null,
  description_title: null,
  description: null,
  description_general: null,
  image: null,
  images: [],
  spec: { Marca: "MARCA", Modelo: "MODELO10" },
  attributes: []
});

const codes = (products: readonly ImportCandidate[]): readonly string[] =>
  analyzePresentationConsistency(products).findings.map((finding) =>
    `${finding.providerId}:${finding.reference}:${finding.code}`);

test("detecta fotografías de otro modelo sin contaminar imágenes propias", () => {
  const own = "https://example.org/images/equipo-propio.jpg";
  const foreign = "https://example.org/images/equipo-ajeno.jpg";
  const first: ImportCandidate = { ...machine("A"), image: own, images: [own, foreign] };
  const second: ImportCandidate = { ...machine("B"), image: foreign, images: [foreign],
    spec: { Marca: "MARCA", Modelo: "MODELO11" } };
  const input = [first, second];
  const before = JSON.stringify(input);
  assert.deepEqual(codes(input), ["gam:A:imagen-de-otro-modelo"]);
  assert.deepEqual(codes([first, { ...second, spec: { Marca: "OTRA", Modelo: "MODELO11" } }]), []);
  assert.equal(JSON.stringify(input), before);
});

test("detecta unidades técnicas malformadas y magnitudes en campos incompatibles", () => {
  const first: ImportCandidate = { ...machine("ALTURA"), spec: { "Altura Plataforma": "6085mm metros" } };
  const second: ImportCandidate = { ...machine("ANCHO"), spec: { "Ancho promedio": "24V / 735-875Ah(V/Ah)" } };
  const report = analyzePresentationConsistency([first, second]);
  assert.equal(report.defects, 2);
  assert.deepEqual(codes([first, second]), [
    "gam:ALTURA:unidad-tecnica-malformada",
    "gam:ANCHO:magnitud-en-campo-incompatible"
  ]);
});

test("una variante B-LIFT discordante se comunica como revisión, no como defecto", () => {
  const product: ImportCandidate = { ...machine("VARIANTE"),
    title: "Plataforma B-LIFT 18HD", spec: { Marca: "CTE", Modelo: "B-LIFT 18HV" } };
  assert.deepEqual(codes([product]), ["gam:VARIANTE:modelo-de-variante-contradictorio"]);
  const report = analyzePresentationConsistency([product]);
  assert.equal(report.defects, 0);
  assert.equal(report.reviews, 1);
});

test("capacidad limitada requiere contexto explícito en la descripción", () => {
  const source: ImportCandidate = { ...machine("CAPACIDAD"),
    spec: { "Capacidad de carga (kg)": "1.800 KG" },
    description: "Capacidad nominal de 1.500 kg y 1.800 kg con limitación" };
  assert.deepEqual(codes([source]), ["gam:CAPACIDAD:capacidad-no-cualificada-en-campo"]);
  for (const description of [
    "Capacidad de 1.500 kg con limitación y 1.800 kg sin limitación",
    "Capacidad de 1.800 kg sin limitación"
  ]) {
    assert.deepEqual(codes([{ ...source, description }]), []);
  }
});

test("una portada Gomariz de otra referencia se informa sin alterar la unidad", () => {
  const image = "https://www.gomarizrent.com/uploads/CC1535-MARCA-MODELO10-1.jpg";
  const product: ImportCandidate = { ...machine("CC1666", "gomariz"), image, images: [image] };
  const before = JSON.stringify(product);
  assert.deepEqual(codes([product]), ["gomariz:CC1666:portada-referencia-ajena"]);
  assert.equal(JSON.stringify(product), before);
});

test("la portada con variante de modelo distinta requiere revisión", () => {
  const image = "https://example.org/TE1772-LGMG-AS0808W-1.jpg";
  const product: ImportCandidate = { ...machine("TE1772", "gomariz"),
    title: "Plataforma tijera LGMG AS0808E", image, images: [image],
    spec: { Marca: "LGMG", Modelo: "AS0808E" } };
  assert.deepEqual(codes([product]), ["gomariz:TE1772:modelo-portada-variante-discordante"]);
});

test("una imagen compartida por variantes de un mismo modelo no genera falsos cruces", () => {
  const image = "https://example.org/images/modelo10.jpg";
  const first: ImportCandidate = { ...machine("A"), image, images: [image] };
  const second: ImportCandidate = { ...machine("B"), image, images: [image] };
  assert.deepEqual(codes([first, second]), []);
  assert.deepEqual(codes([first, { ...second, providerId: "gomariz" }]), []);
});
