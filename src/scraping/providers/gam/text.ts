export const normalizeSpace = (s: string): string => s.replace(/\s+/g, " ").trim();

export const fold = (s: string): string => normalizeSpace(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

