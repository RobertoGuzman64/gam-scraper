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
    { slug: "plataforma-sobre-camion", title: /\bplataforma\b.*\bsobre camion\b/ }
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
    (/\belectric[oa]\b/.test(title) && /\bdiesel\b/.test(title)) ||
    (/\bbarredora\b/.test(title) && /\bfregadora\b/.test(title))) return null;
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
