import assert from "node:assert/strict";
import test from "node:test";
import { brandFromTitle, modelFromTitle } from "../identity.js";

const page = (slug: string): string =>
  `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/${slug}/`;

test("Gomariz: marca respaldada por título con modelo identificable y URL coincidente", () => {
  const cases = [
    ["LGMG S1413EII", "lgmg-s1413eii-tijera-electrica-scissor-lift", "LGMG", "S1413EII"],
    ["Himoinsa HFW-605T", "himoinsa-hfw-605t-generador-generator", "Himoinsa", "HFW-605T"],
    ["Generac EVE 9", "generac-eve-9-generador", "Generac", "EVE 9"],
    ["JLG 340AJ", "jlg-340aj-brazo-articulado", "JLG", "340AJ"]
  ] as const;
  for (const [title, slug, brand, model] of cases) {
    const inferred = brandFromTitle(title, page(slug));
    assert.equal(inferred, brand, title);
    assert.equal(modelFromTitle(title, inferred), model, title);
  }
});

test("Gomariz: extrae modelo si la marca compuesta publicada invierte su orden en el título", () => {
  assert.equal(modelFromTitle("SOCAGE IVECO 35S14 FORSTE 20D SPEED NEUTRA", "Iveco Socage"),
    "35S14 FORSTE 20D SPEED NEUTRA");
  assert.equal(modelFromTitle("SOCAGE IVECO FORSTE 18T SPEED", null), null);
  assert.equal(brandFromTitle("SOCAGE IVECO FORSTE 18T SPEED", page("socage-iveco-forste-18t-speed")), null);
});

test("Gomariz: no inventa marcas a partir de términos de producto o URLs no coincidentes", () => {
  assert.equal(brandFromTitle("Plataforma Eléctrica 10", page("plataforma-electrica-10")), null);
  assert.equal(brandFromTitle("JLG 340AJ", page("lgmg-s1413eii")), null);
  assert.equal(brandFromTitle("JLG 340AJ", "https://example.com/venta/jlg-340aj/"), null);
  assert.equal(modelFromTitle("JLG 340AJ", "Genie"), null);
  assert.equal(modelFromTitle("Plataforma Genérica", "Plataforma"), null);
});
