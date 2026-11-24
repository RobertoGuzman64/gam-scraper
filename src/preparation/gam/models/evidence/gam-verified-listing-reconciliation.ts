import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

type TextChange = readonly [source: string, verified: string];
type SpecChange = readonly [key: string, source: string, verified: string];

type VerifiedListing = Readonly<{
  reference: string;
  url: string;
  sourceHash: string;
  brand: string;
  model: string;
  categoryKey: string;
  condition: string;
  evidenceUrl: string;
  externalReference: string;
  corroboration: readonly (readonly [key: string, value: string])[];
  year?: ProductRecord["year"];
  horometer?: ProductRecord["horometer"];
  serialNumber?: ProductRecord["serialNumber"];
  modelChange?: string;
  titleChanges?: readonly TextChange[];
  shortChanges?: readonly TextChange[];
  longChanges?: readonly TextChange[];
  specChanges?: readonly SpecChange[];
}>;

const verified: readonly VerifiedListing[] = [
  {
    reference: "2190",
    url: "https://online.gamrentals.com/es/manipuladores-de-contenedores-vacios-hyster/2190-manipulador-de-contenedores-hyster-h28xd-16ch",
    sourceHash: "9014adaabd975135c60afb833b6024f4d7e930cbeea6eefff34a384d016abffc",
    externalReference: "H28XD-16CH",
    brand: "HYSTER", model: "H28XD-16CH", categoryKey: "marcas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://www.hyster.com/en-gb/emea/container-handlers/h28-32xd-16ch/",
    corroboration: [["Modelo", "H28XD-16CH"], ["Peso", "51553 KG"],
      ["Capacidad de carga (kg)", "12701 KG"], ["Altura de elevación (m)", "6,06 metros"]],
    shortChanges: [["12000 kg", "26400 kg"], ["7 metros", "6,06 metros"]],
    specChanges: [["Capacidad de carga (kg)", "12701 KG", "26400 KG"],
      ["Centro de carga", "610 mm", "1220 mm"]]
  },
  {
    reference: "6622",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6622-2014-genie-gs-5390",
    sourceHash: "ca6c31a69a745902eaa0e3747581b3bb9c0fc6a3d5029bd78172071d4e58fda4",
    externalReference: "JP-00309",
    brand: "GENIE", model: "GS-5390", categoryKey: "elevacion", condition: "Segunda mano",
    year: "2014", horometer: "1709 horas", serialNumber: "GS9014-49569",
    evidenceUrl: "https://geniepolska.pl/wp-content/uploads/2022/05/GS3390-GS4390-GS5390.pdf",
    corroboration: [["Altura de elevación (m)", "18 metros"], ["Capacidad de carga (kg)", "680 KG"],
      ["Longitud", "4880 mm"], ["Anchura", "2290 mm"], ["Dimensiones Cesta", "4 83 88x1 metros"]],
    titleChanges: [["JLG 1930ES | Plataforma Tijera Diésel 8M | GAM Online", "Plataforma de tijera diésel GENIE GS-5390 de 18 m"]],
    shortChanges: [["➨ JLG 1930ES Segunda Mano ➨ Venta de plataforma de tijera diésel de 8 metros de altura de ocasión ⭐Capacidad de la cesta 230 kg ➨ Año 2014",
      "GENIE GS-5390 de ocasión. Plataforma de tijera diésel de 18 m de altura de trabajo y 680 kg de capacidad; año 2014."]],
    specChanges: [["Dimensiones Cesta", "4 83 88x1 metros", "3,98X1,83 metros"]]
  },
  {
    reference: "6236",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6236-2017-snorkel-s3219e",
    sourceHash: "3b09ab2e32381d45313d7239e7e636a239140295e7da5b95198887ee4a959439",
    externalReference: "GAM-04167",
    brand: "SNORKEL", model: "S4732E", categoryKey: "elevacion", condition: "Segunda mano",
    year: "2018", horometer: "NA horas", serialNumber: "S4732E-01-180200369",
    evidenceUrl: "https://www.snorkellifts.co.uk/equipment/s4732e/",
    corroboration: [["Modelo", "S4732E"], ["Longitud", "2300 mm"], ["Anchura", "1190 mm"],
      ["Altura", "2390 mm"], ["Capacidad de carga (kg)", "350 KG"], ["Dimensiones Cesta", "2,14X1,09 metros"]],
    titleChanges: [["8M SNORKEL S3219E", "12M SNORKEL S4732E"]],
    shortChanges: [["SNORKEL S3219E", "SNORKEL S4732E"], ["8 metros", "12 metros"], ["250 kg", "350 kg"]],
    longChanges: [["S3219E", "S4732E"], ["8 metros", "12 metros"], ["250 kg", "350 kg"]]
  },
  {
    reference: "4650",
    url: "https://online.gamrentals.com/es/cte/4650-cte-b-lift-18hv",
    sourceHash: "5332b0f81f0e1f07704144c72043d6244cd99868aeba85eef5b4fceae6d4cb04",
    externalReference: "B-LIFT 18 HD",
    brand: "CTE", model: "B-LIFT 18HV", categoryKey: "elevacion-nueva", condition: "Nuevo",
    evidenceUrl: "https://www.ctelift.com/wp-content/uploads/2017/05/B-LIFT-18_2021-07_EN.pdf",
    corroboration: [["Modelo", "B-LIFT 18HV"], ["Altura de elevación (m)", "18 metros"],
      ["Capacidad de carga (kg)", "300 KG"]],
    titleChanges: [["B-LIFT 18HD", "B-LIFT 18HV"]],
    shortChanges: [["B-LIFT 18HD", "B-LIFT 18HV"], ["360 kg", "300 kg"]]
  },
  {
    reference: "5902",
    url: "https://online.gamrentals.com/es/xcmg/5902-plataforma-articulada-diesel-xcmg-xga36k",
    sourceHash: "b8eba39aebf68486f8c8f7d995ac46b58d7af8f01a1314b6796655eab0d76316",
    externalReference: "XGA43K",
    brand: "XCMG", model: "XGA43K", categoryKey: "elevacion-nueva", condition: "Nuevo",
    evidenceUrl: "https://xcmguk.com/product/articulated-boom-lift-xga43k/",
    corroboration: [["Modelo", "XGA43K"], ["Peso", "24500 KG"], ["Capacidad de carga (kg)", "460 KG"],
      ["Altura de elevación (m)", "43 metros"], ["Pendiente superable", "40%"]],
    shortChanges: [["XGA36K", "XGA43K"], ["230 kg", "460 kg"]],
    longChanges: [["230 kg", "460 kg"], ["20.500 kg", "24.500 kg"], ["12.500 mm", "12.928 mm"],
      ["3.080 mm", "3.100 mm"], ["45 %", "40 %"]]
  },

  {
    reference: "2180",
    url: "https://online.gamrentals.com/es/apiladores-hyster/2180-hyster-s16ssl",
    sourceHash: "b578110f7d56c102c7dc1ea8bba287cdd6955e9ba98043105301dcfca30d9917",
    externalReference: "S1.6SSL",
    brand: "HYSTER", model: "S1.6SSL", categoryKey: "marcas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://www.hyster.com/globalassets/coms/hyster/europe/documents/trucks-literature/pallet-stackers/s1.0-2.0-s1.2-1.6-il/s1.2-2.0-s1.6sl-d456-tg-04-2019-emea-rev03-es.pdf",
    corroboration: [["Capacidad de carga (kg)", "1600 KG"], ["Altura de elevación (m)", "3,2 metros"]],
    modelChange: "S1.6 SL"
  },
  {
    reference: "4792",
    url: "https://online.gamrentals.com/es/plataforma-telescopica-diesel-xcmg/4792-plataforma-telescopica-diesel-xcmg-xgs58e1",
    sourceHash: "4c1cfabb7946a283d2dc9556458d3b3bba5051701f6eec54705309ce3243aef4",
    externalReference: "XGS58E1",
    brand: "XCMG", model: "XGS58E1", categoryKey: "elevacion-nueva", condition: "Nuevo",
    evidenceUrl: "https://xcmgess.de/wp-content/uploads/2024/01/XGS58E1_English_small-version.pdf",
    corroboration: [["Peso", "27900 KG"], ["Capacidad de carga (kg)", "450 KG"], ["Pendiente superable", "45 %"]],
    titleChanges: [["XCMG XGS58E", "XCMG XGS58E1"]],
    longChanges: [["XGS58E", "XGS58E1"]]
  },
  {
    reference: "6171",
    url: "https://online.gamrentals.com/es/cte/6171-plataforma-sobre-orugas-electrica-cte-traccess-210e",
    sourceHash: "6076aa461b998df99cbab6dc32736af8475bd6d662e39496fe7b665c41e863d1",
    externalReference: "TRACCESS 210E",
    brand: "CTE", model: "TRCS 210E", categoryKey: "elevacion-nueva", condition: "Nuevo",
    evidenceUrl: "https://ctelift.com/es/plataforma-arana-trcs210e/",
    corroboration: [["Capacidad de carga (kg)", "230 KG"], ["Alcance Lateral", "11,30 metros"], ["Rotación de torreta", "190º+190º"]],
    titleChanges: [["TRACCESS 210E", "TRCS 210E"], ["21M", "20,8M"]],
    shortChanges: [["TRACCESS 210E", "TRCS 210E"], ["21 metros", "20,8 metros"], ["200 kg", "230 kg"]],
    longChanges: [["TRACCESS 210E", "TRCS 210E"], ["21 m", "20,8 m"], ["19 m", "18,8 m"], ["8,5 m", "11,3 m"], ["200 kg", "230 kg"]]
  },
  {
    reference: "2314",
    url: "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2314-apilador-electrico-a-pie-yale-gc60vx",
    sourceHash: "a5f60a49ca786befe3e7db8444011491c448b71e428250f3630ea5032b4ca6d7",
    externalReference: "GC60VX",
    brand: "YALE", model: "GC60VX", categoryKey: "carretillas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://www.yale.com/es-es/emea/carretillas-elevadoras-de-combustion-interna-y-ruedas-de-bandajes/gdcglc60-70vx/",
    corroboration: [["Tipo motor", "Kubota 3.8L Diesel / PSI 4.3L LPG"], ["Capacidad de carga (kg)", "6000 KG"], ["Peso", "8667 KG"]],
    specChanges: [["Motorización", "Eléctrico", "Diésel"]],
    longChanges: [["Diésel a Pie", "Diésel"]]
  }
];

const sourceHash = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify([
  record.title, record.shortDescription, record.longDescription, record.specs
])).digest("hex");

const replaceVerified = (value: string, changes: readonly TextChange[] | undefined): string | null => {
  let text = value;
  for (const [source, verified] of changes ?? []) {
    if (!source || source === verified || !text.includes(source)) return null;
    text = text.replaceAll(source, verified);
  }
  return text;
};

export const reconcileGamVerifiedListing = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.reference || !record.brand || !record.model ||
    !record.title || !record.shortDescription || !record.longDescription || !record.specs) return record;
  const item = verified.find((entry) => entry.reference === record.reference && entry.url === record.url &&
    entry.brand === record.brand && entry.model === record.model && entry.condition === record.condition &&
    entry.externalReference === record.externalReference &&
    entry.categoryKey === record.categoryKey);
  if (!item || record.year !== (item.year ?? null) || record.horometer !== (item.horometer ?? null) ||
    record.serialNumber !== (item.serialNumber ?? null) ||
    sourceHash(record) !== item.sourceHash ||
    record.specs.Marca !== item.brand || record.specs.Modelo !== item.model ||
    !item.corroboration.every(([key, value]) => record.specs?.[key] === value) ||
    (item.specChanges && !item.specChanges.every(([key, value]) => record.specs?.[key] === value))) return record;
  const title = replaceVerified(record.title, item.titleChanges);
  const shortDescription = replaceVerified(record.shortDescription, item.shortChanges);
  const longDescription = replaceVerified(record.longDescription, item.longChanges);
  if (title === null || shortDescription === null || longDescription === null) return record;
  const specs = { ...record.specs };
  for (const [key, , value] of item.specChanges ?? []) specs[key] = value;
  if (item.modelChange) specs.Modelo = item.modelChange;
  return { ...record, model: item.modelChange ?? record.model, title, shortDescription, longDescription, specs };
};
