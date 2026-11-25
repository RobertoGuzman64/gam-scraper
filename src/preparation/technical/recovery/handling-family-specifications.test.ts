import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGamForklift } from "../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "../evidence/documented-technical-evidence.js";
import { recoverSourceHandlingConfiguration } from "./handling-family-specifications.js";

const carriage = "El apilador facilita la manipulación gracias al tablero de eje pasador que permite equipar distintos implementos.";
const protection = "Su protección para el operario incluye mandos de control y protectores para los pies.";
const battery = "Funciona con baterías sin necesidad de mantenimiento, 24 V 90 Ah / 20h secas.";
const source = (family: "Apilador" | "Transpaleta", text: string): ProductRecord => ({
  ...controlledGamForklift(), reference: "123456789", condition: "Nuevo", categoryKey: "manutencion", categoryName: family,
  title: `${family} eléctrico MARCA MODELO10`, url: "https://online.gamrentals.com/es/manutencion/123456789-marca-modelo10",
  shortDescription: null, longDescription: text, specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "1000 kg" }
});
const recover = (record: ProductRecord) => recoverSourceHandlingConfiguration(record, record, record.specs ?? {});

test("recupera la configuración declarada sin alterar la fuente y conserva procedencia", () => {
  const record = source("Apilador", carriage);
  const snapshot = structuredClone(record);
  const output = recover(record);
  assert.equal(output["Tipo de tablero"], "Eje pasador");
  assert.equal(recoverSourceHandlingConfiguration(record, record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Tipo de tablero"], "Eje pasador");
  const evidence = prepared.technicalProvenance?.entries.find((entry) => entry.field === "Tipo de tablero");
  assert.equal(evidence?.scope, "unit");
  assert.equal(evidence?.sourceField, "longDescription");
  assert.deepEqual(record, snapshot);
});

test("recupera configuración explícita de transpaleta y mantiene el régimen de capacidad de batería", () => {
  const record = source("Transpaleta", `${protection} ${battery}`);
  const result = recover(record);
  assert.equal(result["Protección de pies"], "Protectores para el operario");
  assert.equal(result["Tensión nominal de batería"], "24 V");
  assert.equal(result["Capacidad de batería (20 h)"], "90 Ah");
  const other: ProductRecord = { ...record, providerId: "mercaeleva", categoryKey: "venta", reference: "CONTROL-02",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
  assert.equal(recover(other)["Capacidad de batería (20 h)"], "90 Ah");
});

test("rechaza opciones, contradicciones, identidades incompletas y especificaciones ya presentes", () => {
  const record = source("Apilador", carriage);
  for (const invalid of [
    { ...record, longDescription: `Como opción, ${carriage}` },
    { ...record, longDescription: `${carriage} No incluye tablero.` },
    { ...record, shortDescription: "Tablero alternativo." },
    { ...record, model: "OTRO" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, specs: { ...record.specs, Portahorquillas: "Otro" } }
  ]) assert.equal(recover(invalid), invalid.specs);
  assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  const conflicting = source("Transpaleta", `${battery} La batería es de 12 V.`);
  assert.equal(recover(conflicting), conflicting.specs);
  const declared = { ...source("Transpaleta", battery), specs: { "Capacidad de la batería": "80 Ah" } };
  assert.equal(recover(declared), declared.specs);
});

test("recupera la motorización declarada de recogepedidos usados con identidad corroborada", () => {
  const record: ProductRecord = { ...source("Apilador", "El recogepedidos MARCA MODELO10 está equipado con un motor eléctrico."),
    title: "Recogepedidos MARCA MODELO10", categoryName: "Recogepedidos", condition: "Segunda mano", year: "2019" };
  assert.equal(recover(record)["Tipo motor"], "Eléctrico");
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Tipo motor"], "Eléctrico");
  assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === "Tipo motor")?.sourceField, "longDescription");
  for (const invalid of [
    { ...record, longDescription: "El recogepedidos MARCA OTRO está equipado con un motor eléctrico." },
    { ...record, longDescription: `${record.longDescription} Motor diésel.` },
    { ...record, longDescription: "El recogepedidos MARCA MODELO10 no está equipado con un motor eléctrico." },
    { ...record, specs: { ...record.specs, Motorización: "GLP" } }
  ]) assert.equal(recover(invalid), invalid.specs);
});

test("recupera la inclinación declarada y conserva otros valores de elevación", () => {
  const record = { ...source("Transpaleta", "Las horquillas se pueden inclinar 75°."), title: "Transpaleta inclinable MARCA MODELO10" };
  const result = recover(record);
  assert.equal(result["Ángulo máximo de inclinación"], "75°");
  assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
  for (const invalid of [
    { ...record, title: "Transpaleta de tijera MARCA MODELO10" },
    { ...record, longDescription: "Como opción, las horquillas se pueden inclinar 75°." },
    { ...record, longDescription: `${record.longDescription} La inclinación máxima es 60°.` },
    { ...record, specs: { ...record.specs, Inclinación: "60°" } }
  ]) assert.equal(recover(invalid), invalid.specs);
});

test("recupera química y tiempo de carga declarados sin confundirlos con autonomía", () => {
  const record = { ...source("Transpaleta", "La batería puede sustituirse en segundos y se carga en tan solo 3 horas. Las baterías de litio tienen muchos ciclos."),
    title: "Transpaleta eléctrica de litio MARCA MODELO10" };
  const result = recover(record);
  assert.equal(result["Tipo de batería"], "Litio");
  assert.equal(result["Tiempo de carga anunciado"], "3 h");
  assert.equal(result.Autonomía, undefined);
  const invalid = { ...record, specs: { ...record.specs, "Tipo de batería": "Gel", "Tiempo de carga": "4 h" } };
  assert.equal(recover(invalid), invalid.specs);
  const ambiguous = { ...record, longDescription: `Como opción, ${record.longDescription}` };
  assert.equal(recover(ambiguous)["Tiempo de carga anunciado"], undefined);
});

test("recupera el material de ejes y anclaje sin atribuirlo al resto de componentes", () => {
  const record = source("Transpaleta", "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables. El resto de piezas es cromado.");
  const result = recover(record);
  assert.equal(result["Material de ejes y anclaje"], "Acero inoxidable");
  assert.equal(result.Chasis, undefined);
  const invalid = { ...record, longDescription: `${record.longDescription} El anclaje es de plástico.` };
  assert.equal(recover(invalid), invalid.specs);
});

test("recupera propulsión manual y posición a pie corroboradas en una unidad usada", () => {
  const record: ProductRecord = { ...source("Transpaleta", "La MARCA MODELO10 es una transpaleta manual a pie. Funciona sin necesidad de alimentación eléctrica."),
    title: "Transpaleta manual a pie MARCA MODELO10", condition: "Segunda mano" };
  const result = recover(record);
  assert.equal(result.Propulsión, "Manual");
  assert.equal(result["Posición de conducción"], "Operador a pie");
  assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
  const contradictory = { ...record, longDescription: `${record.longDescription} Dispone de motor eléctrico y plataforma para el conductor.` };
  assert.equal(recover(contradictory), contradictory.specs);
  const otherModel = { ...record, longDescription: "La MARCA MODELO20 es una transpaleta manual a pie." };
  assert.equal(recover(otherModel), otherModel.specs);
  const existing = { ...record, specs: { ...record.specs, Propulsión: "Manual", "Posición del conductor": "A pie" } };
  assert.equal(recover(existing), existing.specs);
});

test("recupera motor eléctrico acreditado y posición a bordo de una oferta de catálogo", () => {
  const record = { ...source("Transpaleta", "La transpaleta eléctrica MARCA MODELO10 incorpora una plataforma para operario a bordo. Tiene motor eléctrico AC."), title: "Transpaleta eléctrica MARCA MODELO10" };
  const result = recover(record);
  assert.equal(result["Tipo motor"], "Eléctrico");
  assert.equal(result["Posición de conducción"], "Operador a bordo");
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === "Posición de conducción")?.sourceField, "longDescription");
  const option = { ...record, longDescription: "La transpaleta eléctrica MARCA MODELO10, como opción, incorpora una plataforma para operario a bordo. Tiene motor eléctrico AC." };
  assert.equal(recover(option)["Posición de conducción"], undefined);
  const negative = { ...record, longDescription: "La transpaleta eléctrica MARCA MODELO10 no tiene motor eléctrico. Es manual." };
  assert.equal(recover(negative), negative.specs);
  const other: ProductRecord = { ...record, providerId: "mercaeleva", reference: "CONTROL-03", categoryKey: "venta",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-03" };
  assert.equal(recover(other)["Posición de conducción"], "Operador a bordo");
});

const electricHighlifter = (): ProductRecord => ({
  ...source("Transpaleta", "Transpaleta de tijera para elevación de palés."), brand: "LOGITRANS", model: "EHL",
  title: "Transpaleta LOGITRANS EHL", shortDescription: "LOGITRANS EHL nuevo",
  url: "https://online.gamrentals.com/es/transpaletas/CONTROL-01-logitrans-ehl",
  specs: { Marca: "LOGITRANS", Modelo: "EHL", País: "ESPAÑA", "Capacidad de carga (kg)": "1500 kg", Motorización: "Eléctrico" }
});

test("distingue el desplazamiento manual documentado de la elevación eléctrica", () => {
  const record = electricHighlifter();
  const snapshot = structuredClone(record);
  const result = recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});
  assert.deepEqual(result, { ...record.specs, Propulsión: "Manual", "Accionamiento de elevación": "Eléctrico" });
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec.Propulsión, "Manual");
  assert.equal(prepared.product.spec.Motorización, "Eléctrico");
  const evidence = prepared.technicalProvenance?.entries.find((entry) => entry.field === "Propulsión");
  assert.equal(evidence?.scope, "model-document");
  assert.equal(evidence?.verification?.kind, "reviewed-model-fact");
  assert.deepEqual(record, snapshot);
});

test("reutiliza la acreditación y rechaza tracción contradictoria, variantes y unidades usadas", () => {
  const record = electricHighlifter();
  const other: ProductRecord = { ...record, providerId: "gomariz", reference: "CONTROL-02",
    url: "https://www.gomarizrent.com/producto/logitrans-ehl/" };
  assert.equal(recoverReviewedModelTechnicalSpecs(other, other.specs ?? {}).Propulsión, "Manual");
  for (const invalid of [
    { ...record, model: "EHLX" }, { ...record, url: record.url.replace("ehl", "ehlx") },
    { ...record, shortDescription: "LOGITRANS EHLX nuevo" }, { ...record, condition: "Segunda mano" as const },
    { ...record, year: "2020" }, { ...record, serialNumber: "CONTROL-SERIAL" },
    { ...record, longDescription: `${record.longDescription} Motor de tracción eléctrico.` },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2000 kg" } }
  ]) assert.equal(recoverReviewedModelTechnicalSpecs(invalid, invalid.specs ?? {}), invalid.specs);
  const existing = { ...record.specs, Tracción: "Eléctrica" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, existing), existing);
});

test("recupera motorización de preparapedidos de bajo nivel y posición de recogepedidos con evidencia explícita", () => {
  const picker: ProductRecord = { ...source("Transpaleta", "El MARCA MODELO10 es un preparapedidos de bajo nivel eléctrico."),
    title: "Preparapedidos MARCA MODELO10", categoryName: "Maquinaria de ocasión", condition: "Segunda mano",
    url: "https://online.gamrentals.com/es/preparapedidos-segunda-mano/123456789-marca-modelo10" };
  assert.equal(recover(picker)["Tipo motor"], "Eléctrico");
  const rider = { ...picker, title: "Recogepedidos MARCA MODELO10",
    longDescription: "El recogepedidos MARCA MODELO10 dispone de plataforma. La plataforma de operario cuenta con acceso fácil y seguro para subir y bajar de la máquina." };
  assert.equal(recover(rider)["Posición de conducción"], "Operador a bordo");
  for (const invalid of [
    { ...rider, longDescription: `${rider.longDescription} Plataforma opcional.` },
    { ...rider, longDescription: `${rider.longDescription} Conducción a pie.` },
    { ...rider, model: "MODELO20" },
    { ...rider, specs: { ...rider.specs, "Posición del conductor": "A pie" } }
  ]) assert.equal(recover(invalid), invalid.specs);
  const contradictory = { ...picker, longDescription: `${picker.longDescription} Motor diésel.` };
  assert.equal(recover(contradictory), contradictory.specs);
});


test("recupera tecnología de tracción explícita sin confundirla con elevación", () => {
  const picker: ProductRecord = { ...source("Apilador", "El recogepedidos MARCA MODELO10 incorpora un motor de tracción de CA."),
    title: "Recogepedidos MARCA MODELO10", categoryName: "Recogepedidos",
    url: "https://online.gamrentals.com/es/recogepedidos/123456789-marca-modelo10" };
  assert.equal(recover(picker)["Tecnología del motor de tracción"], "Corriente alterna");
  const other = { ...picker, reference: "987654321", url: "https://online.gamrentals.com/es/recogepedidos/987654321-marca-modelo10" };
  assert.equal(recover(other)["Tecnología del motor de tracción"], "Corriente alterna");
  const general = { ...picker, longDescription: "Equipada con un motor de CA, la MARCA MODELO10 ofrece maniobrabilidad." };
  assert.equal(recover(general)["Tecnología del motor"], "Corriente alterna");
  assert.equal(recover(general)["Tecnología del motor de tracción"], undefined);
  const pallet = source("Transpaleta", "La transpaleta MARCA MODELO10 incorpora un motor de tracción AC sin escobillas.");
  assert.equal(recover(pallet)["Tecnología del motor de tracción"], "Corriente alterna");
  const stacker = source("Apilador", "El apilador MARCA MODELO10 utiliza motor de tracción AC sin mantenimiento.");
  assert.equal(recover(stacker)["Tecnología del motor de tracción"], "Corriente alterna");
  const pedestrian = source("Apilador", "El apilador MARCA MODELO10 está diseñado para uso por operario a pie.");
  assert.equal(recover(pedestrian)["Posición de conducción"], "Operador a pie");
  for (const invalid of [
    { ...picker, longDescription: "El recogepedidos MARCA MODELO10 puede equiparse con un motor de tracción de CA opcional." },
    { ...picker, longDescription: `${picker.longDescription} Motor de corriente continua.` },
    { ...picker, longDescription: "El recogepedidos MARCA MODELO10 no tiene motor de tracción de CA." },
    { ...picker, model: "MODELO20" },
    { ...picker, specs: { ...picker.specs, "Tecnología del motor de tracción": "Corriente continua" } },
    { ...picker, condition: "Segunda mano" as const }
  ]) assert.equal(recover(invalid), invalid.specs);
  const conflicting = { ...pedestrian, longDescription: `${pedestrian.longDescription} Operario a bordo.` };
  assert.equal(recover(conflicting), conflicting.specs);
  const result = recover(pallet);
  assert.equal(recoverSourceHandlingConfiguration(pallet, pallet, result), result);
});

test("acredita accionamiento de elevación por modelo compatible y preserva variantes y contradicciones", () => {
  const record: ProductRecord = {
    ...source("Apilador", "Apilador eléctrico para manipulación de palés."), brand: "LOGITRANS", model: "Self Mini",
    title: "Apilador LOGITRANS Self Mini", shortDescription: "LOGITRANS Self Mini nuevo",
    url: "https://online.gamrentals.com/es/apiladores/control-logitrans-self-mini",
    specs: { Marca: "LOGITRANS", Modelo: "Self Mini", País: "ESPAÑA", "Capacidad de carga (kg)": "1000 kg", Motorización: "Eléctrico" }
  };
  const result = recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});
  assert.equal(result["Accionamiento de elevación"], "Eléctrico");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const other: ProductRecord = { ...record, providerId: "gomariz", url: "https://www.gomarizrent.com/producto/logitrans-self-mini/" };
  assert.equal(recoverReviewedModelTechnicalSpecs(other, other.specs ?? {})["Accionamiento de elevación"], "Eléctrico");
  for (const invalid of [
    { ...record, url: record.url.replace("self-mini", "self-mini-x") },
    { ...record, model: "Self Mini X" },
    { ...record, serialNumber: "CONTROL-SERIAL" },
    { ...record, longDescription: `${record.longDescription} Elevación manual.` },
    { ...record, shortDescription: null }
  ]) assert.equal(recoverReviewedModelTechnicalSpecs(invalid, invalid.specs ?? {}), invalid.specs);
});

const vacuumOffer = (): ProductRecord => ({
  ...controlledGamForklift(), reference: "123456789", condition: "Nuevo", categoryKey: "aspiradoras-industriales-nuevas",
  categoryName: "Aspiradoras industriales nuevas", brand: "Tennant", model: "AP V-CAN-10",
  url: "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/123456789-ap-v-can-10",
  title: "Aspiradora TENNANT AP V-CAN-10", shortDescription: "Aspiradora TENNANT AP V-CAN-10",
  longDescription: "La aspiradora TENNANT AP V-CAN-10 pesa 4,1 kg y emite 68 dBA.",
  specs: { Marca: "Tennant", Modelo: "AP V-CAN-10" }
});

test("recupera las prestaciones documentadas de una aspiradora con identidad corroborada", () => {
  const record = vacuumOffer();
  const snapshot = structuredClone(record);
  const output = recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});
  assert.equal(output["Caudal de aire de aspiración"], "29 l/s");
  assert.equal(output["Potencia eléctrica máxima del equipo"], "900 W");
  assert.equal(output["Capacidad del depósito"], "10 l");
  assert.equal(recoverReviewedModelTechnicalSpecs(record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Capacidad del depósito"], "10 l");
  assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === "Capacidad del depósito")?.scope, "model-document");
  assert.deepEqual(record, snapshot);
});

test("rechaza aspiradoras con variante, anclajes o magnitudes incompatibles", () => {
  const record = vacuumOffer();
  for (const invalid of [
    { ...record, url: record.url.replace("v-can-10", "v-can-12") },
    { ...record, longDescription: "La aspiradora TENNANT AP V-CAN-12 pesa 4,1 kg y emite 68 dBA." },
    { ...record, longDescription: record.longDescription?.replace("4,1 kg", "6,1 kg") ?? null },
    { ...record, longDescription: `${record.longDescription} Capacidad del depósito de 12 l.` },
    { ...record, condition: "Segunda mano" as const },
    { ...record, specs: { ...record.specs, Potencia: "700 W" } }
  ]) assert.equal(recoverReviewedModelTechnicalSpecs(invalid, invalid.specs ?? {}), invalid.specs);
  const existing = { ...record.specs, "Caudal de aire": "30 l/s" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, existing), existing);
});

test("recupera condiciones explícitas de manejo de volteadores sin atribuir opciones", () => {
  const record: ProductRecord = { ...source("Apilador", "Los brazos de agarre que sujetan la bobina no se pueden abrir por equivocación y éstas sólo pueden liberarse cuando se sitúan sobre el suelo o un palé."),
    title: "Volteador de bobinas MARCA MODELO10", shortDescription: "Volteador de bobinas MARCA MODELO10 nuevo",
    categoryName: "Volteadores", categoryKey: "volteadores", url: "https://online.gamrentals.com/es/volteadores/123456789-marca-modelo10" };
  const result = recover(record);
  assert.equal(result["Condición de liberación de bobina"], "Solo sobre el suelo o un palé");
  assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
  const drum = { ...record, title: "Volteador de bidones MARCA MODELO10", shortDescription: "Volteador de bidones MARCA MODELO10 nuevo",
    longDescription: "Estos agarres se adaptan al tamaño de los bidones sin necesidad de herramientas." };
  assert.equal(recover(drum)["Ajuste de agarres"], "Sin herramientas");
  const box = { ...record, title: "Volteador de cajas MARCA MODELO10", shortDescription: "Volteador de cajas MARCA MODELO10 nuevo",
    longDescription: "La función de inclinación se desactiva cuando el centro de rotación se encuentra a una altura del suelo superior a 1200 mm o inferior a 600 mm." };
  assert.equal(recover(box)["Bloqueo de inclinación por altura del centro de rotación"], "Por debajo de 600 mm o por encima de 1200 mm");
  const other: ProductRecord = { ...drum, providerId: "mercaeleva", categoryKey: "venta", reference: "CONTROL-02", url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
  assert.equal(recover(other)["Ajuste de agarres"], "Sin herramientas");
  for (const invalid of [
    { ...record, condition: "Segunda mano" as const }, { ...record, model: "MODELO20" },
    { ...record, shortDescription: "Volteador MARCA MODELO20 nuevo" },
    { ...record, longDescription: `${record.longDescription} Liberación en altura.` },
    { ...drum, longDescription: `Como opción, ${drum.longDescription}` },
    { ...box, longDescription: `${box.longDescription} Bloqueo opcional.` },
    { ...record, specs: { ...record.specs, "Condición de liberación de bobina": "Bloqueada" } }
  ]) assert.equal(recover(invalid), invalid.specs);
});

test("recupera mandos y seguridad de agarres declarados sin duplicar equipamiento", () => {
  const display = "Esta gama de volteadores: los equipos incluyen una pantalla de gran tamaño, táctil.";
  const record: ProductRecord = { ...source("Apilador", display),
    title: "Volteador MARCA MODELO10", shortDescription: "Volteador MARCA MODELO10 nuevo",
    categoryName: "Volteadores", categoryKey: "volteadores", url: "https://online.gamrentals.com/es/volteadores/123456789-marca-modelo10" };
  assert.equal(recover(record)["Interfaz de control"], "Pantalla táctil");
  const programmed = { ...record, longDescription: `${display} Gracias a ella se puede programar varias paradas, ángulo de giro, velocidad y volteo.` };
  const output = recover(programmed);
  assert.equal(output["Programación de volteo"], "Paradas, ángulo de giro y velocidad");
  assert.equal(recoverSourceHandlingConfiguration(programmed, programmed, output), output);
  const denied = { ...programmed, longDescription: `${display} Gracias a ella no se puede programar varias paradas, ángulo de giro, velocidad y volteo.` };
  assert.equal(recover(denied)["Programación de volteo"], undefined);
  const drum = { ...record, title: "Volteador de bidones MARCA MODELO10",
    longDescription: "Los agarres son extremadamente seguros, con una placa de bloqueo y cierre superior." };
  assert.equal(recover(drum)["Seguridad de agarres"], "Placa de bloqueo y cierre superior");
  for (const invalid of [
    { ...record, model: "MODELO20" }, { ...record, longDescription: `Como opción, los equipos incluyen una pantalla de gran tamaño, táctil.` },
    { ...record, longDescription: `${display} Pantalla no táctil.` },
    { ...record, specs: { ...record.specs, Pantalla: "Otro tipo" } },
    { ...drum, longDescription: `${drum.longDescription} Cierre opcional.` }
  ]) assert.equal(recover(invalid), invalid.specs);
});

test("recupera conducción peatonal de manutención con identidad y afirmación corroboradas", () => {
  const field = "Posición de conducción";
  for (const family of ["Apilador", "Transpaleta"] as const) {
    const noun = family === "Apilador" ? "apilador eléctrico" : "transpaleta eléctrica";
    const record = source(family, `MARCA MODELO10 es un equipo de manutención. El ${noun} a pie MARCA MODELO10 permite transportar cargas.`);
    const result = recover(record);
    assert.equal(result[field], "Operador a pie");
    assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], "Operador a pie");
    assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === field)?.sourceField, "longDescription");
    const other: ProductRecord = { ...record, providerId: "mercaeleva", categoryKey: "venta", reference: "CONTROL-02",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
    assert.equal(recover(other)[field], "Operador a pie");
    for (const invalid of [
      { ...record, longDescription: `Como opción, el ${noun} a pie MARCA MODELO10 permite transportar cargas.` },
      { ...record, longDescription: `No es un ${noun} a pie MARCA MODELO10.` },
      { ...record, longDescription: `${record.longDescription} También permite trabajar a bordo.` },
      { ...record, longDescription: `${record.longDescription} El MARCA MODELO20 tiene más potencia.` },
      { ...record, longDescription: `MARCA MODELO10 es un equipo. El ${noun} a pie pertenece a otro fabricante.` },
      { ...record, shortDescription: "MARCA MODELO20" },
      { ...record, specs: { ...record.specs, "Tipo de conductor": "Sentado" } }
    ]) assert.equal(recover(invalid), invalid.specs);
    assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  }
});

test("recupera corriente alterna en carretillas eléctricas sin inferir el motor de tracción", () => {
  const record: ProductRecord = { ...source("Apilador", "La carretilla elevadora eléctrica MARCA MODELO10 incorpora motores eléctricos de corriente alterna."),
    title: "Carretilla elevadora eléctrica MARCA MODELO10", categoryName: "Carretilla elevadora", specs: { Marca: "MARCA", Modelo: "MODELO10", Motorización: "Eléctrico" } };
  const general = recover(record);
  assert.equal(general["Tecnología del motor"], "Corriente alterna");
  assert.equal(general["Tecnología del motor de tracción"], undefined);
  assert.equal(recoverSourceHandlingConfiguration(record, record, general), general);
  const traction = { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 incorpora un motor de tracción AC." };
  assert.equal(recover(traction)["Tecnología del motor de tracción"], "Corriente alterna");
  assert.equal(recover(traction)["Tecnología del motor"], undefined);
  const other: ProductRecord = { ...traction, providerId: "mercaeleva", reference: "CONTROL-02", categoryKey: "venta",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
  assert.equal(recover(other)["Tecnología del motor de tracción"], "Corriente alterna");
  const prepared = prepareSourceProduct(traction);
  assert.equal(prepared.product.spec["Tecnología del motor de tracción"], "Corriente alterna");
  assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === "Tecnología del motor de tracción")?.sourceField, "longDescription");
  for (const invalid of [
    { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 puede equiparse con un motor AC opcional." },
    { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 incorpora un controlador de motor AC." },
    { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 incorpora motor AC. MARCA MODELO20 incorpora motor AC." },
    { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 tiene una variante con motor AC." },
    { ...record, longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 no tiene motor AC." },
    { ...record, longDescription: `${record.longDescription} Motor de corriente continua.` },
    { ...record, condition: "Segunda mano" as const },
    { ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico de corriente alterna" } },
    { ...record, specs: { ...record.specs, "Tecnología del motor de tracción": "Corriente continua" } }
  ]) assert.equal(recover(invalid), invalid.specs, invalid.longDescription ?? "");
  assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
});

test("recupera dirección eléctrica declarada en manutención sin inferir asistencia ni opciones", () => {
  const field = "Sistema de dirección";
  for (const family of ["Apilador", "Transpaleta"] as const) {
    const record = source(family, "El equipo MARCA MODELO10 incorpora un sistema de dirección eléctrica.");
    const result = recover(record);
    assert.equal(result[field], "Eléctrica");
    assert.equal(result["Dirección asistida"], undefined);
    assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], "Eléctrica");
    assert.equal(prepared.technicalProvenance?.entries.find((entry) => entry.field === field)?.sourceField, "longDescription");
    const other: ProductRecord = { ...record, providerId: "mercaeleva", reference: "CONTROL-02", categoryKey: "venta",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
    assert.equal(recover(other)[field], "Eléctrica");
    for (const invalid of [
      { ...record, longDescription: "MARCA MODELO10 puede equiparse con dirección eléctrica opcional." },
      { ...record, longDescription: "MARCA MODELO10 no tiene dirección eléctrica." },
      { ...record, longDescription: `${record.longDescription} La dirección hidráulica es de serie.` },
      { ...record, longDescription: `${record.longDescription} Motor diésel.`, specs: { ...record.specs, Batería: "24 V" } },
      { ...record, longDescription: `${record.longDescription} MARCA MODELO20 incorpora dirección eléctrica.` },
      { ...record, shortDescription: "MARCA MODELO20" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, specs: { ...record.specs, "Dirección asistida": true } }
    ]) assert.equal(recover(invalid)[field], undefined);
    assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  }
});

test("recupera el sistema de diagnóstico declarado sin inferir su tecnología", () => {
  const field = "Sistema de diagnóstico";
  for (const family of ["Apilador", "Transpaleta"] as const) {
    const record = source(family, "El equipo MARCA MODELO10 dispone de un sistema de diagnóstico integrado.");
    const snapshot = structuredClone(record);
    const result = recover(record);
    assert.equal(result[field], true);
    assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], true);
    const provenance = prepared.technicalProvenance?.entries.find((entry) => entry.field === field);
    assert.equal(provenance?.sourceField, "longDescription");
    assert.equal(provenance?.scope, "unit");
    assert.deepEqual(record, snapshot);
    const other: ProductRecord = { ...record, providerId: "mercaeleva", reference: "CONTROL-02", categoryKey: "venta",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
    assert.equal(recover(other)[field], true);
    for (const invalid of [
      { ...record, longDescription: "MARCA MODELO10 puede incorporar un sistema de diagnóstico." },
      { ...record, longDescription: "MARCA MODELO10 no tiene sistema de diagnóstico." },
      { ...record, longDescription: "MARCA MODELO10 utiliza un sistema de diagnóstico externo." },
      { ...record, longDescription: "MARCA MODELO10 dispone de un sistema de diagnóstico opcional." },
      { ...record, longDescription: "MARCA MODELO10 dispone de un sistema de diagnóstico desactivado." },
      { ...record, longDescription: `${record.longDescription} MARCA MODELO20 dispone de un sistema de diagnóstico.` },
      { ...record, longDescription: `${record.longDescription} Carece de sistema de diagnóstico.` },
      { ...record, longDescription: "MARCA MODELO10. Otros modelos incorporan un sistema de diagnóstico." },
      { ...record, shortDescription: "MARCA MODELO20" },
      { ...record, shortDescription: "MARCA MODELO10 sin sistema de diagnóstico" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, specs: { ...record.specs, [field]: false } },
      { ...record, specs: { ...record.specs, Autodiagnóstico: "Integrado" } }
    ]) assert.equal(recover(invalid), invalid.specs, invalid.longDescription ?? "");
    assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  }
});

test("recupera el asiento regulable declarado sin inferir suspensión ni configuración opcional", () => {
  const field = "Asiento regulable";
  for (const claim of ["Incorpora un asiento ajustable.", "Dispone de asiento regulable con suspensión."]) {
    const record: ProductRecord = { ...source("Apilador", `La carretilla MARCA MODELO10 es eléctrica. ${claim}`),
      title: "Carretilla elevadora eléctrica MARCA MODELO10", categoryName: "Carretilla elevadora" };
    const snapshot = structuredClone(record);
    const result = recover(record);
    assert.equal(result[field], true);
    assert.equal(result["Suspensión del asiento"], undefined);
    assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], true);
    const provenance = prepared.technicalProvenance?.entries.find((entry) => entry.field === field);
    assert.equal(provenance?.sourceField, "longDescription");
    assert.equal(provenance?.scope, "unit");
    assert.deepEqual(record, snapshot);
    const other: ProductRecord = { ...record, providerId: "mercaeleva", reference: "CONTROL-02", categoryKey: "venta",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
    assert.equal(recover(other)[field], true);
    for (const invalid of [
      { ...record, longDescription: "MARCA MODELO10 dispone de asiento regulable opcional." },
      { ...record, longDescription: "MARCA MODELO10 no dispone de asiento regulable." },
      { ...record, longDescription: `${record.longDescription} MARCA MODELO20 dispone de asiento regulable.` },
      { ...record, longDescription: `${record.longDescription} El asiento es fijo.` },
      { ...record, longDescription: "MARCA MODELO10. Otros modelos incorporan asiento regulable." },
      { ...record, longDescription: "MARCA MODELO10. La variante LWB incorpora asiento regulable." },
      { ...record, shortDescription: "MARCA MODELO20" },
      { ...record, condition: "Segunda mano" as const },
      { ...record, specs: { ...record.specs, "Tipo de asiento": "Fijo" } },
      { ...record, specs: { ...record.specs, [field]: false } }
    ]) assert.equal(recover(invalid), invalid.specs, invalid.longDescription ?? "");
    assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
  }
  assert.equal(recover(source("Apilador", "MARCA MODELO10 dispone de asiento regulable."))[field], undefined);
});
