import type { CategoryConfig, ScrapeOptions } from "./types.js";

export const DEFAULT_CATEGORIES: readonly CategoryConfig[] = [
  { key: "elevacion", name: "Elevación", url: "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano" },
  { key: "manutencion", name: "Manutención", url: "https://online.gamrentals.com/es/9-maquinaria-manutencion-segunda-mano" },
  { key: "manipulacion", name: "Manipulación", url: "https://online.gamrentals.com/es/10-maquinaria-manipulacion-segunda-mano" },
  { key: "energia", name: "Energía", url: "https://online.gamrentals.com/es/11-maquinaria-energia-segunda-mano" },
  { key: "otros", name: "Otros equipos", url: "https://online.gamrentals.com/es/12-resto-maquinaria-segunda-mano" },
  { key: "movilidad", name: "Vehículos de ocasión", url: "https://online.gamrentals.com/es/32-vehiculos-segunda-mano" },
  { key: "maquinaria", name: "Maquinaria de ocasión", url: "https://online.gamrentals.com/es/3-maquinaria-segunda-mano" }
];

export const DEFAULT_OPTIONS: ScrapeOptions = {
  outDir: "output",
  outPrefix: "scrape-gam-marzo-2026",
  maxPages: 500,
  stallStopAfter: 2,
  concurrencyPages: 2,
  concurrencyProducts: 6,
  timeoutMs: 30000,
  delayMs: 250,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
};