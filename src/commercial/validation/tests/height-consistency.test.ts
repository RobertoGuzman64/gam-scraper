import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { assessCommercialHeight } from "../height-consistency.js";

const product = (
  title: string, description: string, spec: ImportCandidate["spec"], description_general: string | null = null
): Pick<ImportCandidate, "title" | "description" | "description_general" | "spec"> => ({
  title, description, spec, description_general
});

test("normaliza el título únicamente cuando la altura de trabajo explícita coincide con el resumen", () => {
  const input = product("Plataforma sobre camión 20 m CTE ZED 25 HV FIB",
    "Plataforma elevadora de 25 metros de altura. Capacidad 300 kg",
    { "Altura de trabajo (m)": "25 m" });
  const before = JSON.stringify(input);
  const assessed = assessCommercialHeight(input);
  assert.equal(assessed.status, "title-normalized");
  assert.equal(assessed.title, "Plataforma sobre camión 25 m CTE ZED 25 HV FIB");
  assert.equal(assessed.description, input.description);
  assert.equal(JSON.stringify(input), before);
  assert.equal(assessCommercialHeight({ ...input, title: assessed.title }).status, "compatible");
});

test("repara una altura manifiestamente imposible con milímetros acreditados por el texto técnico", () => {
  const input = product("Plataforma recogepedidos 5,3 m BRAVI Sprint",
    "Venta de plataforma recogepedidos de 20 metros de altura",
    { "Altura de elevación (mm)": "5350 mm" }, "Altura publicada de 5.350 mm y plataforma a 3,35 m");
  const checked = assessCommercialHeight(input);
  assert.equal(checked.status, "summary-normalized");
  assert.equal(checked.description, "Venta de plataforma recogepedidos de 5,35 metros de altura");
  assert.equal(assessCommercialHeight({ ...input, description: checked.description }).status, "compatible");
  assert.equal(assessCommercialHeight({ ...input, description_general: "Sin altura comprobable" }).status, "unresolved");
});

test("mantiene para revisión diferencias entre plataforma y trabajo sin atribuir una altura inventada", () => {
  const input = product("Plataforma tijera eléctrica 12 m GENIE GS-3246",
    "Venta de tijera eléctrica de 10 metros de altura", { "Altura de elevación (m)": "12 metros" });
  const result = assessCommercialHeight(input);
  assert.equal(result.status, "possible-distinct-heights");
  assert.equal(result.title, input.title);
  assert.equal(result.description, input.description);
});

test("conserva un desacuerdo grande cuando la especificación no acredita altura de trabajo", () => {
  const input = product("Plataforma telescópica 32 m XCMG XGS32ACK II",
    "Plataforma telescópica de 40 metros de altura", { "Altura de elevación (m)": "40 metros" });
  assert.equal(assessCommercialHeight(input).status, "unresolved");
});

test("no transforma redondeos tolerables, dimensiones de transporte ni resúmenes con varias alturas", () => {
  const rounded = product("Plataforma 18 m CTE B-LIFT 18 AUTO",
    "17,7 metros de altura de elevación", { "Altura de elevación (m)": "17,7 metros" });
  assert.equal(assessCommercialHeight(rounded).status, "compatible");
  const ambiguous = product("Plataforma de 14 m", "Plataforma de 16 m de trabajo y 14 m de cesta",
    { "Altura de trabajo (m)": "16 m" });
  assert.equal(assessCommercialHeight(ambiguous).status, "not-comparable");
  const geometry = product("Plataforma de 14 m", "Plataforma de 16 m de altura", { "Altura": "16 m" });
  assert.equal(assessCommercialHeight(geometry).status, "unresolved");
});


test("acredita altura de trabajo y plataforma de GS-3246 según manual Genie 1000060, página 36", () => {
  const baseline = product("Plataforma tijera eléctrica 12 m GENIE GS-3246",
    "GENIE GS-3246 Segunda Mano. Venta de plataforma de tijera eléctrica de 10 metros de altura de ocasión. Capacidad 318 kg",
    { Marca: "GENIE", Modelo: "GS-3246", "Altura de elevación (m)": "12 metros" });
  const original = JSON.stringify(baseline);
  const result = assessCommercialHeight(baseline);
  assert.equal(result.status, "compatible");
  assert.equal(result.titleMetres, 12);
  assert.equal(result.summaryMetres, 10);
  assert.equal(result.technicalMetres, 12);
  assert.equal(result.title, baseline.title);
  assert.equal(result.description,
    "GENIE GS-3246 Segunda Mano. Venta de plataforma de tijera eléctrica de 10 metros de altura de plataforma de ocasión. Capacidad 318 kg");
  assert.equal(JSON.stringify(baseline), original);
  assert.deepEqual(assessCommercialHeight({ ...baseline, description: result.description }), result);
});

test("no acredita pares de altura sin identidad, valores o significado inequívocos", () => {
  const base = product("Plataforma tijera eléctrica 12 m GENIE GS-3246",
    "Venta de plataforma de tijera eléctrica de 10 metros de altura",
    { Marca: "GENIE", Modelo: "GS-3246", "Altura de elevación (m)": "12 metros" });
  const negatives = [
    { ...base, spec: { ...base.spec, Marca: "OTRA" } },
    { ...base, spec: { ...base.spec, Modelo: "GS-2646" } },
    { ...base, title: "Plataforma tijera eléctrica 12 m GENIE GS-2646" },
    { ...base, title: "Plataforma tijera eléctrica 13 m GENIE GS-3246" },
    { ...base, description: "Venta de plataforma de tijera eléctrica de 9 metros de altura" },
    { ...base, description: "Venta de plataforma de tijera eléctrica de 10 metros de altura de trabajo" },
    { ...base, spec: { ...base.spec, "Altura de elevación (m)": "10 metros" } },
    { ...base, spec: { ...base.spec, "Altura de elevación (m)": "12 metros", "Altura de trabajo (m)": "12 metros" } },
    { ...base, description: "Venta de plataforma de tijera eléctrica de 10 metros de altura y de 12 metros de trabajo" }
  ];
  for (const candidate of negatives) {
    const assessment = assessCommercialHeight(candidate);
    assert.notEqual(assessment.status, "compatible", JSON.stringify(candidate));
    assert.equal(assessment.description, candidate.description);
  }
});
