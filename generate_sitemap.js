import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BASE_URL = "https://chuancn.org";

export const CITY_SLUG_MAP = {
  "臺北市": "taipei",
  "台北市": "taipei",
  "新北市": "new-taipei",
  "桃園市": "taoyuan",
  "臺中市": "taichung",
  "台中市": "taichung",
  "臺南市": "tainan",
  "台南市": "tainan",
  "高雄市": "kaohsiung",
  "基隆市": "keelung",
  "新竹市": "hsinchu-city",
  "新竹縣": "hsinchu-county",
  "苗栗縣": "miaoli",
  "彰化縣": "changhua",
  "南投縣": "nantou",
  "雲林縣": "yunlin",
  "嘉義市": "chiayi-city",
  "嘉義縣": "chiayi-county",
  "屏東縣": "pingtung",
  "宜蘭縣": "yilan",
  "花蓮縣": "hualien",
  "臺東縣": "taitung",
  "台東縣": "taitung",
  "澎湖縣": "penghu",
  "金門縣": "kinmen",
  "連江縣": "lienchiang"
};

export function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stableShortHash(input) {
  const s = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Generates a deterministic, canonical SEO slug for a case record:
 * e.g. `taipei-tw-arch-001` or `new-taipei-rec-1042`
 */
export function buildCaseSlug(record, index = 0) {
  if (!record || typeof record !== "object") return `case-${index}`;
  if (record.slug && /^[a-z0-9-]+$/i.test(String(record.slug).trim())) {
    return String(record.slug).trim().toLowerCase();
  }
  const city = String(record.city || "").replace(/台/g, "臺").trim();
  const cityPrefix = CITY_SLUG_MAP[city] || "tw";
  const rawId = String(record.id || "").trim();

  if (rawId && /^[a-z0-9_-]+$/i.test(rawId)) {
    const cleanId = rawId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (cleanId.startsWith(`${cityPrefix}-`)) {
      return cleanId;
    }
    return `${cityPrefix}-${cleanId}`;
  }

  const addrKey = `${city}|${record.district || ""}|${record.doorplate_address || record.address || index}`;
  return `${cityPrefix}-${stableShortHash(addrKey)}`;
}

/**
 * Determines whether a case record has substantive, verifiable content
 * suitable for Google indexing (prevents thin/rumor-only spam indexing).
 */
export function isSubstantiveCaseForSeo(record) {
  if (!record || typeof record !== "object") return false;
  const city = String(record.city || "").trim();
  const address = String(record.doorplate_address || record.address || "").trim();
  const reason = String(record.reason || "").trim();
  if (!city || !address) return false;
  if (reason.length < 12) return false;
  return true;
}

export function normalizeLastModDate(rawDate, fallbackToday) {
  const s = String(rawDate || "").trim().replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const year = parseInt(s.slice(0, 4), 10);
    if (year >= 2024 && s <= fallbackToday) {
      return s;
    }
  }
  return fallbackToday;
}

/**
 * Builds unique SEO title, description, canonical URL, and JSON-LD (@graph) for a standalone case page.
 */
export function buildCaseSeoMetadata(record, baseUrl = DEFAULT_BASE_URL) {
  const cleanBase = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const slug = buildCaseSlug(record);
  const canonicalUrl = `${cleanBase}/case/${slug}/`;
  const city = String(record.city || "臺灣").replace(/台/g, "臺").trim();
  const district = String(record.district || "").trim();
  const doorplate = String(record.doorplate_address || record.address || "").trim();
  const displayAddr = String(record.address || doorplate || `${city}${district}`).trim();
  const category = String(record.category || "歷史事故建物紀錄").trim();
  const incidentDate = String(record.incident_date || "歷年紀錄").trim();
  const statusText = String(record.status || "公開檔案與新聞實證查核").trim();
  const sourceName = String(record.news_source || "司法院法拍公告、裁判書與公開新聞檔案").trim();
  const rawReason = String(record.reason || "")
    .replace(/\s+/g, " ")
    .trim();
  const lastUpdated = new Date().toISOString().slice(0, 10);

  // Neutral, fact-based title & description reflecting the exact case
  const title = `${displayAddr}｜${category}（${incidentDate}）事故建物公開查核檔案 - 臺灣凶宅地圖`;
  const reasonSnippet = rawReason.length > 115 ? `${rawReason.slice(0, 115)}…` : rawReason;
  const description = `【${city}${district}公開查核紀錄】門牌位置：${doorplate}。事件分類：${category}，紀錄日期：${incidentDate}。查核來源：${sourceName}（${statusText}）。案情摘要：${reasonSnippet}`;

  const lat = parseFloat(record.lat);
  const lng = parseFloat(record.lng);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${cleanBase}/#website`,
        "url": `${cleanBase}/`,
        "name": "臺灣凶宅地圖",
        "inLanguage": ["zh-TW", "en", "ja", "ko"]
      },
      {
        "@type": "Organization",
        "@id": `${cleanBase}/#organization`,
        "name": "臺灣凶宅地圖公開實證資料庫",
        "url": `${cleanBase}/`,
        "logo": `${cleanBase}/og-banner.png`
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "臺灣凶宅地圖首頁",
            "item": `${cleanBase}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": `${city}${district ? " " + district : ""}`,
            "item": `${cleanBase}/`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": displayAddr,
            "item": canonicalUrl
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "name": title,
        "description": description,
        "inLanguage": "zh-TW",
        "isPartOf": { "@id": `${cleanBase}/#website` },
        "breadcrumb": { "@id": `${canonicalUrl}#breadcrumb` },
        "datePublished": /^\d{4}-\d{2}-\d{2}$/.test(incidentDate) ? incidentDate : "2025-01-01",
        "dateModified": lastUpdated,
        "mainEntity": {
          "@type": "Place",
          "name": displayAddr,
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "TW",
            "addressRegion": city,
            "addressLocality": district || city,
            "streetAddress": doorplate
          },
          ...(Number.isFinite(lat) && Number.isFinite(lng)
            ? {
                "geo": {
                  "@type": "GeoCoordinates",
                  "latitude": lat,
                  "longitude": lng
                }
              }
            : {})
        }
      }
    ]
  };

  return {
    slug,
    canonicalUrl,
    title,
    description,
    city,
    district,
    doorplate,
    displayAddr,
    category,
    incidentDate,
    statusText,
    sourceName,
    rawReason,
    lastUpdated,
    jsonLd
  };
}

/**
 * Renders a complete standalone HTML page for `/case/<slug>/` by injecting:
 * - Unique `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph & Twitter tags
 * - `@graph` JSON-LD (`WebSite`, `Organization`, `BreadcrumbList`, `WebPage`, `Place`)
 * - Crawlable semantic `<article id="seo-case-prerender">` in initial HTML
 * - `window.__PRELOADED_CASE_RECORD__` so the interactive app opens the case dossier immediately
 */
export function renderStandaloneCaseHtml(templateHtml, record, totalRecordCount = 4045, baseUrl = DEFAULT_BASE_URL) {
  const meta = buildCaseSeoMetadata(record, baseUrl);
  let html = String(templateHtml || "");

  // 1. Replace <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  // 2. Replace <meta name="description">
  html = html.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );

  // 3. Replace <link rel="canonical"> (ensuring only a single canonical tag exists)
  html = html.replace(
    /<link\s+rel=["']canonical["'][^>]*>/gi,
    `<link rel="canonical" id="canonical-link" href="${escapeHtml(meta.canonicalUrl)}" />`
  );

  // 4. Replace OpenGraph & Twitter meta tags
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );

  // 5. Replace initial JSON-LD block (#dynamic-seo-jsonld)
  const jsonLdScript = `<script type="application/ld+json" id="dynamic-seo-jsonld">\n${JSON.stringify(meta.jsonLd, null, 2)}\n  </script>`;
  if (/<script[^>]+id=["']dynamic-seo-jsonld["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(/<script[^>]+id=["']dynamic-seo-jsonld["'][^>]*>[\s\S]*?<\/script>/i, jsonLdScript);
  } else {
    html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, jsonLdScript);
  }

  // 6. Inject crawlable semantic HTML <article id="seo-case-prerender"> and preloaded case script
  const sourceLinkHtml = record.news_url
    ? `<a href="${escapeHtml(record.news_url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(meta.sourceName)}</a>`
    : escapeHtml(meta.sourceName);

  const semanticArticleHtml = `
  <!-- Server/Static Pre-rendered Case Content for Search Engine Indexing & Direct Navigation -->
  <article id="seo-case-prerender" class="sr-only" aria-label="${escapeHtml(meta.displayAddr)} 事故建物公開查核紀錄">
    <nav aria-label="Breadcrumb">
      <ol>
        <li><a href="https://chuancn.org/">臺灣凶宅地圖首頁</a></li>
        <li><a href="https://chuancn.org/">${escapeHtml(meta.city)}${meta.district ? " " + escapeHtml(meta.district) : ""}</a></li>
        <li aria-current="page">${escapeHtml(meta.displayAddr)}</li>
      </ol>
    </nav>
    <h1>${escapeHtml(meta.displayAddr)}（${escapeHtml(meta.category)}・${escapeHtml(meta.incidentDate)}）</h1>
    <dl>
      <dt>所在縣市與行政區</dt>
      <dd>${escapeHtml(meta.city)} ${escapeHtml(meta.district)}</dd>
      <dt>公開門牌與社區位置</dt>
      <dd>${escapeHtml(meta.doorplate)}</dd>
      <dt>事件類型</dt>
      <dd>${escapeHtml(meta.category)}</dd>
      <dt>可確認之紀錄日期</dt>
      <dd><time datetime="${escapeHtml(meta.incidentDate)}">${escapeHtml(meta.incidentDate)}</time></dd>
      <dt>原始資料來源與查核狀態</dt>
      <dd>${sourceLinkHtml}（查核狀態：${escapeHtml(meta.statusText)}）</dd>
      <dt>建物型態與坪數</dt>
      <dd>${escapeHtml(record.building_type || "住宅建物")}｜${escapeHtml(record.area_ping || "依地政謄本為準")}</dd>
      <dt>資料最後更新日期</dt>
      <dd><time datetime="${escapeHtml(meta.lastUpdated)}">${escapeHtml(meta.lastUpdated)}</time></dd>
    </dl>
    <section>
      <h2>公開實證與查封／新聞歷程摘要</h2>
      <p>${escapeHtml(meta.rawReason)}</p>
    </section>
    <footer>
      <p>查核聲明：本頁資料整理自司法院法拍屋公告查封筆錄、各級法院裁判書及具名新聞媒體報導，僅供不動產交易安全查證參考，不將未經查證之網路傳聞直接列為法定凶宅。全站目前共收錄 ${Number(totalRecordCount || 4045).toLocaleString()} 筆實證紀錄。</p>
      <p>更正與申訴管道：若您為建物所有權人或利害關係人，發現門牌誤植、法院判決撤銷或資訊需更正，請點擊頁面內「勘誤／下架申訴」按鈕提交查核申請。</p>
    </footer>
  </article>
  <script id="preloaded-case-script">
    window.__PRELOADED_CASE_SLUG__ = ${JSON.stringify(meta.slug)};
    window.__PRELOADED_CASE_RECORD__ = ${JSON.stringify({ ...record, slug: meta.slug })};
  </script>`;

  html = html.replace(/<body([^>]*)>/i, `<body$1>${semanticArticleHtml}`);
  return html;
}

/**
 * Builds a strict, canonical-only XML Sitemap:
 * - Only includes the homepage (`https://chuancn.org/`) and verified standalone case pages (`https://chuancn.org/case/<slug>/`)
 * - Excludes `?city=`, `?district=`, `?lang=`, and `?case=` query URLs to prevent duplicate/thin content penalties
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

  // 1. Canonical Homepage
  pushUrl(`${cleanBase}/`, today, "daily", "1.0");

  // 2. Substantive, Verified Standalone Case Pages (/case/<slug>/)
  let substantiveCaseCount = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!isSubstantiveCaseForSeo(r)) continue;
    const slug = buildCaseSlug(r, i);
    const caseLoc = `${cleanBase}/case/${slug}/`;
    const lastmod = normalizeLastModDate(r.incident_date, today);
    pushUrl(caseLoc, lastmod, "monthly", "0.8");
    substantiveCaseCount++;
  }

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Generated by generate_sitemap.js | Canonical URLs Only: ${urlEntries.length} (Homepage + ${substantiveCaseCount} Verified Case Pages) -->`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urlEntries.join("\n"),
    `</urlset>`,
    ``
  ].join("\n");

  return {
    xml,
    totalUrls: urlEntries.length,
    caseCount: substantiveCaseCount,
    substantiveCaseCount,
    cityCount: 0,
    districtCount: 0
  };
}

function loadDefaultArchiveRecords(rootDir = __dirname) {
  const candidateFiles = [
    path.join(rootDir, "public", "verified_cases.json"),
    path.join(rootDir, "calibrated_archive.json"),
    path.join(rootDir, "public", "calibrated_archive.json")
  ];
  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (_e) {}
    }
  }
  return [];
}

/**
 * Generates and writes:
 * 1. `/sitemap.xml` and `/public/sitemap.xml` (canonical URLs only)
 * 2. `/public/initial_boot_records.json` (first 80 records + authoritative counts for fast mobile LCP)
 * 3. Static HTML case pages under `/public/case/<slug>/index.html`
 */
export function generateAndWriteSitemapFiles(customRecordsOrDir = null, optionsOrBaseUrl = {}) {
  let rootDir = __dirname;
  let customRecords = null;

  if (typeof customRecordsOrDir === "string") {
    rootDir = customRecordsOrDir;
  } else if (Array.isArray(customRecordsOrDir)) {
    customRecords = customRecordsOrDir;
  }

  const opts =
    typeof optionsOrBaseUrl === "string"
      ? { baseUrl: optionsOrBaseUrl }
      : optionsOrBaseUrl || {};

  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const writeStaticCases = opts.writeStaticCases !== false;
  const maxStaticCases = typeof opts.maxStaticCases === "number" ? opts.maxStaticCases : 60;

  const rawRecords = Array.isArray(customRecords) && customRecords.length > 0
    ? customRecords
    : loadDefaultArchiveRecords(rootDir);

  const records = rawRecords.map((r, idx) => ({
    ...r,
    slug: buildCaseSlug(r, idx)
  }));

  const stats = buildSitemapXml(records, baseUrl);
  const rootSitemapPath = path.join(rootDir, "sitemap.xml");
  const publicDir = path.join(rootDir, "public");
  const publicSitemapPath = path.join(publicDir, "sitemap.xml");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(rootSitemapPath, stats.xml, "utf-8");
  fs.writeFileSync(publicSitemapPath, stats.xml, "utf-8");

  // Write fast initial boot JSON (first 80 records + authoritative totalCount) for static hosting & fast mobile LCP
  const bootPayload = {
    totalCount: records.length,
    generatedAt: new Date().toISOString(),
    records: records.slice(0, 80)
  };
  const bootPath = path.join(publicDir, "initial_boot_records.json");
  fs.writeFileSync(bootPath, JSON.stringify(bootPayload), "utf-8");

  // Write standalone static HTML pages (`/public/case/<slug>/index.html`)
  let staticGeneratedCount = 0;
  const indexHtmlPath = path.join(rootDir, "index.html");
  if (writeStaticCases && fs.existsSync(indexHtmlPath)) {
    const templateHtml = fs.readFileSync(indexHtmlPath, "utf-8");
    const substantiveList = records.filter(isSubstantiveCaseForSeo);
    const limit = Math.min(substantiveList.length, maxStaticCases);
    for (let i = 0; i < limit; i++) {
      const rec = substantiveList[i];
      const slug = buildCaseSlug(rec, i);
      const caseDir = path.join(publicDir, "case", slug);
      fs.mkdirSync(caseDir, { recursive: true });
      const caseHtml = renderStandaloneCaseHtml(templateHtml, rec, records.length, baseUrl);
      fs.writeFileSync(path.join(caseDir, "index.html"), caseHtml, "utf-8");
      staticGeneratedCount++;
    }
  }

  return {
    ...stats,
    totalRecords: records.length,
    staticGeneratedCount,
    rootSitemapPath,
    publicSitemapPath,
    bootPath
  };
}

// Run directly if invoked via CLI: `node generate_sitemap.js [--full-ssg]`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const baseUrl = process.env.APP_URL || DEFAULT_BASE_URL;
  const fullSsg = process.argv.includes("--full-ssg");
  const result = generateAndWriteSitemapFiles(__dirname, {
    baseUrl,
    writeStaticCases: true,
    maxStaticCases: fullSsg ? Infinity : 80
  });
  console.log(
    `[Sitemap & SSG Generator] Complete:\n` +
      `  - Total Records          : ${result.totalRecords.toLocaleString()}\n` +
      `  - Canonical Case URLs    : ${result.substantiveCaseCount.toLocaleString()}\n` +
      `  - Total Sitemap URLs     : ${result.totalUrls.toLocaleString()}\n` +
      `  - Static Case HTML Pages : ${result.staticGeneratedCount.toLocaleString()}`
  );
}
