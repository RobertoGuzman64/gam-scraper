import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

type UnitYearEvidence = Readonly<{
  reference: string;
  url: string;
  externalReference: string;
  serialNumber: string;
  brand: string;
  model: string;
  title: string;
  originalYear: string;
  verifiedYear: string;
  shortDescription: string;
  longDescriptionHash: string;
  specsHash: string;
  longCorrection?: Readonly<{ original: string; replacement: string }>;
}>;

const evidence: readonly UnitYearEvidence[] = [
  {
    reference: "6909", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6909-2008-sky-jack-sjiii-3220m",
    externalReference: "CA-03289", serialNumber: "M600150", brand: "SKYJACK", model: "SJIII-3220M",
    title: "Plataforma tijera eléctrica 8M SKY JACK SJIII-3220", originalYear: "2007", verifiedYear: "2008",
    shortDescription: "➨ SKY JACK SJIII-3220 Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 8 metros de altura de ocasión ⭐Capacidad de la cesta 363 kg ➨ Año 2007",
    longDescriptionHash: "a89d8a564faef32e25f7e89809e46346a4a7c96dbb73b361d4baa5cb29770036",
    specsHash: "668e99101257f1aadd7775a9c4897fe1b9dbbddbd2c6e21d500da2af6d8fc565",
    longCorrection: {
      original: "fabricada en el año 2007 con la calidad",
      replacement: "desarrollada con la calidad"
    }
  },
  {
    reference: "6911", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6911-2014-jlg-1930es",
    externalReference: "GAM-00162", serialNumber: "0200234633", brand: "JLG", model: "1930 ES",
    title: "Plataforma tijera eléctrica 8M JLG 1930 ES", originalYear: "2008", verifiedYear: "2014",
    shortDescription: "➨ JLG 1930 ES Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 8 metros de altura de ocasión ⭐Capacidad de la cesta 230 kg ➨ Año 2008",
    longDescriptionHash: "56f603551fdd4bc63ed2ca4762d50d6a775f0c939d1894207764c82fc4ce440a",
    specsHash: "51836de729c0c16084a16bfcc505318bc146b8587f92c4d65c3991b84eefeb33",
    longCorrection: {
      original: ", fabricada en 2006 por JLG Industries,",
      replacement: ", fabricada por JLG Industries,"
    }
  },
  {
    reference: "6797", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6797-2016-jlg-10rs",
    externalReference: "GAM-02468", serialNumber: "B200032565", brand: "JLG", model: "10RS",
    title: "Plataforma tijera eléctrica 12M JLG 10RS", originalYear: "2015", verifiedYear: "2016",
    shortDescription: "➨ JLG 10RS Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 12 metros de altura de ocasión ⭐Capacidad de la cesta 320 kg ➨ Año 2015",
    longDescriptionHash: "c62ecaeec9ace98109496c7916a7193f656e26f2058dde996c81bb47bbe1390e",
    specsHash: "f299e04edc4d8a42d58310120ad8c2a90d13053603aab37e93a582171e1452bb"
  },
  {
    reference: "6869", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6869-2008-genie-gs-3246",
    externalReference: "SM-00005", serialNumber: "GS4608 – 90644", brand: "GENIE", model: "GS-3246",
    title: "Plataforma tijera eléctrica 12M GENIE GS-3246", originalYear: "2016", verifiedYear: "2008",
    shortDescription: "➨ GENIE GS-3246 Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 10 metros de altura de ocasión ⭐Capacidad de la cesta 700 kg ➨ Año 2016",
    longDescriptionHash: "705f8f7cd53fcb2fe52e1021c62f1fa42085fe726f24356dd179ed9b4e82d3f5",
    specsHash: "a046c79bfee3063f745f74bb6558324b71b01010e94d813b7349f8198d4449fb"
  },
  {
    reference: "6870", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6870-2008-genie-gs-3246",
    externalReference: "SM-00006", serialNumber: "GS4608 - 91653", brand: "GENIE", model: "GS-3246",
    title: "Plataforma tijera eléctrica 12M GENIE GS-3246", originalYear: "2016", verifiedYear: "2008",
    shortDescription: "➨ GENIE GS-3246 Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 10 metros de altura de ocasión ⭐Capacidad de la cesta 700 kg ➨ Año 2016",
    longDescriptionHash: "705f8f7cd53fcb2fe52e1021c62f1fa42085fe726f24356dd179ed9b4e82d3f5",
    specsHash: "bced9e4a1e6cb86bfe3e28d5676be899d32142f679d17201a557f9f5a916c77f"
  },
  {
    reference: "6930", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6930-2014-jlg-1930es",
    externalReference: "GAM-00087", serialNumber: "0200232198", brand: "JLG", model: "1930ES",
    title: "Plataforma tijera eléctrica 8M JLG 1930 ES", originalYear: "2008", verifiedYear: "2014",
    shortDescription: "➨ JLG 1930 ES Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 8 metros de altura de ocasión ⭐Capacidad de la cesta 230 kg ➨ Año 2008",
    longDescriptionHash: "46e2044780359e585d0682407696171dc632ae8f6ce1b3b0ba230b584fe42a7c",
    specsHash: "4878d6144f0298f68e6c47442ee75bd9042243fe792c033c0d004524865dbd07"
  }
];

const byReference = new Map(evidence.map((item) => [item.reference, item]));
const digest = (text: string): string => createHash("sha256").update(text).digest("hex");

export const reconcileGamVerifiedUnitYear = (record: ProductRecord): ProductRecord => {
  const item = byReference.get(record.reference ?? "");
  if (!item || record.providerId !== "gam" || record.categoryKey !== "elevacion" ||
    record.condition !== "Segunda mano" || record.yearSource !== "descripcion" ||
    record.reference !== item.reference || record.url !== item.url ||
    record.externalReference !== item.externalReference || record.serialNumber !== item.serialNumber ||
    record.brand !== item.brand || record.model !== item.model || record.title !== item.title ||
    record.year !== item.originalYear || record.shortDescription !== item.shortDescription ||
    !record.longDescription || digest(record.longDescription) !== item.longDescriptionHash ||
    !record.specs || record.specs.Marca !== item.brand || record.specs.Modelo !== item.model ||
    record.specs["Nº de serie"] !== item.serialNumber ||
    digest(JSON.stringify(record.specs)) !== item.specsHash) return record;

  const oldYear = `Año ${item.originalYear}`;
  const newYear = `Año ${item.verifiedYear}`;
  if (!record.shortDescription.endsWith(oldYear)) return record;
  const longDescription = item.longCorrection
    ? record.longDescription.includes(item.longCorrection.original)
      ? record.longDescription.replace(item.longCorrection.original, item.longCorrection.replacement)
      : null
    : new RegExp(`\\bfabricada\\s+en(?:\\s+el\\s+año)?\\s+${item.verifiedYear}\\b`, "iu").test(record.longDescription)
      ? record.longDescription : null;
  if (longDescription === null) return record;

  return { ...record, year: item.verifiedYear, longDescription,
    shortDescription: record.shortDescription.slice(0, -oldYear.length) + newYear };
};
