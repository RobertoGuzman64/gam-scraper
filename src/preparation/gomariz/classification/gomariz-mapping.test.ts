import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../../prepare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "../../testing/mapping-fixtures.js";

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
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-todoterreno/heli-cpcd25/", "HELI CPCD25", {}, null)), undefined);
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
  assert.equal(categorySlug(genericForklift), "carretillas-todoterreno-segunda-mano");
  assert.equal(categorySlug({ ...genericForklift, model: "CPCD30" }), undefined);
  assert.equal(categorySlug({ ...genericForklift, longDescription: "Máquinas usadas para transportar cargas" }), undefined);
  const truck = {
    ...record, url: "https://www.gomarizrent.com/producto/socage-iveco-s35s14-forste-24d-speed-ultra/",
    brand: "Iveco Socage", model: "S35S14 FORSTE 24D SPEED ULTRA",
    title: "SOCAGE IVECO S35S14 FORSTE 24D SPEED ULTRA", specs: { Motor: "Diésel" },
    longDescription: "Los Camiones Cesta es la solución perfecta para trabajos de exterior."
  };
  assert.equal(categorySlug(truck), "plataformas-elevadoras-sobre-camion-segunda-mano");
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


test("Gomariz: acredita carretillas todoterreno únicamente desde rutas expresas y motor coherente", () => {
  const routes = [
    ["heli-cpcd25-copia", "HELI CPCD25"],
    ["ausa-c-200-h-4x4", "Ausa C 200 H 4×4"],
    ["agriamac-30-21-4x4-2", "Agriamac 30.21 4×4"]
  ] as const;
  for (const [path, title] of routes) {
    const url = `https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-todoterreno/${path}/`;
    assert.equal(categorySlug(source("gomariz", url, title, { Motor: "Diésel" }, null)), "carretillas-todoterreno-segunda-mano", title);
    assert.equal(categorySlug(source("gomariz", url, title, {}, null)), undefined, title);
    assert.equal(categorySlug(source("gomariz", url, title, { Motor: "Eléctrico, Gasolina" }, null)), undefined, title);
    assert.equal(categorySlug(source("gam", url, title, { Motor: "Diésel" }, null)), undefined, title);
  }
});

test("Gomariz: acredita una familia de producto pese al error ortográfico de marca, nunca por la descripción aislada", () => {
  const url = "https://www.gomarizrent.com/producto/brazo-articulado-articulating-boom-lift-skayjack-sj85aj/";
  const record = {
    ...source("gomariz", url, "SKYJACK SJ85AJ", { Motor: "Diésel" }, null),
    brand: "Skyjack", model: "SJ85AJ", longDescription: "Las Articuladas Diésel son muy útiles para trabajos en exterior."
  };
  assert.equal(categorySlug(record), "plataformas-articuladas-diesel-segunda-mano");
  assert.equal(categorySlug({ ...record, model: "SJ46AJ" }), undefined);
  assert.equal(categorySlug({ ...record, brand: "JLG" }), undefined);
  assert.equal(categorySlug({ ...record, title: "HAULOTTE SJ85AJ" }), undefined);
  assert.equal(categorySlug({ ...record, specs: {} }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Diésel, Gasolina" } }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("skayjack", "skyjakk") }), undefined);
  assert.equal(categorySlug({ ...record, longDescription: "Máquina de ocasión" }), undefined);
});

test("Gomariz: identifica camiones cesta aunque la marca compuesta figure en otro orden", () => {
  const url = "https://www.gomarizrent.com/producto/socage-iveco-s35s14-forste-24d-speed-ultra/";
  const record = {
    ...source("gomariz", url, "SOCAGE IVECO S35S14 FORSTE 24D SPEED ULTRA", { Motor: "Diésel" }, null),
    brand: "Iveco Socage", model: "S35S14 FORSTE 24D SPEED ULTRA",
    longDescription: "Los Camiones Cesta es la solución perfecta para realizar trabajos de exterior."
  };
  assert.equal(categorySlug(record), "plataformas-elevadoras-sobre-camion-segunda-mano");
  assert.equal(categorySlug({ ...record, model: "FORSTE 20D" }), undefined);
  assert.equal(categorySlug({ ...record, brand: "Nissan Socage" }), undefined);
  assert.equal(categorySlug({ ...record, title: "SOCAGE S35S14 FORSTE 24D SPEED ULTRA" }), undefined);
  assert.equal(categorySlug({ ...record, longDescription: "Camión usado" }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("socage-iveco", "socage-ford") }), undefined);
});

test("Gomariz: reconoce ruta de fabricante y modelo solo con descripción y Motor concordantes", () => {
  const url = "https://www.gomarizrent.com/snorkel/s3010p/1/";
  const record = {
    ...source("gomariz", url, "SNORKEL S3010P", { Motor: "Eléctrico" }, null),
    brand: "Snorkel", model: "S3010P", longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior."
  };
  assert.equal(categorySlug(record), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug({ ...record, specs: {} }), undefined);
  assert.equal(categorySlug({ ...record, specs: { Motor: "Diésel" } }), undefined);
  assert.equal(categorySlug({ ...record, model: "S3219E" }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("/snorkel/", "/genie/") }), undefined);
  assert.equal(categorySlug({ ...record, url: url.replace("/1/", "/foto/") }), undefined);
  assert.equal(categorySlug({ ...record, longDescription: "Ficha sin familia" }), undefined);
});

test("Gomariz: familias documentadas no fuerzan barredoras ni rodillos sin categoría equivalente", () => {
  const genericForklift = {
    ...source("gomariz", "https://www.gomarizrent.com/producto/heli-cpcd25/", "HELI CPCD25", { Motor: "Diésel" }, null),
    brand: "HELI", model: "CPCD25",
    longDescription: "Máquinas destinadas al trabajo en cualquier condición, existen modelos con propulsión 4×4."
  };
  assert.equal(categorySlug(genericForklift), "carretillas-todoterreno-segunda-mano");
  assert.equal(categorySlug({ ...genericForklift, model: "CPCD30" }), undefined);
  assert.equal(categorySlug({ ...genericForklift, longDescription: "Máquinas usadas para transportar cargas" }), undefined);
  const electricForklift = {
    ...source("gomariz", "https://www.gomarizrent.com/producto/heli-cpd25/", "HELI CPD25", { Motor: "Eléctrico" }, null),
    brand: "HELI", model: "CPD25",
    longDescription: "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios."
  };
  assert.equal(categorySlug(electricForklift), "carretillas-elevadoras-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/limpieza/barredora/eureka-compact-1150-1/", "Eureka Compact 1150", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-lp6500-2/", "Dynapac LP6500", { Motor: "Diésel" }, null)), undefined);
});


test("Gomariz: acredita familias de carretillas por modelo documentado, identidad y motor declarado", () => {
  const diesel = "Máquinas destinadas al trabajo en cualquier condición, existen modelos con propulsión 4×4.";
  const electric = "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios.";
  const cases = [
    ["BAOLI", "KB25", "Diésel", diesel, "carretillas-elevadoras-diesel-segunda-mano"],
    ["Baoli", "KB30", "Diésel", diesel, "carretillas-elevadoras-diesel-segunda-mano"],
    ["Caterpillar", "DP20KMC", "Diésel", diesel, "carretillas-elevadoras-diesel-segunda-mano"],
    ["HELI", "CPCD25", "Diésel", diesel, "carretillas-todoterreno-segunda-mano"],
    ["HELI", "CPD25", "Eléctrico", electric, "carretillas-elevadoras-electricas-segunda-mano"],
    ["Manitou", "ME316-48V", "Eléctrico", electric, "carretillas-elevadoras-electricas-segunda-mano"],
    ["Toyota", "02-8FDF25", "Diésel", diesel, "carretillas-elevadoras-diesel-segunda-mano"]
  ] as const;
  for (const [brand, model, motor, general, expected] of cases) {
    const url = `https://www.gomarizrent.com/producto/${brand.toLowerCase()}-${model.toLowerCase()}/`;
    const record = { ...source("gomariz", url, `${brand} ${model}`, { Motor: motor }, null),
      brand, model, longDescription: general };
    assert.equal(categorySlug(record), expected, model);
    assert.equal(categorySlug({ ...record, specs: {} }), undefined, model);
    assert.equal(categorySlug({ ...record, specs: { Motor: "Diésel, Gasolina" } }), undefined, model);
    assert.equal(categorySlug({ ...record, title: "Máquina sin identidad" }), undefined, model);
    assert.equal(categorySlug({ ...record, brand: "Otra" }), undefined, model);
    assert.equal(categorySlug({ ...record, model: "INDEFINIDO" }), undefined, model);
    assert.equal(categorySlug({ ...record, longDescription: "Carretilla de ocasión" }), undefined, model);
    assert.equal(categorySlug({ ...record, url: url.replace("/producto/", "/alquiler/") }), undefined, model);
    assert.equal(categorySlug({ ...record, url: url.replace("gomarizrent.com", "example.com") }), undefined, model);
    assert.equal(categorySlug({ ...record, condition: "Nuevo" }), undefined, model);
    assert.equal(categorySlug({ ...record, categoryKey: "alquiler" }), undefined, model);
    assert.equal(categorySlug({ ...record, specs: { Motor: motor === "Diésel" ? "Eléctrico" : "Diésel" } }), undefined, model);
  }
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/limpieza/barredora/eureka-compact-1150-1/", "Eureka Compact 1150", { Motor: "Eléctrico" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-lp6500-2/", "Dynapac LP6500", { Motor: "Diésel" }, null)), undefined);
});
