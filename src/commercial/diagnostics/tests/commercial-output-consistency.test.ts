import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { analyzeCommercialOutputConsistency } from "../commercial-output-consistency.js";

const product = (reference: string): ImportCandidate => ({
  providerId: "gam", reference,
  sourceUrl: `https://online.gamrentals.com/es/cte/${reference}-cte-b-lift-18hv`,
  title: "Plataforma CTE B-LIFT 18HV de 2012 · Ref. 4650", categorySellID: 33,
  category: "Plataformas Elevadoras Sobre Camión de Segunda Mano", condition: "Segunda_Mano",
  price: null, description_title: "Plataforma CTE B-LIFT 18HV de 2012 · Ref. 4650",
  description: "Plataforma diésel con altura de 18 m", description_general: "Equipo revisado",
  image: null, images: [], spec: { Modelo: "B-LIFT 18HV" },
  attributes: [{ attributeID: 117, value: 2012 }]
});

const codes = (items: readonly ImportCandidate[]): readonly string[] =>
  analyzeCommercialOutputConsistency(items).findings.map(({ reason }) => reason);

test("audita coherencia comercial sin modificar entradas ni ejecutar proyecciones", () => {
  const first = product("4650");
  const snapshot = JSON.stringify(first);
  const report = analyzeCommercialOutputConsistency([first]);
  assert.deepEqual(report, { products: 1, findings: [], signals: [] });
  assert.equal(JSON.stringify(first), snapshot);
  assert.deepEqual(analyzeCommercialOutputConsistency([first]), report);
});

test("detecta una referencia falsa únicamente cuando el título la declara explícitamente", () => {
  const original = product("4650");
  assert.deepEqual(codes([{ ...original, title: "Plataforma CTE B-LIFT 18HV · Ref. 9999" }]),
    ["referencia-titulo-contradictoria"]);
  assert.deepEqual(codes([{ ...original, title: "Plataforma CTE B-LIFT 18HV" }]), []);
});

test("recupera la contradicción acreditada de variante CTE sin duplicar título y subtítulo", () => {
  const original = product("4650");
  const bad = { ...original, title: "Plataforma CTE B-LIFT 18HD de 2012 · Ref. 4650",
    description_title: "Plataforma CTE B-LIFT 18HD de 2012 · Ref. 4650" };
  assert.deepEqual(codes([bad]), ["modelo-variante-titulo-contradictorio"]);
  assert.deepEqual(codes([{ ...bad, title: original.title }]),
    ["modelo-variante-subtitulo-contradictorio"]);
  assert.deepEqual(codes([{ ...bad, spec: {} }]), []);
  assert.deepEqual(codes([{ ...bad, providerId: "gomariz" }]), []);
});

test("separa motorizaciones explícitamente contradictorias de equipos mixtos", () => {
  const original = product("4650");
  const electric = { ...original, title: "Plataforma eléctrica CTE B-LIFT 18HV de 2012 · Ref. 4650" };
  assert.deepEqual(codes([electric]), ["motorizacion-titulo-resumen-contradictoria"]);
  assert.deepEqual(codes([{ ...electric, description: "Equipo híbrido eléctrico diésel" }]), []);
  assert.deepEqual(codes([{ ...electric, description: "Equipo sin motor indicado" }]), []);
});

test("contrasta años explícitos sin confundir 2000 kg con el año de fabricación", () => {
  const original = product("4650");
  assert.deepEqual(codes([{ ...original, title: "Plataforma CTE B-LIFT 18HV de 2013 · Ref. 4650" }]),
    ["ano-titulo-atributo-contradictorio"]);
  assert.deepEqual(codes([{ ...original, title: "Carretilla CTE B-LIFT 18HV de 2000 kg · Ref. 4650" }]), []);
  assert.deepEqual(codes([{ ...original, attributes: [] }]), []);
});

test("audita años únicamente con una asignación válida y no los infiere de otros atributos", () => {
  const original = { ...product("4650"), title: "Plataforma CTE B-LIFT 18HV de 2013 · Ref. 4650" };
  for (const attributes of [
    [],
    [{ attributeID: 117, value: "2012" }],
    [{ attributeID: 117, value: 1899 }],
    [{ attributeID: 117, value: 2100 }],
    [{ attributeID: 117, value: 2012.5 }],
    [{ attributeID: 117, value: 2012 }, { attributeID: 117, value: 2012 }],
    [{ attributeID: 50, value: 2012 }]
  ]) {
    assert.deepEqual(codes([{ ...original, attributes }]), []);
  }
  assert.deepEqual(codes([{ ...original, attributes: [{ attributeID: 50, value: 2012 },
    { attributeID: 117, value: 2012 }] }]), ["ano-titulo-atributo-contradictorio"]);
  for (const year of [1900, 2099]) {
    assert.deepEqual(codes([{ ...original, attributes: [{ attributeID: 117, value: year }] }]),
      ["ano-titulo-atributo-contradictorio"]);
  }
});

test("agrupa incidencias por causa, conserva las referencias y limita ejemplos", () => {
  const original = product("4650");
  const bad = Array.from({ length: 7 }, (_, index) => ({ ...original,
    reference: String(index), sourceUrl: `${original.sourceUrl}/${index}`,
    title: `Plataforma CTE B-LIFT 18HD · Ref. ${index}`,
    description_title: `Plataforma CTE B-LIFT 18HD · Ref. ${index}` }));
  const report = analyzeCommercialOutputConsistency(bad);
  assert.equal(report.findings.length, 7);
  assert.deepEqual(report.findings.map((item) => item.reference), ["0", "1", "2", "3", "4", "5", "6"]);
  assert.equal(report.signals[0]?.affected, 7);
  assert.equal(report.signals[0]?.examples.length, 5);
});
