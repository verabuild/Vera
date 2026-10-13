import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const templatePath = path.join(outputDir, "index.html");
const template = await readFile(templatePath, "utf8");

const pages = {
  "/about": {
    title: "About VERA | Know before you act",
    description: "Learn why VERA exists, what it investigates, and how it helps people assess digital risk with evidence rather than assumptions."
  },
  "/how-it-works": {
    title: "How VERA Works | Know before you act",
    description: "Understand VERA's evidence-first investigation process, threat-intelligence checks, coverage limits and risk assessments."
  },
  "/project": {
    title: "Project Transparency | VERA",
    description: "Explore VERA's scope, current capabilities, public source code and project status."
  },
  "/contact": {
    title: "Contact VERA | Know before you act",
    description: "Contact the VERA project about privacy requests, investigation corrections, feedback or potential security issues."
  },
  "/privacy": {
    title: "Privacy Policy | VERA",
    description: "Read how VERA processes investigation inputs, uses service providers, stores records and supports privacy requests."
  },
  "/terms": {
    title: "Terms of Use | VERA",
    description: "Review the terms governing use of VERA's beta investigation and decision-support service."
  },
  "/cookies": {
    title: "Cookies | VERA",
    description: "Learn how VERA uses first-party cookies, browser storage and related service technologies."
  },
  "/disclosures": {
    title: "Risk Disclosures | VERA",
    description: "Understand VERA's verdicts, evidence limitations, third-party data coverage and investigation risks."
  }
};

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function upsertMeta(html, attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^\u0024{}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapedKey}["'][^>]*>`, "i");
  const tag = `<meta ${attribute}="${key}" content="${escapeAttribute(value)}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `  ${tag}\\n  </head>`);
}

function makePage(pathname, page) {
  const canonical = `https://vera-build.site${pathname}`;
  let html = template.replace(/<title>[\\s\\S]*?<\\/title>/i, `<title>${page.title}</title>`);
  html = upsertMeta(html, "name", "description", page.description);
  html = upsertMeta(html, "name", "robots", "index,follow");
  html = upsertMeta(html, "property", "og:title", page.title);
  html = upsertMeta(html, "property", "og:description", page.description);
  html = upsertMeta(html, "property", "og:url", canonical);
  html = upsertMeta(html, "name", "twitter:title", page.title);
  html = upsertMeta(html, "name", "twitter:description", page.description);
  html = html.replace(/<link\\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  return html;
}

const homepage = {
  title: "VERA ⇴ Know before you act",
  description: "VERA helps you investigate suspicious links, messages, Solana wallets and transactions using available threat intelligence and evidence-based analysis, so you can make more informed decisions before you act."
};
await writeFile(templatePath, makePage("/", homepage), "utf8");

for (const [route, page] of Object.entries(pages)) {
  const routeDir = path.join(outputDir, route.slice(1));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), makePage(route, page), "utf8");
}
console.log(`Generated crawler-ready HTML metadata for ${Object.keys(pages).length + 1} public routes.`);
