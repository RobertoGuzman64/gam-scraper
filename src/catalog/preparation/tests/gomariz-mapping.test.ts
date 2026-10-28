import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "./mapping-fixtures.js";

test("Gomariz: utiliza tipo fuente y motor, sin adjudicar categorías inexistentes", () => {
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-tijera", "te1620"), "LGMG S1413EII", { Motor: "Eléctrico" }, null)), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("brazo-articulado", "ba1335"), "Skyjack SJ85AJ", { Motor: "Diésel" }, null)), "plataformas-articuladas-diesel-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-tijera", "indefinido"), "Tijera", { Motor: "Eléctrico, Gasolina" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/jcb-540/", "JCB 540", { Motor: "Diésel" }, null)), "manipulador-teñescopico-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-mastil-vertical", "sla15"), "Genie SLA15", {}, null)), undefined);
});

test("Gomariz: la ficha identifica tijeras eléctricas aunque omita Motor, sin forzar tipos ambiguos", () => {
  const electricScissor = gomUrl("elevador-tijera", "lgmg-as0607we-tijera-electrica-electric-scissor-2");
  assert.equal(categorySlug(source("gomariz", electricScissor, "LGMG AS0607WE", {}, null)), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", electricScissor, "LGMG AS0607WE", { Motor: "Diésel" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", gomUrl("brazo-articulado", "jlg-340aj"), "JLG 340AJ", {}, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-cc142-2/", "Dynapac CC142", { Motor: "Diésel" }, null)), undefined);
});

test("Gomariz: mapea alcance lateral positivo a alcance horizontal sin reutilizar ceros", () => {
  const platform = gomUrl("brazo-articulado", "jlg-450aj");
  assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": "7.47 m" }), "Alcance horizontal"), 7.47);
  assert.equal(attrVal(source("gomariz", gomUrl("manipulador-telescopico", "jcb-540-140"), "Manipulador", { "Alcance lateral": "9.25 M" }), "Alcance máximo horizontal"), 9.25);
  for (const raw of ["0 m", "-5 m", "10 ft", "8 a 12 m", "2.500 m"]) {
    assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": raw }), "Alcance horizontal"), null, raw);
  }
  assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": "8 m", "Alcance horizontal": "9 m" }), "Alcance horizontal"), null);
  assert.equal(attrVal(source("gam", gamUrl("plataformas-elevadoras-articuladas-electricas-segunda-mano", "6934"), "Plataforma", { "Alcance lateral": "8 m" }), "Alcance horizontal"), null);
});
