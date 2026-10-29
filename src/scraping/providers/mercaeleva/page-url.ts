export const buildMercaelevaPageUrl = (categoryUrl: string, page: number): string => {
  const url = new URL(categoryUrl);
  url.searchParams.delete("page");
  if (page <= 1) url.searchParams.delete("pageIndex");
  else url.searchParams.set("pageIndex", String(page - 1));
  return url.toString();
};

