import * as cheerio from "cheerio";

export const loadReadableHtml = (html: string): cheerio.CheerioAPI =>
  cheerio.load(html.replace(/(<\/(?:p|div|section|article|h[1-6]|li|dl|dt|dd|span|strong|b)>)/gi, "$1 "));
