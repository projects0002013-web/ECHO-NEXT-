import { readFile } from "node:fs/promises";

const domain = "https://echo-next.pages.dev/";
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");
const html = await readFile("dist/index.html", "utf8");

if (!sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error("Sitemap must start with an XML declaration");
}
if (!sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
  throw new Error("Sitemap XML namespace is missing");
}
if (!sitemap.includes("<loc>" + domain + "</loc>")) {
  throw new Error("Sitemap does not contain the production homepage");
}
if (!robots.includes("Sitemap: " + domain + "sitemap.xml")) {
  throw new Error("robots.txt does not point to production sitemap");
}
if (!html.includes('rel="canonical" href="' + domain + '"')) {
  throw new Error("Production canonical homepage URL is missing");
}
console.log("Verified built sitemap.xml, robots.txt and canonical homepage URL");
