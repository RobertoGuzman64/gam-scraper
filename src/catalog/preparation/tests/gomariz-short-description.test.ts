import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveGomarizShortDescription } from "../mapping/providers/gomariz/short-description.js";

const record = (family: string, specs: SpecsMap, title = "LGMG S1413EII"): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/${family}/lgmg-s1413eii/`,
  title, reference: "TE1620", brand: "LGMG", model: "S1413EII", year: "2024",
  shortDescription: null, longDescription: "Información del fabricante",
  price: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});

const specs: SpecsMap = {
  "Altura de trabajo": "15.8 m", "Altura plataforma": "13.8 m", Capacidad: "320 kg", Motor: "Eléctrico"
};

test("Gomariz: redacta solo medidas verificables para las tres familias acreditadas", () => {
  assert.equal(resolveGomarizShortDescription(record("elevador-tijera", specs)),
    "Plataforma de tijera eléctrica LGMG S1413EII, año 2024. Altura de trabajo de 15,8 m y capacidad de 320 kg.");
  const articulada: ProductRecord = {
    ...record("brazo-articulado", {
      "Altura de trabajo": "27.74 m", "Altura plataforma": "25.91 m",
      "Alcance lateral": "17.07 m", Capacidad: "227 kg", Motor: "Diésel"
    }), title: "SKYJACK SJ85AJ", brand: "Skyjack", model: "SJ85AJ", year: "2018"
  };
  assert.equal(resolveGomarizShortDescription(articulada),
    "Plataforma articulada diésel SKYJACK SJ85AJ, año 2018. Altura de trabajo de 27,74 m, alcance lateral de 17,07 m y capacidad de 227 kg.");
  const oruga: ProductRecord = {
    ...record("oruga", {
      "Altura de trabajo": "15 m", "Altura plataforma": "13 m",
      "Alcance lateral": "7 m", Capacidad: "225 kg", Motor: "Eléctrico, Gasolina"
    }), title: "SOCAGE 15S", brand: "Socage", model: "15S", year: "2023"
  };
  assert.equal(resolveGomarizShortDescription(oruga),
    "Plataforma sobre orugas SOCAGE 15S, año 2023. Altura de trabajo de 15 m, alcance lateral de 7 m y capacidad de 225 kg.");
});

test("Gomariz: no sobrescribe un texto editorial existente ni modifica el registro", () => {
  const original = record("elevador-tijera", specs);
  const existing = { ...original, shortDescription: "Texto original validado" };
  assert.equal(resolveGomarizShortDescription(existing), null);
  assert.equal(resolveGomarizShortDescription(original)?.includes("320 kg"), true);
  assert.equal(original.shortDescription, null);
  assert.equal(original.specs?.["Altura de trabajo"], "15.8 m");
});

test("Gomariz: conserva el hueco si falta evidencia o existe contradicción técnica", () => {
  const source = record("elevador-tijera", specs);
  assert.equal(resolveGomarizShortDescription({ ...source, specs: { ...specs, "Altura plataforma": "14.3 m", "Altura de trabajo": "6.3 m" } }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, specs: { ...specs, Capacidad: "320 litros" } }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, specs: { ...specs, "Altura de trabajo": ["15.8 m", "17 m"] } }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, specs: { ...specs, Motor: "Eléctrico, Diésel" } }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, title: "LGMG S1413EII diésel" }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, year: null }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, model: "S1234" }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, url: "https://example.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/maquina/" }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, providerId: "gam" }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, categoryKey: "alquiler" }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, url: source.url.replace("elevador-tijera", "brazo-telescopico") }), null);
  assert.equal(resolveGomarizShortDescription({ ...source, url: source.url.replace("elevador-tijera", "brazo-articulado") }), null);
});

test("Gomariz: no genera una corta que contradiga la motorización de la descripción general", () => {
  const electric = record("brazo-articulado", { ...specs, "Alcance lateral": "7.81 m" });
  assert.equal(resolveGomarizShortDescription({
    ...electric, longDescription: "Las Articuladas Diésel son máquinas para exterior."
  }), null);
  const diesel: ProductRecord = { ...electric, specs: { ...electric.specs, Motor: "Diésel" } };
  assert.equal(resolveGomarizShortDescription({
    ...diesel, longDescription: "Las Articuladas Eléctricas son maniobrables."
  }), null);
  assert.notEqual(resolveGomarizShortDescription({
    ...electric, longDescription: "Las plataformas articuladas permiten acceder a distintas alturas."
  }), null);
});

const additionalRecord = (
  branch: string, family: string, fields: Partial<ProductRecord>
): ProductRecord => ({
  ...record("elevador-tijera", {}),
  url: `https://www.gomarizrent.com/venta/${branch}/${family}/producto/`,
  longDescription: "Descripción de la familia de maquinaria",
  ...fields
});

test("Gomariz: deriva cortas de otras familias con unidades y campos de su ficha", () => {
  const manipulator = additionalRecord("manipulacion-de-materiales", "manipulador-telescopico", {
    title: "JCB 540-140", brand: "Jcb", model: "540-140", year: "2018",
    specs: { "Altura de trabajo": "13.8 m", "Alcance lateral": "9.25 M", Capacidad: "4000 kg", Motor: "Diésel" }
  });
  assert.equal(resolveGomarizShortDescription(manipulator),
    "Manipulador telescópico JCB 540-140, año 2018. Altura de trabajo de 13,8 m, alcance lateral de 9,25 m y capacidad de 4000 kg.");

  const generator = additionalRecord("energia-electrica-e-iluminacion", "generador", {
    title: "PRAMAC GPW45P", brand: "Pramac", model: "GPW45P", year: "2025",
    specs: { Potencia: "45 kva", Motor: "Diésel" }
  });
  assert.match(resolveGomarizShortDescription(generator) ?? "", /Potencia aparente indicada de 45 kVA/);

  const tower = additionalRecord("energia-electrica-e-iluminacion", "torre-de-luz", {
    title: "Generac EVE 9", brand: "Generac", model: "EVE 9", year: null,
    specs: { Potencia: "4x400 W" }
  });
  assert.match(resolveGomarizShortDescription(tower) ?? "", /4 focos de 400 W/);

  const mast = additionalRecord("elevacion-y-trabajos-en-altura", "elevador-mastil-vertical", {
    title: "GENIE SLA15", brand: "Genie", model: "SLA15", year: null,
    specs: { "Altura de trabajo": "4.50 m", Capacidad: "363 kg" }
  });
  assert.match(resolveGomarizShortDescription(mast) ?? "", /4,50 m y capacidad de 363 kg/);
  assert.doesNotMatch(resolveGomarizShortDescription(mast) ?? "", /el[eé]ctric/i);

  const forklift = additionalRecord("manipulacion-de-materiales", "carretilla-industrial", {
    title: "HELI CPD 35", brand: "HELI", model: "CPD 35", year: "2024",
    specs: { Capacidad: "3500 kg", Motor: "Eléctrico" }
  });
  assert.match(resolveGomarizShortDescription(forklift) ?? "", /Carretilla industrial eléctrica.*3500 kg/);

  const truck = additionalRecord("camion", "camion-porta-maquinaria", {
    title: "Scania P220", brand: "Scania", model: "P220", year: "2001",
    specs: { Longitud: "7.53 M", Peso: "9050 kg" }
  });
  assert.match(resolveGomarizShortDescription(truck) ?? "", /Longitud de 7,53 m y peso indicado de 9050 kg/);
});

test("Gomariz: deja ausencias ante información insuficiente, contradicción o procedencia ajena", () => {
  const manipulator = additionalRecord("manipulacion-de-materiales", "manipulador-telescopico", {
    title: "JCB 540-140", brand: "Jcb", model: "540-140", year: "2018",
    specs: { "Altura de trabajo": "13.8 m", "Alcance lateral": "9.25 M", Capacidad: "4000 kg", Motor: "Diésel" }
  });
  assert.equal(resolveGomarizShortDescription({ ...manipulator, longDescription: "Manipulador eléctrico" }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, specs: { ...manipulator.specs, Capacidad: "4000 l" } }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, providerId: "gam" }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, categoryKey: "alquiler" }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, url: manipulator.url.replace("gomarizrent.com", "example.com") }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, title: "OTRO MODELO" }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, year: "204x" }), null);
  assert.equal(resolveGomarizShortDescription({ ...manipulator, shortDescription: "Texto acreditado" }), null);
  const generator = additionalRecord("energia-electrica-e-iluminacion", "generador", {
    title: "PRAMAC GPW45P", brand: "Pramac", model: "GPW45P", year: "2025",
    specs: { Potencia: "45 kW" }
  });
  assert.equal(resolveGomarizShortDescription(generator), null);
  assert.equal(resolveGomarizShortDescription({ ...generator, specs: { Potencia: "45 kVA" },
    longDescription: "Las torres de iluminación son regulables." }), null);
  assert.equal(manipulator.shortDescription, null);
});
