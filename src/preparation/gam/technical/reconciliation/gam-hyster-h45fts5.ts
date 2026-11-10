import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

type VerifiedUnit = {
  readonly url: string;
  readonly serial: string;
  readonly hours: string;
  readonly height: string;
  readonly general: string;
  readonly short: string;
  readonly extraSpecs: SpecsMap;
};

const units: Readonly<Record<string, VerifiedUnit>> = {
  "5258": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5258-2019-hyster-h45fts5",
    serial: "U005B05348T",
    hours: "3436 horas",
    height: "4145 mm",
    extraSpecs: {
      "Tipo Mástil": "TRIPLEX", "Desplazador lateral": "SI", "Elevación libre": "SI",
      "Dimensiones Horquillas": "1120 mm", "Controles Hidraúlicos": "Minilevers",
      "Altura mástil replegado": "2150 mm", Longitud: "4400 mm", Anchura: "1420 mm"
    },
    short: "Carretilla elevadora GLP Hyster H4.5FTS5 de segunda mano, con 4.500 kg de capacidad, mástil tríplex y 4.145 mm de elevación.",
    general: "Carretilla elevadora Hyster H4.5FTS5 de ocasión, con motor GLP y capacidad de carga de 4.500 kg. La ficha de esta unidad identifica 4.145 mm de altura de elevación, mástil tríplex, desplazador lateral y 3.436 horas de horómetro. También consigna horquillas de 1.120 mm, mandos hidráulicos Minilevers y elevación libre. El mástil replegado mide 2.150 mm; la longitud indicada es de 4.400 mm y la anchura de 1.420 mm."
  },
  "6666": {
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6666-2019-hyster-h45fts5",
    serial: "U005B05353T",
    hours: "4263 horas",
    height: "4800 mm",
    extraSpecs: {
      "Desplazador lateral": "SI", "Elevación libre": "SI",
      "Altura mástil replegado": "3000 mm", Longitud: "3800 mm",
      Anchura: "1150 mm", Peso: "7050 KG"
    },
    short: "Carretilla elevadora GLP Hyster H4.5FTS5 de segunda mano, con 4.500 kg de capacidad y 4.800 mm de elevación.",
    general: "Carretilla elevadora Hyster H4.5FTS5 de ocasión con motor GLP y capacidad de carga de 4.500 kg. Su ficha registra fabricación en 2019, 4.800 mm de elevación y 4.263 horas de horómetro. Sus especificaciones consignan desplazador lateral y elevación libre, con una altura de mástil replegado de 3.000 mm. La unidad mide 3.800 mm de longitud y 1.150 mm de anchura, con un peso declarado de 7.050 kg."
  }
};

const recognized = (record: ProductRecord): VerifiedUnit | null => {
  const unit = record.reference ? units[record.reference] : undefined;
  if (!unit || record.providerId !== "gam" || record.url !== unit.url ||
    record.categoryKey !== "manutencion" || record.condition !== "Segunda mano" ||
    record.brand !== "HYSTER" || record.model !== "H4.5FTS5" ||
    record.title !== "Carretilla elevadora GLP 4500Kg HYSTER H4.5FTS6" ||
    !record.shortDescription?.includes("HYSTER H4.5FTS5") ||
    !record.longDescription?.includes("HYSTER H4.5FT6, fabricada en 2020") ||
    record.specs?.Marca !== "HYSTER" || record.specs.Modelo !== "H4.5FTS5" ||
    record.specs["Capacidad de carga (kg)"] !== "4500 KG" ||
    record.specs["Nº de serie"] !== unit.serial ||
    record.specs.Horómetro !== unit.hours ||
    record.specs["Altura de elevación (mm)"] !== unit.height ||
    Object.entries(unit.extraSpecs).some(([key, value]) => record.specs?.[key] !== value)) return null;
  return unit;
};

export const reconcileGamVerifiedHysterH45fts5Title = (record: ProductRecord): ProductRecord =>
  recognized(record) ? { ...record, title: "Carretilla elevadora GLP 4500Kg HYSTER H4.5FTS5" } : record;

export const verifiedGamHysterH45fts5Editorial = (
  source: ProductRecord,
  reconciled: ProductRecord
): { readonly short: string; readonly general: string } | null => {
  const unit = recognized(source);
  return unit && reconciled.title === "Carretilla elevadora GLP 4500Kg HYSTER H4.5FTS5" &&
    reconciled.model === "H4.5FTS5" && reconciled.specs?.Modelo === "H4.5FTS5"
    ? { short: unit.short, general: unit.general } : null;
};
