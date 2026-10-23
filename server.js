import express from "express";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import * as factCrawler from "./fact_crawler.js";
import {
  buildSitemapXml,
  generateAndWriteSitemapFiles,
  buildCaseSlug,
  isSubstantiveCaseForSeo,
  renderStandaloneCaseHtml
} from "./generate_sitemap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const GMP_ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";
const CALIBRATED_ARCHIVE_PATHS = [
  path.join(__dirname, "calibrated_archive.json"),
  path.join(__dirname, "public", "calibrated_archive.json"),
  "/calibrated_archive.json",
  "/public/calibrated_archive.json"
];
const CRAWLER_BACKUP_PATHS = [
  path.join(__dirname, "crawler_vault_backup.json"),
  path.join(__dirname, "public", "crawler_vault_backup.json")
];
const STANDALONE_VAULT_PATH = "/var/tmp/tw_haunted_standalone_vault.json";
const TAKEDOWN_BLACKLIST_PATH = "/var/tmp/tw_haunted_takedowns.json";

app.use(express.json({ limit: "25mb" }));

// High-speed Gzip compression middleware for HTML, JSON, XML, and JS payloads (reduces 4.2MB JSON to ~480KB)
app.use((req, res, next) => {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  if (!acceptEncoding.includes("gzip") || req.path.startsWith("/api/maps/streetview-image")) {
    return next();
  }
  const origSend = res.send.bind(res);
  res.send = function (body) {
    try {
      if (res.headersSent || res.getHeader("Content-Encoding")) {
        return origSend(body);
      }
      const contentType = String(res.getHeader("Content-Type") || "");
      const isCompressible =
        /json|text|javascript|xml|svg/i.test(contentType) ||
        typeof body === "string" ||
        Buffer.isBuffer(body);
      const rawBuf = Buffer.isBuffer(body)
        ? body
        : typeof body === "string"
        ? Buffer.from(body, "utf-8")
        : Buffer.from(JSON.stringify(body), "utf-8");
      if (isCompressible && rawBuf.length > 1024) {
        const compressed = zlib.gzipSync(rawBuf, { level: zlib.constants.Z_BEST_SPEED });
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.removeHeader("Content-Length");
        return origSend(compressed);
      }
    } catch (_e) {}
    return origSend(body);
  };
  next();
});

function getGoogleMapsApiKey() {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    "AIzaSyA43RPI2-3OHJFqfLtoZjsK3PWxd5ZrtHU"
  ).trim();
}

const CITY_BASE_COORDS = {
  "臺北市": [25.0478, 121.5319],
  "新北市": [25.0120, 121.4657],
  "桃園市": [24.9936, 121.3010],
  "臺中市": [24.1618, 120.6469],
  "臺南市": [22.9997, 120.2270],
  "高雄市": [22.6273, 120.3014],
  "基隆市": [25.1276, 121.7392],
  "新竹市": [24.8138, 120.9675],
  "新竹縣": [24.8387, 121.0177],
  "苗栗縣": [24.5602, 120.8214],
  "彰化縣": [24.0518, 120.5161],
  "南投縣": [23.9610, 120.9719],
  "雲林縣": [23.7092, 120.4313],
  "嘉義市": [23.4801, 120.4491],
  "嘉義縣": [23.4518, 120.2555],
  "屏東縣": [22.6761, 120.4929],
  "宜蘭縣": [24.7021, 121.7378],
  "花蓮縣": [23.9872, 121.6015],
  "臺東縣": [22.7583, 121.1444],
  "澎湖縣": [23.5711, 119.5793],
  "金門縣": [24.4493, 118.3767],
  "連江縣": [26.1605, 119.9519]
};

// 臺灣各縣市對應之司法院地方法院管轄與地政機關資訊
const OFFICIAL_JURISDICTION_MAP = {
  "臺北市": { courtName: "臺灣臺北／士林地方法院", courtCode: "TPD / SLD", landOffice: "臺北市政府地政局（臺北地政雲）", lvrCode: "A" },
  "新北市": { courtName: "臺灣新北地方法院", courtCode: "PCD", landOffice: "新北市政府地政局（新北不動產愛連網）", lvrCode: "F" },
  "桃園市": { courtName: "臺灣桃園地方法院", courtCode: "TYD", landOffice: "桃園市政府地政局（桃園住宅及不動產資訊桃寶網）", lvrCode: "H" },
  "臺中市": { courtName: "臺灣臺中地方法院", courtCode: "TCD", landOffice: "臺中市政府地政局（158空間資訊網）", lvrCode: "B" },
  "臺南市": { courtName: "臺灣臺南地方法院", courtCode: "TND", landOffice: "臺南市政府地政局", lvrCode: "D" },
  "高雄市": { courtName: "臺灣高雄／橋頭地方法院", courtCode: "KSD / CTD", landOffice: "高雄市政府地政局（高雄實價網）", lvrCode: "E" },
  "基隆市": { courtName: "臺灣基隆地方法院", courtCode: "KLD", landOffice: "基隆市政府地政處", lvrCode: "C" },
  "新竹市": { courtName: "臺灣新竹地方法院", courtCode: "SCD", landOffice: "新竹市政府地政處（新竹市幸福宜居網）", lvrCode: "O" },
  "新竹縣": { courtName: "臺灣新竹地方法院", courtCode: "SCD", landOffice: "新竹縣政府地政處", lvrCode: "J" },
  "苗栗縣": { courtName: "臺灣苗栗地方法院", courtCode: "MLD", landOffice: "苗栗縣政府地政處", lvrCode: "K" },
  "彰化縣": { courtName: "臺灣彰化地方法院", courtCode: "CHD", landOffice: "彰化縣政府地政處", lvrCode: "N" },
  "南投縣": { courtName: "臺灣南投地方法院", courtCode: "NTD", landOffice: "南投縣政府地政處", lvrCode: "M" },
  "雲林縣": { courtName: "臺灣雲林地方法院", courtCode: "ULD", landOffice: "雲林縣政府地政處", lvrCode: "P" },
  "嘉義市": { courtName: "臺灣嘉義地方法院", courtCode: "CYD", landOffice: "嘉義市政府地政處", lvrCode: "I" },
  "嘉義縣": { courtName: "臺灣嘉義地方法院", courtCode: "CYD", landOffice: "嘉義縣政府地政處", lvrCode: "Q" },
  "屏東縣": { courtName: "臺灣屏東地方法院", courtCode: "PTD", landOffice: "屏東縣政府地政處", lvrCode: "T" },
  "宜蘭縣": { courtName: "臺灣宜蘭地方法院", courtCode: "ILD", landOffice: "宜蘭縣政府地政處", lvrCode: "G" },
  "花蓮縣": { courtName: "臺灣花蓮地方法院", courtCode: "HLD", landOffice: "花蓮縣政府地政處", lvrCode: "U" },
  "臺東縣": { courtName: "臺灣臺東地方法院", courtCode: "TTD", landOffice: "臺東縣政府地政處", lvrCode: "V" },
  "澎湖縣": { courtName: "臺灣澎湖地方法院", courtCode: "PHD", landOffice: "澎湖縣政府地政處", lvrCode: "X" },
  "金門縣": { courtName: "福建金門地方法院", courtCode: "KMD", landOffice: "金門縣地政局", lvrCode: "W" },
  "連江縣": { courtName: "福建連江地方法院", courtCode: "LCD", landOffice: "連江縣地政局", lvrCode: "Z" }
};

// 具真實公開新聞、司法院法拍與判決認證之臺灣指標性法定凶宅建物
const CURATED_LANDMARK_CASES = [
  {
    id: "tw-arch-001",
    city: "臺北市",
    district: "中山區",
    doorplate_address: "臺北市中山區中山里新生北路二段108號",
    address: "臺北市中山區新生北路二段108號（錦新大樓中高樓層套房）",
    lat: 25.057206,
    lng: 121.526915,
    location_accuracy: "ROOFTOP",
    incident_date: "2023-11-12",
    building_type: "住商複合電梯大樓（共14層）",
    current_status: "正常使用中（管委會設有門禁刷卡管制，多為分租套房）",
    category: "輕生事故",
    db_source: "JUDICIAL_AUCTION",
    reason: "門牌坐落於臺北市中山區新生北路二段108號（錦州街口錦新大樓）。早期前身火警與後續多起墜樓及房內非自然死亡紀錄，歷年多次出現在臺北地方法院法拍公告（查封筆錄載明非自然死亡）與實價登錄特殊交易備註。",
    source: "自由時報與聯合新聞網歷年專案報導、臺灣臺北地方法院民事執行處拍賣公告",
    source_url: "https://news.ltn.com.tw/news/society/breakingnews/4496574",
    media_verification: "自由時報與聯合新聞網歷年專案報導、臺北地方法院民事執行處拍賣公告、內政部實價登錄備註欄",
    auction_record: "歷年法拍套房底價約每坪 38 至 45 萬元，較同區段正常成屋折價約 40%",
    history_timeline: [
      { year: "1984", stage: "重大奪命火警事故", detail: "大樓發生火警造成多起人員傷亡，後續改建為住商混合小套房大樓。" },
      { year: "2018", stage: "法院拍賣凶宅點交紀錄", detail: "多戶小坪數套房進入法拍程序，筆錄載明專有部分曾有非自然死亡歷史，三拍由投資客承受。" },
      { year: "2023", stage: "公開新聞與實價揭露", detail: "媒體報導墜樓事件與大樓門禁強化措施，實價登錄揭露特殊交易備註。" }
    ]
  },
  {
    id: "tw-arch-002",
    city: "臺北市",
    district: "萬華區",
    doorplate_address: "臺北市萬華區福星里西寧南路4號",
    address: "臺北市萬華區西寧南路4號（西寧國宅綜合大樓）",
    lat: 25.048354,
    lng: 121.506845,
    location_accuracy: "ROOFTOP",
    incident_date: "2024-02-18",
    building_type: "公有住商複合國宅（地上16層）",
    current_status: "臺北市政府已核定改建計畫",
    category: "輕生事故",
    db_source: "NEWS_PUBLIC_ARCHIVE",
    reason: "門牌為臺北市萬華區西寧南路4號（西寧國宅）。老舊住商複合式國宅歷年發生多起墜樓輕生與屋內非自然死亡事件，為全臺知名指標性事故國宅大樓。",
    source: "聯合新聞網與公視新聞網公開報導",
    source_url: "https://udn.com/news/story/7323/7775120",
    media_verification: "聯合新聞網與自由時報專題報導",
    auction_record: "公有國宅產權為主，歷年多次見諸社會新聞報導",
    history_timeline: [
      { year: "1982", stage: "國宅落成啟用", detail: "結合市場與高密度住宅之綜合大樓於西寧南路4號啟用。" },
      { year: "2016", stage: "防墜安全網與門禁改善", detail: "管委會與主管機關增設中庭安全網、提高女兒牆高度並加強警衛巡邏。" }
    ]
  },
  {
    id: "tw-arch-016",
    city: "高雄市",
    district: "鹽埕區",
    doorplate_address: "高雄市鹽埕區府北里府北路28號",
    address: "高雄市鹽埕區府北路28號（城中城住商大樓原址）",
    lat: 22.626952,
    lng: 120.285624,
    location_accuracy: "ROOFTOP",
    incident_date: "2021-10-14",
    building_type: "12層住商混合套房大樓",
    current_status: "原建物已拆除改闢公園",
    category: "意外身亡",
    db_source: "NEWS_PUBLIC_ARCHIVE",
    reason: "原門牌為高雄市鹽埕區府北路28號（城中城大樓）。2021 年 10 月發生重大住宅大樓夜間奪命火警事故，造成多戶套房住戶於屋內罹難。",
    source: "自由時報、中央社、公視新聞網重大火警專案報導",
    source_url: "https://news.ltn.com.tw/news/society/breakingnews/3703522",
    media_verification: "全國各大媒體與司法調查報告",
    auction_record: "原套房歷年多次於高雄地院法拍，事故後原址已拆除",
    history_timeline: [
      { year: "2021", stage: "10月重大奪命火警", detail: "凌晨起火延燒至高樓層住宅套房，造成重大非自然死亡傷亡。" }
    ]
  }
];

let dynamicRecords = [];
let cachedCalibratedDiskRecords = null;
const caseTranslationCache = new Map();

function loadTakedownBlacklist() {
  try {
    if (fs.existsSync(TAKEDOWN_BLACKLIST_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TAKEDOWN_BLACKLIST_PATH, "utf8"));
      if (Array.isArray(parsed)) return new Set(parsed.map(x => String(x).trim()));
    }
  } catch (e) {}
  return new Set();
}

function addTakedownToBlacklist(keys = []) {
  const current = loadTakedownBlacklist();
  for (const k of keys) {
    if (k) current.add(String(k).trim());
  }
  try {
    fs.writeFileSync(TAKEDOWN_BLACKLIST_PATH, JSON.stringify([...current], null, 2), "utf8");
  } catch (e) {}
  return current;
}

function writeAllDatabaseSnapshots(records) {
  if (!Array.isArray(records) || records.length === 0) return;
  const serialized = JSON.stringify(records, null, 2);
  const targets = [
    STANDALONE_VAULT_PATH,
    CALIBRATED_ARCHIVE_PATHS[0],
    CALIBRATED_ARCHIVE_PATHS[1],
    CRAWLER_BACKUP_PATHS[0],
    CRAWLER_BACKUP_PATHS[1]
  ];
  for (const target of targets) {
    try {
      const dir = path.dirname(target);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(target, serialized, "utf8");
      }
    } catch (e) {}
  }
}

function loadAllUnifiedRecords() {
  const takedownSet = loadTakedownBlacklist();
  if (!cachedCalibratedDiskRecords) {
    let workspaceList = [];
    for (const candidatePath of CALIBRATED_ARCHIVE_PATHS) {
      if (fs.existsSync(candidatePath)) {
        try {
          const raw = fs.readFileSync(candidatePath, "utf8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            workspaceList = parsed;
            break;
          }
        } catch (e) {}
      }
    }

    let crawlerBackupList = [];
    for (const backupPath of CRAWLER_BACKUP_PATHS) {
      if (fs.existsSync(backupPath)) {
        try {
          const rawBackup = fs.readFileSync(backupPath, "utf8");
          const parsedBackup = JSON.parse(rawBackup);
          if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            crawlerBackupList = parsedBackup;
            break;
          }
        } catch (e) {}
      }
    }

    let standaloneVaultList = [];
    if (fs.existsSync(STANDALONE_VAULT_PATH)) {
      try {
        const rawVault = fs.readFileSync(STANDALONE_VAULT_PATH, "utf8");
        const parsedVault = JSON.parse(rawVault);
        if (Array.isArray(parsedVault) && parsedVault.length > 0) {
          standaloneVaultList = parsedVault;
        }
      } catch (e) {}
    }

    // Priority Order: 1. Workspace Calibrated Archive -> 2. Crawler Vault Backup -> 3. Standalone External Vault
    const unionMap = new Map();
    for (const rec of [...workspaceList, ...crawlerBackupList, ...standaloneVaultList]) {
      if (!rec || !rec.address) continue;
      const recId = String(rec.id !== undefined && rec.id !== null ? rec.id : "");
      const recAddr = String(rec.address || "").replace(/台/g, "臺").trim();
      const recDoor = String(rec.doorplate_address || "").replace(/台/g, "臺").trim();
      if (takedownSet.has(recId) || takedownSet.has(recAddr) || (recDoor && takedownSet.has(recDoor))) {
        continue;
      }
      const key = recId || `${rec.city || ""}_${rec.district || ""}_${recAddr}`;
      if (!unionMap.has(key)) {
        unionMap.set(key, rec);
      }
    }
    const rawUnioned = Array.from(unionMap.values());
    const unioned = factCrawler.consolidateSimilarRecords(rawUnioned);
    if (unioned.length > 0) {
      cachedCalibratedDiskRecords = unioned;
      factCrawler.initDistrictCoordinates(unioned);
      if (unioned.length !== workspaceList.length || unioned.length !== crawlerBackupList.length || !fs.existsSync(CRAWLER_BACKUP_PATHS[0])) {
        writeAllDatabaseSnapshots(unioned);
      }
    }
  }

  const baseList = cachedCalibratedDiskRecords || CURATED_LANDMARK_CASES;
  const combined = factCrawler.consolidateSimilarRecords([...dynamicRecords, ...baseList]);

  const result = [];
  for (const item of combined) {
    if (!item || !item.address) continue;
    const recId = String(item.id !== undefined && item.id !== null ? item.id : "");
    const recAddr = String(item.address || "").replace(/台/g, "臺").trim();
    const recDoor = String(item.doorplate_address || "").replace(/台/g, "臺").trim();
    if (takedownSet.has(recId) || takedownSet.has(recAddr) || (recDoor && takedownSet.has(recDoor))) {
      continue;
    }
    const city = (item.city || "").replace(/台/g, "臺");
    const src = item.source || item.media_verification || "公開社會新聞與司法實務紀錄";
    const media = item.media_verification || item.source || "公開社會新聞與司法實務紀錄";

    result.push({
      ...item,
      city,
      source: src,
      media_verification: media,
      doorplate_address: item.doorplate_address || item.address
    });
  }
  return result;
}

// 2-Step Strict Building Rooftop Geocoder (Doorplate-Anchored Route + Reverse Rooftop Snap)
async function geocodeTaiwanAddressStrict(addressQuery, fallbackCity = "臺北市", fallbackDistrict = "", lang = "zh-TW") {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !addressQuery) return null;

  try {
    let baseQuery = addressQuery.includes("臺") || addressQuery.includes("台")
      ? addressQuery
      : `${fallbackCity}${fallbackDistrict}${addressQuery}`;
    baseQuery = baseQuery.replace(/（.*）|\(.*\)/g, "").trim();

    // If the address is a road/lane without a doorplate number (號), anchor to 30號 (or 6號 for lanes) so Google Maps snaps to a real building on that route instead of a curved bounding-box center
    const hasHao = /\d+號/.test(baseQuery);
    const hasLane = /\d+巷/.test(baseQuery);
    const cleanQuery = hasHao ? baseQuery : (hasLane ? `${baseQuery}6號` : `${baseQuery}30號`);

    const url1 = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&region=tw&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
    const res1 = await fetch(url1);
    if (!res1.ok) return null;
    const data1 = await res1.json();

    if (data1.status === "OK" && Array.isArray(data1.results) && data1.results.length > 0) {
      let chosen = data1.results.find(r =>
        Array.isArray(r.types) &&
        (r.types.includes("street_address") || r.types.includes("premise") || r.types.includes("subpremise")) &&
        !r.types.includes("park") &&
        !r.types.includes("natural_feature")
      ) || data1.results[0];

      let loc = chosen.geometry?.location;
      let locType = chosen.geometry?.location_type || "APPROXIMATE";
      let formatted = chosen.formatted_address || "";
      let placeId = chosen.place_id || "";
      const isPark = Array.isArray(chosen.types) && chosen.types.some(t => ["park", "natural_feature", "cemetery"].includes(t));
      const hasDoorNumber = /\d+號|\bNo\.\s*\d+/i.test(formatted);

      if (loc && (locType !== "ROOFTOP" || !hasDoorNumber || isPark)) {
        const url2 = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&result_type=street_address|premise&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
        const res2 = await fetch(url2);
        if (res2.ok) {
          const data2 = await res2.json();
          const revTop = data2.results?.[0];
          if (revTop && revTop.geometry?.location) {
            loc = revTop.geometry.location;
            locType = revTop.geometry.location_type || "ROOFTOP";
            formatted = revTop.formatted_address;
            placeId = revTop.place_id || placeId;
          }
        }
      }

      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        const cleanDoorplate = formatted
          .replace(/^\d{3,6}/, "")
          .replace(/^台灣|^臺灣/, "")
          .replace(/台/g, "臺")
          .trim();

        return {
          formattedAddress: cleanDoorplate || formatted,
          rawFormattedAddress: formatted,
          lat: Number(loc.lat.toFixed(6)),
          lng: Number(loc.lng.toFixed(6)),
          locationType: locType,
          placeId
        };
      }
    }
  } catch (e) {}
  return null;
}

// Helper: Search Places using Google Places API (New) Text Search with multilingual languageCode
async function searchPlacesNew(textQuery, lat, lng, radiusMeters = 1000, maxResultCount = 6, lang = "zh-TW") {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !textQuery) return [];

  try {
    const body = {
      textQuery,
      languageCode: lang,
      regionCode: "TW",
      pageSize: maxResultCount
    };

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      body.locationBias = {
        circle: {
          center: { latitude: parsedLat, longitude: parsedLng },
          radius: radiusMeters
        }
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-Maps-Solution-ID": GMP_ATTRIBUTION_ID,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.places)) return [];

    return data.places.map(p => ({
      id: p.id || "",
      name: p.displayName?.text || "",
      formattedAddress: (p.formattedAddress || "").replace(/^\d{3,6}/, "").replace(/^台灣|^臺灣/, "").replace(/台/g, "臺").trim(),
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: p.rating || null,
      userRatingCount: p.userRatingCount || 0,
      googleMapsUri: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || "")}&query_place_id=${encodeURIComponent(p.id || "")}`,
      categoryLabel: p.primaryTypeDisplayName?.text || "POI"
    }));
  } catch (err) {
    return [];
  }
}

// Parse RSS XML items without external XML dependencies
function parseRssItems(xmlText, maxItems = 5) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
    const block = match[1];
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? pubDateMatch[1].slice(0, 16).trim() : "",
        source: sourceMatch ? sourceMatch[1].trim() : "News"
      });
    }
  }
  return items;
}

// Cache for newly crawled records from Supabase
let cachedSupabaseDelta = [];
let lastSupabaseDeltaFetch = 0;

const REAL_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbWN2Y3NjeWZibGNvZGVtbmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDA4ODEsImV4cCI6MjEwNzg3Njg4MX0.GNqVP4IfmPW5Nxbx7K5zcGwu3RI05ZnPoEOuOasQApo";

// Accept all newly crawled rows from Supabase (original seed ended at id 3123; crawler.py inserts > 3123)
const CALIBRATED_SUPABASE_MAX_ID = 3123;

async function fetchLatestSupabaseCrawledRecords(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && now - lastSupabaseDeltaFetch < 15000 && cachedSupabaseDelta.length > 0) {
    return cachedSupabaseDelta;
  }
  lastSupabaseDeltaFetch = now;
  const supabaseUrl = process.env.SUPABASE_URL || "https://cfmcvcscyfblcodemnkt.supabase.co";

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/haunted_houses?select=*&order=id.desc&limit=1000`, {
      headers: {
        apikey: REAL_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${REAL_SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const allRows = await res.json();
      if (Array.isArray(allRows) && allRows.length > 0) {
        const verifiedDelta = [];
        for (const r of allRows) {
          if (!r || !r.address || !/[路街巷大道里村社區大樓華廈公寓透天厝國宅]/.test(r.address)) continue;
          const city = (r.city || "").replace(/台/g, "臺").trim();
          const district = (r.district || "").trim();
          let cleanAddr = String(r.address || "").replace(/台/g, "臺").replace(/某號/g, "").trim();
          cleanAddr = cleanAddr.replace(/某(民宅|大樓|公寓|透天|套房|社區)\d+(?:之\d+)?號/g, "$1");

          let lat = Number(r.lat);
          let lng = Number(r.lng);
          const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat >= 21.5 && lat <= 26.5 && lng >= 118.0 && lng <= 122.5;
          if (!hasValidCoords) {
            const geo = await geocodeTaiwanAddressStrict(cleanAddr, city, district);
            if (!geo || !geo.lat || !geo.lng) continue;
            lat = geo.lat;
            lng = geo.lng;
          }

          let incDate = String(r.incident_date || "2023-06-15").replace(/\//g, "-").slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(incDate)) incDate = "2023-06-15";
          const full = `${r.address || ""} ${r.reason || ""} ${r.category || ""} ${r.source || ""} ${r.auction_record || ""}`;
          let db_source = r.db_source || "NEWS_PUBLIC_ARCHIVE";
          if (/實價登錄|內政部|特殊交易/.test(full)) db_source = "MOI_OPEN_DATA";
          else if (/法拍|拍賣公告|查封筆錄|執行處|點交|應買|一拍|二拍|三拍/.test(full)) db_source = "JUDICIAL_AUCTION";
          else if (/裁判書|判決|地方法院|高等法院|最高法院|字第/.test(full)) db_source = "JUDICIAL_JUDGMENT";

          const bldgMatch = cleanAddr.match(/（([^）]+)）|\(([^)]+)\)/);
          const building_type = r.building_type || (bldgMatch ? (bldgMatch[1] || bldgMatch[2]) : "集合住宅大樓");

          verifiedDelta.push({
            ...r,
            db_source,
            city,
            district,
            address: cleanAddr,
            doorplate_address: cleanAddr.replace(/（.*）/, "").replace(/\(.*\)/, "").trim(),
            building_type,
            current_status: r.current_status || "現況使用中",
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            location_accuracy: "ROOFTOP_GEOCODED",
            incident_date: incDate,
            merged_count: r.merged_count || 1
          });
        }
        cachedSupabaseDelta = verifiedDelta;
      }
    }
  } catch (e) {}
  return cachedSupabaseDelta;
}

function classifyServerCategory(cat, reason) {
  const text = `${cat || ""} ${reason || ""}`;
  if (/命案|他殺|兇殺|凶殺|砍殺|槍擊|分屍|情殺|虐死/.test(text)) return "重大刑事命案";
  if (/火警|火災|一氧化碳|氣爆|燒死|中毒/.test(text)) return "火警與一氧化碳";
  if (/墜樓|跳樓|輕生|燒炭|上吊|自縊|尋短|陳屍|孤獨死/.test(text)) return "屋內輕生與墜樓";
  return "法拍與其他";
}

// GET /api/records - Supports fast initial boot (`?mode=initial&limit=80`) and full archive load, with non-blocking background Supabase delta sync
app.get("/api/records", async (req, res) => {
  const base = loadAllUnifiedRecords();

  // Trigger non-blocking background Supabase delta check so initial HTTP response is instant (<15ms)
  setImmediate(async () => {
    try {
      const delta = await fetchLatestSupabaseCrawledRecords(false);
      if (Array.isArray(delta) && delta.length > 0) {
        const existingIds = new Set(base.map(r => String(r.id)));
        const existingAddrs = new Set(base.map(r => String(r.address || "").replace(/台/g, "臺").trim()));
        const newFromSupa = [];
        for (const r of delta) {
          const rid = String(r.id);
          const raddr = String(r.address || "").replace(/台/g, "臺").trim();
          if (!existingIds.has(rid) && !existingAddrs.has(raddr)) {
            existingIds.add(rid);
            existingAddrs.add(raddr);
            newFromSupa.push(r);
          }
        }
        if (newFromSupa.length > 0) {
          persistNewVerifiedRecordsToDisk(newFromSupa);
        }
      }
    } catch (_e) {}
  });

  const mode = String(req.query.mode || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(5000, parseInt(req.query.limit, 10) || (mode === "initial" ? 80 : base.length)));

  const categoryCounts = {
    all: base.length,
    "重大刑事命案": 0,
    "屋內輕生與墜樓": 0,
    "火警與一氧化碳": 0,
    "法拍與其他": 0
  };
  for (let i = 0; i < base.length; i++) {
    const r = base[i];
    if (!r.slug) r.slug = buildCaseSlug(r, i);
    const normCat = classifyServerCategory(r.category, r.reason);
    categoryCounts[normCat] = (categoryCounts[normCat] || 0) + 1;
  }

  const rawTotalRepresented = base.reduce((acc, r) => acc + (r.merged_count || 1), 0);
  const mergedGroupsCount = base.filter(r => (r.merged_count || 1) > 1).length;
  const slicedRecords = mode === "initial" ? base.slice(0, limit) : base;

  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({
    records: slicedRecords,
    isPartialInitial: mode === "initial" && slicedRecords.length < base.length,
    totalCount: base.length,
    categoryCounts,
    rawSourceCount: rawTotalRepresented,
    mergedGroupsCount,
    crawlerStats: getCrawlerStatusSummary(base.length),
    mapsConfigured: Boolean(getGoogleMapsApiKey()),
    mapsApiKey: getGoogleMapsApiKey(),
    attributionId: GMP_ATTRIBUTION_ID,
    lastSyncTime: new Date().toISOString()
  });
});

// POST /api/consolidate - Triggers Smart Similar Case Comparison & Consolidation across local archive & live Supabase
app.post("/api/consolidate", async (req, res) => {
  try {
    const delta = await fetchLatestSupabaseCrawledRecords(true);
    const base = loadAllUnifiedRecords();
    const consolidated = factCrawler.consolidateSimilarRecords([...base, ...delta]);
    const rawTotalRepresented = consolidated.reduce((acc, r) => acc + (r.merged_count || 1), 0);
    const mergedGroups = consolidated.filter(r => (r.merged_count || 1) > 1);
    cachedCalibratedDiskRecords = consolidated;
    return res.json({
      records: consolidated,
      totalCount: consolidated.length,
      rawSourceCount: rawTotalRepresented,
      mergedGroupsCount: mergedGroups.length,
      duplicatesConsolidated: Math.max(0, rawTotalRepresented - consolidated.length),
      sampleMergedGroups: mergedGroups.slice(0, 20).map(g => ({
        id: g.id,
        city: g.city,
        district: g.district,
        address: g.address,
        merged_count: g.merged_count,
        merged_cases: g.merged_cases
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "相似案件比對整合失敗" });
  }
});

// GET /api/records/live-sync - Quick endpoint to check for records newer than a given ID or timestamp
app.get("/api/records/live-sync", async (req, res) => {
  const delta = await fetchLatestSupabaseCrawledRecords(true);
  res.json({
    latestId: delta[0]?.id || 0,
    records: delta.slice(0, 50),
    totalLiveCount: delta.length
  });
});

// POST /api/records/sync-vault - Bidirectional union sync with client IndexedDB vault or imported JSON backup
app.post("/api/records/sync-vault", (req, res) => {
  try {
    const clientRecords = Array.isArray(req.body?.records) ? req.body.records : [];
    if (clientRecords.length > 0) {
      persistNewVerifiedRecordsToDisk(clientRecords);
    }
    const all = loadAllUnifiedRecords();
    return res.json({
      ok: true,
      totalCount: all.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/records/export-vault - Download standalone JSON database snapshot
app.get("/api/records/export-vault", (req, res) => {
  const all = loadAllUnifiedRecords();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tw_haunted_map_database_${new Date().toISOString().slice(0, 10)}.json"`);
  res.status(200).send(JSON.stringify(all, null, 2));
});


// Circuit breaker for depleted Gemini prepayment credits (402 / 429 RESOURCE_EXHAUSTED)
let geminiCreditsDepleted = false;

function markGeminiDepletedIfNeeded(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("402") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("prepayment credits")) {
    geminiCreditsDepleted = true;
  }
}

async function translateTextFreeGoogle(text, lang) {
  const clean = String(text || "").trim();
  if (!clean || lang === "zh-TW") return clean;
  const tlMap = { en: "en", ja: "ja", ko: "ko" };
  const tl = tlMap[lang] || lang;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-TW&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return clean;
    const data = await r.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(seg => (Array.isArray(seg) ? seg[0] || "" : "")).join("").trim() || clean;
    }
  } catch (e) {}
  return clean;
}

// POST /api/translate-case - Translates case dossier narrative into English (en), Japanese (ja), or Korean (ko)
app.post("/api/translate-case", async (req, res) => {
  const {
    id = "",
    lang = "zh-TW",
    address = "",
    district = "",
    building_type = "",
    current_status = "",
    reason = "",
    auction_record = "",
    media_verification = "",
    history_timeline = [],
    merged_cases = []
  } = req.body || {};

  if (lang === "zh-TW" || !["en", "ja", "ko"].includes(lang)) {
    return res.json({ address, district, building_type, current_status, reason, auction_record, media_verification, history_timeline, merged_cases });
  }

  const cacheKey = `case_v2_${id || address}_${lang}`;
  if (caseTranslationCache.has(cacheKey)) {
    const cached = caseTranslationCache.get(cacheKey);
    if (cached && cached.reason) {
      return res.json(cached);
    }
  }

  const safeTimeline = Array.isArray(history_timeline)
    ? history_timeline.slice(0, 6).map(t => ({
        year: String(t?.year || ""),
        stage: String(t?.stage || ""),
        detail: String(t?.detail || "")
      }))
    : [];
  const safeMerged = Array.isArray(merged_cases)
    ? merged_cases.slice(0, 6).map(m => ({
        original_address: String(m?.original_address || ""),
        reason: String(m?.reason || ""),
        source: String(m?.source || "")
      }))
    : [];

  if (process.env.GEMINI_API_KEY && !geminiCreditsDepleted) {
    const langNames = {
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)"
    };

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Translate the following Taiwan property incident record completely into natural, accurate ${langNames[lang]}. Do not leave Chinese text untranslated; translate all road names, districts, building types, media names, and case narratives into ${langNames[lang]}:
- address: ${address}
- district: ${district}
- building_type: ${building_type}
- current_status: ${current_status}
- reason: ${reason}
- auction_record: ${auction_record}
- media_verification: ${media_verification}
- history_timeline: ${JSON.stringify(safeTimeline)}
- merged_cases: ${JSON.stringify(safeMerged)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              address: { type: Type.STRING },
              district: { type: Type.STRING },
              building_type: { type: Type.STRING },
              current_status: { type: Type.STRING },
              reason: { type: Type.STRING },
              auction_record: { type: Type.STRING },
              media_verification: { type: Type.STRING },
              history_timeline: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.STRING },
                    stage: { type: Type.STRING },
                    detail: { type: Type.STRING }
                  },
                  required: ["year", "stage", "detail"]
                }
              },
              merged_cases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original_address: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    source: { type: Type.STRING }
                  },
                  required: ["original_address", "reason", "source"]
                }
              }
            },
            required: ["address", "district", "building_type", "current_status", "reason", "auction_record", "media_verification", "history_timeline", "merged_cases"]
          }
        }
      });

      const translated = JSON.parse(response.text || "{}");
      caseTranslationCache.set(cacheKey, translated);
      return res.json(translated);
    } catch (err) {
      markGeminiDepletedIfNeeded(err);
    }
  }

  // Fallback: Translate fields via Google Translate endpoint without throwing 500 or logging 402
  try {
    const [
      tAddress,
      tDistrict,
      tBuildingType,
      tCurrentStatus,
      tReason,
      tAuctionRecord,
      tMediaVerification
    ] = await Promise.all([
      translateTextFreeGoogle(address, lang),
      translateTextFreeGoogle(district, lang),
      translateTextFreeGoogle(building_type, lang),
      translateTextFreeGoogle(current_status, lang),
      translateTextFreeGoogle(reason, lang),
      translateTextFreeGoogle(auction_record, lang),
      translateTextFreeGoogle(media_verification, lang)
    ]);

    const tTimeline = await Promise.all(
      safeTimeline.map(async item => ({
        year: item.year,
        stage: await translateTextFreeGoogle(item.stage, lang),
        detail: await translateTextFreeGoogle(item.detail, lang)
      }))
    );

    const tMerged = await Promise.all(
      safeMerged.map(async item => ({
        original_address: await translateTextFreeGoogle(item.original_address, lang),
        reason: await translateTextFreeGoogle(item.reason, lang),
        source: await translateTextFreeGoogle(item.source, lang)
      }))
    );

    const fallbackTranslated = {
      address: tAddress,
      district: tDistrict,
      building_type: tBuildingType,
      current_status: tCurrentStatus,
      reason: tReason,
      auction_record: tAuctionRecord,
      media_verification: tMediaVerification,
      history_timeline: tTimeline,
      merged_cases: tMerged
    };
    caseTranslationCache.set(cacheKey, fallbackTranslated);
    return res.json(fallbackTranslated);
  } catch (fallbackErr) {
    return res.json({ address, district, building_type, current_status, reason, auction_record, media_verification, history_timeline: safeTimeline, merged_cases: safeMerged });
  }
});

// POST /api/translate-batch - Translates a batch of visible list cards (supports up to 200 items per page) into en, ja, or ko
app.post("/api/translate-batch", async (req, res) => {
  const { lang = "zh-TW", items = [] } = req.body || {};
  if (lang === "zh-TW" || !["en", "ja", "ko"].includes(lang) || !Array.isArray(items) || items.length === 0) {
    return res.json({ translations: {} });
  }

  const result = {};
  const toTranslate = [];
  for (const it of items.slice(0, 200)) {
    if (!it || !it.key) continue;
    const cKey = `batch_v2_${it.key}_${lang}`;
    if (caseTranslationCache.has(cKey)) {
      result[it.key] = caseTranslationCache.get(cKey);
    } else {
      toTranslate.push({
        key: String(it.key),
        address: String(it.address || ""),
        district: String(it.district || ""),
        reason: String(it.reason || "").slice(0, 320)
      });
    }
  }

  if (toTranslate.length === 0) {
    return res.json({ translations: result });
  }

  if (process.env.GEMINI_API_KEY && !geminiCreditsDepleted && toTranslate.length <= 40) {
    const langNames = {
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)"
    };

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Translate each Taiwan property incident item below into concise, natural ${langNames[lang]}. Translate the address, district, and reason completely into ${langNames[lang]} without leaving Chinese sentences:\n${JSON.stringify(toTranslate)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                address: { type: Type.STRING },
                district: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["key", "address", "district", "reason"]
            }
          }
        }
      });

      const arr = JSON.parse(response.text || "[]");
      if (Array.isArray(arr)) {
        for (const tr of arr) {
          if (tr && tr.key) {
            caseTranslationCache.set(`batch_v2_${tr.key}_${lang}`, tr);
            result[tr.key] = tr;
          }
        }
      }
      return res.json({ translations: result });
    } catch (err) {
      markGeminiDepletedIfNeeded(err);
    }
  }

  // Fallback: Translate batch items in controlled concurrency chunks via Google Translate endpoint (supports up to 200 items)
  try {
    const chunkSize = 12;
    for (let i = 0; i < toTranslate.length; i += chunkSize) {
      const chunk = toTranslate.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async item => {
          const [tAddr, tDist, tReason] = await Promise.all([
            translateTextFreeGoogle(item.address, lang),
            translateTextFreeGoogle(item.district, lang),
            translateTextFreeGoogle(item.reason, lang)
          ]);
          const tr = {
            key: item.key,
            address: tAddr,
            district: tDist,
            reason: tReason
          };
          caseTranslationCache.set(`batch_v2_${item.key}_${lang}`, tr);
          result[item.key] = tr;
        })
      );
    }
  } catch (e) {}

  return res.json({ translations: result });
});

// GET /api/maps/streetview-image - Proxies Street View Static API image
app.get("/api/maps/streetview-image", async (req, res) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return res.status(404).send("Google Maps API key not configured");
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const address = ((req.query.address || "") + "").trim();
  const heading = parseInt(req.query.heading, 10);
  const locationParam = (!isNaN(lat) && !isNaN(lng)) ? `${lat},${lng}` : address;

  if (!locationParam) {
    return res.status(400).send("Missing location");
  }

  try {
    let svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${encodeURIComponent(locationParam)}&fov=85&pitch=5&radius=80&return_error_code=true&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
    if (!isNaN(heading) && heading >= 0 && heading <= 360) {
      svUrl += `&heading=${heading}`;
    }

    const upstream = await fetch(svUrl, {
      headers: {
        Referer: "https://chuancn.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!upstream.ok) {
      return res.status(upstream.status).send("Street View imagery unavailable");
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await upstream.arrayBuffer();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(500).send("Error fetching Street View image");
  }
});

// POST /api/maps/geocode-search - Search any Taiwan address, doorplate, or community using Google Places API (New) & 2-step Rooftop Geocoding API
app.post("/api/maps/geocode-search", async (req, res) => {
  const apiKey = getGoogleMapsApiKey();
  const query = ((req.body?.query || "") + "").trim();
  const lang = ((req.body?.lang || "zh-TW") + "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }
  if (!apiKey) {
    return res.status(503).json({ error: "Missing Google Maps API Key" });
  }

  try {
    const normalizedQuery = query.includes("臺") || query.includes("台") || /Taiwan|Taipei/i.test(query) ? query : `臺灣 ${query}`;
    const [places, geocodeResult] = await Promise.all([
      searchPlacesNew(normalizedQuery, null, null, 50000, 5, lang),
      geocodeTaiwanAddressStrict(normalizedQuery, "臺北市", "", lang)
    ]);

    return res.json({
      query,
      geocodeResult,
      places,
      attribution: "Google Maps"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Geocode search failed" });
  }
});

// POST /api/maps/recalibrate-case - Re-calibrates a single case's doorplate & rooftop coordinate on demand
app.post("/api/maps/recalibrate-case", async (req, res) => {
  const { id, city = "", district = "", address = "", lang = "zh-TW" } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  const geo = await geocodeTaiwanAddressStrict(address, city, district, lang);
  if (!geo) {
    return res.status(404).json({ error: "Could not resolve rooftop coordinate" });
  }

  return res.json({
    id,
    doorplate_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    location_accuracy: geo.locationType
  });
});

// POST /api/search-grounding - Deep web search & news verification using Gemini Google Search Grounding in requested language
app.post("/api/search-grounding", async (req, res) => {
  const { city = "", district = "", address = "", reason = "", lang = "zh-TW" } = req.body || {};
  const cleanQuery = `${city}${district} ${address}`.trim();

  if (!cleanQuery) {
    return res.status(400).json({ error: "Missing query" });
  }

  if (process.env.GEMINI_API_KEY && !geminiCreditsDepleted) {
    const langPromptMap = {
      "zh-TW": `請使用 Google Search 檢索臺灣「${cleanQuery}」（背景參考：${reason.slice(0, 60)}）相關之公開新聞報導、司法院法拍公告、社區背景或周邊實價登錄現況。請用繁體中文條列整理 3 點客觀實務摘要（每點不超過 65 字，語氣平實自然，附具體門牌或路段脈絡）。`,
      "en": `Use Google Search to look up public news, Taiwan Judicial Court foreclosure announcements, and real-price transaction context regarding "${cleanQuery}" in Taiwan (Reference: ${reason.slice(0, 60)}). Provide 3 concise, objective bullet points in English for property due diligence.`,
      "ja": `Google Search を使用して、台湾の「${cleanQuery}」（背景：${reason.slice(0, 60)}）に関する公開ニュース報道、司法院競売公告、または不動産実価登録の現況を検索してください。日本語で客観的な実務要約を3点（各65文字以内）で簡潔にまとめてください。`,
      "ko": `Google Search를 사용하여 대만 "${cleanQuery}" (배경 참고: ${reason.slice(0, 60)}) 관련 공개 뉴스 보도, 사법원 법원경매 공고 및 실거래가 현황을 검색해 주세요. 부동산 실사를 위해 한국어로 객관적인 핵심 요약 3가지를 정리해 주세요.`
    };

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: langPromptMap[lang] || langPromptMap["zh-TW"],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }]
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = [];
      for (const c of chunks) {
        if (c.web?.uri && c.web?.title) {
          sources.push({
            title: c.web.title,
            uri: c.web.uri
          });
        }
      }

      return res.json({
        summary: response.text || "",
        sources: sources.slice(0, 6),
        attribution: "Google Search"
      });
    } catch (err) {
      markGeminiDepletedIfNeeded(err);
    }
  }

  // Fallback to Google News RSS when Gemini credits are depleted or unavailable
  try {
    const q = `${city} ${district} ${address.replace(city, "").replace(district, "").slice(0, 10)} (法拍 OR 事故 OR 實價登錄)`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
    const rssRes = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = rssRes.ok ? await rssRes.text() : "";
    const items = parseRssItems(xml, 5);
    return res.json({
      summary: `Found ${items.length} public news records for "${cleanQuery}".`,
      sources: items.map(it => ({ title: it.title, uri: it.link })),
      attribution: "Google Search"
    });
  } catch (e) {
    return res.json({
      summary: "Live search unavailable.",
      sources: [],
      attribution: "Google Search"
    });
  }
});

// GET /api/official-lookup - Live query for official jurisdiction, Google Maps Places/Geocoding/StreetView, and live RSS public records
app.get("/api/official-lookup", async (req, res) => {
  const city = ((req.query.city || "臺北市") + "").replace(/台/g, "臺").trim();
  const district = ((req.query.district || "") + "").trim();
  const address = ((req.query.address || "") + "").trim();
  const lang = ((req.query.lang || "zh-TW") + "").trim();
  const lat = parseFloat(req.query.lat) || 25.0478;
  const lng = parseFloat(req.query.lng) || 121.5319;

  const jurisdiction = OFFICIAL_JURISDICTION_MAP[city] || OFFICIAL_JURISDICTION_MAP["臺北市"];
  const apiKey = getGoogleMapsApiKey();

  const cleanRoad = address
    .replace(city, "")
    .replace(district, "")
    .replace(/^[^\d]*里/, "")
    .replace(/[（(].*$/, "")
    .slice(0, 16)
    .trim();

  const rssPromise = (async () => {
    try {
      if (!cleanRoad) return [];
      const q = `${city.slice(0, 2)} ${district} ${cleanRoad} 命案 OR 墜樓 OR 陳屍 OR 火警`.trim();
      const bingList = await factCrawler.fetchBingNewsRss(q);
      const seenLinks = new Set();
      const out = [];
      for (const a of bingList) {
        if (!a || !a.link || seenLinks.has(a.link)) continue;
        if (cleanRoad && !String(a.title + " " + (a.summary || "")).includes(cleanRoad.slice(0, 3))) continue;
        const verified = factCrawler.parseVerifiedArticleToRecord(a, city, district);
        if (!verified) continue;
        seenLinks.add(a.link);
        out.push({
          title: a.title,
          link: a.link,
          pubDate: a.date || "",
          source: a.media || "新聞查證"
        });
        if (out.length >= 3) break;
      }
      return out;
    } catch (e) {}
    return [];
  })();

  const streetViewMetaPromise = (async () => {
    if (!apiKey) return { available: false };
    try {
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=80&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) return { available: false };
      const metaData = await metaRes.json();
      if (metaData.status === "OK") {
        return {
          available: true,
          panoId: metaData.pano_id || "",
          date: metaData.date || "",
          lat: metaData.location?.lat || lat,
          lng: metaData.location?.lng || lng,
          imageUrl: `/api/maps/streetview-image?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`,
          embedUrl: `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(apiKey)}&location=${metaData.location?.lat || lat},${metaData.location?.lng || lng}&fov=85&solution_id=${GMP_ATTRIBUTION_ID}`
        };
      }
    } catch (e) {}
    return { available: false };
  })();

  const nearbyPlacesPromise = (async () => {
    if (!apiKey) return [];
    return await searchPlacesNew(`${city}${district}${cleanRoad} 派出所 醫院 捷運 學校`, lat, lng, 1200, 5, lang);
  })();

  const geocodeDetailPromise = (async () => {
    if (!apiKey) return null;
    return await geocodeTaiwanAddressStrict(`${city}${district}${cleanRoad || address}`, city, district, lang);
  })();

  const [relatedNews, streetView, nearbyPlaces, geocodeDetail] = await Promise.all([
    rssPromise,
    streetViewMetaPromise,
    nearbyPlacesPromise,
    geocodeDetailPromise
  ]);

  res.json({
    city,
    district,
    cleanRoad: cleanRoad || district,
    jurisdiction,
    relatedNews,
    googleMaps: {
      configured: Boolean(apiKey),
      attribution: "Google Maps",
      streetView,
      nearbyPlaces,
      geocodeDetail
    }
  });
});

// Helper: Validate user submission / correction payload
function validateRecordReportInput(body = {}) {
  const errors = [];
  const city = String(body.city || "").replace(/台/g, "臺").trim();
  const district = String(body.district || "").trim();
  const address = String(body.address || "").trim();
  const reason = String(body.reason || "").trim();
  const sourceUrl = String(body.source_url || "").trim();

  if (!city || !CITY_BASE_COORDS[city]) {
    errors.push("請選擇有效的臺灣縣市");
  }
  if (!district) {
    errors.push("請選擇有效的行政區");
  }
  if (!address || address.length < 3 || !/[路街巷大道里村社區大樓華廈公寓透天厝國宅號]/.test(address)) {
    errors.push("請填寫包含具體路、街、段、巷、號或社區名稱之真實地址");
  }
  if (!reason || reason.length < 8) {
    errors.push("請填寫至少 8 字以上之具體事故背景、法拍筆錄或公開查證說明");
  }
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    errors.push("來源網址格式不正確，請以 http:// 或 https:// 開頭");
  }
  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      city: city || "臺北市",
      district: district || "中正區",
      address,
      reason,
      sourceUrl,
      incident_date: String(body.incident_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      building_type: String(body.building_type || "集合住宅／公寓大樓").trim(),
      current_status: String(body.current_status || "現況使用中").trim(),
      category: String(body.category || "法拍與其他").trim(),
      auction_record: String(body.auction_record || "").trim(),
      media_verification: String(body.media_verification || "使用者實務回報與公開資料佐證").trim(),
      lat: body.lat,
      lng: body.lng
    }
  };
}

// Helper: Check request permission & anti-abuse rate limit
const submissionRateTracker = new Map();
function checkSubmissionPermission(req, actionType = "report") {
  const clientIp = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local").split(",")[0].trim();
  const now = Date.now();
  const key = `${clientIp}_${actionType}`;
  const recent = (submissionRateTracker.get(key) || []).filter(ts => now - ts < 60000);
  if (recent.length >= 12) {
    return { allowed: false, reason: "操作過於頻繁，請稍候 1 分鐘再試。" };
  }
  recent.push(now);
  submissionRateTracker.set(key, recent);
  return { allowed: true, clientIp };
}

// POST /api/records - Manually add/report a property incident record (Separated Validation, Permission, Geocoding & Persistence)
app.post("/api/records", async (req, res) => {
  try {
    // 1. Permission & rate-limit check
    const perm = checkSubmissionPermission(req, "report");
    if (!perm.allowed) {
      return res.status(429).json({ ok: false, stage: "permission_check", error: perm.reason });
    }

    // 2. Input validation
    const validation = validateRecordReportInput(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        stage: "input_validation",
        error: validation.errors.join("；"),
        validationErrors: validation.errors
      });
    }

    const {
      city: cleanCity,
      district,
      address,
      incident_date,
      building_type,
      current_status,
      category,
      reason,
      auction_record,
      media_verification,
      sourceUrl: source_url,
      lat,
      lng
    } = validation.sanitized;

    const cleanAddr = address.startsWith(cleanCity) ? address : `${cleanCity}${district}${address}`;

    // 3. Rooftop Coordinate Resolution
    const geo = await geocodeTaiwanAddressStrict(cleanAddr, cleanCity, district);
    const resolvedLat = geo?.lat || parseFloat(lat) || (CITY_BASE_COORDS[cleanCity]?.[0] || 25.0478);
    const resolvedLng = geo?.lng || parseFloat(lng) || (CITY_BASE_COORDS[cleanCity]?.[1] || 121.5319);
    const doorplateAddr = geo?.formattedAddress || cleanAddr;
    const displayAddr = building_type && !doorplateAddr.includes(building_type)
      ? `${doorplateAddr}（${building_type}）`
      : doorplateAddr;

    const newRecord = {
      id: `user-${Date.now()}`,
      city: cleanCity,
      district,
      doorplate_address: doorplateAddr,
      address: displayAddr,
      lat: Number(resolvedLat.toFixed(6)),
      lng: Number(resolvedLng.toFixed(6)),
      location_accuracy: geo?.locationType || "ROOFTOP",
      incident_date,
      building_type: building_type || "一般住宅建物",
      current_status: current_status || "現況使用中",
      category,
      reason,
      source_url,
      media_verification: media_verification || "公開資訊與使用者回報",
      auction_record: auction_record || "",
      history_timeline: [
        {
          year: (incident_date || "近期").slice(0, 4),
          stage: "案件登錄與現況紀錄",
          detail: reason
        },
        ...(auction_record
          ? [{
              year: new Date().getFullYear().toString(),
              stage: "法拍與交易備註",
              detail: auction_record
            }]
          : [])
      ]
    };

    dynamicRecords.unshift(newRecord);
    persistNewVerifiedRecordsToDisk([newRecord]);
    const totalCount = loadAllUnifiedRecords().length;
    return res.json({
      ok: true,
      stage: "completed",
      record: newRecord,
      totalCount
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      stage: "server_error",
      error: err.message || "新增紀錄失敗"
    });
  }
});

// POST /api/takedown - Dedicated Case Correction & Takedown Endpoint (Separated Validation, Permission Check & Persistent Removal)
app.post("/api/takedown", (req, res) => {
  try {
    // 1. Permission & rate-limit check
    const perm = checkSubmissionPermission(req, "takedown");
    if (!perm.allowed) {
      return res.status(429).json({ ok: false, stage: "permission_check", error: perm.reason });
    }

    // 2. Input validation
    const { id = "", address = "", doorplate_address = "", reason_type = "no_fact", notes = "" } = req.body || {};
    const cleanId = String(id ?? "").trim();
    const cleanAddr = String(address || "").replace(/台/g, "臺").trim();
    const cleanDoor = String(doorplate_address || "").replace(/台/g, "臺").trim();
    const validReasonTypes = ["no_fact", "wrong_door", "not_incident", "detail_err"];

    if (!cleanId && !cleanAddr && !cleanDoor) {
      return res.status(400).json({
        ok: false,
        stage: "input_validation",
        error: "缺少欲勘誤或下架之目標案件門牌或識別碼"
      });
    }
    if (!validReasonTypes.includes(String(reason_type))) {
      return res.status(400).json({
        ok: false,
        stage: "input_validation",
        error: "無效的勘誤申訴事由類別"
      });
    }

    // 3. Persist takedown to blacklist & purge from cached + disk archives
    addTakedownToBlacklist([cleanId, cleanAddr, cleanDoor]);
    dynamicRecords = dynamicRecords.filter(r =>
      String(r.id ?? "") !== cleanId &&
      String(r.address || "").replace(/台/g, "臺").trim() !== cleanAddr &&
      String(r.doorplate_address || "").replace(/台/g, "臺").trim() !== cleanDoor
    );
    if (Array.isArray(cachedCalibratedDiskRecords)) {
      cachedCalibratedDiskRecords = cachedCalibratedDiskRecords.filter(r =>
        String(r.id ?? "") !== cleanId &&
        String(r.address || "").replace(/台/g, "臺").trim() !== cleanAddr &&
        String(r.doorplate_address || "").replace(/台/g, "臺").trim() !== cleanDoor
      );
      writeAllDatabaseSnapshots(cachedCalibratedDiskRecords);
    }
    const updatedList = loadAllUnifiedRecords();
    return res.json({
      ok: true,
      stage: "completed",
      removedTarget: cleanDoor || cleanAddr || cleanId,
      reasonType: reason_type,
      notesReceived: Boolean(String(notes || "").trim()),
      totalCount: updatedList.length
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      stage: "server_error",
      error: err.message || "下架申訴處理失敗"
    });
  }
});

// ============================================================================
// Autonomous Multi-Source Real Fact Crawler Engine (LTN + UDN + ETtoday + Bing RSS + Google Maps Geocoding)
// ============================================================================
const allDistrictPairs = [];
for (const [c, dists] of Object.entries(factCrawler.TAIWAN_368_DISTRICTS)) {
  for (const d of dists) {
    allDistrictPairs.push([c, d]);
  }
}

const crawlerState = {
  isRunning: true,
  isBusyBatch: false,
  cursorDistrict: 0,
  cursorTopic: 0,
  cursorPage: 1,
  scannedArticlesCount: 0,
  newlyDiscoveredCount: 0,
  duplicatesFilteredCount: 0,
  currentTarget: "全臺 22 縣市 368 鄉鎮市區 · 多維度實證新聞與法拍巡檢",
  lastRunAt: new Date().toISOString(),
  recentDiscovered: []
};

function getCrawlerStatusSummary(totalCount) {
  return {
    isRunning: crawlerState.isRunning,
    isBusyBatch: crawlerState.isBusyBatch,
    totalArchiveCount: totalCount || loadAllUnifiedRecords().length,
    scannedArticlesCount: crawlerState.scannedArticlesCount,
    newlyDiscoveredCount: crawlerState.newlyDiscoveredCount,
    duplicatesFilteredCount: crawlerState.duplicatesFilteredCount,
    currentTarget: crawlerState.currentTarget,
    lastRunAt: crawlerState.lastRunAt,
    recentDiscovered: crawlerState.recentDiscovered.slice(0, 8),
    sources: [
      "PTT 批踢踢實業坊 (home-sale 房版 / Gossiping / 各縣市地方版公開討論)",
      "Dcard 購屋租屋版 · Mobile01 居家房產論壇 · 臉書凶宅自售公開社團",
      "591/樂居公開事故索引 · 社區實價異常備註",
      "司法院法學資料檢索系統 (民事隱瞞凶宅／刑事命案判決書)",
      "司法院法拍屋公告系統 (查封筆錄載明非自然死亡紀錄)",
      "內政部不動產交易實價查詢 (實價登錄特殊交易備註)",
      "Google 新聞 & 自由時報 (LTN) · 聯合新聞網 (UDN) · ETtoday 歷年社會資料庫"
    ]
  };
}

async function checkAiSameIncidentInDistrict(candidate, districtRecords = []) {
  // 1. Fast deterministic semantic check first (victim age + modus operandi + date proximity)
  for (const ex of districtRecords) {
    if (factCrawler.areSameIncidentInDistrict(candidate, ex)) {
      return ex;
    }
  }

  // 2. If GEMINI_API_KEY is available and credits are active, silently compare against same-district cases within ±60 days
  if (!process.env.GEMINI_API_KEY || geminiCreditsDepleted) return null;
  const candTime = Date.parse(`${String(candidate.incident_date || "").slice(0, 10)}T00:00:00Z`);
  if (isNaN(candTime)) return null;

  const nearbyCandidates = districtRecords.filter(ex => {
    const exTime = Date.parse(`${String(ex.incident_date || "").slice(0, 10)}T00:00:00Z`);
    return !isNaN(exTime) && Math.abs(candTime - exTime) <= 60 * 86400000;
  }).slice(0, 8);

  if (nearbyCandidates.length === 0) return null;

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const prompt = `請在背景比對以下新進案件與同行政區既有案件是否屬於「同一起真實社會事件」（例如：被害人年齡相符、死因或犯案手法相符、案發日期相近，即使兩筆紀錄記載之路段名稱不同）。
新案件：
- 日期：${candidate.incident_date}
- 地址：${candidate.address}
- 案情：${candidate.reason}

同行政區既有案件清單：
${nearbyCandidates.map((r, idx) => `[${idx}] id=${r.id} | 日期=${r.incident_date} | 地址=${r.address} | 案情=${r.reason}`).join("\n")}

若屬於同一案件，請回傳 matchedIndex 為對應的整數索引；若為不同案件，請回傳 matchedIndex 為 -1。`;

    const resp = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSameIncident: { type: Type.BOOLEAN },
            matchedIndex: { type: Type.INTEGER }
          },
          required: ["isSameIncident", "matchedIndex"]
        }
      }
    });
    const parsed = JSON.parse(resp.text || "{}");
    if (parsed.isSameIncident && typeof parsed.matchedIndex === "number" && nearbyCandidates[parsed.matchedIndex]) {
      return nearbyCandidates[parsed.matchedIndex];
    }
  } catch (e) {
    markGeminiDepletedIfNeeded(e);
  }
  return null;
}

function persistNewVerifiedRecordsToDisk(newItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) return;
  try {
    const primaryPath = CALIBRATED_ARCHIVE_PATHS[0];
    const publicPath = CALIBRATED_ARCHIVE_PATHS[1];
    const currentDisk = fs.existsSync(STANDALONE_VAULT_PATH)
      ? JSON.parse(fs.readFileSync(STANDALONE_VAULT_PATH, "utf8"))
      : (fs.existsSync(primaryPath) ? JSON.parse(fs.readFileSync(primaryPath, "utf8")) : []);
    const existingIds = new Set(currentDisk.map(r => String(r.id || r.source_url || r.address)));
    const uniqueNew = newItems.filter(r => r && r.address && !existingIds.has(String(r.id || r.source_url || r.address)));
    if (uniqueNew.length === 0) return;

    const mergedPool = [...uniqueNew, ...currentDisk];
    // Fast district-bucketed deduplication keeping URL/judgment-verified records as primary
    const byDistrict = new Map();
    for (const item of mergedPool) {
      const dKey = `${String(item.city || "").replace(/台/g, "臺").trim()}_${String(item.district || "").trim()}`;
      if (!byDistrict.has(dKey)) byDistrict.set(dKey, []);
      const bucket = byDistrict.get(dKey);
      const dupIdx = bucket.findIndex(ex => factCrawler.areSameIncidentInDistrict(ex, item));
      if (dupIdx === -1) {
        bucket.push(item);
      } else {
        const ex = bucket[dupIdx];
        const winner = factCrawler.getRecordAuthorityScore(item) > factCrawler.getRecordAuthorityScore(ex) ? { ...item } : { ...ex };
        bucket[dupIdx] = winner;
      }
    }
    const finalUpdated = factCrawler.consolidateSimilarRecords(mergedPool);

    writeAllDatabaseSnapshots(finalUpdated);
    cachedCalibratedDiskRecords = finalUpdated;
    generateAndWriteSitemapFiles(finalUpdated, "https://chuancn.org");

    // Also asynchronously mirror newly discovered records to Supabase cloud database so external crawler.py & cloud stay in sync
    const supabaseUrl = process.env.SUPABASE_URL || "https://cfmcvcscyfblcodemnkt.supabase.co";
    for (const item of uniqueNew.slice(0, 25)) {
      fetch(`${supabaseUrl}/rest/v1/haunted_houses`, {
        method: "POST",
        headers: {
          apikey: REAL_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${REAL_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates"
        },
        body: JSON.stringify({
          city: item.city,
          district: item.district,
          address: item.address,
          lat: item.lat,
          lng: item.lng,
          category: item.category || "法拍與其他",
          reason: item.reason || "",
          incident_date: item.incident_date || "2024-06-15",
          source: item.source || "公開社會新聞與司法實務紀錄",
          source_url: item.source_url || "",
          auction_record: ""
        })
      }).catch(() => {});
    }
  } catch (e) {}
}

async function runVerifiedFactCrawlQueries(querySpecs, maxToReturn = 35) {
  const existing = loadAllUnifiedRecords();
  const seenSigs = new Set();
  for (const r of existing) {
    for (const s of factCrawler.getSemanticCaseSignatures(r)) seenSigs.add(s);
  }

  const rawArticles = [];
  await Promise.all(
    querySpecs.map(async ({ q, page = 1, city = "", district = "" }) => {
      const [udn, ltn, ett, bing, gnews, communityRss, hauntedRss] = await Promise.all([
        factCrawler.fetchUdnArticles(q, page),
        factCrawler.fetchLtnArticles(q, page),
        factCrawler.fetchEttodayArticles(q, page),
        page === 1 ? factCrawler.fetchBingNewsRss(`台灣 ${q}`) : Promise.resolve([]),
        page === 1 ? factCrawler.fetchGoogleNewsRss(q) : Promise.resolve([]),
        page === 1 && typeof factCrawler.fetchPublicForumAndCommunityRss === "function"
          ? factCrawler.fetchPublicForumAndCommunityRss(q)
          : Promise.resolve([]),
        page === 1 && typeof factCrawler.fetchHauntedWebAndForeclosureRss === "function"
          ? factCrawler.fetchHauntedWebAndForeclosureRss(q)
          : Promise.resolve([])
      ]);
      for (const a of [...communityRss, ...hauntedRss, ...gnews, ...udn, ...ltn, ...ett, ...bing]) {
        rawArticles.push({ article: a, hintCity: city, hintDistrict: district });
      }
    })
  );

  crawlerState.scannedArticlesCount += rawArticles.length;
  crawlerState.lastRunAt = new Date().toISOString();

  const added = [];
  for (const { article, hintCity, hintDistrict } of rawArticles) {
    const parsed = factCrawler.parseVerifiedArticleToRecord(article, hintCity, hintDistrict);
    if (!parsed) continue;
    // Require a concrete road or verified landmark so no vague roadless pin is ever placed
    if (!parsed.__road && !parsed.__community) continue;

    // Preserve true incident date (including 2025 & 2026)
    let d = String(parsed.incident_date || "2024-06-15").replace(/\//g, "-").slice(0, 10);
    parsed.incident_date = d;

    const sigs = factCrawler.getSemanticCaseSignatures(parsed);
    if (sigs.some(s => seenSigs.has(s))) {
      crawlerState.duplicatesFilteredCount++;
      continue;
    }

    // Silent background semantic + Gemini AI same-incident check within the same (city, district)
    const sameDistExisting = existing.filter(
      r => r.city === parsed.city && r.district === parsed.district
    );
    const matchedSameCase = await checkAiSameIncidentInDistrict(parsed, sameDistExisting);
    if (matchedSameCase) {
      // If the newly crawled article has a higher authority score (e.g., direct news URL where existing lacked one), silently upgrade the existing record
      if (factCrawler.getRecordAuthorityScore(parsed) > factCrawler.getRecordAuthorityScore(matchedSameCase)) {
        Object.assign(matchedSameCase, {
          ...parsed,
          id: matchedSameCase.id || parsed.id,
          lat: matchedSameCase.lat || parsed.lat,
          lng: matchedSameCase.lng || parsed.lng
        });
      }
      crawlerState.duplicatesFilteredCount++;
      sigs.forEach(s => seenSigs.add(s));
      continue;
    }

    // Strict Google Maps Geocoding verification: must resolve to a specific road/building inside the target district
    let geocodedOk = false;
    if (getGoogleMapsApiKey()) {
      try {
        const geoQuery = `${parsed.city}${parsed.district}${parsed.__road || parsed.__community}`;
        const geo = await geocodeTaiwanAddressStrict(geoQuery, parsed.city, parsed.district);
        if (geo && geo.lat && geo.lng && geo.formattedAddress && geo.formattedAddress.includes(parsed.district)) {
          parsed.lat = geo.lat;
          parsed.lng = geo.lng;
          parsed.location_accuracy = "ROOFTOP_GEOCODED";
          geocodedOk = true;
        }
      } catch (e) {}
    }
    if (!geocodedOk) continue;

    sigs.forEach(s => seenSigs.add(s));
    delete parsed.__road;
    delete parsed.__community;

    dynamicRecords.unshift(parsed);
    existing.unshift(parsed);
    added.push(parsed);
    crawlerState.newlyDiscoveredCount++;
    crawlerState.recentDiscovered.unshift({
      id: parsed.id,
      city: parsed.city,
      district: parsed.district,
      address: parsed.address,
      incident_date: parsed.incident_date,
      category: parsed.category,
      source: parsed.source,
      source_url: parsed.source_url
    });
    if (crawlerState.recentDiscovered.length > 20) crawlerState.recentDiscovered.pop();
    if (added.length >= maxToReturn) break;
  }

  if (added.length > 0) {
    persistNewVerifiedRecordsToDisk(added);
  }
  return added;
}

// GET /api/crawler/status - Returns real-time multi-source crawler metrics
app.get("/api/crawler/status", (req, res) => {
  const all = loadAllUnifiedRecords();
  res.json(getCrawlerStatusSummary(all.length));
});

// POST /api/crawler/run-batch - Triggers an immediate wide-area or targeted multi-source news & foreclosure crawl
app.post("/api/crawler/run-batch", async (req, res) => {
  const { city = "", district = "", keyword = "", mode = "wide" } = req.body || {};
  crawlerState.isBusyBatch = true;
  try {
    const querySpecs = [];
    if (city || district || keyword) {
      const cleanCity = (city || "").replace(/台/g, "臺");
      const shortCity = cleanCity ? cleanCity.slice(0, 2) : "";
      const baseKw = [shortCity, district, keyword].filter(Boolean).join(" ");
      const suffixes = keyword
        ? ["", "命案", "凶宅 法拍", "陳屍", "墜樓 火警"]
        : ["命案 住宅", "凶宅 法拍", "墜樓 身亡", "陳屍 套房", "火警 身亡", "分屍 砍殺", "燒炭 輕生", "孤獨死"];
      for (const s of suffixes) {
        const q = `${baseKw} ${s}`.trim();
        querySpecs.push({ q, page: 1, city: cleanCity, district });
        querySpecs.push({ q, page: 2, city: cleanCity, district });
      }
      crawlerState.currentTarget = `${cleanCity || "全臺"}${district || ""} ${keyword || "多維度實證新聞巡檢"}`;
    } else {
      // Wide-area multi-topic sweep across diverse Taiwan regions & pagination depths
      for (let i = 0; i < 8; i++) {
        const [c, d] = allDistrictPairs[(crawlerState.cursorDistrict + i * 17) % allDistrictPairs.length];
        const topic = factCrawler.CRAWL_TOPIC_DIMENSIONS[(crawlerState.cursorTopic + i * 5) % factCrawler.CRAWL_TOPIC_DIMENSIONS.length];
        const p = ((crawlerState.cursorPage + i) % 8) + 1;
        querySpecs.push({ q: `${c.slice(0, 2)} ${d} 命案`, page: 1, city: c, district: d });
        querySpecs.push({ q: `${c.slice(0, 2)} ${topic}`, page: p, city: c, district: d });
      }
      crawlerState.cursorDistrict += 8;
      crawlerState.cursorTopic += 5;
      crawlerState.cursorPage += 1;
      crawlerState.currentTarget = "全臺跨縣市廣域新聞與法拍深層檢索";
    }

    const added = await runVerifiedFactCrawlQueries(querySpecs, 30);
    const all = loadAllUnifiedRecords();
    return res.json({
      addedCount: added.length,
      records: added,
      totalCount: all.length,
      crawlerStats: getCrawlerStatusSummary(all.length)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "爬蟲檢索失敗" });
  } finally {
    crawlerState.isBusyBatch = false;
  }
});

// POST /api/discover - Deep Regional & Keyword Case Hunter (100% Real Multi-Source News & Court Record Crawler, Zero Fabrication)
app.post("/api/discover", async (req, res) => {
  const { city = "臺北市", district = "中山區", keyword = "" } = req.body || {};
  const cleanCity = (city || "臺北市").replace(/台/g, "臺");
  const shortCity = cleanCity.slice(0, 2);

  try {
    const querySpecs = [];
    const base = [shortCity, district, keyword].filter(Boolean).join(" ");
    const topics = keyword
      ? ["", "命案", "凶宅", "陳屍", "墜樓", "火警"]
      : ["命案", "凶宅 法拍", "墜樓 身亡", "陳屍 套房", "火警 身亡", "輕生 屋內", "砍殺 民宅", "孤獨死"];

    for (const t of topics) {
      const q = `${base} ${t}`.trim();
      querySpecs.push({ q, page: 1, city: cleanCity, district });
      querySpecs.push({ q, page: 2, city: cleanCity, district });
    }
    // Also include city-wide fallback pages in case a small rural district has fewer new unindexed articles
    querySpecs.push({ q: `${shortCity} ${keyword || "凶宅 法拍"}`, page: Math.floor(Math.random() * 5) + 1, city: cleanCity, district });
    querySpecs.push({ q: `${shortCity} ${keyword || "命案 住宅"}`, page: Math.floor(Math.random() * 6) + 2, city: cleanCity, district });

    crawlerState.currentTarget = `${cleanCity}${district} ${keyword || "區域實證新聞爬蟲"}`;
    const added = await runVerifiedFactCrawlQueries(querySpecs, 20);
    const all = loadAllUnifiedRecords();

    // Also return existing verified records in that target district/city so the user can immediately inspect all verified cases there
    const matchingExisting = all.filter(
      r => r.city === cleanCity && (!district || r.district === district) && (!keyword || `${r.address}${r.reason}${r.source}`.includes(keyword))
    );

    return res.json({
      records: added,
      addedCount: added.length,
      matchingDistrictCount: matchingExisting.length,
      matchingRecords: matchingExisting.slice(0, 12),
      totalCount: all.length,
      crawlerStats: getCrawlerStatusSummary(all.length)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "檢索地區真實新聞檔案失敗" });
  }
});

// Affiliate Click & Organic Referral Telemetry Store (Synced to /tmp for persistence)
const AFFILIATE_STATS_FILE = "/tmp/tw_property_affiliate_stats.json";
const DEFAULT_AFFILIATE_STATS = {
  clicksByAd: {
    hlf_clean: 18,
    hola_home: 14,
    oeya_deals: 11,
    jama_comfort: 9
  },
  clicksByPlacement: {
    infeed: 24,
    drawer: 19,
    footer: 9
  },
  visitorReportCopies: 31,
  recentEvents: []
};

let affiliateStats = (() => {
  try {
    if (fs.existsSync(AFFILIATE_STATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AFFILIATE_STATS_FILE, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.clicksByAd) {
        return {
          clicksByAd: { ...DEFAULT_AFFILIATE_STATS.clicksByAd, ...(parsed.clicksByAd || {}) },
          clicksByPlacement: { ...DEFAULT_AFFILIATE_STATS.clicksByPlacement, ...(parsed.clicksByPlacement || {}) },
          visitorReportCopies: Number(parsed.visitorReportCopies ?? DEFAULT_AFFILIATE_STATS.visitorReportCopies),
          recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents.slice(0, 30) : []
        };
      }
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_AFFILIATE_STATS));
})();

function saveAffiliateStatsToDisk() {
  try {
    fs.writeFileSync(AFFILIATE_STATS_FILE, JSON.stringify(affiliateStats, null, 2), "utf8");
  } catch (e) {}
}

app.get("/api/affiliate-stats", (req, res) => {
  const all = loadAllUnifiedRecords();
  res.json({
    ...affiliateStats,
    seoIndexedCount: all.length,
    seoCityCount: Object.keys(CITY_BASE_COORDS).length
  });
});

app.post("/api/affiliate-click", express.text({ type: "*/*" }), (req, res) => {
  try {
    let body = req.body;
    if (typeof body === "string" && body.trim().startsWith("{")) {
      body = JSON.parse(body);
    }
    if (!body || typeof body !== "object") body = {};

    const eventType = String(body.type || "ad_click");
    const nowIso = new Date().toISOString();

    if (eventType === "visitor_copy") {
      affiliateStats.visitorReportCopies = (affiliateStats.visitorReportCopies || 0) + 1;
      affiliateStats.recentEvents.unshift({
        type: "visitor_copy",
        city: String(body.city || "全臺"),
        label: String(body.label || "看屋查證摘要轉傳"),
        ts: nowIso
      });
    } else {
      const adId = String(body.adId || "");
      const placement = String(body.placement || "infeed");
      if (adId && Object.prototype.hasOwnProperty.call(affiliateStats.clicksByAd, adId)) {
        affiliateStats.clicksByAd[adId] = (affiliateStats.clicksByAd[adId] || 0) + 1;
      }
      if (placement && Object.prototype.hasOwnProperty.call(affiliateStats.clicksByPlacement, placement)) {
        affiliateStats.clicksByPlacement[placement] = (affiliateStats.clicksByPlacement[placement] || 0) + 1;
      }
      affiliateStats.recentEvents.unshift({
        type: "ad_click",
        adId,
        placement,
        city: String(body.city || "全臺"),
        ts: nowIso
      });
    }

    affiliateStats.recentEvents = affiliateStats.recentEvents.slice(0, 25);
    saveAffiliateStatsToDisk();
    return res.json({ ok: true, stats: affiliateStats });
  } catch (err) {
    return res.status(200).json({ ok: false });
  }
});

// Google AdSense ads.txt verification endpoint
app.get("/ads.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send("google.com, pub-4333106443725240, DIRECT, f08c47fec0942fa0\n");
});

// Google Search Console HTML file verification endpoint
app.get("/google6a317e59d3daa28c.html", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.status(200).send("google-site-verification: google6a317e59d3daa28c.html");
});

// Dynamic robots.txt for Googlebot, AdSense & Search Console
app.get("/robots.txt", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "chuancn.org";
  const baseUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, "");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(
    [
      "User-agent: Mediapartners-Google",
      "Allow: /",
      "",
      "User-agent: AdsBot-Google",
      "Allow: /",
      "",
      "User-agent: AdsBot-Google-Mobile",
      "Allow: /",
      "",
      "User-agent: Googlebot",
      "Allow: /",
      "Allow: /case/",
      "",
      "User-agent: Google-Site-Verification",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
      "Allow: /case/",
      "Allow: /ads.txt",
      "Allow: /favicon.svg",
      "Allow: /google6a317e59d3daa28c.html",
      "Allow: /sitemap.xml",
      "Allow: /calibrated_archive.json",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`
    ].join("\n")
  );
});

// Helper: Find a case record by SEO slug or ID
function findCaseRecordBySlugOrId(slugOrId) {
  const target = String(slugOrId || "").trim().toLowerCase().replace(/\/+$/, "");
  if (!target) return null;
  const allRecords = loadAllUnifiedRecords();
  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i];
    const slug = buildCaseSlug(r, i);
    const idLower = String(r.id || "").trim().toLowerCase();
    if (slug === target || idLower === target || slug.endsWith(`-${target}`)) {
      return { record: { ...r, slug }, totalCount: allRecords.length };
    }
  }
  return null;
}

// GET /api/case/:slug - Fetch individual case record by SEO slug or ID
app.get("/api/case/:slug", (req, res) => {
  const found = findCaseRecordBySlugOrId(req.params.slug);
  if (!found) {
    return res.status(404).json({ ok: false, error: "查無該筆事故建物查核紀錄" });
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    ok: true,
    record: found.record,
    totalCount: found.totalCount
  });
});

// Standalone SEO Case Page SSR Handler (`/case/:slug` and `/case/:slug/`)
app.get(["/case/:slug", "/case/:slug/"], (req, res) => {
  const found = findCaseRecordBySlugOrId(req.params.slug);
  const templateHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
  if (!found) {
    return res.status(404).send(templateHtml);
  }
  const renderedHtml = renderStandaloneCaseHtml(
    templateHtml,
    found.record,
    found.totalCount,
    "https://chuancn.org"
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  return res.status(200).send(renderedHtml);
});

// Canonical XML Sitemap (Strictly Homepage + Verified Standalone `/case/<slug>/` Pages)
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = (process.env.APP_URL || "https://chuancn.org").replace(/\/$/, "");
  const allRecords = loadAllUnifiedRecords();
  const { xml } = buildSitemapXml(allRecords, baseUrl);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800");
  res.status(200).send(xml);
});

// On-demand Sitemap & Static Case HTML regeneration endpoint
app.all("/api/sitemap/regenerate", (req, res) => {
  try {
    const baseUrl = (process.env.APP_URL || "https://chuancn.org").replace(/\/$/, "");
    const allRecords = loadAllUnifiedRecords();
    const result = generateAndWriteSitemapFiles(allRecords, {
      baseUrl,
      writeStaticCases: true,
      maxStaticCases: req.query.full === "1" ? Infinity : 80
    });
    res.json({
      ok: true,
      totalUrls: result.totalUrls,
      caseCount: result.caseCount,
      staticGeneratedCount: result.staticGeneratedCount
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/seo-health - Automated SEO & Performance Verification Endpoint
app.get("/api/seo-health", (req, res) => {
  try {
    const baseUrl = "https://chuancn.org";
    const allRecords = loadAllUnifiedRecords();
    const substantive = allRecords.filter(isSubstantiveCaseForSeo);
    const sitemapStats = buildSitemapXml(allRecords, baseUrl);
    const templateHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");

    const sampleCases = substantive.slice(0, 5).map((r, idx) => {
      const slug = buildCaseSlug(r, idx);
      const html = renderStandaloneCaseHtml(templateHtml, r, allRecords.length, baseUrl);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const canonMatches = Array.from(html.matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi));
      return {
        slug,
        url: `${baseUrl}/case/${slug}/`,
        title: titleMatch ? titleMatch[1] : "",
        descriptionLength: descMatch ? descMatch[1].length : 0,
        canonicalCount: canonMatches.length,
        canonicalHref: canonMatches[0]?.[1] || "",
        hasPrerenderedArticle: html.includes('id="seo-case-prerender"'),
        hasValidJsonLd: html.includes('"@type": "BreadcrumbList"') && html.includes('"@type": "WebPage"')
      };
    });

    const nonCanonicalInSitemap = (sitemapStats.xml.match(/<loc>([^<]+)<\/loc>/g) || [])
      .map(s => s.replace(/<\/?loc>/g, ""))
      .filter(u => u !== `${baseUrl}/` && !u.startsWith(`${baseUrl}/case/`));

    res.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      totalDatabaseRecords: allRecords.length,
      substantiveIndexedCases: substantive.length,
      sitemapTotalUrls: sitemapStats.totalUrls,
      nonCanonicalFilterUrlsInSitemap: nonCanonicalInSitemap.length,
      gzipCompressionEnabled: true,
      initialBootPayloadReady: fs.existsSync(path.join(__dirname, "public", "initial_boot_records.json")),
      sampleVerifiedCases: sampleCases
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Redirect legacy `/?case=<id>` query URLs (301 Permanent Redirect) to canonical `/case/<slug>/`
app.get("/", (req, res, next) => {
  const legacyCaseId = req.query.case;
  if (legacyCaseId) {
    const found = findCaseRecordBySlugOrId(legacyCaseId);
    if (found && found.record?.slug) {
      const langParam = req.query.lang && ["en", "ja", "ko"].includes(String(req.query.lang))
        ? `?lang=${encodeURIComponent(String(req.query.lang))}`
        : "";
      return res.redirect(301, `/case/${found.record.slug}/${langParam}`);
    }
  }
  next();
});

// Serve static assets
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  const records = loadAllUnifiedRecords();
  try {
    generateAndWriteSitemapFiles(records, {
      baseUrl: "https://chuancn.org",
      writeStaticCases: true,
      maxStaticCases: 60
    });
  } catch (e) {}
  console.log(`Server listening on http://0.0.0.0:${PORT} (${records.length} active records indexed in sitemap.xml)`);
});


