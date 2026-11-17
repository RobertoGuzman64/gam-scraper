import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../../commercial/legacy-export/contracts.js";
import { analyzeTechnicalDensity } from "../../../../../catalog/diagnostics/technical-density.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../evidence/documented-platform-technical-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { readMercaelevaSource } from "../../../../../testing/builders/mercaeleva-source-fixture.js";

const source = await readMercaelevaSource();
const referencesByModel = {
  "1930 ES": ["M032-4313", "M352-1310", "M373-1461", "M674-6716", "M726-9929", "M750-3069", "M775-6522", "M795-6850", "M829-6181", "M931-4108"],
  "1930ES": ["M840-8278", "M995-8408"],
  "HA12IP": ["M212-3717", "M237-2621", "M448-2901", "M577-4076", "M696-2742", "M869-4472", "M988-6161"],
  "170AETJL": ["M051-3155", "M106-1389", "M310-8756", "M391-7199", "M417-9896", "M547-8652", "M711-4051", "M873-8524"],
  "450 AJ": ["M050-6081", "M081-0775", "M091-9536", "M243-5988", "M272-6304", "M380-3644", "M571-2568", "M922-8615", "M976-1043", "M998-5889"],
  "COMPACT-10N": ["M034-3284", "M308-4683", "M345-0184", "M825-8158", "M953-7579", "M987-2983"],
  "HA15IP": ["M158-2594", "M274-8210", "M709-8662", "M819-0909", "M911-4028", "M921-0545"],
  "HA16RTJ": ["M299-2045", "M369-6811", "M574-8807", "M620-2142"],
  "Optimum 8": ["M131-5855", "M281-3486", "M229-0241", "M539-6438", "M687-7610", "M517-8202"],
  "Compact 12": ["M778-4251", "M201-8398", "M690-8650", "M715-6049"],
  "COMPACT-14": ["M028-0455", "M621-1566", "M594-9948"],
  "STAR-10": ["M095-5362", "M171-6370", "M144-5512"],
  "S0808EII": ["M309-0364", "M040-2258"],
  "AS1212E": ["M563-8693", "M008-1528", "M000-3684"],
  "AR16J": ["M236-6155", "M037-5798", "M835-4459"],
  "A14JE": ["M887-9469", "M384-3098", "M408-7290"],
  "Z-80/60": ["M598-6695", "M107-1791", "M811-9996"],
  "E300AJP": ["M030-7485", "M026-2648", "M904-5325"],
  "SR1218D": ["M057-0589", "M186-5711", "M416-1048"],
  "120AETJC": ["M510-3631", "M106-2983", "M879-0952"],
  "180ATJ": ["M572-8190", "M205-2951", "M178-6194"],
  "SJ6832RT": ["M342-3553", "M045-6952", "M763-8737"],
  "GS2632": ["M417-2082", "M282-6906"],
  "GS4390RT": ["M439-8484", "M203-6152"],
  "COMPACT-10": ["M544-7437", "M659-0840"],  "GS5390RT": ["M004-3667", "M845-8651"],
  "HA260PX": ["M038-6763", "M116-2363"],
  "MAN GO 12": ["M099-6166", "M256-1875"],
  "Z-34/22N": ["M110-1645", "M160-4528"],
  "COMPACT-12DX": ["M122-9495", "M579-7579"],
  "Z-62/40": ["M168-7445", "M317-3748"],
  "HA32PX": ["M692-8041", "M932-2445"],
  "460SJ": ["M725-7107", "M749-9513"],
  "HL-220 E12": ["M082-6111", "M140-0406"],
  "SCORPION 1490": ["M082-5310", "M264-2806"],
  "1250AJP": ["M018-7013"],
  "800AJ": ["M091-1956"],
  "660SJ": ["M209-3306"],
  "2630ES": ["M451-2844"],
  "860SJ": ["M829-9712"],
  "3394RT": ["M549-6792"],
  "E600JP": ["M622-7084"],
  "1350 SJP": ["M624-7785"],
  "Z-51/30J": ["M579-8838"],
  "Z-45/25J": ["M055-3461"],
  "Z-30/20N": ["M380-2365"],
  "Z-30/20NRJ": ["M479-8138"],
  "GS2646": ["M567-8260"],
  "GS3246": ["M584-9410"],
  "S-125": ["M971-8124"],
  "GS4390": ["M665-4166"],
  "S-65": ["M805-9451"],
  "HA20PX": ["M141-6600"],
  "200ATJ": ["M061-0041"],
  "160ATJ": ["M731-0501"],
} as const;
const expectedByModel: Readonly<Record<string, SpecsMap>> = {
  "1930 ES": { "Altura de plataforma": "5,72 m", "Anchura total": "0,76 m", "Capacidad máxima de plataforma": "230 kg", "Longitud total": "1,87 m" },
  "1930ES": { "Altura de plataforma": "5,7 m", "Anchura total": "0,76 m", "Capacidad máxima de plataforma": "230 kg", "Extensión de plataforma": "0,9 m" },
  "HA12IP": { "Altura de plataforma": "10 m", "Alcance horizontal": "6,5 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "1,35 m" },
  "170AETJL": { "Altura de plataforma": "14,9 m", "Alcance horizontal": "9,4 m", "Capacidad máxima de plataforma": "200 kg", "Anchura total": "1,75 m" },
  "450 AJ": { "Altura de plataforma": "13,72 m", "Alcance horizontal": "7,47 m", "Capacidad máxima de plataforma": "230 kg" },
  "COMPACT-10N": { "Altura de plataforma": "8 m", "Anchura total": "0,81 m", "Capacidad máxima de plataforma": "230 kg", "Distancia entre ejes": "1,86 m" },
  "HA15IP": { "Alcance horizontal": "8,45 m", "Capacidad máxima de plataforma": "230 kg", "Altura de plataforma": "12,87 m", "Anchura total": "1,52 m" },
  "HA16RTJ": { "Altura de plataforma": "14 m", "Alcance horizontal": "8,3 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,3 m" },
  "Optimum 8": { "Capacidad máxima de plataforma": "230 kg", "Distancia entre ejes": "1,38 m" },
  "Compact 12": { "Anchura total": "1,2 m", "Distancia entre ejes": "1,86 m", "Capacidad máxima de plataforma": "300 kg", "Extensión de plataforma": "0,92 m" },
  "COMPACT-14": { "Altura de plataforma": "11,85 m", "Anchura total": "1,2 m", "Capacidad máxima de plataforma": "350 kg", "Distancia entre ejes": "1,86 m" },
  "STAR-10": { "Altura de plataforma": "8 m", "Alcance horizontal": "3 m", "Capacidad máxima de plataforma": "200 kg", "Rotación de torreta": "345°" },
  "S0808EII": { "Anchura total": "0,83 m", "Capacidad máxima de plataforma": "230 kg", "Altura de plataforma": "7,8 m", "Extensión de plataforma": "0,9 m" },
  "AS1212E": { "Altura de plataforma": "12 m", "Anchura total": "1,18 m", "Capacidad máxima de plataforma": "320 kg", "Extensión de plataforma": "0,9 m" },
  "AR16J": { "Altura de plataforma": "15,7 m", "Alcance horizontal": "9,39 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,31 m" },
  "A14JE": { "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,81 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "1,8 m" },
  "Z-80/60": { "Altura de plataforma": "23,77 m", "Alcance horizontal": "18,29 m", "Capacidad máxima de plataforma": "227 kg", "Anchura total": "2,49 m" },
  "E300AJP": { "Altura de plataforma": "9,14 m", "Anchura total": "1,22 m", "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "6,1 m" },
  "SR1218D": { "Altura de plataforma": "11,9 m", "Anchura total": "1,79 m", "Capacidad máxima de plataforma": "365 kg", "Extensión de plataforma": "1,52 m" },
  "120AETJC": { "Altura de plataforma": "9,95 m", "Capacidad máxima de plataforma": "200 kg", "Anchura total": "1,2 m", "Alcance horizontal": "7 m" },
  "180ATJ": { "Alcance horizontal": "10,62 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,3 m", "Longitud total": "7,77 m" },
  "SJ6832RT": { "Altura de plataforma": "9,75 m", "Capacidad máxima de plataforma": "454 kg", "Anchura total": "1,76 m", "Extensión de plataforma": "1,52 m" },
  "GS2632": { "Altura de plataforma": "7,92 m", "Anchura total": "0,81 m", "Capacidad máxima de plataforma": "227 kg", "Extensión de plataforma": "0,91 m" },
  "GS4390RT": { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg", "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" },
  "COMPACT-10": { "Capacidad máxima de plataforma": "450 kg", "Distancia entre ejes": "1,86 m", "Anchura total": "1,2 m", "Longitud total": "2,45 m" },  "GS5390RT": { "Altura de plataforma": "16,15 m", "Capacidad máxima de plataforma": "680 kg", "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" },
  "HA260PX": { "Altura de plataforma": "23,6 m", "Alcance horizontal": "16,2 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,38 m" },
  "MAN GO 12": { "Altura de plataforma": "9,9 m", "Capacidad máxima de plataforma": "230 kg", "Alcance horizontal": "6,69 m", "Anchura total": "1,8 m" },
  "Z-34/22N": { "Altura de plataforma": "10,5 m", "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "6,78 m", "Anchura total": "1,47 m" },
  "COMPACT-12DX": { "Altura de plataforma": "10,06 m", "Capacidad máxima de plataforma": "450 kg", "Anchura total": "1,78 m", "Longitud de plataforma": "2,45 m" },
  "Z-62/40": { "Altura de plataforma": "18,87 m", "Alcance horizontal": "12,42 m", "Capacidad máxima de plataforma": "227 kg", "Anchura total": "2,49 m" },
  "HA32PX": { "Altura de plataforma": "29,8 m", "Capacidad máxima de plataforma": "250 kg", "Alcance horizontal": "21,3 m", "Anchura de plataforma": "0,8 m" },
  "460SJ": { "Altura de plataforma": "14 m", "Anchura total": "1,98 m", "Alcance horizontal máximo": "12 m", "Capacidad de plataforma sin restricciones": "230 kg" },
  "HL-220 E12": { "Anchura total": "1,2 m", "Capacidad máxima de plataforma": "500 kg", "Longitud de plataforma": "3,38 m", "Extensión de plataforma": "1,5 m" },
  "SCORPION 1490": { "Alcance horizontal": "9,2 m", "Anchura de plataforma": "0,7 m" },
  "1250AJP": { "Altura de plataforma": "38,3 m", "Alcance horizontal": "19,25 m", "Anchura con ejes recogidos": "2,49 m", "Longitud total": "11,46 m" },
  "800AJ": { "Altura de plataforma": "24,38 m", "Alcance horizontal": "15,8 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,44 m" },
  "660SJ": { "Altura de plataforma": "20,31 m", "Alcance horizontal": "17,3 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,49 m" },
  "2630ES": { "Altura de plataforma": "7,77 m", "Anchura total": "0,76 m", "Extensión de plataforma": "0,9 m", "Distancia entre ejes": "1,88 m" },
  "860SJ": { "Altura de plataforma": "26,21 m", "Alcance horizontal": "22,86 m", "Anchura total": "2,49 m", "Capacidad de plataforma sin restricciones": "230 kg" },
  "3394RT": { "Altura de plataforma": "10,06 m", "Anchura total": "2,39 m", "Longitud de plataforma": "3,81 m", "Anchura de plataforma": "2,18 m" },
  "E600JP": { "Alcance horizontal": "13,54 m", "Capacidad máxima de plataforma": "227 kg", "Altura de plataforma": "18,39 m", "Anchura total": "2,42 m" },
  "1350 SJP": { "Altura de plataforma": "41,2 m", "Alcance horizontal máximo sin restricción de carga": "24,4 m", "Capacidad de plataforma sin restricciones": "227 kg", "Anchura con ejes recogidos": "2,49 m" },
  "Z-51/30J": { "Altura de plataforma": "15,59 m", "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "9,25 m", "Anchura total": "2,29 m" },
  "Z-45/25J": { "Capacidad máxima de plataforma": "227 kg", "Anchura de plataforma": "0,76 m", "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,7 m" },
  "Z-30/20N": { "Altura de plataforma": "9,1 m", "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "6,4 m", "Anchura total": "1,2 m" },
  "Z-30/20NRJ": { "Altura de plataforma": "8,89 m", "Alcance horizontal": "6,25 m", "Capacidad máxima de plataforma": "227 kg", "Anchura total": "1,19 m" },
  "GS2646": { "Altura de plataforma": "7,9 m", "Anchura total": "1,17 m", "Extensión de plataforma": "0,91 m", "Distancia entre ejes": "1,85 m" },
  "GS3246": { "Altura de plataforma": "9,75 m", "Anchura total": "1,17 m", "Extensión de plataforma": "0,91 m", "Distancia entre ejes": "1,85 m" },
  "S-125": { "Altura de plataforma": "38,1 m", "Alcance horizontal": "24,38 m", "Capacidad máxima de plataforma": "227 kg", "Anchura con ejes recogidos": "2,5 m" },
  "GS4390": { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg", "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" },
  "S-65": { "Altura de plataforma": "19,8 m", "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "17,1 m", "Anchura total": "2,49 m" },
  "HA20PX": { "Altura de plataforma": "18,65 m", "Alcance horizontal": "13,5 m", "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,38 m" },
  "200ATJ": { "Alcance horizontal": "12 m", "Capacidad máxima de plataforma": "230 kg", "Altura de plataforma": "18,28 m", "Anchura total": "2,4 m" },
  "160ATJ": { "Capacidad máxima de plataforma": "230 kg", "Anchura de plataforma": "0,8 m", "Anchura total": "2,30 m", "Longitud de plataforma": "1,80 m" },
};
const expected: ReadonlySet<string> = new Set(Object.values(referencesByModel).flat());

const sourceByReference = (reference: string): ProductRecord => {
  const record = source.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: 20 plataformas JLG acreditadas recuperan capacidad sin modificar su origen", () => {
  const targeted = [...referencesByModel["1930 ES"], ...referencesByModel["450 AJ"]];
  assert.equal(targeted.length, 20);
  assert.equal(new Set(targeted).size, 20);
  for (const reference of targeted) {
    const record = sourceByReference(reference);
    const before = JSON.stringify(record);
    const originalSpecs = record.specs ?? {};
    assert.equal(originalSpecs["Capacidad máxima de plataforma"], undefined, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Capacidad máxima de plataforma"], "230 kg", reference);
    assert.equal(prepared.product.reference, record.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("Mercaeleva: 20 plataformas Haulotte recuperan capacidad según su modelo acreditado", () => {
  const targeted = [
    ...referencesByModel.HA12IP,
    ...referencesByModel["COMPACT-10N"],
    ...referencesByModel["Compact 12"],
    ...referencesByModel["COMPACT-14"]
  ];
  const capacityByModel: Readonly<Record<string, string>> = {
    HA12IP: "230 kg",
    "COMPACT-10N": "230 kg",
    "Compact 12": "300 kg",
    "COMPACT-14": "350 kg"
  };
  assert.equal(targeted.length, 20);
  assert.equal(new Set(targeted).size, 20);

  for (const reference of targeted) {
    const record = sourceByReference(reference);
    const original = JSON.stringify(record);
    const expectedCapacity = capacityByModel[record.model ?? ""];
    assert.ok(expectedCapacity, reference);
    assert.equal(record.specs?.["Capacidad máxima de plataforma"], undefined, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Capacidad máxima de plataforma"], expectedCapacity, reference);
    assert.equal(prepared.product.reference, record.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.equal(JSON.stringify(record), original, reference);

    const conflictingSpecs = { ...record.specs, "Capacidad máxima de plataforma": "999 kg" };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, conflictingSpecs), conflictingSpecs, reference);
  }
});

test("Mercaeleva: la evidencia no pasa a otras unidades, configuraciones ni originales alterados", () => {
  for (const reference of expected) {
    const record = sourceByReference(reference);
    const specs = record.specs ?? {};
    const documentedSpecs = expectedByModel[record.model ?? ""];
    assert.ok(documentedSpecs, reference);
    const protectedKey = Object.keys(documentedSpecs)[0];
    assert.ok(protectedKey, reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, reference: `${reference}-otra` },
      { ...record, url: `${record.url}?version=otra` },
      { ...record, title: `${record.title} OTRA` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: "1999" },
      { ...record, horometer: "999999" },
      { ...record, condition: "Nuevo" },
      { ...record, longDescription: `${record.longDescription} otras opciones` },
      { ...record, specs: { ...specs, "Tipo de motor": "Diésel" } },
      { ...record, specs: { ...specs, "Altura de trabajo": specs["Altura de trabajo"] === "20 m" ? "2 m" : "20 m" } },
      { ...record, specs: { ...specs, "Modelo": "Otro modelo" } },
      { ...record, specs: { ...specs, "Año de fabricación": "1999" } },
      { ...record, specs: { ...specs, "Artículo No.": "otro" } },
      { ...record, specs: { ...specs, [protectedKey]: "40 m" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const input = variant.specs ?? {};
      assert.equal(recoverMercaelevaDocumentedPlatformTechnicalSpecs(variant, input), input, `${reference}:${index}`);
    }
    const previouslyDefined = { ...specs, [protectedKey]: "10 m" };
    assert.equal(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, previouslyDefined), previouslyDefined, reference);
  }
});


test("Mercaeleva: modelos repetidos preservan los datos de cada unidad y son independientes del orden", () => {
  const groups = new Map<string, ProductRecord[]>();
  for (const record of source) {
    if (!record.brand || !record.model) continue;
    const key = JSON.stringify([record.brand, record.model]);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const repeated = [...groups.values()].filter((group) => group.length > 1);
  assert.equal(repeated.length, 44);
  assert.equal(repeated.reduce((total, group) => total + group.length, 0), 145);

  for (const group of repeated) {
    const forward = group.map((record) => {
      const original = JSON.stringify(record);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const key of ["Artículo No.", "Horas laborales", "Año de fabricación"] as const) {
        assert.equal(prepared.spec[key], record.specs?.[key], `${record.reference}: ${key}`);
      }
      assert.equal(JSON.stringify(record), original);
      return prepared;
    });
    for (const [index, record] of [...group].reverse().entries()) {
      assert.deepEqual(prepareSourceProduct(record).product, forward[group.length - index - 1], record.reference ?? record.url);
    }
  }
});

test("Mercaeleva: intercambiar identidades de unidades hermanas no habilita evidencia documental", () => {
  const first = sourceByReference("M050-6081");
  const second = sourceByReference("M091-9536");
  assert.equal(first.model, second.model);
  const secondArticle = second.specs?.["Artículo No."];
  assert.notEqual(secondArticle, undefined);
  if (secondArticle === undefined) throw new Error("Artículo No. de la unidad hermana ausente");
  const attempts: readonly ProductRecord[] = [
    { ...first, reference: second.reference },
    { ...first, reference: second.reference, url: second.url },
    { ...first, reference: second.reference, url: second.url, horometer: second.horometer },
    { ...first, reference: second.reference, url: second.url, specs: { ...first.specs, "Artículo No.": secondArticle } }
  ];
  for (const [index, attempted] of attempts.entries()) {
    const specs = attempted.specs ?? {};
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(attempted, specs), specs, String(index));
  }
});

const profiles = {
  "170AETJL": { count: 8, specifications: { "Capacidad máxima de plataforma": "200 kg", "Anchura total": "1,75 m" } },
  "HA15IP": { count: 6, specifications: { "Altura de plataforma": "12,87 m", "Anchura total": "1,52 m" } },
  "Optimum 8": { count: 6, specifications: { "Altura de plataforma": "5,77 m", "Anchura total": "0,79 m" } }
} as const;

const expectedSpecs = (year: string | null, model: string | null, description: string | null): Readonly<Record<string, string>> => {
  if (model === "170AETJL") return profiles[model].specifications;
  if (model === "HA15IP") return profiles[model].specifications;
  if (model === "Optimum 8") {
    return year === "2018" && description?.includes("OPTIMUM 8 AC")
      ? profiles[model].specifications
      : { "Altura de plataforma": "5,8 m", "Anchura total": "0,76 m" };
  }
  return {};
};

test("Mercaeleva: 20 unidades salen del aviso de densidad por prestaciones comerciales acreditadas", () => {
  const targets = source.filter((record) => record.model === "170AETJL" || record.model === "HA15IP" || record.model === "Optimum 8");
  assert.equal(targets.length, 20);
  assert.equal(new Set(targets.map((record) => record.reference)).size, 20);
  for (const [model, profile] of Object.entries(profiles)) {
    assert.equal(targets.filter((record) => record.model === model).length, profile.count, model);
  }

  const prior: ImportCandidate[] = [];
  const prepared: ImportCandidate[] = [];
  for (const record of targets) {
    const original = JSON.stringify(record);
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "ready", record.reference ?? record.url);
    const expected = expectedSpecs(record.year, record.model, record.longDescription);
    assert.equal(Object.keys(expected).length, 2, record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(record.specs?.[key], undefined, record.reference ?? record.url);
      assert.equal(result.product.spec[key], value, record.reference ?? record.url);
    }
    const withoutAdditions = Object.fromEntries(Object.entries(result.product.spec).filter(([key]) => !(key in expected)));
    assert.deepEqual(Object.keys(result.product.spec).filter((key) => key in expected).sort(), Object.keys(expected).sort(), record.reference ?? record.url);
    assert.equal(result.product.reference, record.reference ?? record.url);
    assert.equal(result.product.sourceUrl, record.url);
    assert.equal(JSON.stringify(record), original, record.reference ?? record.url);
    prior.push({ ...result.product, spec: withoutAdditions });
    prepared.push(result.product);
  }

  const before = analyzeTechnicalDensity(prior);
  const after = analyzeTechnicalDensity(prepared);
  assert.equal(before.target.below, 20);
  assert.equal(before.target.missing, 40);
  assert.equal(after.target.below, 0);
  assert.equal(after.target.missing, 0);
  assert.equal(after.totals.medium, 0);
});

test("Mercaeleva: variantes antiguas de Optimum 8 conservan sus dimensiones propias", () => {
  const classic = source.filter((record) => record.model === "Optimum 8" && record.year !== "2018");
  assert.equal(classic.length, 2);
  for (const record of classic) {
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec["Altura de plataforma"], "5,8 m");
    assert.equal(result.product.spec["Anchura total"], "0,76 m");
  }
  const ac = source.filter((record) => record.model === "Optimum 8" && record.year === "2018");
  assert.equal(ac.length, 4);
  for (const record of ac) {
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec["Altura de plataforma"], "5,77 m");
    assert.equal(result.product.spec["Anchura total"], "0,79 m");
  }
});

test("Mercaeleva: valores técnicos explícitos y huellas alteradas impiden sobrescribir medidas", () => {
  const targets = source.filter((record) => record.model === "170AETJL" || record.model === "HA15IP" || record.model === "Optimum 8");
  assert.equal(targets.length, 20);
  for (const record of targets) {
    const expected = expectedSpecs(record.year, record.model, record.longDescription);
    const addedKey = Object.keys(expected)[0];
    assert.ok(addedKey);
    const incoming = { ...record.specs, [addedKey]: "999 m" };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, incoming), incoming, record.reference ?? record.url);
    const tampered = { ...record, year: "1999" };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(tampered, record.specs ?? {}), tampered.specs, record.reference ?? record.url);
  }
});

const additionalDimensions: Readonly<Record<string, Readonly<{ key: string; value: string; count: number }>>> = {
  "1930 ES": { key: "Longitud total", value: "1,87 m", count: 10 },
  "HA12IP": { key: "Anchura total", value: "1,35 m", count: 7 },
  "COMPACT-10N": { key: "Distancia entre ejes", value: "1,86 m", count: 6 }
};

test("Mercaeleva: 23 unidades dejan de presentar aviso de uniformidad por dimensiones documentadas", () => {
  const targets = source.filter((record) => record.model !== null && record.model in additionalDimensions);
  assert.equal(targets.length, 23);
  assert.equal(new Set(targets.map((record) => record.reference)).size, 23);
  for (const [model, dimension] of Object.entries(additionalDimensions)) {
    assert.equal(targets.filter((record) => record.model === model).length, dimension.count, model);
  }

  const prior: ImportCandidate[] = [];
  const prepared: ImportCandidate[] = [];
  for (const record of targets) {
    const dimension = additionalDimensions[record.model ?? ""];
    assert.ok(dimension, record.reference ?? record.url);
    const original = JSON.stringify(record);
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "ready", record.reference ?? record.url);
    assert.equal(record.specs?.[dimension.key], undefined, record.reference ?? record.url);
    assert.equal(result.product.spec[dimension.key], dimension.value, record.reference ?? record.url);
    assert.equal(result.product.reference, record.reference, record.reference ?? record.url);
    assert.equal(result.product.sourceUrl, record.url, record.reference ?? record.url);
    assert.equal(JSON.stringify(record), original, record.reference ?? record.url);

    const { [dimension.key]: documented, ...existing } = result.product.spec;
    assert.equal(documented, dimension.value, record.reference ?? record.url);
    prior.push({ ...result.product, spec: existing });
    prepared.push(result.product);

    const conflicting = { ...record.specs, [dimension.key]: "999 m" };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, conflicting), conflicting, record.reference ?? record.url);
    const differentYear = { ...record, year: "1999" };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(differentYear, record.specs ?? {}), record.specs, record.reference ?? record.url);
  }

  const before = analyzeTechnicalDensity(prior);
  const after = analyzeTechnicalDensity(prepared);
  assert.equal(before.target.below, 23);
  assert.equal(before.target.missing, 23);
  assert.equal(after.target.below, 0);
  assert.equal(after.target.missing, 0);
  assert.equal(after.totals.medium, before.totals.medium);
});

const uniformityRecovery: Readonly<Record<string, Readonly<{ count: number; additions: Readonly<Record<string, string>> }>>> = {
  HA16RTJ: { count: 4, additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,3 m" } },
  "STAR-10": { count: 3, additions: { "Capacidad máxima de plataforma": "200 kg", "Rotación de torreta": "345°" } },
  A14JE: { count: 3, additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "1,8 m" } },
  "COMPACT-14": { count: 3, additions: { "Distancia entre ejes": "1,86 m" } },
  "Compact 12": { count: 4, additions: { "Extensión de plataforma": "0,92 m" } },
  "COMPACT-10": { count: 2, additions: { "Anchura total": "1,2 m", "Longitud total": "2,45 m" } },
  "COMPACT-12DX": { count: 2, additions: { "Anchura total": "1,78 m", "Longitud de plataforma": "2,45 m" } }
};

test("Mercaeleva: 21 fichas salen del aviso de uniformidad con prestaciones acreditadas", () => {
  const targets = source.filter((record) => record.model !== null && record.model in uniformityRecovery &&
    record.condition === "Segunda mano");
  assert.equal(targets.length, 21);
  assert.equal(new Set(targets.map((record) => record.reference)).size, 21);
  for (const [model, profile] of Object.entries(uniformityRecovery)) {
    assert.equal(targets.filter((record) => record.model === model).length, profile.count, model);
  }

  const before: ImportCandidate[] = [];
  const after: ImportCandidate[] = [];
  for (const record of targets) {
    const profile = uniformityRecovery[record.model ?? ""];
    assert.ok(profile, record.reference ?? record.url);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    const oldSpecs = { ...prepared.product.spec };
    for (const [key, value] of Object.entries(profile.additions)) {
      assert.equal(record.specs?.[key], undefined, record.reference ?? record.url);
      assert.equal(prepared.product.spec[key], value, record.reference ?? record.url);
      delete oldSpecs[key];
      const conflicting = { ...record.specs, [key]: "999 m" };
      assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, conflicting), conflicting);
    }
    const alternate = { ...record, reference: `${record.reference}-otra` };
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(alternate, record.specs ?? {}), record.specs);
    assert.equal(prepared.product.reference, record.reference, record.reference ?? record.url);
    assert.equal(prepared.product.sourceUrl, record.url, record.reference ?? record.url);
    assert.equal(JSON.stringify(record), original, record.reference ?? record.url);
    before.push({ ...prepared.product, spec: oldSpecs });
    after.push(prepared.product);
  }
  const beforeDensity = analyzeTechnicalDensity(before);
  const afterDensity = analyzeTechnicalDensity(after);
  assert.equal(beforeDensity.target.below, 21);
  assert.equal(beforeDensity.target.missing, 35);
  assert.equal(afterDensity.target.below, 0);
  assert.equal(afterDensity.target.missing, 0);
});

test("Mercaeleva: variantes nuevas y sin huella no reciben el perfil técnico de ocasión", () => {
  const latest = source.filter((record) => record.model === "A14JE" && record.condition !== "Segunda mano");
  assert.equal(latest.length, 1);
  for (const record of latest) {
    const existing = record.specs ?? {};
    assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, existing), existing);
  }
});

const recoveredUniformityModels: Readonly<Record<string, Readonly<{ references: readonly string[]; additions: Readonly<Record<string, string>> }>>> = {
  AS1212E: { references: referencesByModel.AS1212E, additions: { "Capacidad máxima de plataforma": "320 kg", "Extensión de plataforma": "0,9 m" } },
  AR16J: { references: referencesByModel.AR16J, additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,31 m" } },
  SR1218D: { references: referencesByModel.SR1218D, additions: { "Capacidad máxima de plataforma": "365 kg", "Extensión de plataforma": "1,52 m" } },
  SJ6832RT: { references: referencesByModel.SJ6832RT, additions: { "Anchura total": "1,76 m", "Extensión de plataforma": "1,52 m" } },
  E300AJP: { references: referencesByModel.E300AJP, additions: { "Capacidad máxima de plataforma": "227 kg", "Alcance horizontal": "6,1 m" } },
  "120AETJC": { references: referencesByModel["120AETJC"], additions: { "Anchura total": "1,2 m", "Alcance horizontal": "7 m" } },
  "180ATJ": { references: referencesByModel["180ATJ"], additions: { "Anchura total": "2,3 m", "Longitud total": "7,77 m" } }
};

test("Mercaeleva: 21 máquinas salen del indicador de uniformidad mediante 42 prestaciones acreditadas", () => {
  const before: ImportCandidate[] = [];
  const after: ImportCandidate[] = [];
  const identities = new Set<string>();
  for (const [model, profile] of Object.entries(recoveredUniformityModels)) {
    assert.equal(profile.references.length, 3, model);
    for (const reference of profile.references) {
      assert.ok(!identities.has(reference), reference);
      identities.add(reference);
      const original = sourceByReference(reference);
      assert.equal(original.model, model, reference);
      const originalJson = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(prepared.status, "ready", reference);
      const previousSpecs: SpecsMap = Object.fromEntries(Object.entries(prepared.product.spec).filter(([key]) => !(key in profile.additions)));
      for (const [key, value] of Object.entries(profile.additions)) {
        assert.equal(original.specs?.[key], undefined, reference);
        assert.equal(prepared.product.spec[key], value, reference);
        assert.equal(Object.prototype.hasOwnProperty.call(previousSpecs, key), false, reference);
        const conflicting = { ...original.specs, [key]: "999 m" };
        assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(original, conflicting), conflicting, reference);
      }
      assert.equal(JSON.stringify(original), originalJson, reference);
      assert.equal(prepared.product.reference, reference);
      assert.equal(prepared.product.sourceUrl, original.url);
      before.push({ ...prepared.product, spec: previousSpecs });
      after.push(prepared.product);
    }
  }
  assert.equal(identities.size, 21);
  const prior = analyzeTechnicalDensity(before);
  const current = analyzeTechnicalDensity(after);
  assert.equal(prior.target.below, 21);
  assert.equal(prior.target.missing, 42);
  assert.equal(current.target.below, 0);
  assert.equal(current.target.missing, 0);
});

const restoredComparisonModels: typeof recoveredUniformityModels = {
  "Z-80/60": { references: referencesByModel["Z-80/60"], additions: { "Altura de plataforma": "23,77 m", "Anchura total": "2,49 m" } },
  GS5390RT: { references: referencesByModel.GS5390RT, additions: { "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" } },
  GS4390RT: { references: referencesByModel.GS4390RT, additions: { "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" } },
  GS2632: { references: referencesByModel.GS2632, additions: { "Capacidad máxima de plataforma": "227 kg", "Extensión de plataforma": "0,91 m" } },
  HA260PX: { references: referencesByModel.HA260PX, additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,38 m" } },
  "MAN GO 12": { references: referencesByModel["MAN GO 12"], additions: { "Alcance horizontal": "6,69 m", "Anchura total": "1,8 m" } },
  HA32PX: { references: referencesByModel.HA32PX, additions: { "Alcance horizontal": "21,3 m", "Anchura de plataforma": "0,8 m" } },
  "1930ES": { references: referencesByModel["1930ES"], additions: { "Capacidad máxima de plataforma": "230 kg", "Extensión de plataforma": "0,9 m" } },
  "Z-34/22N": { references: referencesByModel["Z-34/22N"], additions: { "Alcance horizontal": "6,78 m", "Anchura total": "1,47 m" } },
  "Z-62/40": { references: referencesByModel["Z-62/40"], additions: { "Altura de plataforma": "18,87 m", "Anchura total": "2,49 m" } }
};

test("Mercaeleva: 21 fichas de diez familias recuperan 42 especificaciones comparables", () => {
  const before: ImportCandidate[] = [];
  const after: ImportCandidate[] = [];
  const identities = new Set<string>();
  for (const [model, profile] of Object.entries(restoredComparisonModels)) {
    assert.equal(profile.references.length, model === "Z-80/60" ? 3 : 2, model);
    assert.equal(Object.keys(profile.additions).length, 2, model);
    for (const reference of profile.references) {
      assert.ok(!identities.has(reference), reference);
      identities.add(reference);
      const original = sourceByReference(reference);
      assert.equal(original.model, model, reference);
      const originalJson = JSON.stringify(original);
      const prepared = prepareSourceProduct(original);
      assert.equal(prepared.status, "ready", reference);
      const previousSpecs: SpecsMap = Object.fromEntries(Object.entries(prepared.product.spec).filter(([key]) => !(key in profile.additions)));
      for (const [key, value] of Object.entries(profile.additions)) {
        assert.equal(original.specs?.[key], undefined, reference);
        assert.equal(prepared.product.spec[key], value, reference);
        assert.equal(Object.prototype.hasOwnProperty.call(previousSpecs, key), false, reference);
        const conflicting = { ...original.specs, [key]: "999 m" };
        assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(original, conflicting), conflicting, reference);
      }
      const mismatchedOriginal: ProductRecord = { ...original, year: "1990" };
      assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(mismatchedOriginal, original.specs ?? {}), original.specs);
      assert.equal(JSON.stringify(original), originalJson, reference);
      assert.equal(prepared.product.reference, original.reference, reference);
      assert.equal(prepared.product.sourceUrl, original.url, reference);
      before.push({ ...prepared.product, spec: previousSpecs });
      after.push(prepared.product);
    }
  }
  assert.equal(identities.size, 21);
  const previousDensity = analyzeTechnicalDensity(before);
  const currentDensity = analyzeTechnicalDensity(after);
  assert.equal(previousDensity.target.below, 21);
  assert.equal(previousDensity.target.missing, 42);
  assert.equal(currentDensity.target.below, 0);
  assert.equal(currentDensity.target.missing, 0);
});


const latestComparisonModels: Readonly<Record<string, Readonly<{ references: readonly string[]; additions: Readonly<Record<string, string>> }>>> = {
  "S0808EII": { references: ["M040-2258", "M309-0364"], additions: { "Altura de plataforma": "7,8 m", "Extensión de plataforma": "0,9 m" } },
  "HL-220 E12": { references: ["M082-6111", "M140-0406"], additions: { "Longitud de plataforma": "3,38 m", "Extensión de plataforma": "1,5 m" } },
  "GS2646": { references: ["M567-8260"], additions: { "Extensión de plataforma": "0,91 m", "Distancia entre ejes": "1,85 m" } },
  "GS3246": { references: ["M584-9410"], additions: { "Extensión de plataforma": "0,91 m", "Distancia entre ejes": "1,85 m" } },
  "S-65": { references: ["M805-9451"], additions: { "Alcance horizontal": "17,1 m", "Anchura total": "2,49 m" } },
  "Z-51/30J": { references: ["M579-8838"], additions: { "Alcance horizontal": "9,25 m", "Anchura total": "2,29 m" } },
  "Z-45/25J": { references: ["M055-3461"], additions: { "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,7 m" } },
  "Z-30/20N": { references: ["M380-2365"], additions: { "Alcance horizontal": "6,4 m", "Anchura total": "1,2 m" } },
  "Z-30/20NRJ": { references: ["M479-8138"], additions: { "Capacidad máxima de plataforma": "227 kg", "Anchura total": "1,19 m" } },
  "GS4390": { references: ["M665-4166"], additions: { "Extensión de plataforma": "1,52 m", "Anchura de plataforma": "1,83 m" } },
  "S-125": { references: ["M971-8124"], additions: { "Capacidad máxima de plataforma": "227 kg", "Anchura con ejes recogidos": "2,5 m" } },
  "660SJ": { references: ["M209-3306"], additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,49 m" } },
  "1250AJP": { references: ["M018-7013"], additions: { "Anchura con ejes recogidos": "2,49 m", "Longitud total": "11,46 m" } },
  "1350 SJP": { references: ["M624-7785"], additions: { "Capacidad de plataforma sin restricciones": "227 kg", "Anchura con ejes recogidos": "2,49 m" } },
  "E600JP": { references: ["M622-7084"], additions: { "Altura de plataforma": "18,39 m", "Anchura total": "2,42 m" } },
  "800AJ": { references: ["M091-1956"], additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,44 m" } },
  "2630ES": { references: ["M451-2844"], additions: { "Extensión de plataforma": "0,9 m", "Distancia entre ejes": "1,88 m" } },
  "HA20PX": { references: ["M141-6600"], additions: { "Capacidad máxima de plataforma": "230 kg", "Anchura total": "2,38 m" } },
};

test("Mercaeleva: 20 fichas salen del indicador de uniformidad con 40 prestaciones acreditadas", () => {
  const before: ImportCandidate[] = [];
  const after: ImportCandidate[] = [];
  const identities = new Set<string>();
  for (const [model, profile] of Object.entries(latestComparisonModels)) {
    for (const reference of profile.references) {
      assert.ok(!identities.has(reference), reference);
      identities.add(reference);
      const original = sourceByReference(reference);
      const originalJson = JSON.stringify(original);
      assert.equal(original.model, model, reference);
      assert.equal(original.condition, "Segunda mano", reference);
      const prepared = prepareSourceProduct(original);
      assert.equal(prepared.status, "ready", reference);
      const previousSpecs: SpecsMap = Object.fromEntries(Object.entries(prepared.product.spec)
        .filter(([key]) => !(key in profile.additions)));
      for (const [key, value] of Object.entries(profile.additions)) {
        assert.equal(original.specs?.[key], undefined, reference);
        assert.equal(prepared.product.spec[key], value, reference);
        assert.ok(!(key in previousSpecs), reference);
        const conflicting = { ...original.specs, [key]: "999 m" };
        assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(original, conflicting), conflicting, reference);
      }
      const wrongOriginal: ProductRecord = { ...original, reference: `${reference}-otra` };
      assert.strictEqual(recoverMercaelevaDocumentedPlatformTechnicalSpecs(wrongOriginal, original.specs ?? {}), original.specs);
      assert.equal(prepared.product.reference, original.reference, reference);
      assert.equal(prepared.product.sourceUrl, original.url, reference);
      assert.equal(JSON.stringify(original), originalJson, reference);
      before.push({ ...prepared.product, spec: previousSpecs });
      after.push(prepared.product);
    }
  }
  assert.equal(identities.size, 20);
  const previousDensity = analyzeTechnicalDensity(before);
  const currentDensity = analyzeTechnicalDensity(after);
  assert.equal(previousDensity.target.below, 20);
  assert.equal(previousDensity.target.missing, 40);
  assert.equal(currentDensity.target.below, 0);
  assert.equal(currentDensity.target.missing, 0);
});


const comparableRecovery: Readonly<Record<string, SpecsMap>> = {
  "M736-5615": { "Capacidad de tolva rasa": "2055 l", "Radio de giro exterior": "4830 mm" },
  "M432-1479": { "Longitud de transporte": "2980 mm", "Anchura máxima del chasis extendido": "990 mm" },
  "M913-0641": { "Alcance máximo de excavación": "4740 mm", "Altura máxima de descarga": "3100 mm" },
  "M238-0251": { "Altura de plataforma": "13 m", "Anchura total": "1,5 m" },
  "M569-9029": { "Anchura total": "1,79 m", "Extensión de plataforma": "1,52 m" },
  "M649-6453": { "Longitud de plataforma": "4,27 m", "Anchura de plataforma": "1,88 m" },
  "M200-9533": { "Longitud de transporte": "6,32 m", "Anchura de transporte": "2,43 m" },
  "M640-1938": { "Centro de carga nominal del modelo": "500 mm", "Pendiente superable del modelo": "38 %" },
  "M855-6850": { "Centro de carga nominal del modelo": "500 mm", "Pendiente superable del modelo": "38 %" },
  "M011-3720": { "Capacidad nominal": "2000 kg", "Centro de carga nominal del modelo": "600 mm" },
  "M239-6301": { "Centro de carga nominal del modelo": "600 mm" },
  "M690-5522": { "Longitud de plataforma": "0,76 m", "Anchura de plataforma": "1,42 m" },
  "M028-8481": { "Altura de plataforma": "4,62 m", "Longitud replegada": "1,35 m" },
  "M061-0041": { "Altura de plataforma": "18,28 m", "Anchura total": "2,4 m" },
  "M731-0501": { "Anchura total": "2,30 m", "Longitud de plataforma": "1,80 m" },
  "M549-6792": { "Longitud de plataforma": "3,81 m", "Anchura de plataforma": "2,18 m" },
  "M829-9712": { "Anchura total": "2,49 m", "Capacidad de plataforma sin restricciones": "230 kg" },
  "M725-7107": { "Alcance horizontal máximo": "12 m", "Capacidad de plataforma sin restricciones": "230 kg" },
  "M749-9513": { "Alcance horizontal máximo": "12 m", "Capacidad de plataforma sin restricciones": "230 kg" },
  "M547-1056": { "Altura máxima de plataforma": "25,9 m" }
};

test("Mercaeleva: 20 unidades salen del aviso comercial por 38 atributos acreditados", () => {
  const references = Object.keys(comparableRecovery);
  assert.equal(references.length, 20);
  assert.equal(new Set(references).size, 20);
  const previous: ImportCandidate[] = [];
  const recovered: ImportCandidate[] = [];
  let added = 0;
  for (const reference of references) {
    const original = sourceByReference(reference);
    const snapshot = JSON.stringify(original);
    const expected = comparableRecovery[reference];
    if (!expected) throw new Error(`Evidencia ausente: ${reference}`);
    const result = prepareSourceProduct(original);
    assert.equal(result.status, "ready", reference);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(original.specs?.[key], undefined, `${reference}:${key}`);
      assert.equal(result.product.spec[key], value, `${reference}:${key}`);
    }
    const withoutRecovered = Object.fromEntries(Object.entries(result.product.spec).filter(([key]) => !(key in expected)));
    previous.push({ ...result.product, spec: withoutRecovered });
    recovered.push(result.product);
    added += Object.keys(expected).length;
    assert.equal(JSON.stringify(original), snapshot, reference);
  }
  assert.equal(added, 38);
  const before = analyzeTechnicalDensity(previous);
  const after = analyzeTechnicalDensity(recovered);
  assert.equal(before.target.below, 20);
  assert.equal(before.target.missing, 38);
  assert.equal(after.target.below, 0);
  assert.equal(after.target.missing, 0);
});
