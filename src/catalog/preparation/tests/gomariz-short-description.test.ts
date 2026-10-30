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
