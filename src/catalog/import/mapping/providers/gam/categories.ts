import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const gamCategories: Readonly<Record<string, string>> = {
  "plataformas-elevadoras-tijera-electricas-segunda-mano": "plataformas-tijera-electricas-segunda-mano",
  "plataformas-elevadoras-tijera-diesel-segunda-mano": "plataformas-tijera-diesel-segunda-mano",
  "plataformas-elevadoras-articuladas-electricas-segunda-mano": "plataformas-articuladas-electricas-segunda-mano",
  "plataformas-elevadoras-articuladas-diesel-segunda-mano": "plataformas-articuladas-diesel-segunda-mano",
  "elevadores-telescopicos-segunda-mano": "plataformas-elevadoras-telescopicas-segunda-mano",
  "elevadores-unipersonales-segunda-mano": "plataformas-unipersonales-segunda-mano",
  "camiones-cesta-segunda-mano": "plataformas-elevadoras-sobre-camion-segunda-mano",
  "carretillas-elevadoras-electricas-segunda-mano": "carretillas-elevadoras-electricas-segunda-mano",
  "carretillas-elevadoras-diesel-segunda-mano": "carretillas-elevadoras-diesel-segunda-mano",
  "carretillas-elevadoras-glp-segunda-mano": "carretillas-elevadoras-glp-segunda-mano",
  "carretillas-elevadoras-retractiles-segunda-mano": "carretillas-elevadoras-retractiles-segunda-mano",
  "transpaletas-elevadoras-electricas-segunda-mano": "transpaletas-electricas-segunda-mano",
  "transpaletas-elevadoras-manuales-segunda-mano": "transpaletas-manuales-segunda-mano",
  "apiladoras-elevadoras-electricas-segunda-mano": "apiladores-electricos-segunda-mano",
  "preparapedidos-segunda-mano": "carretillas-elevadoras-recogepedidos-segunda-mano",
  "dumpers-segunda-mano": "dumpers-segunda-mano",
  "rodillo-tandem-segunda-mano": "rodillo-tandem-segunda-mano",
  "generadores-electricos-segunda-mano": "grupos-electrogenos-segunda-mano",
  "tractores-electricos-segunda-mano": "tractores-electricos-segunda-mano",
  "ciclomotores-electricos-segunda-mano": "ciclomotores-electricos-segunda-mano",
  "motocicletas-electricas-segunda-mano": "motocicletas-electricas-segunda-mano",
  "bicicletas-electricas-segunda-mano": "bicicletas-electricas-segunda-mano",
  "manipuladores-frontales-segunda-mano": "manipulador-teñescopico-segunda-mano",
  "furgonetas-electricas-de-ocasion": "furgonetas-electricas-segunda-mano"
};

const gamNewCategories: Readonly<Record<string, { readonly slug: string; readonly title: RegExp }>> = {
  "plataformas-de-tijera-electricas-xcmg": { slug: "plataforma-tijera-electrica", title: /\bplataforma\b.*\btijera\b.*\belectrica\b/ },
  "plataformas-de-tijera-diesel-xcmg": { slug: "plataforma-tijera-diesel", title: /\bplataforma\b.*\btijera\b.*\bdiesel\b/ },
  "plataforma-articulada-electrica-xcmg": { slug: "plataforma-articulada-electrica", title: /\bplataforma\b.*\barticulada\b.*\belectrica\b/ },
  "plataforma-articulada-diesel-xcmg": { slug: "plataforma-articulada-diesel", title: /\bplataforma\b.*\barticulada\b.*\bdiesel\b/ },
  "plataforma-telescopica-electrica-xcmg": { slug: "plataforma-telescopica-electrica", title: /\bplataforma\b.*\btelescopica\b.*\belectrica\b/ },
  "plataforma-telescopica-diesel-xcmg": { slug: "plataforma-telescopica-diesel", title: /\bplataforma\b.*\btelescopica\b.*\bdiesel\b/ },
  "plataformas-unipersonales-xcmg": { slug: "plataforma-unipersonal-electrica", title: /\bplataforma\b.*\bunipersonal\b.*\belectrica\b/ },
  "carretillas-elevadoras-diesel-hyster": { slug: "carretilla-elevadora-diesel", title: /\bcarretilla\b.*\bdiesel\b/ },
  "carretillas-elevadora-diesel-yale": { slug: "carretilla-elevadora-diesel", title: /\bcarretilla\b.*\bdiesel\b/ },
  "carretillas-elevadoras-electricas-hyster": { slug: "carretilla-elevadora-electrica", title: /\bcarretilla\b.*\belectrica\b/ },
  "carretillas-elevadoras-electricas-yale": { slug: "carretilla-elevadora-electrica", title: /\bcarretilla\b.*\belectrica\b/ },
  "carretillas-elevadoras-retractiles-yale": { slug: "carretilla-retractil", title: /\bcarretilla\b.*\bretractil\b/ },
  "carretillas-retractiles-hyster": { slug: "carretilla-retractil", title: /\bcarretilla\b.*\bretractil\b/ },
  "carretillas-trilaterales-yale": { slug: "carretilla-elevadora-trilateral", title: /\bcarretilla\b.*\btrilateral\b/ },
  "carretillas-trilaterales-hyster": { slug: "carretilla-elevadora-trilateral", title: /\bcarretilla\b.*\b(?:trilateral|pasillos estrechos)\b/ },
  "carretillas-elevadoras-glp-yale": { slug: "carretilla-elevadora-glp", title: /\bcarretilla\b.*\bglp\b/ },
  "carretillas-elevadoras-glp-nuevas": { slug: "carretilla-elevadora-glp", title: /\b(?:carretilla|grua horquilla)\b.*\bglp\b/ },
  "apiladores-hyster": { slug: "apilador-electrico", title: /\bapilador(?:a)?\b.*\belectrico\b/ },
  "apiladores-yale": { slug: "apilador-electrico", title: /\bapilador(?:a)?\b.*\belectrico\b/ },
  "apiladores-logitrans": { slug: "apilador-electrico", title: /\bapilador(?:a)?\b.*\belectrico\b/ },
  "transpaletas-yale": { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\belectrica\b/ },
  "transpaletas-logitrans": { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\belectrica\b/ },
  "transpaletas-hyster": { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\belectrica\b/ },
  "transpaleta-electrica-compacta-1500-kg": { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\b(?:electrica|bateria)\b/ },
  "transpaleta-electrica-conductor-acompanante-1600-kg": { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\belectrica\b/ },
  "tractores-electricos-de-arrastre-tecnacar": { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
  "tractores-electricos-de-carga-tecnacar": { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
  "tractores-arrastre-nuevos": { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
  "tractores-arrastre-yale": { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
  "volteadores-logitrans": { slug: "volteador-de-bidones", title: /\bvolteador\b.*\bbidones\b/ },
  "grupos-electrogenos-nuevos": { slug: "grupos-electrogenos", title: /\bgrupo\b.*\belectrogeno\b/ },
  "grupos-electrogenos-menores-815kvs-pramac": { slug: "grupos-electrogenos", title: /\bgrupo\b.*\belectrogeno\b/ },
  "grupos-electrogenos-mayores-815kvs-pramac": { slug: "grupos-electrogenos", title: /\bgrupo\b.*\belectrogeno\b/ },
  "xcmg-manipulacion": { slug: "manipulador-telescopico", title: /\bmanipulador\b.*\btelescopico\b/ },
  "manipuladores-de-contenedores-vacios-hyster": { slug: "manipulador-de-contenedores", title: /\bmanipulador\b.*\bcontenedores\b/ },
  "manipuladores-de-contenedores-hyster": { slug: "manipulador-de-contenedores", title: /\bmanipulador\b.*\bcontenedores\b/ },
  "barredoras-industriales-nuevas": { slug: "barredora-industrial", title: /\bbarredora\b/ },
  "fregadoras-industriales-nuevas": { slug: "fregadora-industrial", title: /\bfregadora\b/ },
  "aspiradoras-industriales-nuevas": { slug: "aspirador-industrial", title: /\baspiradora\b/ },
  "portaferetros-nuevos": { slug: "portaferetro", title: /\bportaferetros?\b/ }
};

const specializedLogitransCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  if (record.categoryKey !== "otros-nuevos" || parent !== "volteadores-logitrans") return undefined;
  if (/\belevador\s+de\s+bobinas?\b/.test(title)) return "elevador-de-bobina";
  if (/\bvolteador\s+de\s+bidones?\b/.test(title)) return "volteador-de-bidones";
  if (/\bvolteador\b/.test(title)) return "volteador";
  return null;
};

const gamDocumentedCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  const short = fold(record.shortDescription ?? "");
  const long = fold(record.longDescription ?? "");
  const rawMotor = record.specs?.["Tipo motor"];
  const motor = rawMotor === undefined ? "" : typeof rawMotor === "string" ? fold(rawMotor) : null;
  const combined = `${title} ${short} ${long}`;

  if (parent === "reachstacker-hyster" && /\breach[ -]?stacker\b/.test(title)) {
    return /\bmanipulacion de contenedores\b|\bcontenedores iso\b|\bvaciado de contenedores\b/.test(long)
      ? "manipulador-de-contenedores" : null;
  }
  if (parent === "carretillas-elevadoras-diesel-hyster" &&
    /\bcarretilla elevadora glp\b/.test(title) && !/\bdiesel\b/.test(title)) {
    return /\bglp\b/.test(short) && /\bglp\b/.test(long) && motor === "glp" &&
      !/\b(?:diesel|electrica|hibrida)\b/.test(combined)
      ? "carretilla-elevadora-glp" : null;
  }
  if (parent === "carretillas-elevadoras-electricas-hyster" &&
    /\bcarretilla elevadora\b/.test(title) && !/\belectrica\b/.test(title) &&
    !/\b(?:diesel|glp|hibrida)\b/.test(combined)) {
    return /\bcarretilla electrica\b/.test(short) && /\bcarretilla elevadora electrica\b/.test(long) &&
      (motor === "" || motor === "electrico") ? "carretilla-elevadora-electrica" : null;
  }
  if (parent === "tennant" && record.categoryKey === "limpieza-fregadoras" &&
    /\bmicrofregadora\b/.test(title)) {
    return /\bfregadora industrial\b/.test(short) && !/\bbarredora\b/.test(combined)
      ? "fregadora-industrial" : null;
  }
  if (parent === "bravi" && /\bplataforma elevadora\b/.test(title) &&
    /\bplataforma unipersonal electrica\b/.test(long) && motor === "electrico" &&
    !/\b(?:diesel|glp|hibrida)\b/.test(combined)) return "plataforma-unipersonal-electrica";
  if (parent === "tractor-de-remolcado-conductor-sentado-7000-kg" &&
    /\btractor de arrastre\b/.test(title) && motor === "electrico" &&
    !/\b(?:diesel|glp|hibrido)\b/.test(combined)) return "tractor-electrico";
  return undefined;
};

const gamNewTitleCategories: Readonly<Record<string, readonly { readonly slug: string; readonly title: RegExp }[]>> = {
  "elevacion-nueva": [
    { slug: "plataforma-tijera-electrica", title: /\bplataforma\b.*\btijera\b.*\belectrica\b/ },
    { slug: "plataforma-tijera-diesel", title: /\bplataforma\b.*\btijera\b.*\bdiesel\b/ },
    { slug: "plataforma-articulada-electrica", title: /\bplataforma\b.*\barticulada\b.*\belectrica\b/ },
    { slug: "plataforma-articulada-diesel", title: /\bplataforma\b.*\barticulada\b.*\bdiesel\b/ },
    { slug: "plataforma-telescopica-electrica", title: /\bplataforma\b.*\btelescopica\b.*\belectrica\b/ },
    { slug: "plataforma-telescopica-diesel", title: /\bplataforma\b.*\btelescopica\b.*\bdiesel\b/ },
    { slug: "plataforma-unipersonal-electrica", title: /\bplataforma\b.*\bunipersonal\b.*\belectrica\b/ },
    { slug: "plataforma-sobre-oruga", title: /\bplataforma\b.*\bsobre orugas\b/ },
    { slug: "plataforma-sobre-camion", title: /\bplataformas?\b.*\bsobre camion\b/ }
  ],
  "carretillas-nuevas": [
    { slug: "carretilla-elevadora-electrica", title: /\bcarretilla\b.*\belectrica\b/ },
    { slug: "carretilla-elevadora-diesel", title: /\bcarretilla\b.*\bdiesel\b/ },
    { slug: "carretilla-elevadora-glp", title: /\b(?:carretilla|grua horquilla)\b.*\bglp\b/ },
    { slug: "carretilla-retractil", title: /\bcarretilla\b.*\bretractil\b/ },
    { slug: "carretilla-elevadora-trilateral", title: /\bcarretilla\b.*\btrilateral\b/ }
  ],
  "apiladores-nuevos": [
    { slug: "apilador-electrico", title: /\bapilador(?:a)?\b.*\belectrico\b/ }
  ],
  "otros-nuevos": [
    { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
    { slug: "grupos-electrogenos", title: /\bgrupo\b.*\belectrogeno\b/ },
    { slug: "manipulador-telescopico", title: /\bmanipulador\b.*\btelescopico\b/ },
    { slug: "volteador-de-bidones", title: /\bvolteador\b.*\bbidones\b/ }
  ],
  "marcas-nuevas": [
    { slug: "transpaleta-electrica", title: /\btranspaleta\b.*\belectrica\b/ },
    { slug: "apilador-electrico", title: /\bapilador\b.*\belectrico\b/ },
    { slug: "manipulador-de-contenedores", title: /\bmanipulador\b.*\bcontenedores\b/ },
    { slug: "tractor-electrico", title: /\btractor\b.*\belectrico\b/ },
    { slug: "minicargadora", title: /\bminicargadora\b/ },
    { slug: "aspirador-industrial", title: /\baspiradora\b/ }
  ],
  "limpieza-fregadoras": [
    { slug: "fregadora-industrial", title: /\bfregadora\b/ }
  ],
  "limpieza-barredoras": [
    { slug: "barredora-industrial", title: /\bbarredora\b/ }
  ],
  "portaferetros": [
    { slug: "portaferetro", title: /\bportaferetros?\b/ }
  ]
};

const gamElevationCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  if (record.categoryKey !== "elevacion-nueva") return undefined;
  if (parent === "plataformas-de-tijera-electricas-xcmg" && /\btijera(?=\b|\d)/.test(title)) {
    const description = fold(record.shortDescription ?? "");
    const confirms = /\bplataforma\b[^.!?]{0,100}\btijera\b[^.!?]{0,50}\belectrica\b/.test(description);
    if (confirms && !/\b(?:diesel|hibrid[oa]|gasolina|glp)\b/.test(title + " " + description) &&
      /\b(?:bateria|electric[oa])\b/.test(title + " " + description)) return "plataforma-tijera-electrica";
  }
  return undefined;
};

const gamHandlingCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  const apiladores = ["apiladores-hyster", "apiladores-yale", "apiladores-logitrans"];
  const transpaletas = ["transpaletas-hyster", "transpaletas-yale", "transpaletas-logitrans", "transpaleta-electrica-compacta-1500-kg", "transpaleta-electrica-conductor-acompanante-1600-kg"];
  const preparapedidos = ["recogepedidos-hyster", "recogepedidos-yale", "yale"];
  if (preparapedidos.includes(parent) && /\b(?:recogepedidos?|preparapedidos?)\b/.test(title)) {
    return /\b(?:plataforma|carretilla|apilador|transpaleta)\b/.test(title) ? null : "preparapedido";
  }
  const apilador = apiladores.includes(parent) && /\bapilador(?:a|es|as)?\b/.test(title);
  const transpaleta = (transpaletas.includes(parent) || parent === "hyster") &&
    /\b(?:transpaletas?|portador de paletas)\b/.test(title);
  if (!apilador && !transpaleta) return undefined;
  const short = fold(record.shortDescription ?? "");
  const source = `${title} ${short}`;
  const specs = record.specs ?? {};
  const drive = fold([specs["Tipo motor"], specs["Motorización"]].filter((value) => typeof value === "string").join(" "));
  if (/\b(?:semi[ -]?electric[oa]s?|hibrid[oa]s?|diesel|glp|gasolina)\b/.test(`${source} ${drive}`)) return null;
  if (transpaleta && /\btranspaleta\b.*\btijera\b/.test(title)) return "transpaleta-tijera";
  const manual = /\bmanual(?:es)?\b/.test(title) ||
    /\b(?:transpaleta|apilador(?:a)?)\s+manual\b/.test(short);
  const electric = /\belectric[oa]s?\b|\b(?:ion de litio|bateria de litio|propulsada con ion de litio)\b/.test(source) ||
    /\belectric[oa]s?\b/.test(drive);
  const specManual = /\bmanual\b/.test(drive);
  const specElectric = /\belectric[oa]s?\b/.test(drive);
  if ((manual && (electric || specElectric)) || (specManual && (electric || specElectric)) ||
    (specElectric && specManual)) return null;
  if ((manual || specManual) && transpaleta && parent === "transpaletas-yale" &&
    /\btranspaletas? motorizadas?\b/.test(fold(record.longDescription ?? "")) &&
    /\b24\s*v\b/.test(fold(typeof specs["Capacidad de la batería"] === "string" ? specs["Capacidad de la batería"] : ""))) return null;
  if (manual || specManual) return apilador ? "apilador-manual" : "transpaleta-manual";
  if (electric) return apilador ? "apilador-electrico" : "transpaleta-electrica";
  if (parent === "transpaletas-yale" && record.categoryKey === "marcas-nuevas" &&
    /\btranspaleta\b/.test(title) && !/\b(?:manual|tijera)\b/.test(title)) {
    const model = specs["Modelo"];
    const battery = specs["Capacidad de la batería"];
    const modelName = typeof model === "string" ? fold(model).trim() : "";
    const batteryText = typeof battery === "string" ? fold(battery) : "";
    const long = fold(record.longDescription ?? "");
    const combined = `${title} ${short} ${long} ${drive}`;
    if (modelName && modelName.length >= 4 &&
      title.includes(modelName) && long.includes(modelName) &&
      /\btranspaletas? motorizadas? compactas?\b/.test(long) &&
      /\b24\s*v\b/.test(batteryText) &&
      !/\b(?:manual|diesel|glp|lpg|gasolina|hibrid[oa]|semi[ -]?electric[oa])\b/.test(combined)) {
      return "transpaleta-electrica";
    }
    return null;
  }
  return null;
};

export const newCategorySlug = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam") return null;
  let url: URL;
  try { url = new URL(record.url); }
  catch { return null; }
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname !== "online.gamrentals.com" || segments[0] !== "es") return null;
  const parent = segments.at(-2) ?? "";
  if (/(?:segunda-mano|de-ocasion)/.test(parent)) return null;
  const title = fold(record.title ?? "");
  if (/\bsemi\s+electric[oa]\b/.test(title) || /\bhibrid[oa]\b/.test(title) ||
    (/\bglp\b/.test(title) && /\bdiesel\b/.test(title)) ||
    (/\belectric[oa]\b/.test(title) && /\bdiesel\b/.test(title)) ||
    (/\bbarredora\b/.test(title) && /\bfregadora\b/.test(title))) return null;
  const special = specializedLogitransCategory(record, parent, title);
  if (special !== undefined) return special;
  const handling = gamHandlingCategory(record, parent, title);
  if (handling !== undefined) return handling;
  const elevation = gamElevationCategory(record, parent, title);
  if (elevation !== undefined) return elevation;
  const documented = gamDocumentedCategory(record, parent, title);
  if (documented !== undefined) return documented;
  const explicit = gamNewCategories[parent];
  if (explicit) return explicit.title.test(title) ? explicit.slug : null;
  const matches = (gamNewTitleCategories[record.categoryKey] ?? []).filter((item) => item.title.test(title));
  return matches.length === 1 ? matches[0]?.slug ?? null : null;
};

export const gamUsedCategorySlug = (record: ProductRecord, path: readonly string[], hostname: string): string | null => {
  if (hostname === "online.gamrentals.com" && path[0] === "es") {
    const parent = path.at(-2) ?? "";
    const title = fold(record.title ?? "");
    if (parent === "mini-cargadoras-segunda-mano" && /\bminiexcavadora\b/.test(title)) {
      return "miniexcavadoras-segunda-mano";
    }
    if (parent === "carretillas-elevadoras-diesel-segunda-mano" &&
      /\bcarretilla elevadora electrica\b/.test(title)) {
      const short = fold(record.shortDescription ?? "");
      const long = fold(record.longDescription ?? "");
      const combined = `${title} ${short} ${long}`;
      const rawMotor = record.specs?.["Tipo motor"];
      const motor = rawMotor === undefined ? "" : typeof rawMotor === "string" ? fold(rawMotor) : null;
      if ((motor === "" || motor === "electrico") &&
        /\bcarretilla (?:frontal )?electrica\b/.test(short) &&
        /\bcarretilla elevadora electrica\b/.test(long) &&
        !/\b(?:diesel|glp|gasolina|hibrida)\b/.test(combined)) {
        return "carretillas-elevadoras-electricas-segunda-mano";
      }
    }
    if (parent === "carretillas-elevadoras-electricas-segunda-mano" && /\btrilateral\b/.test(title)) {
      return "carretillas-elevadoras-trilaterales-segunda-mano";
    }
    if (parent.startsWith("transpaletas-elevadoras-") && /\btranspaleta\b/.test(title)) {
      if (/\belectrica\b/.test(title) && !/\bmanual\b/.test(title)) return "transpaletas-electricas-segunda-mano";
      if (/\bmanual\b/.test(title) && !/\belectrica\b/.test(title)) return "transpaletas-manuales-segunda-mano";
      if (/\belectrica\b/.test(title) && /\bmanual\b/.test(title)) return null;
    }
    return gamCategories[parent] ?? null;
  }
  return null;
};
