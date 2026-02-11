export const buildDefaultMetadata = (categoryKey: string): { keywords: string[]; tags: string[] } => {
    const base = ["maquinaria", "maquinaria-de-ocasion"];
    const perKey: Record<string, string[]> = {
        elevacion: ["elevacion-de-segunda-mano"],
        manutencion: ["manutencion-de-segunda-mano"],
        manipulacion: ["manipulacion-de-segunda-mano"],
        energia: ["energia-de-segunda-mano"],
        otros: ["otros-equipos-de-segunda-mano"],
        movilidad: ["movilidad-sostenible-de-segunda-mano"],
        maquinaria: ["maquinaria-de-ocasion"]
    };

    const extra = perKey[categoryKey] ?? [];
    const all = [...base, ...extra];
    return { keywords: all, tags: all };
};
