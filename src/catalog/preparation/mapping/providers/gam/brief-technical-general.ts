import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

type Kind = "funeral" | "battery" | "platform";
type Evidence = {
  readonly url: string;
  readonly brand: string | null;
  readonly model: string;
  readonly category: string;
  readonly sourceSha256: string;
  readonly generalSha256: string;
  readonly kind: Kind;
};

const evidence: Readonly<Record<string, Evidence>> = {
  "2620": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2620-ares-45", "brand": null, "model": "Ares 45", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "e4b7a304fa44a26edb21da22e529e9dfda9552e5c138f899de855babf9a352ed", "kind": "funeral"},
  "2621": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2621-ares-50", "brand": null, "model": "Ares 50", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "80fa8ba01e6d21ed3f18e57eb7716dc9401ca6d3e718bd7ad3c3fa0bc1fa39c7", "kind": "funeral"},
  "2622": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2622-ares-55", "brand": null, "model": "Ares 55", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "8de4c5a5d4379d68b11b5718c78831aca0bd282f2918bc7b9dadf4836f6a3d6c", "kind": "funeral"},
  "2623": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2623-portaferetros-draco-36", "brand": null, "model": "Draco 36", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "2d4291397ac29d55593dfdac300a5d658158a5ff5ba1276d9a87150a772a52ca", "kind": "funeral"},
  "2624": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2624-portaferetros-draco-45", "brand": "Portaféretros", "model": "Draco 45", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "e3e2c70cabb3e94c28f3bc9ea6e5c6da1e0514041b349453fa1de8b3e5d5a5fe", "kind": "funeral"},
  "2625": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2625-portaferetros-orion-45", "brand": null, "model": "Orion 45", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "8c19394f9756f1e681f8852da8347d27c6bbdb663aadd3f122a25ece318d1baa", "kind": "funeral"},
  "2626": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2626-portaferetros-orion-45-cp", "brand": null, "model": "Orion 45 CP", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "192e4710f64c14fae970ccf07654bcc4d1dce9278edde91aee9aa74f659d466f", "kind": "funeral"},
  "2627": {"url": "https://online.gamrentals.com/es/portaferetros-nuevos/2627-portaferetros-orion-55-", "brand": null, "model": "Orion 55", "category": "portaferetros", "sourceSha256": "aade1f432ce01753e3b8a0c6b4ecc862e8781c721b9bc72ff0c8cfe858225f47", "generalSha256": "c7abe029e5e24e6502954d8ae1b33564d748ca2f7eff163b5fd5d5bbfaa86d45", "kind": "funeral"},
  "2297": {"url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/2297-carretilla-frontal-electrica-yale-erp50vm", "brand": "YALE", "model": "ERP50VM", "category": "carretillas-nuevas", "sourceSha256": "fbfc37c2a6e3a8d0392c801961dd24929eb50e574371bb4d649fa389ecc1a051", "generalSha256": "53de648104b9893c2b317f8407b2e6f3f42e6b60f23e144043ed5a68e7f4012c", "kind": "battery"},
  "2229": {"url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2229-carretilla-retractil-yale-mr14e", "brand": "YALE", "model": "MR14E", "category": "carretillas-nuevas", "sourceSha256": "e2b4dc456f759e82b07322edb6b044ae747cfbe64c13615e4c608f97c15cd93d", "generalSha256": "b7be053f58ef38eefc97ddc5c1252e12ded73bb988d9cc9543fee6e60b339c46", "kind": "battery"},
  "2334": {"url": "https://online.gamrentals.com/es/apiladores-yale/2334-apilador-electrico-a-pie-yale-ms12x", "brand": "YALE", "model": "MS12X", "category": "apiladores-nuevos", "sourceSha256": "671baa3f95192cb66243b94e274963209886f2e4dcfc3571d478027291e592c1", "generalSha256": "5bbaf5602897acfc67cacfb53df876d10fee3c9cb103651ba4269de1271c0c3a", "kind": "battery"},
  "2202": {"url": "https://online.gamrentals.com/es/apiladores-yale/2202-aplicador-electrico-a-pie-yale-ms20", "brand": "YALE", "model": "MS20", "category": "apiladores-nuevos", "sourceSha256": "b771a05975ee3a22df895034c06550c4a79cb0fbcddf5fdb157bf5b946a7afb0", "generalSha256": "38031bc8cdcf6732f15ac62cac249986612681a6a06b523843abb6d66d7dc494", "kind": "battery"},
  "4774": {"url": "https://online.gamrentals.com/es/plataforma-articulada-electrica-xcmg/4774-plataforma-articulada-electrica-xcmg-xga20ack-li", "brand": "XCMG", "model": "XGA20ACK-LI", "category": "elevacion-nueva", "sourceSha256": "ecbceffba3526b7659539f7c2ae9e63b6542e5d934b5006642713dba41e7ea53", "generalSha256": "8dbf6ebc0b04d05d399e928d6593269a6491a3a9f3d61d36c9d5f572dd66e919", "kind": "platform"},
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const normalize = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase().replace(/[^a-z0-9]/gu, "");
const readSpec = (record: ProductRecord, key: string, pattern: RegExp): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && pattern.test(value) ? value : null;
};

const funeralDetails = (record: ProductRecord): string | null => {
  if (record.longDescription?.trim() !== "Equipamiento Estándar:") return null;
  const weight = readSpec(record, "Peso", /^\d{2,5} KG$/u);
  const basket = readSpec(record, "Dimensiones Cesta", /^\d[\d., ]*\s*x\s*\d[\d., ]* metros?$/iu);
  const platform = record.specs?.["Altura Plataforma"] === undefined ? null :
    readSpec(record, "Altura Plataforma", /^\d+(?:[.,]\d+)? metros?$/iu);
  if (!weight || !basket || (record.specs?.["Altura Plataforma"] !== undefined && !platform)) return null;
  return `La ficha indica además un peso de ${weight.toLowerCase()} y unas dimensiones de cesta de ${basket}.` +
    (platform ? ` La altura de plataforma figura como ${platform}.` : "");
};

const batteryDetails = (record: ProductRecord): string | null => {
  if (record.longDescription?.trim() !== record.shortDescription?.trim()) return null;
  const battery = readSpec(record, "Capacidad de la batería", /^\d{2}V \/ \d{2,4}-\d{2,4}Ah(?: \| Li-ion \d{2}V \/ \d{2,4}Ah)?\(V\/Ah\)$/u);
  if (!battery) return null;
  const height = record.reference === "2297" ? readSpec(record, "Altura de elevación (mm)", /^\d{4,5} mm$/u) : null;
  const center = record.reference === "2297" ? readSpec(record, "Centro de carga", /^\d{3,4} mm$/u) : null;
  if (record.reference === "2297" && (!height || !center)) return null;
  return `La ficha técnica recoge también una capacidad de batería indicada como ${battery}.` +
    (height && center ? ` Además, declara una altura de elevación de ${height} y un centro de carga de ${center}.` :
      " Son valores del catálogo técnico, sin identificar una batería instalada en una unidad concreta.");
};

const platformDetails = (record: ProductRecord): string | null => {
  if (record.longDescription?.trim() !== record.shortDescription?.trim()) return null;
  const height = readSpec(record, "Altura", /^\d{4} mm$/u);
  const slope = readSpec(record, "Pendiente superable", /^\d{1,2}%$/u);
  const basket = readSpec(record, "Dimensiones Cesta", /^\d(?:[.,]\d+)? x \d(?:[.,]\d+)? metros?$/u);
  if (!height || !slope || !basket || record.specs?.["Tipo de batería"] !== "Batería de litio") return null;
  return `La altura propia indicada es de ${height}, la pendiente superable publicada de ${slope} y las dimensiones de la cesta de ${basket}.`;
};

export const resolveGamVerifiedBriefGeneral = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  const expected = record.reference ? evidence[record.reference] : undefined;
  const general = preparedGeneral?.trim();
  const source = record.longDescription;
  if (!expected || !general || !source || record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.url !== expected.url || record.brand !== expected.brand || record.model !== expected.model ||
    record.categoryKey !== expected.category || record.specs?.Modelo !== expected.model ||
    (expected.brand === null ? record.specs?.Marca !== undefined : record.specs?.Marca !== expected.brand) ||
    (record.externalReference && normalize(record.externalReference) !== normalize(expected.model)) ||
    !record.title || !normalize(record.title).includes(normalize(expected.model)) ||
    !record.shortDescription || (expected.kind !== "funeral" &&
      !normalize(record.shortDescription).includes(normalize(expected.model))) ||
    digest(source) !== expected.sourceSha256 || digest(general) !== expected.generalSha256 ||
    general.split(/\s+/u).length >= 60) return null;

  const addition = expected.kind === "funeral" ? funeralDetails(record) :
    expected.kind === "battery" ? batteryDetails(record) : platformDetails(record);
  if (!addition) return null;
  const updated = `${general} ${addition}`;
  return updated.split(/\s+/u).length >= 60 ? updated : null;
};
