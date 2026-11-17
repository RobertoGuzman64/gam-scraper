import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../../../prepare.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "../../../testing/mapping-fixtures.js";

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

test("Gomariz: clasifica rutas actuales de familia con categorías de ocasión existentes", () => {
  const cases = [
    ["elevacion-y-trabajos-en-altura/elevador-tijera", "LGMG S1413EII", "Eléctrico", "plataformas-tijera-electricas-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/elevador-tijera", "GENIE GS4390RT", "Diésel", "plataformas-tijera-diesel-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/brazo-articulado", "Manitou 150 AETJC", "Eléctrico", "plataformas-articuladas-electricas-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/brazo-articulado", "Skyjack SJ85AJ", "Diésel", "plataformas-articuladas-diesel-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/brazo-telescopico", "JLG 1350SJP", "Diésel", "plataformas-elevadoras-telescopicas-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/elevador-mastil-vertical", "JLG 1230ES", "Eléctrico", "plataformas-unipersonales-segunda-mano"],
    ["elevacion-y-trabajos-en-altura/camion-plataforma", "Nissan Cabstar Multitel MX130", "Diésel", "plataformas-elevadoras-sobre-camion-segunda-mano"],
    ["manipulacion-de-materiales/carretilla-industrial", "Toyota 7FBMF20", "Eléctrico", "carretillas-elevadoras-electricas-segunda-mano"],
    ["manipulacion-de-materiales/carretilla-industrial", "Toyota 02-8FDF25", "Diésel", "carretillas-elevadoras-diesel-segunda-mano"],
    ["manipulacion-de-materiales/manipulador-telescopico", "JCB 535-140", "Diésel", "manipulador-teñescopico-segunda-mano"],
    ["energia-electrica-e-iluminacion/generador", "PRAMAC GPW100I_FS2", "Diésel", "grupos-electrogenos-segunda-mano"],
    ["energia-electrica-e-iluminacion/torre-de-luz", "GENERAC VT-HYBRID", "Diésel", "torres-iluminacion-segunda-mano"]
  ] as const;
  for (const [familyRoute, title, motor, expected] of cases) {
    const url = `https://www.gomarizrent.com/${familyRoute}/${title.toLowerCase().replace(/\s+/g, "-")}/`;
    assert.equal(categorySlug(source("gomariz", url, title, { Motor: motor }, null)), expected, title);
  }
});

test("Gomariz: las rutas actuales no permiten clasificar unidades sin evidencia suficiente", () => {
  const scissor = "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we/";
  assert.equal(categorySlug(source("gomariz", scissor, "LGMG AS0607WE", {}, null)), undefined);
  assert.equal(categorySlug(source("gomariz", scissor, "LGMG AS0607WE", { Motor: "Eléctrico, Gasolina" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", scissor, "Tijera diésel", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", scissor, "LGMG AS0607WE", { Motor: "Eléctrico" }, null)), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", scissor.replace("elevacion-y-trabajos-en-altura", "manipulacion-de-materiales"), "LGMG AS0607WE", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", scissor.replace("gomarizrent.com", "otro-dominio.com"), "LGMG AS0607WE", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gam", scissor, "LGMG AS0607WE", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", scissor + "detalle/", "LGMG AS0607WE", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/producto/lgmg-as0812-tijera-electrica/", "LGMG AS0812", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/limpieza/barredora/eureka-compact-1150/", "Eureka Compact 1150", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-todoterreno/heli-cpcd25/", "HELI CPCD25", { Motor: "Diésel" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-mastil-vertical/genie-sla15/", "GENIE SLA15", {}, null)), undefined);
  assert.equal(categorySlug(source("gomariz", gomUrl("brazo-articulado", "ba1335"), "Skyjack SJ85AJ", { Motor: "Diésel" }, null)), "plataformas-articuladas-diesel-segunda-mano");
});
