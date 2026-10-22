import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BASE_URL = "https://chuancn.org";

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeLastModDate(rawDate, fallbackToday) {
  const s = String(rawDate || "").trim().replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const year = parseInt(s.slice(0, 4), 10);
    if (year >= 2025 && s <= fallbackToday) {
      return s;
    }
  }
  return fallbackToday;
}

/**
 * Builds a complete XML Sitemap covering:
 * 1. Main application entry & 4 language variants (zh-TW, en, ja, ko)
 * 2. All 22 Taiwan cities/counties
 * 3. All active administrative districts with recorded incidents
 * 4. Every individual case dossier page (3,112+ records)
 */
export function buildSitemapXml(records = [], baseUrl = DEFAULT_BASE_URL) {
  const cleanBase = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);

  const urlEntries = [];
  const seenLocs = new Set();

  function pushUrl(loc, lastmod, changefreq, priority) {
    if (!loc || seenLocs.has(loc)) return;
    seenLocs.add(loc);
    urlEntries.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    );
  }

  // 1. Root & Multilingual Landing Pages
  pushUrl(`${cleanBase}/`, today, "daily", "1.0");
  pushUrl(`${cleanBase}/?lang=en`, today, "weekly", "0.9");
  pushUrl(`${cleanBase}/?lang=ja`, today, "weekly", "0.9");
  pushUrl(`${cleanBase}/?lang=ko`, today, "weekly", "0.9");

  // Collect unique cities and (city, district) pairs from all active records
  const citiesSet = new Set([
    "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市",
    "基隆市", "新竹市", "新竹縣", "苗栗縣", "彰化縣", "南投縣",
    "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣",
    "臺東縣", "澎湖縣", "金門縣", "連江縣"
  ]);
  const districtMap = new Map();

  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const city = String(r.city || "").replace(/台/g, "臺").trim();
    const dist = String(r.district || "").trim();
    if (city) citiesSet.add(city);
    if (city && dist) {
      districtMap.set(`${city}_${dist}`, [city, dist]);
    }
  }

  // 2. All 22 City / County Pages
  for (const city of citiesSet) {
    pushUrl(`${cleanBase}/?city=${encodeURIComponent(city)}`, today, "daily", "0.9");
  }

  // 3. All Active Administrative District Pages
  for (const [city, dist] of districtMap.values()) {
    pushUrl(
      `${cleanBase}/?city=${encodeURIComponent(city)}&district=${encodeURIComponent(dist)}`,
      today,
      "weekly",
      "0.8"
    );
  }

  // 4. Individual Case Pages (3,112+ active records)
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r || typeof r !== "object") continue;
    const city = String(r.city || "").replace(/台/g, "臺").trim();
    const dist = String(r.district || "").trim();
    const caseId = r.id !== undefined && r.id !== null
      ? String(r.id).trim()
      : String(r.doorplate_address || r.address || `rec-${i}`).trim();
    if (!caseId) continue;

    const params = [];
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (dist) params.push(`district=${encodeURIComponent(dist)}`);
    params.push(`case=${encodeURIComponent(caseId)}`);

    const caseLoc = `${cleanBase}/?${params.join("&")}`;
    const lastmod = normalizeLastModDate(r.incident_date, today);
    pushUrl(caseLoc, lastmod, "monthly", "0.7");
  }

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Generated automatically by generate_sitemap.js | Total URLs: ${urlEntries.length} | Active Cases: ${records.length} -->`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urlEntries.join("\n"),
    `</urlset>`,
    ``
  ].join("\n");

  return {
    xml,
    totalUrls: urlEntries.length,
    caseCount: records.length,
    cityCount: citiesSet.size,
    districtCount: districtMap.size
  };
}

/**
 * Loads records from calibrated_archive.json (or uses provided records)
 * and writes /sitemap.xml and /public/sitemap.xml to disk.
 */
export function generateAndWriteSitemapFiles(customRecords = null, baseUrl = DEFAULT_BASE_URL) {
  let records = Array.isArray(customRecords) ? customRecords : [];
  if (records.length === 0) {
    const archiveCandidates = [
      path.join(__dirname, "calibrated_archive.json"),
      path.join(__dirname, "public", "calibrated_archive.json")
    ];
    for (const file of archiveCandidates) {
      if (fs.existsSync(file)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
          if (Array.isArray(parsed) && parsed.length > 0) {
            records = parsed;
            break;
          }
        } catch (e) {}
      }
    }
  }

  const stats = buildSitemapXml(records, baseUrl);
  const rootSitemapPath = path.join(__dirname, "sitemap.xml");
  const publicDir = path.join(__dirname, "public");
  const publicSitemapPath = path.join(publicDir, "sitemap.xml");

  fs.writeFileSync(rootSitemapPath, stats.xml, "utf8");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(publicSitemapPath, stats.xml, "utf8");

  return {
    ...stats,
    rootSitemapPath,
    publicSitemapPath
  };
}

// Run directly if invoked via CLI: `node generate_sitemap.js`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const baseUrl = process.env.APP_URL || DEFAULT_BASE_URL;
  const result = generateAndWriteSitemapFiles(null, baseUrl);
  console.log(
    `[Sitemap Generator] Successfully generated /sitemap.xml and /public/sitemap.xml:\n` +
    `  - Active Case Pages : ${result.caseCount.toLocaleString()}\n` +
    `  - City Pages        : ${result.cityCount.toLocaleString()}\n` +
    `  - District Pages    : ${result.districtCount.toLocaleString()}\n` +
    `  - Total Indexed URLs: ${result.totalUrls.toLocaleString()}`
  );
}
