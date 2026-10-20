import type { CategoryConfig, ScrapeOptions } from "../../../contracts/scraping.js";

export const DEFAULT_CATEGORIES: readonly CategoryConfig[] = [
  { key: "elevacion", name: "Elevación", url: "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano" },
  { key: "manutencion", name: "Manutención", url: "https://online.gamrentals.com/es/9-maquinaria-manutencion-segunda-mano" },
  { key: "manipulacion", name: "Manipulación", url: "https://online.gamrentals.com/es/10-maquinaria-manipulacion-segunda-mano" },
  { key: "energia", name: "Energía", url: "https://online.gamrentals.com/es/11-maquinaria-energia-segunda-mano" },
  { key: "otros", name: "Otros equipos", url: "https://online.gamrentals.com/es/12-resto-maquinaria-segunda-mano" },
  { key: "movilidad", name: "Vehículos de ocasión", url: "https://online.gamrentals.com/es/32-vehiculos-segunda-mano" },
  { key: "maquinaria", name: "Maquinaria de ocasión", url: "https://online.gamrentals.com/es/3-maquinaria-segunda-mano" },
  { key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://online.gamrentals.com/es/33-plataformas-elevadoras-nuevas" },
  { key: "carretillas-nuevas", name: "Carretillas elevadoras nuevas", url: "https://online.gamrentals.com/es/34-carretillas-elevadoras-nuevas" },
  { key: "apiladores-nuevos", name: "Apiladores nuevos", url: "https://online.gamrentals.com/es/35-maquinas-apiladoras-nuevas" },
  { key: "otros-nuevos", name: "Otros equipos nuevos", url: "https://online.gamrentals.com/es/37-otra-maquinaria-nueva" },
  { key: "portaferetros", name: "Portaféretros nuevos", url: "https://online.gamrentals.com/es/784-portaferetros-nuevos" },
  { key: "limpieza-barredoras", name: "Barredoras industriales nuevas", url: "https://online.gamrentals.com/es/152-barredoras-industriales-nuevas" },
  { key: "limpieza-fregadoras", name: "Fregadoras industriales nuevas", url: "https://online.gamrentals.com/es/153-fregadoras-industriales-nuevas" },
  { key: "marcas-nuevas", name: "Maquinaria nueva por marcas", url: "https://online.gamrentals.com/es/38-marcas" }
];

export const DEFAULT_OPTIONS: ScrapeOptions = {
  outDir: "storage/scraped/gam",
  outPrefix: "scrape-gam-marzo-2026",
  maxPages: 500,
  stallStopAfter: 2,
  concurrencyPages: 2,
  concurrencyProducts: 6,
  timeoutMs: 30000,
  delayMs: 250,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
};