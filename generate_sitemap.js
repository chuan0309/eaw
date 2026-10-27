import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildCaseSlug(record, idx = 0) {
  const idStr = String(record?.id || record?.__key || `case-${idx}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  return idStr || `case-${idx}`;
}

export function isSubstantiveCaseForSeo(record) {
  if (!record || typeof record !== "object") return false;
  const addr = String(record.doorplate_address || record.address || "").trim();
  const reason = String(record.reason || "").trim();
  return addr.length >= 4 && reason.length >= 10;
}

export function buildLocalizedIndexHtml(baseHtml, pageKey = "zh-root", baseUrl = "https://chuancn.org") {
  let html = String(baseHtml || "");
  const cleanBase = String(baseUrl || "https://chuancn.org").replace(/\/$/, "");
  const metaByKey = {
    "zh-root": {
      lang: "zh-Hant-TW",
      title: "凶宅地圖｜台灣・日本事故物件查詢與公開法院法拍實證資料庫",
      desc: "整合台灣與日本超過 54,000 筆凶宅地圖、事故物件查詢、屋內非自然死亡（他殺、自殺、奪命火災、孤獨死）與法院法拍點交紀錄之空間查詢資料庫。",
      url: `${cleanBase}/`
    },
    "zh-tw": {
      lang: "zh-Hant-TW",
      title: "凶宅地圖｜台灣・日本事故物件查詢與公開法院法拍實證資料庫",
      desc: "整合台灣與日本超過 54,000 筆凶宅地圖、事故物件查詢、屋內非自然死亡（他殺、自殺、奪命火災、孤獨死）與法院法拍點交紀錄之空間查詢資料庫。",
      url: `${cleanBase}/zh-tw/`
    },
    ja: {
      lang: "ja",
      title: "事故物件マップ｜日本・台湾の心理的瑕疵・競売BIT・報道検証データベース",
      desc: "日本全国50,000件以上および台湾の事故物件（大島てる・競売BIT3点セット・成仏不動産・UR特別募集・報道記録）を網羅した空間検索データベース。",
      url: `${cleanBase}/ja/`
    },
    ko: {
      lang: "ko",
      title: "사고매물 지도｜대만·일본 부동산 사고 및 법원경매 검증 데이터베이스",
      desc: "대만과 일본의 54,000건 이상 부동산 사고物件 및 법원 경매 기록을 교차 검증한 공간 검색 데이터베이스.",
      url: `${cleanBase}/ko/`
    },
    en: {
      lang: "en",
      title: "Property Incident Map | Taiwan & Japan Stigmatized Property & Court Auction Archive",
      desc: "Spatial verification database covering over 54,000 verified property incidents across Taiwan and Japan, cross-referenced with court auctions and news archives.",
      url: `${cleanBase}/en/`
    }
  };
  const cfg = metaByKey[pageKey] || metaByKey["zh-root"];
  html = html.replace(/<html[^>]*>/i, `<html lang="${cfg.lang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${cfg.title}</title>`);
  html = html.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${cfg.desc}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${cfg.title}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${cfg.desc}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${cfg.url}" />`
  );
  return html;
}

export function renderStandaloneCaseHtml(baseHtml, record, totalCount = 54056, baseUrl = "https://chuancn.org") {
  let html = String(baseHtml || "");
  if (!record) return html;
  const cleanBase = String(baseUrl || "https://chuancn.org").replace(/\/$/, "");
  const slug = record.slug || buildCaseSlug(record, 0);
  const canonicalUrl = `${cleanBase}/case/${slug}/`;
  const addr = String(record.address || record.doorplate_address || "").replace(/"/g, "&quot;");
  const cat = String(record.category || "事故物件").replace(/"/g, "&quot;");
  const reason = String(record.reason || "").replace(/"/g, "&quot;");
  const title = `${addr}｜${cat} — 凶宅地圖・事故物件實證卷宗`;
  const desc = reason.slice(0, 155) || `${addr} 事故建物查核與法院實價紀錄（全庫共 ${totalCount} 筆）。`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${desc}" />`
  );
  html = html.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: title,
        description: desc
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "凶宅地圖", item: `${cleanBase}/` },
          { "@type": "ListItem", position: 2, name: addr, item: canonicalUrl }
        ]
      }
    ]
  });
  const headInject = `<link rel="canonical" href="${canonicalUrl}" />\n<script type="application/ld+json">${jsonLd}</script>\n</head>`;
  html = html.replace(/<\/head>/i, headInject);

  const prerenderArticle = `<article id="seo-case-prerender" style="display:none" aria-hidden="true"><h1>${addr}</h1><p>${cat}</p><p>${reason}</p></article>`;
  html = html.replace(/<body([^>]*)>/i, `<body$1>${prerenderArticle}`);
  return html;
}

export function buildSitemapXml(records = [], baseUrl = "https://chuancn.org") {
  const cleanBase = String(baseUrl || "https://chuancn.org").replace(/\/$/, "");
  const nowIso = new Date().toISOString().split("T")[0];
  const urls = [
    `${cleanBase}/`,
    `${cleanBase}/zh-tw/`,
    `${cleanBase}/ja/`,
    `${cleanBase}/en/`
  ];
  const substantive = Array.isArray(records) ? records.filter(isSubstantiveCaseForSeo) : [];
  const maxSitemapCases = Math.min(substantive.length, 5000);
  for (let i = 0; i < maxSitemapCases; i++) {
    const slug = buildCaseSlug(substantive[i], i);
    urls.push(`${cleanBase}/case/${slug}/`);
  }
  const urlEntries = urls
    .map(
      u =>
        `  <url>\n    <loc>${u}</loc>\n    <lastmod>${nowIso}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  return {
    xml,
    totalUrls: urls.length,
    caseCount: maxSitemapCases
  };
}

export function generateAndWriteSitemapFiles(records = [], opts = {}) {
  const baseUrl = (opts.baseUrl || "https://chuancn.org").replace(/\/$/, "");
  const { xml, totalUrls, caseCount } = buildSitemapXml(records, baseUrl);
  try {
    fs.writeFileSync(path.join(__dirname, "sitemap.xml"), xml, "utf8");
    if (fs.existsSync(path.join(__dirname, "public"))) {
      fs.writeFileSync(path.join(__dirname, "public", "sitemap.xml"), xml, "utf8");
    }
  } catch (_e) {}

  try {
    const baseHtmlPath = path.join(__dirname, "index.html");
    if (fs.existsSync(baseHtmlPath)) {
      const baseHtml = fs.readFileSync(baseHtmlPath, "utf8");
      const routes = [
        { key: "zh-tw", dirs: [path.join(__dirname, "zh-tw"), path.join(__dirname, "public", "zh-tw")] },
        { key: "ko", dirs: [path.join(__dirname, "ko"), path.join(__dirname, "public", "ko")] },
        { key: "ja", dirs: [path.join(__dirname, "ja"), path.join(__dirname, "public", "ja")] },
        { key: "en", dirs: [path.join(__dirname, "en"), path.join(__dirname, "public", "en")] }
      ];
      for (const r of routes) {
        const localized = buildLocalizedIndexHtml(baseHtml, r.key, baseUrl);
        for (const d of r.dirs) {
          fs.mkdirSync(d, { recursive: true });
          fs.writeFileSync(path.join(d, "index.html"), localized, "utf8");
        }
      }
    }
  } catch (_e) {}

  return {
    totalUrls,
    caseCount,
    staticGeneratedCount: 0
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  let records = [];
  for (const fname of ["calibrated_archive.json", "crawler_vault_backup.json"]) {
    const p = path.join(__dirname, fname);
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Array.isArray(parsed) && parsed.length > records.length) records = parsed;
      } catch (_e) {}
    }
  }
  const res = generateAndWriteSitemapFiles(records, { baseUrl: "https://chuancn.org" });
  console.log(`Generated sitemap.xml with ${res.totalUrls} URLs (${res.caseCount} cases).`);
}
