import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourcedFamilyContext } from "../domain/editorial-sourced-family-context.js";
import { controlledGomarizForklift, controlledGomarizPlatform } from "./editorial-contract-records.js";

const indoor = (): ProductRecord => ({
  ...controlledGomarizForklift(),
  longDescription: "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios. Gracias a propulsión eléctrica no contaminan el aire con gases de escape y trabajan muy silencioso.",
  specs: { Capacidad: "1800 kg", Motor: "Eléctrico" }
});

const generator = (): ProductRecord => ({
  ...controlledGomarizForklift(),
  title: "PRAMAC GPW45P",
  brand: "PRAMAC",
  model: "GPW45P",
  longDescription: "Contamos con grupos electrógenos desde 8 a 200 kvas, monofásicos y trifásicos insonorizados perfectos para proveer de electricidad su domicilio, trabajo o negocio donde no hay suministro regular de compañía de una manera eficiente.",
  specs: { Potencia: "45 kVA", Motor: "Diésel" }
});

const electricGeneral = "La ficha técnica de carretilla elevadora eléctrica MARCA MODELO10 indica capacidad de carga de 1.800 kg.";
const generatorGeneral = "La ficha técnica de grupo electrógeno diésel PRAMAC GPW45P indica potencia aparente de 45 kVA.";

test("aprovecha el contexto de uso eléctrico interior solo cuando el motor está documentado", () => {
  const source = indoor();
  const before = JSON.stringify(source);
  const result = resolveSourcedFamilyContext(source, source, electricGeneral, true) ?? "";
  assert.match(result, /almacenamiento y el trabajo en el interior de edificios/u);
  assert.match(result, /ámbitos de uso de esta clase/u);
  assert.doesNotMatch(result, /equipa|instalado|garantiza/iu);
  assert.equal(JSON.stringify(source), before);
  assert.equal(resolveSourcedFamilyContext(source, source, `${electricGeneral} Recomendada para el almacenaje.`, true), null);
});

test("recupera la aplicación declarada de generación sin prometer fases ni insonorización", () => {
  const source = generator();
  const result = resolveSourcedFamilyContext(source, source, generatorGeneral, true) ?? "";
  assert.match(result, /lugares sin abastecimiento regular de la red/u);
  assert.match(result, /fases e insonorización debe verificarse/u);
  assert.doesNotMatch(result, /trifásico instalado|insonorizado de serie/u);
});

test("las aplicaciones no cruzan unidades ni se infieren de potencia, motor o frases incompletas", () => {
  for (const source of [indoor(), generator()]) {
    const general = source.brand === "PRAMAC" ? generatorGeneral : electricGeneral;
    const changed: readonly ProductRecord[] = [
      { ...source, reference: "CONTROL-99" },
      { ...source, providerId: "gam" },
      { ...source, model: "OTRO", title: `${source.brand} OTRO` },
      { ...source, condition: "Nuevo" },
      { ...source, specs: { ...source.specs, Motor: "Gasolina", Potencia: "100 kVA" } }
    ];
    for (const candidate of changed) {
      assert.equal(resolveSourcedFamilyContext(source, candidate, general, source.providerId === candidate.providerId), null);
    }
    assert.equal(resolveSourcedFamilyContext({ ...source, longDescription: null }, source, general, true), null);
  }
  const power = generator();
  assert.equal(resolveSourcedFamilyContext({ ...power, specs: { Potencia: "45" } },
    { ...power, specs: { Potencia: "45" } }, generatorGeneral, true), null);
  const electric = indoor();
  assert.equal(resolveSourcedFamilyContext({ ...electric, specs: { Capacidad: "1800 kg", Motor: "Diésel" } },
    { ...electric, specs: { Capacidad: "1800 kg", Motor: "Diésel" } }, electricGeneral, true), null);
});

const familySources = [
  {
    title: "Plataforma de tijera eléctrica MARCA MODELO10",
    general: "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica 10 m de altura de trabajo.",
    description: "Las Tijeras Eléctricas están diseñadas para trabajar en interior. Se caracterizan por llevar ruedas anti-huellas y plataforma extensible.",
    expected: /trabajos de interior y menciona ruedas antihuellas/u
  },
  {
    title: "Plataforma de tijera diésel MARCA MODELO10",
    general: "La ficha técnica de plataforma de tijera diésel MARCA MODELO10 indica 10 m de altura de trabajo.",
    description: "Las Tijeras Diésel tienen una plataforma extensible y estabilizadores para trabajar en superficies con pendiente.",
    expected: /plataforma extensible y estabilizadores/u
  },
  {
    title: "Plataforma articulada diésel MARCA MODELO10",
    general: "La ficha técnica de plataforma articulada diésel MARCA MODELO10 indica 10 m de altura de trabajo.",
    description: "Las Articuladas Diésel son útiles para trabajos en exterior y pueden superar terrenos irregulares con pendientes.",
    expected: /trabajos exteriores y desplazamientos/u
  },
  {
    title: "Manipulador telescópico MARCA MODELO10",
    general: "La ficha técnica de manipulador telescópico MARCA MODELO10 indica 10 m de altura de trabajo.",
    description: "Manipuladores. Combina las características de una carretilla elevadora con las de un brazo telescópico.",
    expected: /elevación de materiales mediante brazo telescópico/u
  },
  {
    title: "Plataforma de mástil vertical MARCA MODELO10",
    general: "La ficha técnica de equipo de mástil vertical MARCA MODELO10 indica altura de trabajo de 10 m.",
    description: "Los Mástiles Verticales se utilizan en espacios reducidos y son perfectos para realizar trabajos de interior.",
    expected: /acceso en interiores y espacios reducidos/u
  }
] as const;

test("recupera el contexto declarado por familias sin atribuir accesorios instalados", () => {
  for (const example of familySources) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), title: example.title, longDescription: example.description
    };
    const snapshot = JSON.stringify(source);
    const result = resolveSourcedFamilyContext(source, source, example.general, true) ?? "";
    assert.match(result, example.expected);
    assert.match(result, /(?:(?:debe|deben) comprobarse|deben contrastarse|requieren comprobación|requieren comprobar)/u);
    assert.doesNotMatch(result, /(?:incorpora|incluye|de serie)/iu);
    assert.equal(JSON.stringify(source), snapshot);
    assert.equal(resolveSourcedFamilyContext(source, source, `${example.general} ${result}`, true), null);
  }
});

test("las referencias y variantes distintas no reciben contexto de otra ficha", () => {
  for (const example of familySources) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), title: example.title, longDescription: example.description
    };
    for (const candidate of [
      { ...source, providerId: "gam" },
      { ...source, reference: "CONTROL-OTRA" },
      { ...source, model: "MODELO11", title: example.title.replace("MODELO10", "MODELO11") },
      { ...source, url: "https://www.gomarizrent.com/producto/otra/" },
      { ...source, condition: "Nuevo" as const }
    ]) {
      assert.equal(resolveSourcedFamilyContext(source, candidate, example.general,
        source.providerId === candidate.providerId), null);
    }
    assert.equal(resolveSourcedFamilyContext({ ...source, shortDescription: "Descripción firmada." },
      { ...source, shortDescription: "Descripción firmada." }, example.general, true), null);
    assert.equal(resolveSourcedFamilyContext(source, source, example.general, false), null);
    assert.equal(resolveSourcedFamilyContext({ ...source, title: "Carretilla elevadora MARCA MODELO10" },
      { ...source, title: "Carretilla elevadora MARCA MODELO10" }, example.general, true), null);
  }
});

test("no se recuperan características que el proveedor considera opcionales", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior. Las ruedas antihuellas y la plataforma extensible son opcionales según la versión."
  };
  const general = familySources[0].general;
  assert.equal(resolveSourcedFamilyContext(source, source, general, true), null);
  assert.equal(resolveSourcedFamilyContext({ ...source, longDescription:
    "Las Tijeras Eléctricas no están diseñadas para trabajar en interior. Se caracterizan por ruedas antihuellas y plataforma extensible." },
  { ...source, longDescription:
    "Las Tijeras Eléctricas no están diseñadas para trabajar en interior. Se caracterizan por ruedas antihuellas y plataforma extensible." }, general, true), null);
});
