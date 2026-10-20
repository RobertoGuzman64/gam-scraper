import { normalizeSpace } from "./string.js";

export const extractUrlCategorySlug = (url: string): string => {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        const i = parts.indexOf("es");
        if (i < 0) return "";
        return normalizeSpace(parts[i + 1] ?? "");
    } catch {
        return "";
    }
};

export const normalizeGamSlugBase = (slug: string): string => {
    const s = normalizeSpace(slug).toLowerCase();
    if (!s) return "";
    const withoutSaleSuffix = s
        .replace(/-segunda-mano\b/g, "")
        .replace(/-de-segunda-mano\b/g, "")
        .replace(/-de-ocasion\b/g, "")
        .replace(/-ocasion\b/g, "")
        .replace(/-usado\b/g, "")
        .replace(/-usada\b/g, "")
        .replace(/-venta\b/g, "")
        .replace(/-alquiler\b/g, "");
    return normalizeSpace(withoutSaleSuffix).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
};

export const slugCandidatesFromUrlSlug = (urlSlug: string): readonly string[] => {
    const raw = normalizeSpace(urlSlug).toLowerCase();
    if (!raw) return [];

    const candidates: string[] = [];
    const base = normalizeGamSlugBase(raw);

    const withSuffix = (s: string): string => {
        const t = normalizeSpace(s).toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!t) return "";
        if (t.endsWith("-segunda-mano")) return t;
        return `${t}-segunda-mano`;
    };

    const push = (s: string): void => {
        const t = normalizeSpace(s).toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!t) return;
        if (!candidates.includes(t)) candidates.push(t);
    };

    push(raw);
    push(base);
    push(withSuffix(base));

    const noElevadoras = base.replace(/\bplataformas-elevadoras-/, "plataformas-").replace(/-elevadoras-/g, "-");
    push(noElevadoras);
    push(withSuffix(noElevadoras));

    const elevadoresToPlataformas = base.replace(/^elevadores-/, "plataformas-");
    push(elevadoresToPlataformas);
    push(withSuffix(elevadoresToPlataformas));

    const telescopicas = base
        .replace(/^elevadores-/, "plataformas-")
        .replace(/-telescopicos\b/, "-telescopicas")
        .replace(/-telescopico\b/, "-telescopica");
    push(telescopicas);
    push(withSuffix(telescopicas));

    const plataformasElevadorasTelescopicas = telescopicas.replace(/^plataformas-/, "plataformas-elevadoras-");
    push(plataformasElevadorasTelescopicas);
    push(withSuffix(plataformasElevadorasTelescopicas));

    const transpaletas = base.replace(/^transpaletas-elevadoras-/, "transpaletas-");
    push(transpaletas);
    push(withSuffix(transpaletas));

    const apiladoras = base.replace(/^apiladoras-elevadoras-/, "apiladores-").replace(/^apiladoras-/, "apiladores-");
    push(apiladoras);
    push(withSuffix(apiladoras));

    const apiladoresElectricos = base
        .replace(/^apiladoras-elevadoras-/, "apiladores-")
        .replace(/^apiladoras-/, "apiladores-")
        .replace(/-electricas\b/, "-electricos")
        .replace(/-electrica\b/, "-electrico");
    push(apiladoresElectricos);
    push(withSuffix(apiladoresElectricos));

    const preparapedidos = base.replace(/^preparapedidos\b/, "preparapedido");
    push(preparapedidos);
    push(withSuffix(preparapedidos));

    const carretillas4x4 = base.replace(/^carretillas-todoterreno-4x4\b/, "carretillas-todoterreno");
    push(carretillas4x4);
    push(withSuffix(carretillas4x4));

    const minicargadoras = base.replace(/^mini-cargadoras\b/, "minicargadoras").replace(/^mini-cargadora\b/, "minicargadora");
    push(minicargadoras);
    push(withSuffix(minicargadoras));

    const miniexcavadoras = base.replace(/^mini-excavadoras\b/, "miniexcavadoras").replace(/^mini-excavadora\b/, "miniexcavadora");
    push(miniexcavadoras);
    push(withSuffix(miniexcavadoras));

    if (base.startsWith("camiones-cesta")) {
        push("plataformas-elevadoras-sobre-camion-segunda-mano");
        push("plataformas-elevadoras-sobre-camion");
    }

    if (base.startsWith("manipuladores-frontales")) {
        push("manipulacion-elevacion-cargas-segunda-mano");
        push("manipulacion-elevacion-cargas");
    }

    if (base.startsWith("resto-maquinaria")) {
        push("maquinaria");
    }

    return candidates;
};
