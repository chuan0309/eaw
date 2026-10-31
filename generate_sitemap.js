import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CITY_ASCII_SLUG_MAP = {
  "臺北市": "taipei", "台北市": "taipei", "新北市": "new-taipei", "桃園市": "taoyuan",
  "臺中市": "taichung", "台中市": "taichung", "臺南市": "tainan", "台南市": "tainan",
  "高雄市": "kaohsiung", "基隆市": "keelung", "新竹市": "hsinchu-city", "新竹縣": "hsinchu",
  "苗栗縣": "miaoli", "彰化縣": "changhua", "南投縣": "nantou", "雲林縣": "yunlin",
  "嘉義市": "chiayi-city", "嘉義縣": "chiayi", "屏東縣": "pingtung", "宜蘭縣": "yilan",
  "花蓮縣": "hualien", "臺東縣": "taitung", "台東縣": "taitung", "澎湖縣": "penghu",
  "金門縣": "kinmen", "連江縣": "lienchiang",
  // All 47 Prefectures of Japan
  "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi",
  "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima", "茨城県": "ibaraki",
  "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba",
  "東京都": "tokyo", "神奈川県": "kanagawa", "新潟県": "niigata", "富山県": "toyama",
  "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
  "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie",
  "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo",
  "奈良県": "nara", "和歌山県": "wakayama", "鳥取県": "tottori", "島根県": "shimane",
  "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi", "徳島県": "tokushima",
  "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi", "福岡県": "fukuoka",
  "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita",
  "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa",
  // South Korea
  "首爾特別市": "seoul", "釜山廣域市": "busan", "仁川廣域市": "incheon", "京畿道": "gyeonggi",
  "大邱廣域市": "daegu", "大田廣域市": "daejeon", "光州廣域市": "gwangju", "濟州特別自治道": "jeju"
};

export function buildCaseSlug(record, idx = 0) {
  if (!record || typeof record !== "object") return `case-${idx}`;
  if (record.__seo_slug) return String(record.__seo_slug);
  const rawCity = String(record.city || "").trim();
  const normCity = CITY_ASCII_SLUG_MAP[rawCity] ? rawCity : rawCity.replace(/台/g, "臺");
  const isJp = record.country === "JP" || /^jp-/i.test(String(record.id || "")) || /[都府県]$/.test(rawCity);
  const citySlug = CITY_ASCII_SLUG_MAP[normCity] || CITY_ASCII_SLUG_MAP[rawCity] || (isJp ? "japan" : "taiwan");

  let rawId = record.id !== undefined && record.id !== null ? String(record.id).trim() : String(record.__key || "");
  if (!rawId) {
    const addr = String(record.doorplate_address || record.address || `rec-${idx}`);
    let h = 2166136261;
    for (let i = 0; i < addr.length; i++) {
      h ^= addr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    rawId = `h${(h >>> 0).toString(36)}`;
  }
  const cleanId = rawId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `case-${idx}`;
  return cleanId.startsWith(`${citySlug}-`) ? cleanId : `${citySlug}-${cleanId}`;
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
      title: "凶宅地圖｜台灣・日本全境 47 都道府縣事故物件查詢與新聞法拍實證資料庫",
      desc: "整合台灣全境 22 縣市與日本全境 47 都道府縣之真實新聞報導、法院法拍公告與公營住宅（UR/JKK）實證事故物件空間查詢資料庫。",
      url: `${cleanBase}/`
    },
    "zh-tw": {
      lang: "zh-Hant-TW",
      title: "凶宅地圖｜台灣・日本全境 47 都道府縣事故物件查詢與新聞法拍實證資料庫",
      desc: "整合台灣全境 22 縣市與日本全境 47 都道府縣之真實新聞報導、法院法拍公告與公營住宅（UR/JKK）實證事故物件空間查詢資料庫。",
      url: `${cleanBase}/zh-tw/`
    },
    ja: {
      lang: "ja",
      title: "事故物件マップ｜日本全国47都道府県・台湾の報道検証・競売BIT・公的記録データベース",
      desc: "日本全国47都道府県および台湾全土の報道検証済み事故物件（全国紙・地方紙報道、UR特別募集住宅、JKK特定物件、競売BIT）を網羅した空間検索データベース。",
      url: `${cleanBase}/ja/`
    },
    ko: {
      lang: "ko",
      title: "사고매물 지도｜대만·일본 전국 47개 도도부현 부동산 사고 및 뉴스·경매 검증 데이터베이스",
      desc: "대만 전역 및 일본 전국 47개 도도부현의 실제 뉴스 보도와 법원 경매 기록을 교차 검증한 공간 검색 데이터베이스.",
      url: `${cleanBase}/ko/`
    },
    en: {
      lang: "en",
      title: "Property Incident Map | Taiwan & All 47 Prefectures of Japan Verified Property Incident Archive",
      desc: "Spatial verification database covering news-verified property incidents across all 22 cities/counties of Taiwan and all 47 prefectures of Japan.",
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

function escapeHtmlAttr(str = "") {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderStandaloneCaseHtml(baseHtml, record, totalCount = 9217, baseUrl = "https://chuancn.org") {
  let html = String(baseHtml || "");
  if (!record) return html;
  const cleanBase = String(baseUrl || "https://chuancn.org").replace(/\/$/, "");
  const slug = record.slug || buildCaseSlug(record, 0);
  const canonicalUrl = `${cleanBase}/case/${slug}/`;
  const isJp = record.country === "JP" || /^jp-/i.test(String(record.id || ""));
  const city = String(record.city || "").trim();
  const district = String(record.district || "").trim();
  const rawAddr = String(record.address || record.doorplate_address || "").trim();
  const rawCat = String(record.category || "事故物件").trim();
  const incDate = String(record.incident_date || "2025").slice(0, 10);
  const bldgType = String(record.building_type || (isJp ? "共同住宅・戸建" : "住宅建物")).trim();
  const sourceName = String(record.media_verification || record.source || "公開新聞報導與司法實務紀錄").trim();
  const rawReason = String(record.reason || "").replace(/<[^>]*>?/g, " ").replace(/\s+/g, " ").trim();
  const updatedDate = String(record.updated_at || record.verified_at || new Date().toISOString().slice(0, 10)).slice(0, 10);

  const rawTitle = isJp
    ? `${rawAddr}｜${rawCat}（${incDate}）心理的瑕疵・事故物件実証記録 — 凶宅地圖`
    : `${rawAddr}｜${rawCat}（${incDate}）事故建物與產權查證卷宗 — 凶宅地圖`;
  const rawDesc = `${city}${district} ${rawAddr}（${bldgType}）事故物件實證紀錄。類別：${rawCat}，案發日期：${incDate}。${rawReason.slice(0, 110)}（核實來源：${sourceName}）`;

  const title = escapeHtmlAttr(rawTitle);
  const desc = escapeHtmlAttr(rawDesc);
  const addrEsc = escapeHtmlAttr(rawAddr);
  const catEsc = escapeHtmlAttr(rawCat);
  const reasonEsc = escapeHtmlAttr(rawReason);
  const srcEsc = escapeHtmlAttr(sourceName);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${desc}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${desc}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:description" content="${desc}" />`
  );
  html = html.replace(
    /<link\s+rel=["']canonical["'][^>]*\/?>/gi,
    ""
  );

  const latNum = Number(record.lat) || (isJp ? 35.6895 : 25.0478);
  const lngNum = Number(record.lng) || (isJp ? 139.6917 : 121.5319);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "凶宅地圖", item: `${cleanBase}/` },
          ...(city
            ? [{ "@type": "ListItem", position: 2, name: `${city}${district ? " " + district : ""}`, item: `${cleanBase}/?city=${encodeURIComponent(city)}` }]
            : []),
          { "@type": "ListItem", position: city ? 3 : 2, name: rawAddr, item: canonicalUrl }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: rawTitle,
        description: rawDesc,
        inLanguage: isJp ? "ja" : "zh-TW",
        datePublished: incDate,
        dateModified: updatedDate,
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
        mainEntity: { "@id": `${canonicalUrl}#place` }
      },
      {
        "@type": "Place",
        "@id": `${canonicalUrl}#place`,
        name: `${rawAddr} (${incDate} · ${rawCat})`,
        description: rawDesc,
        url: canonicalUrl,
        identifier: slug,
        address: {
          "@type": "PostalAddress",
          addressCountry: isJp ? "JP" : "TW",
          addressRegion: city,
          addressLocality: district,
          streetAddress: String(record.doorplate_address || rawAddr)
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: latNum,
          longitude: lngNum
        },
        additionalProperty: [
          { "@type": "PropertyValue", name: "案發日期 (Incident Date)", value: incDate },
          { "@type": "PropertyValue", name: "事故類別 (Incident Category)", value: rawCat },
          { "@type": "PropertyValue", name: "建物型態 (Building Type)", value: bldgType },
          { "@type": "PropertyValue", name: "核實來源 (Verification Source)", value: sourceName },
          { "@type": "PropertyValue", name: "最後核實更新 (Last Verified)", value: updatedDate }
        ]
      }
    ]
  });

  const safeRecordJson = JSON.stringify({ ...record, slug }).replace(/</g, "\\u003c");
  const headInject = `<link rel="canonical" id="canonical-link" href="${canonicalUrl}" />\n<script id="dynamic-case-jsonld" type="application/ld+json">${jsonLd}</script>\n<script>window.__PRELOADED_CASE_RECORD__ = ${safeRecordJson};</script>\n</head>`;
  html = html.replace(/<\/head>/i, headInject);

  const prerenderArticle = `<article id="seo-case-prerender" class="sr-only" aria-hidden="true"><h1>${addrEsc}</h1><p>所屬地區：${escapeHtmlAttr(city)} ${escapeHtmlAttr(district)}｜案發日期：${escapeHtmlAttr(incDate)}｜類別：${catEsc}｜建物型態：${escapeHtmlAttr(bldgType)}</p><p>${reasonEsc}</p><p>查證來源：${srcEsc}（最後核實更新：${escapeHtmlAttr(updatedDate)}）</p></article>`;
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
    `${cleanBase}/ko/`,
    `${cleanBase}/en/`
  ];
  const substantive = Array.isArray(records) ? records.filter(isSubstantiveCaseForSeo) : [];
  const maxSitemapCases = Math.min(substantive.length, 10000);
  const seenSlugs = new Set();
  for (let i = 0; i < maxSitemapCases; i++) {
    const slug = buildCaseSlug(substantive[i], i);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
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
    caseCount: seenSlugs.size
  };
}

export function generateAndWriteSitemapFiles(records = [], opts = {}) {
  const baseUrl = (typeof opts === "string" ? opts : (opts.baseUrl || "https://chuancn.org")).replace(/\/$/, "");
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
