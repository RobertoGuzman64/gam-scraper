export const isGomarizOccasionSale = (sourceUrl: string, categoryKey: string, categoryName: string): boolean => {
  if (categoryKey !== "venta" || categoryName !== "Maquinaria de ocasión") return false;
  try {
    const url = new URL(sourceUrl);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && ["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) &&
      path[0] === "venta" && (path.length === 1 || path.length === 4);
  } catch {
    return false;
  }
};
