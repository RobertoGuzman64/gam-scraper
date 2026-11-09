import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCommercialSummary, normalizeCommercialTitle } from "../editorial-normalization.js";

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
