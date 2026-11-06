import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold } from "../mapping/attribute-utils.js";

type VerifiedCapacity = {
  reference: string;
  brand: string;
  model: string;
  previous: string;
  replacement: string;
  spec: string;
  evidence: string;
  source: string;
  specCorrection?: string;
  longCorrection?: { original: string; replacement: string };
};

const verified: readonly VerifiedCapacity[] = [
  { reference: "4792", brand: "XCMG", model: "XGS58E1", previous: "Capacidad de la cesta 450 kg", replacement: "Capacidad de la cesta hasta 450 kg con restricciones", spec: "450 KG", evidence: "Soporta 230 kg estándar y 450 kg restringido", source: "https://online.gamrentals.com/es/plataforma-telescopica-diesel-xcmg/4792-plataforma-telescopica-diesel-xcmg-xgs58e1" },
  { reference: "4807", brand: "XCMG", model: "XGR08", previous: "Capacidad de la cesta 200 kg", replacement: "Capacidad de cesta pendiente de verificar (159 kg en ficha técnica y 200 kg en anuncio)", spec: "159 KG", evidence: "soportando una carga de hasta 200 kg", source: "https://online.gamrentals.com/es/plataformas-unipersonales-xcmg/4807-plataforma-unipersonal-electrica-xcmg-xgr08" },
  { reference: "6934", brand: "JLG", model: "E300AJ", previous: "Capacidad de la cesta 230 kg", replacement: "Capacidad de cesta pendiente de verificar (220 kg en ficha técnica y 230 kg en anuncio)", spec: "220 KG", evidence: "Con una capacidad de carga de 220 kg", source: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6934-2007-jlg-e300ajp" },
  { reference: "4730", brand: "XCMG", model: "XG0608C", previous: "Capacidad de la cesta 230 kg", replacement: "Capacidad de la cesta 200 kg", spec: "200 KG", evidence: "capacidad de carga de 200 kg", source: "https://www.xcmgglobal.com/product/crawler-scissor-lifts/xg0608c/" },
  { reference: "4769", brand: "XCMG", model: "XGA18ACK1", previous: "Capacidad de la cesta 250 kg", replacement: "Capacidad de la cesta 256 kg sin restricciones y 350 kg con restricciones", spec: "256 KG", evidence: "256 kg (sin restricciones) y 350 kg (con restricciones)", source: "https://online.gamrentals.com/es/plataforma-articulada-electrica-xcmg/4769-plataforma-articulada-electrica-xcmg-xga18ack1" },
  { reference: "4755", brand: "XCMG", model: "XGA18E", previous: "Capacidad de la cesta 230 kg", replacement: "Capacidad de la cesta 256 kg sin restricciones y 350 kg con restricciones", spec: "350 KG", evidence: "capacidad dual de carga", source: "https://xcmg-america.com/produtos/xga18e/" },
  { reference: "4796", brand: "XCMG", model: "XGS32ACKⅡ", previous: "Capacidad de la cesta 300 kg", replacement: "Capacidad de la cesta 300 kg sin restricciones y 460 kg con restricciones", spec: "460 KG", evidence: "300 kg (sin restricción) y 460 kg (con restricción)", source: "https://online.gamrentals.com/es/plataforma-telescopica-electrica-xcmg/4796-plataforma-telescopica-electrica-xcmg-xgs32ack-" },
  { reference: "5900", brand: "XCMG", model: "XGA36K", previous: "Capacidad de la cesta 230 kg", replacement: "Capacidad de la cesta 300 kg sin restricciones y 460 kg con restricciones", spec: "460 KG", evidence: "capacidad de carga de 230 kg", source: "https://www.xcmgmena.com/ar/product/mobile-elevating-work-platform/XGA36K/", longCorrection: { original: "230 kg", replacement: "300 kg sin restricciones y hasta 460 kg con restricciones" } },
  { reference: "6171", brand: "CTE", model: "TRCS 210E", previous: "Capacidad de la cesta 200 kg", replacement: "Capacidad de la cesta 230 kg", spec: "230 KG", evidence: "La cesta de trabajo admite una capacidad de carga de hasta 200 kg", source: "https://ctelift.com/es/plataforma-arana-trcs210e/", longCorrection: { original: "200 kg", replacement: "230 kg" } },
  { reference: "4650", brand: "CTE", model: "B-LIFT 18HV", previous: "Capacidad de la cesta 360 kg", replacement: "Capacidad de la cesta 300 kg", spec: "300 KG", evidence: "capacidad de carga en cesta de hasta 300 kg", source: "https://online.gamrentals.com/es/cte/4650-cte-b-lift-18hv" },
  { reference: "4844", brand: "CTE", model: "B-LIFT 18 HD FIB", previous: "Capacidad de la cesta 360 kg", replacement: "Capacidad de la cesta 300 kg", spec: "300 KG", evidence: "capacidad de carga en cesta de hasta 300 kg", source: "https://online.gamrentals.com/es/cte/4844-b-lift-18-hd-fib" },
  { reference: "4845", brand: "CTE", model: "B-LIFT 18 HD FIB AIS", previous: "Capacidad de la cesta 360 kg", replacement: "Capacidad de la cesta 300 kg", spec: "300 KG", evidence: "capacidad de carga en cesta de hasta 300 kg", source: "https://online.gamrentals.com/es/cte/4845-b-lift-18-hd-fib-ais" },
  { reference: "2136", brand: "HYSTER", model: "P1.6", previous: "Capacidad de carga de 2000 kg", replacement: "Capacidad de carga de 1600 kg", spec: "1600 KG", evidence: "capacidad de carga de hasta 1.600 kg", source: "https://online.gamrentals.com/es/hyster/2136-transpaleta-elevadora-electrica-hyster-p16" },
  { reference: "3189", brand: "HYSTER", model: "H50XD-CH", previous: "Capacidad de carga de 6000 kg", replacement: "Capacidad de carga de 41000 kg", spec: "41000 KG", evidence: "capacidad de carga extraordinaria de 41,000 Kg", source: "https://online.gamrentals.com/fichas-tecnicas/es/H40XD-CH.pdf" },
  { reference: "5879", brand: "UNICARRIERS", model: "A2N1L16Q", previous: "Capacidad de carga de 1800 kg", replacement: "Capacidad de carga de 1600 kg", spec: "1600 KG", evidence: "capacidad de carga de 1600 kg", source: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/5879-2017-unicarriers-a2n1l16q" },
  { reference: "6625", brand: "GENIE", model: "GS-5390", previous: "Capacidad de la cesta 1400 kg", replacement: "Capacidad de la cesta 680 kg", spec: "1400 KG", specCorrection: "680 KG", evidence: "capacidad de carga de 1410 kg", source: "https://www.genielift.com/docs/default-source/product-specifications/rough-terrain-scissor-lifts/en-gb/gsspec_gs-3390-4390-5390_en-%28gen0965%29-lr-3.pdf", longCorrection: { original: "1410 kg", replacement: "680 kg" } },
  { reference: "6869", brand: "GENIE", model: "GS-3246", previous: "Capacidad de la cesta 700 kg", replacement: "Capacidad de la cesta 318 kg", spec: "700 KG", specCorrection: "318 KG", evidence: "capacidad de carga de 700 kg", source: "https://www.genielift.com/en-gb/aerial-lift-products/Slab-scissor-lifts/gs-3246slab-engb", longCorrection: { original: "700 kg", replacement: "318 kg" } },
  { reference: "6870", brand: "GENIE", model: "GS-3246", previous: "Capacidad de la cesta 700 kg", replacement: "Capacidad de la cesta 318 kg", spec: "700 KG", specCorrection: "318 KG", evidence: "capacidad de carga de 700 kg", source: "https://www.genielift.com/en-gb/aerial-lift-products/Slab-scissor-lifts/gs-3246slab-engb", longCorrection: { original: "700 kg", replacement: "318 kg" } }
];

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const verifiedUrl = (record: ProductRecord): boolean => {
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && (parts[2] ?? "").startsWith(`${record.reference}-`);
  } catch {
    return false;
  }
};

export const reconcileGamVerifiedCapacityCoherence = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.reference || !record.brand || !record.model ||
    !record.shortDescription || !record.longDescription || !verifiedUrl(record)) return record;
  const evidence = verified.find((item) => item.reference === record.reference);
  if (!evidence || compact(record.brand) !== compact(evidence.brand) ||
    compact(record.model) !== compact(evidence.model) ||
    compact(String(record.specs?.Marca ?? "")) !== compact(evidence.brand) ||
    compact(String(record.specs?.Modelo ?? "")) !== compact(evidence.model) ||
    record.specs?.["Capacidad de carga (kg)"] !== evidence.spec ||
    !record.shortDescription.includes(evidence.previous) ||
    !fold(record.longDescription).includes(fold(evidence.evidence))) return record;
  if (evidence.longCorrection && !record.longDescription.includes(evidence.longCorrection.original)) return record;
  const shortDescription = record.shortDescription.replace(evidence.previous, evidence.replacement);
  const longDescription = evidence.longCorrection
    ? record.longDescription.replaceAll(evidence.longCorrection.original, evidence.longCorrection.replacement)
    : record.longDescription;
  const specs = evidence.specCorrection
    ? { ...record.specs, "Capacidad de carga (kg)": evidence.specCorrection }
    : record.specs;
  return { ...record, shortDescription, longDescription, specs };
};

export const reconcileGamVerifiedModelIdentity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "4802" || record.brand !== "XCMG" ||
    record.model !== "XG1418ERT" || record.specs?.Marca !== "XCMG" ||
    record.specs?.Modelo !== "XG1418ERT" || record.specs?.["Capacidad de carga (kg)"] !== "700 KG" ||
    !(record.title ?? "").includes("XG1523ERT") || !record.shortDescription?.includes("XG1523ERT") ||
    !record.longDescription?.includes("XG1523ERT") || !verifiedUrl(record) ||
    !record.url.includes("xg1523ert")) return record;
  return { ...record, model: "XG1523ERT", specs: { ...record.specs, Modelo: "XG1523ERT" } };
};

export const reconcileGamVerifiedBasketLoad = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "4846" || record.brand !== "CTE" ||
    record.model !== "ZED 20.4 HN IVE FIB" || record.specs?.Marca !== "CTE" ||
    record.specs?.Modelo !== "ZED 20.4 HN IVE FIB" ||
    record.specs?.["Capacidad de carga (kg)"] !== "3500 KG" ||
    !(record.title ?? "").includes("ZED 20.4 HN IVE FIB") ||
    !record.shortDescription?.includes("Capacidad de la cesta 250 kg") ||
    !record.longDescription?.includes("camión de 3.500 kg de MMA") ||
    !verifiedUrl(record)) return record;
  return { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "250 KG" } };
};

export const reconcileGamVerifiedListingIdentity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "5879" || record.brand !== "UNICARRIERS" ||
    record.model !== "A2N1L16Q" || record.specs?.Modelo !== "A2N1L16Q" ||
    record.specs?.Marca !== "UNICARRIERS" || !(record.title ?? "").includes("A1N1L16Q") ||
    !record.shortDescription?.includes("UNICARRIERS A1N1L16Q") ||
    !record.longDescription?.includes("UNICARRIERS A2N1L16Q") ||
    !record.url.includes("-a2n1l16q") || !verifiedUrl(record)) return record;
  return {
    ...record,
    title: (record.title ?? "").replace("A1N1L16Q", "A2N1L16Q"),
    shortDescription: record.shortDescription.replace("UNICARRIERS A1N1L16Q", "UNICARRIERS A2N1L16Q")
  };
};

export const reconcileGamVerifiedEditorialCoherence = (record: ProductRecord, general: string | null): string | null => {
  if (record.providerId !== "gam" || !record.reference || general === null) return general;
  const spec = record.specs ?? {};
  if (record.reference === "6934" && record.brand === "JLG" && record.model === "E300AJ" &&
    spec.Marca === "JLG" && spec.Modelo === "E300AJ" && spec["Capacidad de carga (kg)"] === "220 KG" &&
    record.title?.includes("E300AJP") && record.longDescription?.includes("capacidad de carga de 230 kg") &&
    record.longDescription.includes("capacidad de carga de 220 kg") && verifiedUrl(record) &&
    general.includes("capacidad de carga de 230 kg") && general.includes("capacidad de carga de 220 kg")) {
    return "La plataforma articulada eléctrica anunciada como JLG E300AJP es una unidad de ocasión de 2007 para trabajos de acceso en altura. El título y el texto largo del proveedor identifican E300AJP, mientras que el resumen original y el campo técnico «Modelo» indican E300AJ; la variante de esta máquina requiere comprobar la placa. El anuncio menciona 230 kg de carga de cesta, pero la ficha técnica registra 220 kg, de modo que no se confirma una capacidad nominal única sin verificar esta unidad. La ficha declara 11 m de elevación y una pendiente superable del 25 %. El registro identifica 1.620 horas, número de serie 0300109330 y ubicación en Mallorca. Las prestaciones de alcance y capacidad deben contrastarse con el diagrama de trabajo de la variante realmente suministrada.";
  }
  if (record.reference === "6625" && record.brand === "GENIE" && record.model === "GS-5390" &&
    spec["Capacidad de carga (kg)"] === "680 KG" && general.includes("1.400 kg de capacidad de carga"))
    return general.replace("1.400 kg de capacidad de carga", "680 kg de capacidad de carga");
  if ((record.reference === "6869" || record.reference === "6870") && record.brand === "GENIE" &&
    record.model === "GS-3246" && spec["Capacidad de carga (kg)"] === "318 KG" &&
    general.includes("capacidad de carga de 700 kg"))
    return general.replaceAll("capacidad de carga de 700 kg", "capacidad de carga de 318 kg");
  if (record.reference === "4802" && record.brand === "XCMG" && record.model === "XG1523ERT" &&
    spec.Modelo === "XG1523ERT" && spec["Capacidad de carga (kg)"] === "700 KG")
    return general.replace(
      "La ficha estructurada, sin embargo, identifica el modelo XG1418ERT; esa divergencia debe verificarse antes de atribuir prestaciones a una variante.",
      "La identidad XG1523ERT está respaldada por el título, el resumen, la descripción y la referencia original."
    );
  return general;
};
