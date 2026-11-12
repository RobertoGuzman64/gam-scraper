import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
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
  "1930 ES": { "Altura de plataforma": "5,72 m", "Anchura total": "0,76 m" },
  "1930ES": { "Altura de plataforma": "5,7 m", "Anchura total": "0,76 m" },
  "HA12IP": { "Altura de plataforma": "10 m", "Alcance horizontal": "6,5 m" },
  "170AETJL": { "Altura de plataforma": "14,9 m", "Alcance horizontal": "9,4 m" },
  "450 AJ": { "Altura de plataforma": "13,72 m", "Alcance horizontal": "7,47 m" },
  "COMPACT-10N": { "Altura de plataforma": "8 m", "Anchura total": "0,81 m" },
  "HA15IP": { "Alcance horizontal": "8,45 m", "Capacidad máxima de plataforma": "230 kg" },
  "HA16RTJ": { "Altura de plataforma": "14 m", "Alcance horizontal": "8,3 m" },
  "Optimum 8": { "Capacidad máxima de plataforma": "230 kg", "Distancia entre ejes": "1,38 m" },
  "Compact 12": { "Anchura total": "1,2 m", "Distancia entre ejes": "1,86 m" },
  "COMPACT-14": { "Altura de plataforma": "11,85 m", "Anchura total": "1,2 m" },
  "STAR-10": { "Altura de plataforma": "8 m", "Alcance horizontal": "3 m" },
  "S0808EII": { "Anchura total": "0,83 m", "Capacidad máxima de plataforma": "230 kg" },
  "AS1212E": { "Altura de plataforma": "12 m", "Anchura total": "1,18 m" },
  "AR16J": { "Altura de plataforma": "15,7 m", "Alcance horizontal": "9,39 m" },
  "A14JE": { "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,81 m" },
  "Z-80/60": { "Alcance horizontal": "18,29 m", "Capacidad máxima de plataforma": "227 kg" },
  "E300AJP": { "Altura de plataforma": "9,14 m", "Anchura total": "1,22 m" },
  "SR1218D": { "Altura de plataforma": "11,9 m", "Anchura total": "1,79 m" },
  "120AETJC": { "Altura de plataforma": "9,95 m", "Capacidad máxima de plataforma": "200 kg" },
  "180ATJ": { "Alcance horizontal": "10,62 m", "Capacidad máxima de plataforma": "230 kg" },
  "SJ6832RT": { "Altura de plataforma": "9,75 m", "Capacidad máxima de plataforma": "454 kg" },
  "GS2632": { "Altura de plataforma": "7,92 m", "Anchura total": "0,81 m" },
  "GS4390RT": { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg" },
  "COMPACT-10": { "Capacidad máxima de plataforma": "450 kg", "Distancia entre ejes": "1,86 m" },  "GS5390RT": { "Altura de plataforma": "16,15 m", "Capacidad máxima de plataforma": "680 kg" },
  "HA260PX": { "Altura de plataforma": "23,6 m", "Alcance horizontal": "16,2 m" },
  "MAN GO 12": { "Altura de plataforma": "9,9 m", "Capacidad máxima de plataforma": "230 kg" },
  "Z-34/22N": { "Altura de plataforma": "10,5 m", "Capacidad máxima de plataforma": "227 kg" },
  "COMPACT-12DX": { "Altura de plataforma": "10,06 m", "Capacidad máxima de plataforma": "450 kg" },
  "Z-62/40": { "Alcance horizontal": "12,42 m", "Capacidad máxima de plataforma": "227 kg" },
  "HA32PX": { "Altura de plataforma": "29,8 m", "Capacidad máxima de plataforma": "250 kg" },
  "460SJ": { "Altura de plataforma": "14 m", "Anchura total": "1,98 m" },
  "HL-220 E12": { "Anchura total": "1,2 m", "Capacidad máxima de plataforma": "500 kg" },
  "SCORPION 1490": { "Alcance horizontal": "9,2 m", "Anchura de plataforma": "0,7 m" },
  "1250AJP": { "Altura de plataforma": "38,3 m", "Alcance horizontal": "19,25 m" },
  "800AJ": { "Altura de plataforma": "24,38 m", "Alcance horizontal": "15,8 m" },
  "660SJ": { "Altura de plataforma": "20,31 m", "Alcance horizontal": "17,3 m" },
  "2630ES": { "Altura de plataforma": "7,77 m", "Anchura total": "0,76 m" },
  "860SJ": { "Altura de plataforma": "26,21 m", "Alcance horizontal": "22,86 m" },
  "3394RT": { "Altura de plataforma": "10,06 m", "Anchura total": "2,39 m" },
  "E600JP": { "Alcance horizontal": "13,54 m", "Capacidad máxima de plataforma": "227 kg" },
  "1350 SJP": { "Altura de plataforma": "41,2 m", "Alcance horizontal máximo sin restricción de carga": "24,4 m" },
  "Z-51/30J": { "Altura de plataforma": "15,59 m", "Capacidad máxima de plataforma": "227 kg" },
  "Z-45/25J": { "Capacidad máxima de plataforma": "227 kg", "Anchura de plataforma": "0,76 m" },
  "Z-30/20N": { "Altura de plataforma": "9,1 m", "Capacidad máxima de plataforma": "227 kg" },
  "Z-30/20NRJ": { "Altura de plataforma": "8,89 m", "Alcance horizontal": "6,25 m" },
  "GS2646": { "Altura de plataforma": "7,9 m", "Anchura total": "1,17 m" },
  "GS3246": { "Altura de plataforma": "9,75 m", "Anchura total": "1,17 m" },
  "S-125": { "Altura de plataforma": "38,1 m", "Alcance horizontal": "24,38 m" },
  "GS4390": { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg" },
  "S-65": { "Altura de plataforma": "19,8 m", "Capacidad máxima de plataforma": "227 kg" },
  "HA20PX": { "Altura de plataforma": "18,65 m", "Alcance horizontal": "13,5 m" },
  "200ATJ": { "Alcance horizontal": "12 m", "Capacidad máxima de plataforma": "230 kg" },
  "160ATJ": { "Capacidad máxima de plataforma": "230 kg", "Anchura de plataforma": "0,8 m" },
};
const expected: ReadonlySet<string> = new Set(Object.values(referencesByModel).flat());

const sourceByReference = (reference: string): ProductRecord => {
  const record = source.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

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
