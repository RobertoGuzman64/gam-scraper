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

test("Gomariz: rutas producto acreditadas por identidad, familia documentada y Motor", () => {
  const cases = [
    ["producto/lgmg-as0812-tijera-electrica-scissor-lift", "LGMG", "AS0812", "Las Tijeras Eléctricas están diseñadas para trabajar en interior.", "Eléctrico", "plataformas-tijera-electricas-segunda-mano"],
    ["producto/lgmg-sr1023d", "LGMG", "SR1023D", "Las Tijeras Diésel destacan por tener una cesta de gran dimensión.", "Diésel", "plataformas-tijera-diesel-segunda-mano"],
    ["producto/lgmg-a14je", "LGMG", "A14JE", "Las Articuladas Eléctricas destacan por su gran maniobrabilidad.", "Eléctrico", "plataformas-articuladas-electricas-segunda-mano"],
    ["producto/snorkel-a46je", "Snorkel", "A46JE", "Las Articuladas Diésel son muy útiles para trabajos en exterior.", "Eléctrico", "plataformas-articuladas-electricas-segunda-mano"],
    ["producto/haulotte-ht23rtj-pro", "Haulotte", "HT23RTJ PRO", "Los Telescópicos Diesel dan solución tanto en altura como en alcance lateral.", "Diésel", "plataformas-elevadoras-telescopicas-segunda-mano"],
    ["producto/skyjack-sj16", "Skyjack", "SJ16", "Los Mástiles Verticales son ideales para trabajar en espacios reducidos.", "Eléctrico", "plataformas-unipersonales-segunda-mano"],
    ["producto/jcb-525-60-hi-viz", "JCB", "525-60 HI VIZ", "Manipuladores. Unifica las características de una carretilla elevadora.", "", "manipulador-teñescopico-segunda-mano"],
    ["producto/pramac-gpw100i_fs2", "Pramac", "GPW100I_FS2", "Contamos con grupos electrógenos desde 8 a 200 kvas.", "Diésel", "grupos-electrogenos-segunda-mano"],
    ["producto/skyjack-sj6832rt", "Skyjack", "SJ6832RT", "Las Tijeras Diésel destacan por tener una cesta extensible.", "Diésel", "plataformas-tijera-diesel-segunda-mano"]
  ] as const;
  for (const [path, brand, model, longDescription, motor, expected] of cases) {
    const record = {
      ...source("gomariz", `https://www.gomarizrent.com/${path}/`, `${brand} ${model}`, motor ? { Motor: motor } : {}, null),
      brand, model, longDescription
    };
    assert.equal(categorySlug(record), expected, path);
  }
});

test("Gomariz: producto sin identidad, Motor inequívoco o familia corroborada sigue pendiente", () => {
  const url = "https://www.gomarizrent.com/producto/lgmg-as0812-tijera-electrica-scissor-lift/";
  const record = {
    ...source("gomariz", url, "LGMG AS0812", { Motor: "Eléctrico" }, null),
    brand: "LGMG", model: "AS0812", longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior."
  };
  assert.equal(categorySlug({ ...record, longDescription: "Máquina de ocasión" }), undefined);
  assert.equal(categorySlug({ ...record, brand: "Genie" }), undefined);
  assert.equal(categorySlug({ ...record, model: "AS1413E" }), undefined);
  assert.equal(categorySlug({ ...record, title: "LGMG S1413E" }), undefined);
  assert.equal(categorySlug({ ...record, specs: {} }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Diésel" } }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Eléctrico, Gasolina" } }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("gomarizrent.com", "example.com") }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("producto", "alquiler") }), undefined);
  assert.equal(categorySlug({ ...record, providerId: "gam" }), undefined);
  const genericForklift = {
    ...record, url: "https://www.gomarizrent.com/producto/heli-cpcd25/", brand: "HELI", model: "CPCD25",
    title: "HELI CPCD25", specs: { Motor: "Diésel" },
    longDescription: "Máquinas destinadas al trabajo en cualquier condición, existen modelos con propulsión 4×4."
  };
  assert.equal(categorySlug(genericForklift), undefined);
  const truck = {
    ...record, url: "https://www.gomarizrent.com/producto/socage-iveco-s35s14-forste-24d-speed-ultra/",
    brand: "Iveco Socage", model: "S35S14 FORSTE 24D SPEED ULTRA",
    title: "SOCAGE IVECO S35S14 FORSTE 24D SPEED ULTRA", specs: { Motor: "Diésel" },
    longDescription: "Los Camiones Cesta es la solución perfecta para trabajos de exterior."
  };
  assert.equal(categorySlug(truck), undefined);
});

test("Gomariz: tijeras sin Motor solo con identidad, ruta y declaración eléctrica convergentes", () => {
  const url = "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we-1/";
  const record = {
    ...source("gomariz", url, "LGMG AS0607WE", {}, null),
    brand: "LGMG", model: "AS0607WE", longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior."
  };
  assert.equal(categorySlug(record), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug({ ...record, longDescription: null }), undefined);
  assert.equal(categorySlug({ ...record, title: "LGMG AS0607WE diésel" }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Diésel" } }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Eléctrico, Gasolina" } }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("as0607we", "as0812") }), undefined);
});
