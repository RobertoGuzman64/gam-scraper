import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../source/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../source/context/editorial-missing-technical-general.js";
import { resolveDocumentedModelGeneral, resolveDocumentedPlatformShort } from "../measurements/sourced/editorial-sourced-technical-context.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";

const source = (
  providerId: ProductRecord["providerId"], model: string, suffix: string, description: string | null,
  specs: ProductRecord["specs"]
): ProductRecord => ({
  providerId, categoryKey: providerId === "mercaeleva" ? "venta" : "manutencion", categoryName: "Maquinaria en venta",
  url: providerId === "mercaeleva" ? `https://sales.mercaeleva.com/es/for-sale/machine/MB-${model}-M888-7070` :
    `https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-nuevas/8888-mb-${model}`,
  title: `MB ${model} ${suffix}`, shortDescription: null, longDescription: description,
  price: null, condition: "Nuevo", reference: providerId === "mercaeleva" ? "M888-7070" : "8888",
  brand: "MB", model, year: "2026", location: null, country: null, horometer: null,
  serialNumber: null, image: null, images: [], specs: specs ?? {}
});

const technical = {
  Marca: "MB", Modelo: "ESL999", Estado: "Nuevo", "Título adicional": "Apilador eléctrico de 1.600kg con batería de litio",
  "Capacidad máxima de elevación": "1600 kg", "Tipo de Batería": "Li-ion", "Tipo de motor": "Eléctrico",
  "Voltaje de la batería": "24 V", "Capacidad de la batería": "100 Ah",
  "Altura máxima de elevación": "3600 mm", "Tipo de mástil": "Triple"
} as const;

test("El motor recupera una general técnica de una unidad nueva verificada sin narrador específico", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  const general = resolveMissingTechnicalEditorialGeneral(record, record);
  assert.match(general ?? "", /MB ESL999/);
  assert.match(general ?? "", /1\.600 kg/);
  assert.match(general ?? "", /3\.600 mm/);
  assert.match(general ?? "", /24 V y 100 Ah/);
  const prepared = prepareSourceProduct(record);
  assert.match(prepared.product.description_general ?? "", /MB ESL999/);
  assert.match(prepared.product.description_general ?? "", /1\.600 kg/);
});

test("La recuperación funciona por contrato para un segundo origen sin reglas de proveedor", () => {
  const record = source("gam", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  const general = resolveMissingTechnicalEditorialGeneral(record, record);
  assert.match(general ?? "", /MB ESL999/);
});

test("No hereda capacidad, motorización, identidad o valores de una unidad distinta", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg con batería de litio", null, technical);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, model: "ESL998" }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, reference: "M999-7070" }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral(record, { ...record, specs: { ...technical, "Capacidad máxima de elevación": "1500 kg" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, title: record.title?.replace("1.600", "2.000") ?? null },
    { ...record, title: record.title?.replace("1.600", "2.000") ?? null }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, specs: { ...technical, "Tipo de motor": "Diésel" } },
    { ...record, specs: { ...technical, "Tipo de motor": "Diésel" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, specs: { ...technical, "Tipo de Batería": "Gel" } },
    { ...record, specs: { ...technical, "Tipo de Batería": "Gel" } }), null);
  assert.equal(resolveMissingTechnicalEditorialGeneral({ ...record, longDescription: "Ficha técnica existente" },
    { ...record, longDescription: "Ficha técnica existente" }), null);
});

test("Extrae descripción declarada solo con marca, modelo, familia y medidas compatibles", () => {
  const title = "PLATAFORMA TIJERA ELECTRICA 22 MT";
  const record = {
    ...source("mercaeleva", "HL-220 E12", title, "Ref. 1887 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12 HORAS 859 AÑO DE FABRICACION 2017", {
      Marca: "Hollandlift", Modelo: "HL-220 E12", Estado: "Usado"
    }),
    title: `Hollandlift HL-220 E12 ${title}`,
    brand: "Hollandlift", condition: "Segunda mano" as const
  };
  const excerpt = resolveVerifiedSourceEditorialExcerpt(record);
  assert.equal(excerpt, "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12");
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, model: "HL-220 E13" }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, longDescription: record.longDescription?.replace("TIJERA", "ARTICULADA") ?? null }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, longDescription: record.longDescription?.replace("22 MT", "16 MT") ?? null }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, shortDescription: "Resumen oficial" }), null);
  assert.equal(resolveVerifiedSourceEditorialExcerpt({ ...record, providerId: "gomariz" }), null);
});

test("Rechaza la atribución de capacidades y mástiles contradictorios en el origen", () => {
  const record = source("mercaeleva", "ESL999", "Apilador eléctrico de 1.600kg", "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 MASTIL DUPLEX TRIPLEX HORAS 1", technical);
  assert.equal(resolveVerifiedSourceEditorialExcerpt(record), null);
  const incompatible = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1500 KG MB ESL999 HORAS 1" };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(incompatible), null);
  const capacityConflict = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 HORAS 1",
    specs: { ...technical, "Capacidad máxima de elevación": "1500 kg" } };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(capacityConflict), null);
  const mastConflict = { ...record, longDescription: "Ref. M888-7070 APILADOR ELECTRICO 1600 KG MB ESL999 MASTIL DUPLEX HORAS 1" };
  assert.equal(resolveVerifiedSourceEditorialExcerpt(mastConflict), null);
});


test("aprovecha maniobrabilidad nominal acreditada sin atribuir condiciones de trabajo en altura", () => {
  const reviewed = { "Radio de giro exterior del modelo": "2300 mm", "Pendiente superable del modelo con plataforma bajada": "25 %" };
  const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m y pendiente superable nominal con plataforma bajada de 25 %.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Radio de giro de 2,3 m. Pendiente de 25 %.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { ...reviewed, "Radio de giro exterior del modelo": "2500 mm", "Pendiente superable del modelo con plataforma bajada": "40 %" }), null);
    const articulated = { ...original, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    assert.equal(resolveDocumentedModelGeneral(articulated, { ...articulated, specs: prepared.specs }, general.replace("de tijera", "articulada"), reviewed), `${general.replace("de tijera", "articulada")}\n\nEl modelo presenta radio de giro exterior de 2,3 m.`);
  }
});


test("distingue diámetro compatible de herramienta instalada en implementos", () => {
  const original = { ...controlledGomarizPlatform(), title: "Martillo para miniexcavadora MARCA MODELO10", specs: { Peso: "100 kg" } };
  const reviewed = { "Diámetro nominal de herramienta compatible": "45 mm" };
  const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
  const general = "La ficha técnica de martillo para miniexcavadora MARCA MODELO10 indica peso declarado de 100 kg.";
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, reviewed), `${general}\n\nEl modelo presenta diámetro nominal de herramienta compatible de 45 mm.`);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Puntero de 45 mm.`, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Diámetro nominal de herramienta compatible": "55 mm" }), null);
  assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRO" }, general, reviewed), null);
});


test("prioriza maniobrabilidad y pendiente nominal condicionada en generales técnicas extensas", () => {
  const field = "Pendiente superable del modelo con plataforma bajada";
  const reviewed = { [field]: "25 %", "Radio de giro exterior del modelo": "2300 mm" };
  const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m y capacidad de carga de 450 kg. La selección del equipo debe considerar las dimensiones exteriores, la configuración de transporte, el acceso al recinto y la zona prevista para realizar el trabajo. La altura del equipo replegado condiciona el paso por puertas y otros accesos. La utilización requiere una superficie de apoyo adecuada y comprobar las condiciones de carga y las restricciones de la plataforma. La altura de trabajo no equivale a la altura de plataforma; verificar la capacidad de cesta antes de elegir la máquina para la operación.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m. El modelo presenta pendiente superable nominal con plataforma bajada de 25 %. Esta prestación no indica la inclinación admisible durante el trabajo en altura.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { [field]: "30 %" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, longDescription: "Pendiente máxima del 15 %." }, prepared, general, reviewed), `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m.`);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { ...original.specs, [field]: "30 %" } }, prepared, general, reviewed), `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m.`);
    const wheelbase = { "Distancia entre ejes (mm)": "1800 mm" };
    const withWheelbase = { ...prepared, specs: { ...prepared.specs, ...wheelbase, Longitud: "2,5 m" } };
    const combined = resolveDocumentedModelGeneral(original, withWheelbase, general, { ...reviewed, ...wheelbase });
    assert.equal(combined, `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m y distancia entre ejes de 1,8 m. El modelo presenta pendiente superable nominal con plataforma bajada de 25 %. Esta prestación no indica la inclinación admisible durante el trabajo en altura.`);
    assert.equal(resolveDocumentedModelGeneral(original, withWheelbase, combined, { ...reviewed, ...wheelbase }), null);
    assert.equal(resolveDocumentedModelGeneral(original, withWheelbase, general, wheelbase), `${general}\n\nEl modelo presenta distancia entre ejes de 1,8 m.`);
    assert.equal(resolveDocumentedModelGeneral(original, withWheelbase, `${general} Batalla de 1,8 m.`, wheelbase), null);
    assert.equal(resolveDocumentedModelGeneral(original, withWheelbase, general, { "Distancia entre ejes (mm)": "2000 mm" }), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { ...original.specs, "Distancia entre ejes": "2 m" } }, withWheelbase, general, wheelbase), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...withWheelbase, specs: { ...withWheelbase.specs, Longitud: "1,5 m" } }, general, wheelbase), null);
    const extension = { "Extensión de plataforma": "900 mm" };
    const withExtension = { ...prepared, specs: { ...prepared.specs, ...extension } };
    const extended = `${general}\n\nEl modelo presenta extensión de plataforma de 0,9 m.`;
    assert.equal(resolveDocumentedModelGeneral(original, withExtension, general, extension), extended);
    assert.equal(resolveDocumentedModelGeneral(original, withExtension, extended, extension), null);
    assert.equal(resolveDocumentedModelGeneral(original, withExtension, `${general} Extensión de plataforma de 0,9 m.`, extension), null);
    assert.equal(resolveDocumentedModelGeneral(original, withExtension, general, { "Extensión de plataforma": "1 m" }), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { ...original.specs, "Extensión de plataforma": "1 m" } }, withExtension, general, extension), null);
    assert.equal(resolveDocumentedModelGeneral(original, withExtension, general, {}), null);
    const all = { ...reviewed, ...wheelbase, ...extension };
    assert.equal(resolveDocumentedModelGeneral(original, { ...withWheelbase, specs: { ...withWheelbase.specs, ...extension } }, general, all), `${general}\n\nEl modelo presenta radio de giro exterior de 2,3 m, distancia entre ejes de 1,8 m y extensión de plataforma de 0,9 m. El modelo presenta pendiente superable nominal con plataforma bajada de 25 %. Esta prestación no indica la inclinación admisible durante el trabajo en altura.`);
    const articulated = { ...original, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    const articulatedGeneral = general.replace("de tijera", "articulada");
    assert.equal(resolveDocumentedModelGeneral(articulated, { ...articulated, specs: prepared.specs }, articulatedGeneral, reviewed), `${articulatedGeneral}\n\nEl modelo presenta radio de giro exterior de 2,3 m.`);
    assert.equal(resolveDocumentedModelGeneral(articulated, { ...articulated, specs: prepared.specs }, articulatedGeneral, { "Pendiente superable del modelo con plataforma bajada": "25 %" }), null);
  }
});


test("Aprovecha dimensiones acreditadas de plataforma sin confundirlas con la geometría exterior", () => {
  const reviewed = { "Longitud de plataforma": "2,26 m", "Anchura de plataforma": "1120 mm" };
  const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m y capacidad de carga de 450 kg. La selección del equipo debe considerar las dimensiones exteriores, la configuración de transporte, el acceso al recinto y la zona prevista para realizar el trabajo. La altura del equipo replegado condiciona el paso por puertas y otros accesos. La utilización requiere una superficie de apoyo adecuada y comprobar las condiciones de carga y las restricciones de la plataforma. La altura de trabajo no equivale a la altura de plataforma; verificar la capacidad de cesta antes de elegir la máquina para la operación.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, ...reviewed, Longitud: "2,5 m", Anchura: "1,18 m" } };
    const expected = `${general}\n\nEl modelo presenta longitud de plataforma de 2,26 m y anchura de plataforma de 1,12 m.`;
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, reviewed), expected);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, expected, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Plataforma de 2,26 × 1,12 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Dimensiones de cesta": "2,26 x 1,12 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, Longitud: "2 m", Anchura: "1 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Longitud de plataforma": "2 m", "Anchura de plataforma": "1 m" }), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { ...original.specs, "Longitud de plataforma": "2 m", "Anchura de plataforma": "1 m" } }, prepared, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
  }
});


test("La corta de plataforma aprovecha capacidad máxima acreditada del modelo sin confundirla con la unidad", () => {
  const reviewed = { "Capacidad máxima de plataforma": "450 kg" };
  const short = "Plataforma de tijera eléctrica MARCA MODELO10, con altura de trabajo de 10 m; año de fabricación 2020.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
    const expected = short.replace(";", " y capacidad máxima de plataforma del modelo de 450 kg;");
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, reviewed), expected);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, expected, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, {}), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, reference: "OTRA" }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, Capacidad: "300 kg" } }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, "Capacidad de plataforma sin restricciones": "250 kg" } }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, longDescription: "Capacidad de 300 kg." }, prepared, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, shortDescription: "Resumen del fabricante" }, prepared, short, reviewed), null);
  }
});

test("La corta de brazo elevador incorpora alcance horizontal documentado sin confundir alcance y altura", () => {
  const reviewed = { "Alcance horizontal (m)": "7,5 m", "Capacidad máxima de plataforma": "450 kg" };
  const short = "Plataforma articulada eléctrica MARCA MODELO10, con altura de trabajo de 10 m; año de fabricación 2020.";
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    const prepared = { ...original, specs: { ...original.specs, ...reviewed, "Alcance horizontal (m)": "7500 mm" } };
    const expected = short.replace(";", ", capacidad máxima de plataforma del modelo de 450 kg y alcance horizontal del modelo de 7,5 m;");
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, reviewed), expected);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, expected, reviewed), null);
    const onlyReach = { "Alcance horizontal (m)": "7,5 m" };
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, onlyReach), short.replace(";", " y alcance horizontal del modelo de 7,5 m;"));
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, {}), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, model: "OTRO" }, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, "Alcance lateral": "8 m" } }, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, specs: { ...original.specs, "Alcance lateral": "8 m" } }, prepared, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, longDescription: "Alcance condicionado por carga." }, prepared, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, shortDescription: "Resumen existente" }, prepared, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, "Alcance horizontal máximo sin restricción de carga": "6 m" } }, short, onlyReach), null);
    assert.equal(resolveDocumentedPlatformShort(base, { ...base, specs: prepared.specs }, short.replace("articulada", "de tijera"), onlyReach), null);
  }
});

test("La corta de tijera incorpora extensión de plataforma acreditada sin confundirla con la unidad", () => {
  const reviewed = { "Extensión de plataforma": "900 mm" };
  const short = "Plataforma de tijera eléctrica MARCA MODELO10, con altura de trabajo de 10 m; año de fabricación 2020.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, "Extensión de plataforma": "0,9 m" } };
    const expected = short.replace(";", " y extensión de plataforma del modelo de 0,9 m;");
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, reviewed), expected);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, expected, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, {}), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, model: "OTRO" }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, "Longitud de extensión": "1 m" } }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, specs: { ...original.specs, "Extensión de plataforma": "1 m" } }, prepared, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, longDescription: "Plataforma extensible opcional." }, prepared, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, shortDescription: "Resumen existente" }, prepared, short, reviewed), null);
    const articulated = { ...original, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    assert.equal(resolveDocumentedPlatformShort(articulated, { ...articulated, specs: prepared.specs }, short.replace("de tijera", "articulada"), reviewed), null);
  }
});

test("La corta distingue la altura de plataforma documentada de la altura de trabajo", () => {
  const reviewed = { "Altura de plataforma": "8000 mm" };
  const short = "Plataforma de tijera eléctrica MARCA MODELO10, con altura de trabajo de 10 m; año de fabricación 2020.";
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared = { ...original, specs: { ...original.specs, "Altura de trabajo": "10 m", "Altura de plataforma": "8 m" } };
    const expected = short.replace(";", " y altura de plataforma del modelo de 8 m;");
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, reviewed), expected);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, expected, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short, {}), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, model: "OTRO" }, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, short.replace("10 m", "12 m"), reviewed), null);
    assert.equal(resolveDocumentedPlatformShort(original, { ...prepared, specs: { ...prepared.specs, "Altura de plataforma": "11 m" } }, short, { "Altura de plataforma": "11 m" }), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, specs: { ...original.specs, "Altura plataforma": "9 m" } }, prepared, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, longDescription: "Altura máxima de la cesta de 8 m." }, prepared, short, reviewed), null);
    assert.equal(resolveDocumentedPlatformShort({ ...original, shortDescription: "Texto existente" }, prepared, short, reviewed), null);
    const longShort = short.replace(";", `, ${"detalle ".repeat(22).trim()};`);
    assert.equal(resolveDocumentedPlatformShort(original, prepared, longShort, reviewed), null);
  }
});

test("Aprovecha geometría documentada de plataformas de brazo en generales extensas", () => {
  const reviewed = { "Altura de plataforma": "8000 mm", "Longitud de plumín": "1,2 m", "Rotación de torreta": "350°" };
  const general = "La ficha técnica de plataforma articulada eléctrica MARCA MODELO10 indica altura de trabajo de 10 m y capacidad de carga de 450 kg. La selección del equipo debe considerar las dimensiones exteriores, la configuración de transporte, el acceso al recinto y la zona prevista para realizar el trabajo. La altura del equipo replegado condiciona el paso por puertas y otros accesos. La utilización requiere una superficie de apoyo adecuada y comprobar las condiciones de carga y las restricciones de la plataforma. La altura de trabajo no equivale a la altura de plataforma; verificar la capacidad de cesta antes de elegir la máquina para la operación.";
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
    const expected = `${general}\n\nEl modelo presenta altura de plataforma de 8 m, longitud de plumín de 1,2 m y rotación de torreta de 350°.`;
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, reviewed), expected);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, expected, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Altura de plataforma": "11 m", "Longitud de plumín": "2 m", "Rotación de torreta": "400°" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { ...original.specs, "Longitud de plumín": "2 m" } }, prepared, general, { "Longitud de plumín": "1,2 m" }), null);
  }
});
