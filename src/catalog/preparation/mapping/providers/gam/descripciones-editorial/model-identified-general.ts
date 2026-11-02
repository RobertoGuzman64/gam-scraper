import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";

const verified: Readonly<Record<string, {
  readonly brand: string;
  readonly model: string;
  readonly category: string;
  readonly sourceStart: string;
}>> = {
  "217": { brand: "LOGITRANS", model: "MDT", category: "otros-nuevos", sourceStart: "Este volteador tiene una capacidad de carga" },
  "215": { brand: "LOGITRANS", model: "RR S", category: "otros-nuevos", sourceStart: "El volteador multifunción es una herramienta" },
  "216": { brand: "LOGITRANS", model: "RL 500", category: "otros-nuevos", sourceStart: "El elevador de bobinas Logitrans es un complemento" },
  "211": { brand: "LOGITRANS", model: "ELFRA/SELFRA", category: "otros-nuevos", sourceStart: "Este volteador puede inclinar cajones y cajas" },
  "212": { brand: "LOGITRANS", model: "ELFR/SELFR", category: "otros-nuevos", sourceStart: "Este volteador tiene un impacto directo sobre" },
  "213": { brand: "LOGITRANS", model: "ELFR", category: "otros-nuevos", sourceStart: "El volteador multifunción es una herramienta" },
  "234": { brand: "LOGITRANS", model: "Mover", category: "marcas-nuevas", sourceStart: "La batería es uno de los componentes estrella" },
  "239": { brand: "LOGITRANS", model: "LogiQ 200/300", category: "marcas-nuevas", sourceStart: "Las transpaletas para cuartos de palé se emplean" },
  "237": { brand: "LOGITRANS", model: "Panther Flex", category: "marcas-nuevas", sourceStart: "Este tipo de elevadores ofrecen la máxima calidad" },
  "243": { brand: "LOGITRANS", model: "HLI", category: "marcas-nuevas", sourceStart: "La transpaleta tiene el timón, la bomba de pistones" },
  "235": { brand: "LOGITRANS", model: "Panther", category: "marcas-nuevas", sourceStart: "Este tipo de elevadores ofrecen la máxima calidad" },
  "6185": { brand: "CTE", model: "DZ 20 AUTO FIB", category: "elevacion-nueva", sourceStart: "La plataforma sobre camión articulado CTE DZ 20 AUTO" },
  "6188": { brand: "CTE", model: "B-LIFT 20 J AUTO FIB", category: "elevacion-nueva", sourceStart: "La plataforma sobre camión telescópico CTE B-LIFT 20 J AUTO" },
  "4765": { brand: "XCMG", model: "XGA16ACK-Li", category: "elevacion-nueva", sourceStart: "La plataforma elevadora articulada eléctrica XCMG XGA16ACK" },
  "4031": { brand: "Tennant", model: "BCS S20 Batería", category: "limpieza-barredoras", sourceStart: "La Barredora TENNANT BCS S20 a batería" },
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

export const resolveGamModelIdentifiedGeneral = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const evidence = reference && Object.hasOwn(verified, reference) ? verified[reference] : undefined;
  const source = record.longDescription?.trim();
  const title = record.title?.trim();
  const short = record.shortDescription?.trim();
  if (record.providerId !== "gam" || !reference || !evidence || !general || !source || !title || !short ||
    record.brand !== evidence.brand || record.model !== evidence.model || record.categoryKey !== evidence.category ||
    !source.startsWith(evidence.sourceStart) ||
    record.condition !== "Nuevo" ||
    record.specs?.Marca !== evidence.brand || record.specs?.Modelo !== evidence.model ||
    (record.externalReference && normalize(record.externalReference) !== normalize(evidence.model)) ||
    !normalize(title).includes(normalize(evidence.brand)) ||
    !normalize(title).includes(normalize(evidence.model)) ||
    !normalize(short).includes(normalize(evidence.brand)) ||
    !normalize(short).includes(normalize(evidence.model)) ||
    normalize(general).includes(normalize(evidence.model))) return null;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      parts.length !== 3 || parts[0] !== "es" || !parts[2]?.startsWith(`${reference}-`) ||
      !normalize(parts[2]).includes(normalize(evidence.model)) || url.search || url.hash) return null;
  } catch {
    return null;
  }

  return `Modelo identificado en la ficha: ${evidence.brand} ${evidence.model}.\n\n${general}`;
};

const exactVariants: Readonly<Record<string, {
  readonly brand: string;
  readonly model: string;
  readonly category: string;
  readonly sourceSha256: string;
}>> = {
  "2276": { brand: "YALE", model: "ERC22VG (MWB)", category: "carretillas-nuevas", sourceSha256: "83efcce0633f45710d07479c8cb71bf92ddaec766abe346da34cbebe6ac1f70c" },
  "2277": { brand: "YALE", model: "ERC25VG (MWB)", category: "carretillas-nuevas", sourceSha256: "c5942d8a1ec2c85632a4db07da44f8b8b6cab68bfcea8de551be44ea8817058e" },
  "2278": { brand: "YALE", model: "ERC30VG (MWB)", category: "carretillas-nuevas", sourceSha256: "17574b0adf372292cf1c0a8ca4fefbc8238c6439458a0e4df9a317a2305cf334" },
  "2279": { brand: "YALE", model: "ERC32VG (LWB)", category: "carretillas-nuevas", sourceSha256: "9853529df6acf5a31991fcd41b04c56419882c1ccb4ea570c69e86ad9ce35bbc" },
  "2280": { brand: "YALE", model: "ERC35VG (LWB)", category: "carretillas-nuevas", sourceSha256: "3c9635b98234104fbe2cf6b22c7f4d1bdfc7019118d0567d4ccad24f82d38264" },
  "2291": { brand: "YALE", model: "ERP16VF (MWB)", category: "carretillas-nuevas", sourceSha256: "cfe7fe333bd512e894d8558c76ee2eaa47b6629233e850699d3e02089f73d9bf" },
  "2293": { brand: "YALE", model: "ERP20VF (LWB)", category: "carretillas-nuevas", sourceSha256: "03990beb63a59a3fde78798909708cdee43f819b51a4eebbddd550249ecc8cf3" },
  "2294": { brand: "YALE", model: "ERP35VL (LWB)", category: "carretillas-nuevas", sourceSha256: "ef1048dcd305b5280d5025ea5e06a65948fb7dc1073853229b7c345cbe17f76b" },
  "4734": { brand: "XCMG", model: "XG0807AC-LI", category: "elevacion-nueva", sourceSha256: "ef11eb0599214dd6e0e082cbba04790f4e8b3a9c603150850265fc029b6b67bd" },
  "4739": { brand: "XCMG", model: "XG1008AC-LI", category: "elevacion-nueva", sourceSha256: "9c125a035c1cd466008c8831b030e9ea5512db9524439290a18472e3c5ffd6c8" },
  "4741": { brand: "XCMG", model: "XG1012AC-LI", category: "elevacion-nueva", sourceSha256: "6c6a7b544cd887f64bf917aa6920d9bb55c556651a561921ca93901ef4165260" },
  "4743": { brand: "XCMG", model: "XG1212AC-LI", category: "elevacion-nueva", sourceSha256: "bda513c8b82629c01a5ca27235bc541884b4395428808f32a1e6794795e82d19" },
  "4745": { brand: "XCMG", model: "XG1412AC-LI", category: "elevacion-nueva", sourceSha256: "0ecdc1ea1769fa113e309ad006addf63e4b6ade2de6537d05d51cc2b7d81c3be" },
  "4747": { brand: "XCMG", model: "XG1614AC-LI", category: "elevacion-nueva", sourceSha256: "e717b295b72050b1bb2fd99652e4c96744786d665cd8298e383cebd3cb014cf5" },
  "4768": { brand: "XCMG", model: "XGA18ACK-LI", category: "elevacion-nueva", sourceSha256: "cdbca4e9b5b24fae337de164acaa47c52a0f235297be025c2dd73ae8446e5398" }
};

export const resolveGamExactVariantGeneral = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const evidence = reference && Object.hasOwn(exactVariants, reference) ? exactVariants[reference] : undefined;
  const source = record.longDescription?.trim();
  const title = record.title?.trim();
  const short = record.shortDescription?.trim();
  if (record.providerId !== "gam" || !reference || !evidence || !source || !general || !title || !short ||
    record.brand !== evidence.brand || record.model !== evidence.model || record.categoryKey !== evidence.category ||
    record.condition !== "Nuevo" || record.specs?.Marca !== evidence.brand ||
    record.specs?.Modelo !== evidence.model || general.trim() !== source ||
    createHash("sha256").update(source).digest("hex") !== evidence.sourceSha256) return null;

  const suffix = evidence.model.endsWith("-LI") ? "-LI" :
    evidence.model.endsWith(" (MWB)") ? " (MWB)" :
    evidence.model.endsWith(" (LWB)") ? " (LWB)" : null;
  if (!suffix) return null;
  const baseModel = evidence.model.slice(0, -suffix.length);
  if (record.externalReference && normalize(record.externalReference) !==
    normalize(suffix === "-LI" ? evidence.model : baseModel)) return null;
  if (!normalize(title).includes(normalize(evidence.brand)) ||
    !normalize(title).includes(normalize(baseModel)) ||
    !normalize(short).includes(normalize(evidence.brand)) ||
    !normalize(short).includes(normalize(evidence.model.endsWith("-LI") ? evidence.model : baseModel)) ||
    (suffix === "-LI" && (record.specs?.["Tipo de batería"] !== "Batería de litio" ||
      !/bater[ií]a de litio/iu.test(source)))) return null;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      parts.length !== 3 || parts[0] !== "es" || !parts[2]?.startsWith(`${reference}-`) ||
      !normalize(parts[2]).includes(normalize(suffix === "-LI" ? evidence.model : baseModel)) ||
      url.search || url.hash) return null;
  } catch {
    return null;
  }

  const modelInProse = new RegExp(`\\b${evidence.brand}\\s+${baseModel}\\b`, "iu");
  if (modelInProse.test(general) === false || general.includes(evidence.model)) return null;
  return general.replace(modelInProse, (match) => `${match}${suffix}`);
};

const identifiedSourceModels: Readonly<Record<string, {
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly category: string;
  readonly condition: "Nuevo" | "Segunda mano";
  readonly sourceSha256: string;
}>> = {
  "6634": {
    url: "https://online.gamrentals.com/es/transpaletas-elevadoras-manuales-segunda-mano/6634-2021-logitrans-logiq-200",
    brand: "LOGITRANS", model: "LOGIQ 200", category: "manutencion", condition: "Segunda mano",
    sourceSha256: "3fcba5806ddad7bf5e8b09f247be9ad4320b9b4164d4d132752cb9fa0a713870"
  },
  "3314": {
    url: "https://online.gamrentals.com/es/packmat/3314-packmat-pk711",
    brand: "PACKMAT", model: "PK711", category: "marcas-nuevas", condition: "Nuevo",
    sourceSha256: "94c2ee8f7245eadbbfdfb67ac42d367e5bd110019ecd8de66f75ce619ca606dd"
  }
};

export const resolveGamSourceIdentifiedModel = (record: ProductRecord, general: string | null): string | null => {
  const expected = record.reference ? identifiedSourceModels[record.reference] : undefined;
  const source = record.longDescription?.trim();
  const short = record.shortDescription;
  if (!expected || !source || !general || record.providerId !== "gam" ||
    record.url !== expected.url || record.brand !== expected.brand || record.model !== expected.model ||
    record.categoryKey !== expected.category || record.condition !== expected.condition ||
    record.specs?.Marca !== expected.brand || record.specs?.Modelo !== expected.model ||
    !record.title || !short || !normalize(record.title).includes(normalize(`${expected.brand}${expected.model}`)) ||
    !normalize(short).includes(normalize(`${expected.brand}${expected.model}`)) ||
    createHash("sha256").update(source).digest("hex") !== expected.sourceSha256 ||
    general !== source || normalize(general).includes(normalize(expected.model)) ||
    (expected.condition === "Nuevo" && normalize(record.externalReference ?? "") !== normalize(expected.model)) ||
    (expected.condition === "Segunda mano" && !/^GAM-\d+$/u.test(record.externalReference ?? ""))) return null;

  return `Modelo identificado en la ficha: ${expected.brand} ${expected.model}.\n\n${general}`;
};
