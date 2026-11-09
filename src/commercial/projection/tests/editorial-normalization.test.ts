import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCommercialGeneral, normalizeCommercialSummary, normalizeCommercialTitle } from "../editorial-normalization.js";

const title = (value: string, model: string | null = null, provider = "gam"): string | null =>
  normalizeCommercialTitle(value, provider, model);
const short = (value: string | null, model: string | null = null): string | null =>
  normalizeCommercialSummary(value, model);

test("separa magnitudes y normaliza unidades sin cambiar las cifras acreditadas", () => {
  assert.equal(title("Plataforma articulada 16M GENIE Z45/25J", "Z45/25J"),
    "Plataforma articulada 16 m GENIE Z45/25J");
  assert.equal(title("Carretilla 2500Kg HYSTER H2.5XT", "H2.5XT"),
    "Carretilla 2500 kg HYSTER H2.5XT");
  assert.equal(title("Carretilla GLP 1.600 KG HYSTER 3.2", "3.2"),
    "Carretilla GLP 1.600 kg HYSTER 3.2");
  assert.equal(title("Módulo de 6m x 2,35m", null, "mercaeleva"), "Módulo de 6 m x 2,35 m");
});

test("los códigos de modelo y los identificadores técnicos quedan intactos", () => {
  assert.equal(title("Plataforma GENIE Z45/25M 16M", "Z45/25M"), "Plataforma GENIE Z45/25M 16 m");
  assert.equal(title("Plataforma modelo 16M", "16M"), "Plataforma modelo 16M");
  assert.equal(title("Modelo 16M-XL para elevación", "16M-XL"), "Modelo 16M-XL para elevación");
  assert.equal(title("Referencia AB16M altura 16M", "AB16M"), "Referencia AB16M altura 16 m");
  assert.equal(title("Equipo 15 MT", null), "Equipo 15 MT");
});

test("normaliza MT como metros solo si el contexto expresa altura o elevación", () => {
  assert.equal(title("LGMG A14JE PLATAFORMA ARTICULADA ELECTRICA 15 MT", "A14JE", "mercaeleva"),
    "LGMG A14JE Plataforma articulada eléctrica 15 m");
  assert.equal(short("PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG A14JE", "A14JE"),
    "Plataforma articulada eléctrica altura de trabajo 16 m LGMG A14JE");
  assert.equal(short("CARGA 20 MT EN TRANSPORTE"), "CARGA 20 MT EN TRANSPORTE");
});

test("mantiene marcas, modelos y siglas mientras normaliza los términos descriptivos", () => {
  assert.equal(title("PLATAFORMA SOBRE CAMIÓN TELESCÓPICO 18M CTE B-LIFT 18 AUTO", "B-LIFT 18 AUTO"),
    "Plataforma sobre camión telescópico 18 m CTE B-LIFT 18 AUTO");
  assert.equal(title("MODULO CASETA DIAFANA CON AIRE 6m x 2,35m", null, "mercaeleva"),
    "Módulo caseta diáfana con aire 6 m x 2,35 m");
  assert.equal(title("HELI CPD 35", "CPD 35", "gomariz"), "HELI CPD 35");
  assert.equal(short("CARRETILLA ELEVADORA DIESEL 1800 KG TOYOTA 02-7FD18", "02-7FD18"),
    "Carretilla elevadora diésel 1800 kg TOYOTA 02-7FD18");
});

test("retira solo los marcadores promocionales de GAM sin borrar datos", () => {
  const input = "➨ GENIE Z45/25 de ocasión ➨ Venta de plataforma articulada diésel de 16 metros de altura ⭐Capacidad de la cesta 227 kg";
  const output = "GENIE Z45/25 de ocasión. Venta de plataforma articulada diésel de 16 metros de altura. Capacidad de la cesta 227 kg";
  assert.equal(short(input, "Z45/25"), output);
  assert.equal(short(output, "Z45/25"), output);
});

test("conserva descripciones editoriales mixtas, vacíos y ausencia de datos", () => {
  const source = "Plataforma articulada Genie Z45/25J de segunda mano, con elevación de 16 m y cesta de 230 kg.";
  assert.equal(short(source, "Z45/25J"), source);
  assert.equal(short(null), null);
  assert.equal(title("  "), null);
  assert.equal(short(""), "");
});

test("respeta la limpieza anterior de Compra y del vendedor, y es idempotente", () => {
  const before = "  Compra Compra PLATAFORMA ARTICULADA DIÉSEL 20M HAULOTTE HA20 RTJ | GAM Online  ";
  const output = "Plataforma articulada diésel 20 m HAULOTTE HA20 RTJ";
  assert.equal(title(before, "HA20 RTJ"), output);
  assert.equal(title(output, "HA20 RTJ"), output);
});

test("normaliza milímetros separados del número y conserva códigos de modelo", () => {
  assert.equal(short("Altura de trabajo 6.000mm TOYOTA 6FBRE14", "6FBRE14"),
    "Altura de trabajo 6.000 mm TOYOTA 6FBRE14");
  assert.equal(short("ALTURA ELEVACION 4.700MM TOYOTA 7FBEF15", "7FBEF15"),
    "ALTURA ELEVACION 4.700 mm TOYOTA 7FBEF15");
  assert.equal(short("Modelo AB200mm con elevación 4.500mm", "AB200mm"),
    "Modelo AB200mm con elevación 4.500 mm");
  assert.equal(short("Altura de trabajo 6.000 mm TOYOTA 6FBRE14", "6FBRE14"),
    "Altura de trabajo 6.000 mm TOYOTA 6FBRE14");
});

test("retira descriptores repetidos de mástil y no toca denominaciones de modelo", () => {
  const original = "Carretilla eléctrica 2000 kg tríplex tríplex NISSAN Q02L20CU Altura 6.000mm";
  const normalized = "Carretilla eléctrica 2000 kg tríplex NISSAN Q02L20CU Altura 6.000 mm";
  assert.equal(short(original, "Q02L20CU"), normalized);
  assert.equal(short(normalized, "Q02L20CU"), normalized);
  assert.equal(short("Modelo RANGE ROVER ROVER SPORT"), "Modelo RANGE ROVER ROVER SPORT");
});

test("elimina únicamente el aviso promocional acreditado de GAM", () => {
  const source = "Venta de carretilla diésel Hyster H2.0FT en GAM Online. Somos distribuidores oficiales de Hyster en España.";
  const clean = "Venta de carretilla diésel Hyster H2.0FT.";
  assert.equal(normalizeCommercialSummary(source, "H2.0FT", "gam"), clean);
  assert.equal(normalizeCommercialSummary(clean, "H2.0FT", "gam"), clean);
  assert.equal(normalizeCommercialSummary(source, "H2.0FT", "gomariz"), source);
});

test("normaliza unidades de descripción general sin reescribir la evidencia del modelo", () => {
  const original = "Equipo PRAMAC GSW1270M de 20M de altura. Ficha 2.449mm.\n\nPotencia 2000KG. ";
  const normalized = "Equipo PRAMAC GSW1270M de 20 m de altura. Ficha 2.449 mm.\n\nPotencia 2000 kg.";
  assert.equal(normalizeCommercialGeneral(original, "GSW1270M"), normalized);
  assert.equal(normalizeCommercialGeneral(normalized, "GSW1270M"), normalized);
  assert.equal(normalizeCommercialGeneral(null, null), null);
});

test("normaliza un descriptor completamente en mayúsculas sin alterar la marca o el modelo", () => {
  assert.equal(title("COMPACTADOR RESIDUOS MOVIL DIESEL PACKMAT PK402", "PK402"),
    "Compactador residuos móvil diésel PACKMAT PK402");
});
