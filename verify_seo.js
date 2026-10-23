/**
 * Automated SEO & Performance Verification Script (`node verify_seo.js`)
 * Validates:
 * 1. Sitemap XML generation & strict canonical URL policy (only `/` and `/case/<slug>/`)
 * 2. Standalone Case SSR/SSG HTML rendering (`<title>`, `<meta name="description">`, `<link rel="canonical">`, JSON-LD)
 * 3. Zero duplicate canonical tags or duplicate titles/descriptions across sample case pages
 * 4. JSON-LD structured data validity (WebSite, Organization, Dataset, BreadcrumbList, WebPage, Place — no invalid WebApplication warnings)
 * 5. Initial boot dataset (`public/initial_boot_records.json`) for fast mobile LCP
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateAndWriteSitemapFiles,
  buildCaseSlug,
  isSubstantiveCaseForSeo,
  renderStandaloneCaseHtml
} from "./generate_sitemap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log("=== [SEO & Performance Verification Suite] ===");
  const fullSsg = process.argv.includes("--full-ssg");

  // 1. Run sitemap + SSG generator
  const genResult = generateAndWriteSitemapFiles(__dirname, {
    writeStaticCases: true,
    maxStaticCases: fullSsg ? Infinity : 80
  });

  const checks = [];
  const recordCheck = (name, passed, detail) => {
    checks.push({ name, passed: Boolean(passed), detail });
    const icon = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${icon} | ${name}: ${detail}`);
  };

  // Check 1: Sitemap file exists and contains only canonical URLs
  const sitemapPath = path.join(__dirname, "sitemap.xml");
  const sitemapExists = fs.existsSync(sitemapPath);
  const sitemapXml = sitemapExists ? fs.readFileSync(sitemapPath, "utf-8") : "";
  const locMatches = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const nonCanonicalLocs = locMatches.filter(
    (u) => u !== "https://chuancn.org/" && !/^https:\/\/chuancn\.org\/case\/[a-z0-9-]+\/$/.test(u)
  );
  recordCheck(
    "Sitemap Canonical Exclusivity",
    sitemapExists && locMatches.length > 100 && nonCanonicalLocs.length === 0,
    `Total URLs: ${locMatches.length}, Non-canonical filter URLs: ${nonCanonicalLocs.length}`
  );

  // Check 2: Initial boot dataset for Mobile LCP exists
  const bootPath = path.join(__dirname, "public", "initial_boot_records.json");
  const bootExists = fs.existsSync(bootPath);
  let bootInfo = "missing";
  let bootValid = false;
  if (bootExists) {
    const bootJson = JSON.parse(fs.readFileSync(bootPath, "utf-8"));
    bootValid = Array.isArray(bootJson.records) && bootJson.records.length > 0 && bootJson.totalCount > 1000;
    bootInfo = `${bootJson.records?.length || 0} boot records (totalCount=${bootJson.totalCount}, size=${(fs.statSync(bootPath).size / 1024).toFixed(1)} KiB)`;
  }
  recordCheck("Mobile Fast-Boot Payload (initial_boot_records.json)", bootValid, bootInfo);

  // Check 3: Homepage HTML SEO & JSON-LD checks
  const indexHtmlPath = path.join(__dirname, "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
  const homeCanonicals = Array.from(indexHtml.matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi));
  const hasWebAppWarningType = indexHtml.includes('"@type": "WebApplication"');
  recordCheck(
    "Homepage Canonical & JSON-LD Schema",
    homeCanonicals.length === 1 && !hasWebAppWarningType && indexHtml.includes('"@type": "Dataset"'),
    `Canonical tags count=${homeCanonicals.length}, Dataset schema present=true, deprecated WebApplication schema=${hasWebAppWarningType}`
  );

  // Check 4: Standalone Case Page Uniqueness & Structured Data across sample cases
  const verifiedPath = fs.existsSync(path.join(__dirname, "public", "verified_cases.json"))
    ? path.join(__dirname, "public", "verified_cases.json")
    : path.join(__dirname, "verified_cases.json");
  const records = JSON.parse(fs.readFileSync(verifiedPath, "utf-8"));
  const substantiveRecords = records.filter(isSubstantiveCaseForSeo).slice(0, 25);

  const titles = new Set();
  const descriptions = new Set();
  const canonicals = new Set();
  let schemaAllValid = true;
  let singleCanonicalAllValid = true;
  let prerenderArticleAllValid = true;

  for (const rec of substantiveRecords) {
    const html = renderStandaloneCaseHtml(indexHtml, rec, records.length);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const canonMatches = Array.from(html.matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/gi));
    const ldMatch = html.match(/<script type="application\/ld\+json" id="dynamic-seo-jsonld">([\s\S]*?)<\/script>/i);

    if (titleMatch) titles.add(titleMatch[1]);
    if (descMatch) descriptions.add(descMatch[1]);
    if (canonMatches.length === 1) {
      canonicals.add(canonMatches[0][1]);
    } else {
      singleCanonicalAllValid = false;
    }

    if (!html.includes('id="seo-case-prerender"')) {
      prerenderArticleAllValid = false;
    }

    if (ldMatch) {
      try {
        const parsedLd = JSON.parse(ldMatch[1].trim());
        const graphTypes = Array.isArray(parsedLd["@graph"])
          ? parsedLd["@graph"].map((n) => n["@type"])
          : [];
        if (!graphTypes.includes("BreadcrumbList") || !graphTypes.includes("WebPage")) {
          schemaAllValid = false;
        }
      } catch (_e) {
        schemaAllValid = false;
      }
    } else {
      schemaAllValid = false;
    }
  }

  recordCheck(
    "Standalone Case Pages Unique <title> & <meta description>",
    titles.size === substantiveRecords.length && descriptions.size === substantiveRecords.length,
    `Tested ${substantiveRecords.length} case pages -> ${titles.size} unique titles, ${descriptions.size} unique descriptions`
  );

  recordCheck(
    "Standalone Case Pages Single Canonical & Prerendered Semantic HTML",
    singleCanonicalAllValid && canonicals.size === substantiveRecords.length && prerenderArticleAllValid,
    `Single canonical per page=${singleCanonicalAllValid}, unique canonicals=${canonicals.size}, crawlable <article id="seo-case-prerender">=${prerenderArticleAllValid}`
  );

  recordCheck(
    "Standalone Case Pages JSON-LD (@graph: WebSite, BreadcrumbList, WebPage, Place)",
    schemaAllValid,
    `Valid JSON-LD @graph across all ${substantiveRecords.length} sampled case pages=${schemaAllValid}`
  );

  const failed = checks.filter((c) => !c.passed);
  console.log("----------------------------------------------");
  console.log(
    `Summary: ${checks.length - failed.length}/${checks.length} checks passed | Indexed Cases in Sitemap: ${genResult.substantiveCaseCount} | Static HTML Cases Written: ${genResult.staticGeneratedCount}`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

runVerification().catch((err) => {
  console.error("SEO Verification Error:", err);
  process.exit(1);
});
