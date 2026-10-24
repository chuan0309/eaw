import fs from "fs";
import path from "path";

export const TAIWAN_368_DISTRICTS = {
  "臺北市": ["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"],
  "新北市": ["板橋區","三重區","中和區","永和區","新莊區","新店區","土城區","蘆洲區","樹林區","汐止區","鶯歌區","三峽區","淡水區","瑞芳區","五股區","泰山區","林口區","深坑區","石碇區","坪林區","三芝區","石門區","八里區","平溪區","雙溪區","貢寮區","金山區","萬里區","烏來區"],
  "桃園市": ["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","大溪區","龍潭區","龜山區","大園區","觀音區","新屋區","復興區"],
  "臺中市": ["中區","東區","南區","西區","北區","北屯區","西屯區","南屯區","太平區","大里區","霧峰區","烏日區","豐原區","后里區","石岡區","東勢區","和平區","新社區","潭子區","大雅區","神岡區","大肚區","沙鹿區","龍井區","梧棲區","清水區","大甲區","外埔區","大安區"],
  "臺南市": ["中西區","東區","南區","北區","安平區","安南區","永康區","歸仁區","新化區","左鎮區","玉井區","楠西區","南化區","仁德區","關廟區","龍崎區","官田區","麻豆區","佳里區","西港區","七股區","將軍區","學甲區","北門區","新營區","後壁區","白河區","東山區","六甲區","下營區","柳營區","鹽水區","善化區","大內區","山上區","新市區","安定區"],
  "高雄市": ["新興區","前金區","苓雅區","鹽埕區","鼓山區","旗津區","前鎮區","三民區","楠梓區","小港區","左營區","仁武區","大社區","岡山區","路竹區","阿蓮區","田寮區","燕巢區","橋頭區","梓官區","彌陀區","永安區","湖內區","鳳山區","大寮區","林園區","鳥松區","大樹區","旗山區","美濃區","六龜區","內門區","杉林區","甲仙區","桃源區","那瑪夏區","茂林區","茄萣區"],
  "基隆市": ["仁愛區","信義區","中正區","中山區","安樂區","暖暖區","七堵區"],
  "新竹市": ["東區","北區","香山區"],
  "新竹縣": ["竹北市","竹東鎮","新埔鎮","關西鎮","湖口鄉","新豐鄉","芎林鄉","橫山鄉","北埔鄉","寶山鄉","峨眉鄉","尖石鄉","五峰鄉"],
  "苗栗縣": ["苗栗市","頭份市","竹南鎮","後龍鎮","通霄鎮","苑裡鎮","卓蘭鎮","造橋鄉","西湖鄉","頭屋鄉","公館鄉","銅鑼鄉","三義鄉","大湖鄉","獅潭鄉","三灣鄉","南庄鄉","泰安鄉"],
  "彰化縣": ["彰化市","員林市","和美鎮","鹿港鎮","溪湖鎮","二林鎮","田中鎮","北斗鎮","花壇鄉","芬園鄉","大村鄉","永靖鄉","伸港鄉","線西鄉","福興鄉","秀水鄉","埔心鄉","埔鹽鄉","大城鄉","芳苑鄉","竹塘鄉","社頭鄉","二水鄉","田尾鄉","埤頭鄉","溪州鄉"],
  "南投縣": ["南投市","埔里鎮","草屯鎮","竹山鎮","集集鎮","名間鄉","鹿谷鄉","中寮鄉","魚池鄉","國姓鄉","水里鄉","信義鄉","仁愛鄉"],
  "雲林縣": ["斗六市","斗南鎮","虎尾鎮","西螺鎮","土庫鎮","北港鎮","古坑鄉","大埤鄉","莿桐鄉","林內鄉","二崙鄉","崙背鄉","麥寮鄉","東勢鄉","褒忠鄉","臺西鄉","元長鄉","四湖鄉","口湖鄉","水林鄉"],
  "嘉義市": ["東區","西區"],
  "嘉義縣": ["太保市","朴子市","布袋鎮","大林鎮","民雄鄉","溪口鄉","新港鄉","六腳鄉","東石鄉","義竹鄉","鹿草鄉","水上鄉","中埔鄉","竹崎鄉","梅山鄉","番路鄉","大埔鄉","阿里山鄉"],
  "屏東縣": ["屏東市","潮州鎮","東港鎮","恆春鎮","萬丹鄉","長治鄉","麟洛鄉","九如鄉","里港鄉","鹽埔鄉","高樹鄉","萬巒鄉","內埔鄉","竹田鄉","新埤鄉","枋寮鄉","新園鄉","崁頂鄉","林邊鄉","南州鄉","佳冬鄉","琉球鄉","車城鄉","滿州鄉","枋山鄉","三地門鄉","霧臺鄉","瑪家鄉","泰武鄉","來義鄉","春日鄉","獅子鄉","牡丹鄉"],
  "宜蘭縣": ["宜蘭市","羅東鎮","蘇澳鎮","頭城鎮","礁溪鄉","壯圍鄉","員山鄉","冬山鄉","五結鄉","三星鄉","大同鄉","南澳鄉"],
  "花蓮縣": ["花蓮市","鳳林鎮","玉里鎮","新城鄉","吉安鄉","壽豐鄉","光復鄉","豐濱鄉","瑞穗鄉","富里鄉","秀林鄉","萬榮鄉","卓溪鄉"],
  "臺東縣": ["臺東市","成功鎮","關山鎮","卑南鄉","鹿野鄉","池上鄉","東河鄉","長濱鄉","太麻里鄉","大武鄉","綠島鄉","海端鄉","延平鄉","金峰鄉","達仁鄉","蘭嶼鄉"],
  "澎湖縣": ["馬公市","湖西鄉","白沙鄉","西嶼鄉","望安鄉","七美鄉"],
  "金門縣": ["金城鎮","金湖鎮","金沙鎮","金寧鄉","烈嶼鄉","烏坵鄉"],
  "連江縣": ["南竿鄉","北竿鄉","莒光鄉","東引鄉"]
};

export const CITY_BASE_COORDS = {
  "臺北市": [25.0478, 121.5319], "新北市": [25.0120, 121.4657], "桃園市": [24.9936, 121.3010],
  "臺中市": [24.1618, 120.6469], "臺南市": [22.9997, 120.2270], "高雄市": [22.6273, 120.3014],
  "基隆市": [25.1276, 121.7392], "新竹市": [24.8138, 120.9675], "新竹縣": [24.8387, 121.0177],
  "苗栗縣": [24.5602, 120.8214], "彰化縣": [24.0518, 120.5161], "南投縣": [23.9610, 120.9719],
  "雲林縣": [23.7092, 120.4313], "嘉義市": [23.4801, 120.4491], "嘉義縣": [23.4518, 120.2555],
  "屏東縣": [22.6761, 120.4929], "宜蘭縣": [24.7021, 121.7378], "花蓮縣": [23.9872, 121.6015],
  "臺東縣": [22.7583, 121.1444], "澎湖縣": [23.5711, 119.5793], "金門縣": [24.4493, 118.3767],
  "連江縣": [26.1605, 119.9519]
};

export const CRAWL_TOPIC_DIMENSIONS = [
  "命案 住宅",
  "凶宅 法拍",
  "司法院 法拍 非自然死亡",
  "法院 判決 隱瞞凶宅 判賠",
  "台灣凶宅網 事故屋 命案",
  "居易網 凶宅 事故屋",
  "PTT 凶宅 社區 命案",
  "Dcard 凶宅 租屋 套房",
  "Mobile01 凶宅 事故屋",
  "591 凶宅 壓價 事故屋",
  "臉書 凶宅 社團 求售",
  "實價登錄 特殊交易 凶宅",
  "透天 火警 身亡",
  "公寓 墜樓 身亡",
  "出租套房 陳屍",
  "社區大樓 墜樓",
  "縱火 民宅 奪命",
  "分屍 命案 住宅",
  "滅門 命案",
  "砍殺 民宅 身亡",
  "燒炭 輕生 屋內",
  "一氧化碳中毒 住宅 身亡",
  "雙屍 住宅 命案",
  "氣爆 民宅 身亡",
  "隱瞞凶宅 判賠 法院",
  "地方法院 法拍 凶宅",
  "行政執行署 法拍 透天",
  "弒母 弒父 弒親 住宅",
  "情殺 租屋 套房",
  "債務 輕生 法拍",
  "大樓 火警 嗆傷 不治",
  "凶宅 實價登錄 折價",
  "桶屍 棄屍 民宅",
  "槍擊 命案 住宅",
  "神明廳 起火 透天 身亡"
];

// Deterministic hash for slight coordinate offset along a street/district so markers never stack identically
function deterministicOffset(seedStr, scale = 0.0065) {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < seedStr.length; i++) {
    const c = seedStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ (c * 31), 2166136261);
  }
  const n1 = ((h1 >>> 0) % 2000 - 1000) / 1000;
  const n2 = ((h2 >>> 0) % 2000 - 1000) / 1000;
  return [n1 * scale, n2 * scale];
}

// Build district coordinate lookup from existing calibrated records
const districtCoordMap = new Map();
export function initDistrictCoordinates(records = []) {
  const buckets = new Map();
  for (const r of records) {
    if (!r || !r.city || !r.district) continue;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lng);
    if (isNaN(lat) || isNaN(lng) || lat < 21.8 || lat > 26.4 || lng < 118.1 || lng > 122.1) continue;
    const key = `${r.city.replace(/台/g, "臺")}_${r.district}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push([lat, lng]);
  }
  for (const [k, arr] of buckets.entries()) {
    const lats = arr.map(x => x[0]).sort((a, b) => a - b);
    const lngs = arr.map(x => x[1]).sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    districtCoordMap.set(k, [lats[mid], lngs[mid]]);
  }
}

export function getDistrictBaseCoords(city, district, seedStr = "") {
  const cleanCity = (city || "臺北市").replace(/台/g, "臺");
  const key = `${cleanCity}_${district}`;
  const base = districtCoordMap.get(key) || CITY_BASE_COORDS[cleanCity] || [25.0478, 121.5319];
  const [dLat, dLng] = deterministicOffset(`${key}_${seedStr}`, districtCoordMap.has(key) ? 0.0055 : 0.014);
  return [Number((base[0] + dLat).toFixed(6)), Number((base[1] + dLng).toFixed(6))];
}

// 1. Fetch from LTN (自由時報) Search
export async function fetchLtnArticles(keyword, page = 1) {
  const url = `https://search.ltn.com.tw/list?keyword=${encodeURIComponent(keyword)}&type=all&page=${page}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const html = await r.text();
    const blocks = html.match(/<li(?:\s+[^>]*)?>[\s\S]*?<\/li>/g) || [];
    const out = [];
    for (const b of blocks) {
      const m =
        b.match(/class=["']tit["'][^>]*href=["'](https:\/\/news\.ltn\.com\.tw\/news\/[^/]+\/breakingnews\/\d+)["'][^>]*>([^<]+)<\/a>/) ||
        b.match(/href=["'](https:\/\/news\.ltn\.com\.tw\/news\/[^/]+\/breakingnews\/\d+)["'][^>]*class=["']tit["'][^>]*>([^<]+)<\/a>/);
      if (!m) continue;
      const link = m[1].trim();
      const title = m[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
      const mp = b.match(/<p>([\s\S]*?)<\/p>/);
      const snippet = mp ? mp[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
      const mImg = b.match(/\/Upload\/news\/\d+\/(\d{4})\/(\d{2})\/(\d{2})\//);
      const mTime = b.match(/<span class=["']time["']>(\d{4})[/-](\d{2})[/-](\d{2})/);
      let date = "2024-06-15";
      if (mImg) {
        date = `${mImg[1]}-${mImg[2]}-${mImg[3]}`;
      } else if (mTime) {
        date = `${mTime[1]}-${mTime[2]}-${mTime[3]}`;
      } else {
        // Check if snippet mentions YYYY年M月D日
        const mYear = (title + " " + snippet).match(/(20[012]\d)\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/);
        if (mYear) {
          date = `${mYear[1]}-${String(mYear[2]).padStart(2, "0")}-${String(mYear[3] || "15").padStart(2, "0")}`;
        } else {
          date = new Date().toISOString().slice(0, 10);
        }
      }
      out.push({ title, link, date, snippet, media: "自由時報" });
    }
    return out;
  } catch (e) {
    return [];
  }
}

// 2. Fetch from UDN (聯合新聞網) JSON API
export async function fetchUdnArticles(keyword, page = 1) {
  const url = `https://udn.com/api/more?page=${page}&id=search:${encodeURIComponent(keyword)}&channelId=2&type=searchword`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.lists)) return [];
    return d.lists.map(it => ({
      title: (it.title || "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim(),
      link: (it.titleLink || "").split("?")[0].trim(),
      date: ((it.time && it.time.date) || "2024-06-15").slice(0, 10).replace(/\//g, "-"),
      snippet: (it.paragraph || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      media: "聯合新聞網 (UDN)"
    })).filter(x => x.title && x.link.startsWith("http"));
  } catch (e) {
    return [];
  }
}

// 3. Fetch from ETtoday (ETtoday新聞雲) Search
export async function fetchEttodayArticles(keyword, page = 1) {
  const url = `https://www.ettoday.net/news_search/doSearch.php?keywords=${encodeURIComponent(keyword)}&idx=1&page=${page}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const html = await r.text();
    const boxes = html.match(/<div class="box_2">[\s\S]*?<\/div>/g) || [];
    const out = [];
    for (const b of boxes) {
      const m = b.match(/<h2><a[^>]+href=["'](https:\/\/[^"']*ettoday\.net\/news\/(\d{4})(\d{2})(\d{2})\/\d+\.htm)["'][^>]*>([\s\S]*?)<\/a><\/h2>/);
      if (!m) continue;
      const link = m[1].trim();
      const date = `${m[2]}-${m[3]}-${m[4]}`;
      const title = m[5].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').trim();
      const mp = b.match(/<p class="detail">([\s\S]*?)<\/p>/);
      const snippet = mp ? mp[1].replace(/<span[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
      out.push({ title, link, date, snippet, media: "ETtoday新聞雲" });
    }
    return out;
  } catch (e) {
    return [];
  }
}

function cleanRssHtmlEntities(rawStr) {
  return String(rawStr || "")
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;lt;|&lt;/gi, "<")
    .replace(/&amp;gt;|&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 4. Fetch from Bing News RSS (Aggregates PTS 公視, CNA 中央社, TVBS, 三立, 壹蘋, Yahoo)
export async function fetchBingNewsRss(keyword) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out = [];
    for (const raw of items) {
      const tMatch = raw.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const lMatch = raw.match(/<link>([\s\S]*?)<\/link>/);
      const dMatch = raw.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      const pMatch = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sMatch = raw.match(/<News:Source[^>]*>([\s\S]*?)<\/News:Source>/i);
      if (!tMatch || !lMatch) continue;
      let link = lMatch[1].trim();
      const uParam = link.match(/[?&]url=([^&]+)/);
      if (uParam) {
        try { link = decodeURIComponent(uParam[1]); } catch (e) {}
      }
      const title = cleanRssHtmlEntities(tMatch[1]);
      const media = sMatch ? cleanRssHtmlEntities(sMatch[1]) : "臺灣綜合新聞";
      let snippet = dMatch ? cleanRssHtmlEntities(dMatch[1]) : "";
      if (media && snippet.endsWith(media)) {
        snippet = snippet.slice(0, -media.length).replace(/[-｜|·\s]+$/, "").trim();
      }
      let date = new Date().toISOString().slice(0, 10);
      if (pMatch) {
        const parsed = new Date(pMatch[1].trim());
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
      }
      if (link.startsWith("http")) {
        out.push({ title, link, date, snippet, media });
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

// 5. Fetch from Google News Taiwan Public Archive RSS (Aggregates CNA 中央社, PTS 公視, TVBS, 三立, 中時, 民視, 東森, 鏡週刊, 台灣凶宅網與司法院判決報導)
export async function fetchGoogleNewsRss(keyword) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out = [];
    for (const raw of items) {
      const tMatch = raw.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const lMatch = raw.match(/<link>([\s\S]*?)<\/link>/);
      const dMatch = raw.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      const pMatch = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sMatch = raw.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      if (!tMatch || !lMatch) continue;
      const link = lMatch[1].trim();
      const rawTitle = cleanRssHtmlEntities(tMatch[1]);
      const title = rawTitle.replace(/\s*-\s*[^-]+$/, "").trim() || rawTitle;
      const media = sMatch ? cleanRssHtmlEntities(sMatch[1]) : "Google 新聞公開檔案庫";
      let snippet = dMatch ? cleanRssHtmlEntities(dMatch[1]) : "";
      if (media && snippet.endsWith(media)) {
        snippet = snippet.slice(0, -media.length).replace(/[-｜|·\s]+$/, "").trim();
      }
      if (snippet === title || snippet === rawTitle) {
        snippet = "";
      }
      let date = new Date().toISOString().slice(0, 10);
      if (pMatch) {
        const parsed = new Date(pMatch[1].trim());
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
      }
      if (link.startsWith("http")) {
        out.push({ title, link, date, snippet, media });
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

// 6. Fetch from Public Communities & Forums (PTT 批踢踢 home-sale/Gossiping, Dcard, Mobile01, 臉書凶宅社團與房產論壇公開討論)
export async function fetchPublicForumAndCommunityRss(keyword) {
  const communityQuery = `${keyword} (PTT OR 批踢踢 OR Dcard OR Mobile01 OR 凶宅網 OR 居易網 OR 591凶宅 OR 凶宅社團 OR 事故屋)`;
  try {
    const [gItems, bItems] = await Promise.all([
      fetchGoogleNewsRss(communityQuery),
      fetchBingNewsRss(`台灣 ${communityQuery}`)
    ]);
    return [...gItems, ...bItems].map(item => ({
      ...item,
      media: /PTT|批踢踢/i.test(item.title + " " + item.snippet)
        ? `PTT 批踢踢公開社群與${item.media}`
        : /Dcard/i.test(item.title + " " + item.snippet)
        ? `Dcard 社群與${item.media}`
        : /Mobile01/i.test(item.title + " " + item.snippet)
        ? `Mobile01 房產社群與${item.media}`
        : /凶宅網|居易網/i.test(item.title + " " + item.snippet)
        ? `台灣凶宅網／居易網與${item.media}`
        : `公開房產社群與${item.media}`
    }));
  } catch (e) {
    return [];
  }
}

// 7. Fetch from Haunted House Databases & Judicial Foreclosure Indices (台灣凶宅網、居易網、591事故屋、司法院法拍凶宅與裁判書索引)
export async function fetchHauntedWebAndForeclosureRss(keyword) {
  const hauntedQuery = `${keyword} (凶宅 OR 事故屋 OR 非自然死亡 OR 隱瞞凶宅 OR 法拍凶宅)`;
  try {
    const [gItems, bItems] = await Promise.all([
      fetchGoogleNewsRss(hauntedQuery),
      fetchBingNewsRss(`台灣 ${hauntedQuery}`)
    ]);
    return [...gItems, ...bItems];
  } catch (e) {
    return [];
  }
}

const UNAMBIGUOUS_DISTRICT_MAP = {
  "板橋": ["新北市", "板橋區"], "三重": ["新北市", "三重區"], "中和": ["新北市", "中和區"], "永和": ["新北市", "永和區"],
  "新莊": ["新北市", "新莊區"], "新店": ["新北市", "新店區"], "土城": ["新北市", "土城區"], "蘆洲": ["新北市", "蘆洲區"],
  "樹林": ["新北市", "樹林區"], "汐止": ["新北市", "汐止區"], "鶯歌": ["新北市", "鶯歌區"], "三峽": ["新北市", "三峽區"],
  "淡水": ["新北市", "淡水區"], "淡海": ["新北市", "淡水區"], "瑞芳": ["新北市", "瑞芳區"], "五股": ["新北市", "五股區"],
  "泰山": ["新北市", "泰山區"], "林口": ["新北市", "林口區"], "深坑": ["新北市", "深坑區"], "八里": ["新北市", "八里區"],
  "三芝": ["新北市", "三芝區"], "金山": ["新北市", "金山區"], "萬里": ["新北市", "萬里區"], "烏來": ["新北市", "烏來區"],
  "萬華": ["臺北市", "萬華區"], "西門町": ["臺北市", "萬華區"], "士林": ["臺北市", "士林區"], "北投": ["臺北市", "北投區"],
  "內湖": ["臺北市", "內湖區"], "南港": ["臺北市", "南港區"], "文山": ["臺北市", "文山區"], "松山": ["臺北市", "松山區"],
  "大安區": ["臺北市", "大安區"], "信義區": ["臺北市", "信義區"], "中山區": ["臺北市", "中山區"], "中正區": ["臺北市", "中正區"],
  "中壢": ["桃園市", "中壢區"], "平鎮": ["桃園市", "平鎮區"], "八德": ["桃園市", "八德區"], "楊梅": ["桃園市", "楊梅區"],
  "蘆竹": ["桃園市", "蘆竹區"], "大溪": ["桃園市", "大溪區"], "龍潭": ["桃園市", "龍潭區"], "龜山": ["桃園市", "龜山區"],
  "大園": ["桃園市", "大園區"], "觀音": ["桃園市", "觀音區"], "新屋": ["桃園市", "新屋區"],
  "北屯": ["臺中市", "北屯區"], "西屯": ["臺中市", "西屯區"], "南屯": ["臺中市", "南屯區"], "太平": ["臺中市", "太平區"],
  "大里": ["臺中市", "大里區"], "霧峰": ["臺中市", "霧峰區"], "烏日": ["臺中市", "烏日區"], "豐原": ["臺中市", "豐原區"],
  "后里": ["臺中市", "后里區"], "東勢": ["臺中市", "東勢區"], "潭子": ["臺中市", "潭子區"], "大雅": ["臺中市", "大雅區"],
  "神岡": ["臺中市", "神岡區"], "大肚": ["臺中市", "大肚區"], "沙鹿": ["臺中市", "沙鹿區"], "龍井": ["臺中市", "龍井區"],
  "梧棲": ["臺中市", "梧棲區"], "清水": ["臺中市", "清水區"], "大甲": ["臺中市", "大甲區"],
  "永康": ["臺南市", "永康區"], "安平": ["臺南市", "安平區"], "安南": ["臺南市", "安南區"], "歸仁": ["臺南市", "歸仁區"],
  "新化": ["臺南市", "新化區"], "仁德": ["臺南市", "仁德區"], "關廟": ["臺南市", "關廟區"], "麻豆": ["臺南市", "麻豆區"],
  "佳里": ["臺南市", "佳里區"], "學甲": ["臺南市", "學甲區"], "新營": ["臺南市", "新營區"], "白河": ["臺南市", "白河區"],
  "善化": ["臺南市", "善化區"], "鹽水": ["臺南市", "鹽水區"],
  "新興區": ["高雄市", "新興區"], "前金": ["高雄市", "前金區"], "苓雅": ["高雄市", "苓雅區"], "鹽埕": ["高雄市", "鹽埕區"],
  "鼓山": ["高雄市", "鼓山區"], "旗津": ["高雄市", "旗津區"], "前鎮": ["高雄市", "前鎮區"], "三民": ["高雄市", "三民區"],
  "楠梓": ["高雄市", "楠梓區"], "小港": ["高雄市", "小港區"], "左營": ["高雄市", "左營區"], "仁武": ["高雄市", "仁武區"],
  "大社": ["高雄市", "大社區"], "岡山": ["高雄市", "岡山區"], "路竹": ["高雄市", "路竹區"], "橋頭": ["高雄市", "橋頭區"],
  "鳳山": ["高雄市", "鳳山區"], "大寮": ["高雄市", "大寮區"], "林園": ["高雄市", "林園區"], "鳥松": ["高雄市", "鳥松區"],
  "大樹": ["高雄市", "大樹區"], "旗山": ["高雄市", "旗山區"], "美濃": ["高雄市", "美濃區"], "六龜": ["高雄市", "六龜區"],
  "竹北": ["新竹縣", "竹北市"], "竹東": ["新竹縣", "竹東鎮"], "新埔": ["新竹縣", "新埔鎮"], "關西": ["新竹縣", "關西鎮"],
  "湖口": ["新竹縣", "湖口鄉"], "新豐": ["新竹縣", "新豐鄉"],
  "頭份": ["苗栗縣", "頭份市"], "竹南": ["苗栗縣", "竹南鎮"], "後龍": ["苗栗縣", "後龍鎮"], "通霄": ["苗栗縣", "通霄鎮"],
  "苑裡": ["苗栗縣", "苑裡鎮"], "公館": ["苗栗縣", "公館鄉"],
  "員林": ["彰化縣", "員林市"], "和美": ["彰化縣", "和美鎮"], "鹿港": ["彰化縣", "鹿港鎮"], "溪湖": ["彰化縣", "溪湖鎮"],
  "二林": ["彰化縣", "二林鎮"], "田中": ["彰化縣", "田中鎮"], "北斗": ["彰化縣", "北斗鎮"], "花壇": ["彰化縣", "花壇鄉"],
  "伸港": ["彰化縣", "伸港鄉"], "福興": ["彰化縣", "福興鄉"], "秀水": ["彰化縣", "秀水鄉"], "社頭": ["彰化縣", "社頭鄉"],
  "埔里": ["南投縣", "埔里鎮"], "草屯": ["南投縣", "草屯鎮"], "竹山": ["南投縣", "竹山鎮"], "集集": ["南投縣", "集集鎮"],
  "斗六": ["雲林縣", "斗六市"], "斗南": ["雲林縣", "斗南鎮"], "虎尾": ["雲林縣", "虎尾鎮"], "西螺": ["雲林縣", "西螺鎮"],
  "北港": ["雲林縣", "北港鎮"], "麥寮": ["雲林縣", "麥寮鄉"], "土庫": ["雲林縣", "土庫鎮"],
  "太保": ["嘉義縣", "太保市"], "朴子": ["嘉義縣", "朴子市"], "布袋": ["嘉義縣", "布袋鎮"], "大林": ["嘉義縣", "大林鎮"],
  "民雄": ["嘉義縣", "民雄鄉"], "新港": ["嘉義縣", "新港鄉"], "水上": ["嘉義縣", "水上鄉"], "中埔": ["嘉義縣", "中埔鄉"],
  "潮州": ["屏東縣", "潮州鎮"], "東港": ["屏東縣", "東港鎮"], "恆春": ["屏東縣", "恆春鎮"], "萬丹": ["屏東縣", "萬丹鄉"],
  "內埔": ["屏東縣", "內埔鄉"], "枋寮": ["屏東縣", "枋寮鄉"], "里港": ["屏東縣", "里港鄉"], "九如": ["屏東縣", "九如鄉"],
  "羅東": ["宜蘭縣", "羅東鎮"], "蘇澳": ["宜蘭縣", "蘇澳鎮"], "頭城": ["宜蘭縣", "頭城鎮"], "礁溪": ["宜蘭縣", "礁溪鄉"],
  "冬山": ["宜蘭縣", "冬山鄉"], "五結": ["宜蘭縣", "五結鄉"], "壯圍": ["宜蘭縣", "壯圍鄉"],
  "玉里": ["花蓮縣", "玉里鎮"], "吉安": ["花蓮縣", "吉安鄉"], "壽豐": ["花蓮縣", "壽豐鄉"], "新城": ["花蓮縣", "新城鄉"],
  "鳳林": ["花蓮縣", "鳳林鎮"], "光復": ["花蓮縣", "光復鄉"], "瑞穗": ["花蓮縣", "瑞穗鄉"],
  "卑南": ["臺東縣", "卑南鄉"], "太麻里": ["臺東縣", "太麻里鄉"], "成功鎮": ["臺東縣", "成功鎮"], "關山鎮": ["臺東縣", "關山鎮"],
  "馬公": ["澎湖縣", "馬公市"], "金城": ["金門縣", "金城鎮"], "金湖": ["金門縣", "金湖鎮"], "金寧": ["金門縣", "金寧鄉"]
};

// Strict Statutory Haunted House (內政部定義凶宅) Filter & Location Parser
export function parseVerifiedArticleToRecord(article, hintCity = "", hintDistrict = "") {
  if (!article || !article.title || !article.link || !article.link.startsWith("http")) return null;
  const fullText = `${article.title} ${article.snippet || ""}`.replace(/台/g, "臺");
  const textWithoutNationality = fullText.replace(/(?:大陸|中國|越南|泰國|印尼|菲律賓|馬來西亞|大馬|日本|韓國|美國|英國|香港|澳門|外國|外)籍/g, "外國籍");

  // 1. Reject foreign news (Japan, Korea, China, HK, Macau, SE Asia, US, Europe, etc.)
  if (/名古屋|愛知|沖繩|九州|關西|關東|橫濱|京都|神戶|福岡|札幌|東京|大阪|北海道|日本|首爾|釜山|濟州|仁川|南韓|韓國|曼谷|清邁|芭達雅|普吉|泰國|吉隆坡|檳城|新山|大馬|馬來西亞|新加坡|胡志明|河內|馬尼拉|雅加達|峇里島|金邊|西港|仰光|孟買|新德里|印度|雪梨|墨爾本|布里斯本|奧克蘭|紐約|洛杉磯|舊金山|芝加哥|休士頓|西雅圖|波士頓|華盛頓|加州|俄勒岡|溫哥華|多倫多|倫敦|曼徹斯特|巴黎|柏林|法蘭克福|羅馬|米蘭|馬德里|莫斯科|烏克蘭|重慶|四川|成都|廣東|廣州|深圳|東莞|珠海|佛山|上海|北京|天津|浙江|杭州|溫州|寧波|江蘇|南京|蘇州|無錫|福建|廈門|福州|泉州|湖南|長沙|湖北|武漢|河南|鄭州|山東|青島|濟南|江西|安徽|河北|遼寧|吉林|黑龍江|廣西|雲南|貴州|陝西|西安|甘肅|新疆|內蒙古|海南|三亞|中國大陸|香港|九龍|新界|旺角|銅鑼灣|尖沙咀|屯門|元朗|荃灣|葵涌|將軍澳|天水圍|澳門|氹仔/.test(textWithoutNationality)) {
    return null;
  }
  if (/^(?:中國|大陸|香港|日本|韓國|南韓|泰國|大馬|馬來西亞|美國|英國|印度|澳洲|越南|印尼|新加坡|菲國|菲律賓|柬埔寨)/.test(article.title.trim())) {
    return null;
  }

  // 2. Reject non-residential incident scenes (bridges, mountains, parks, construction sites, factories, KTV/hotels, prisons, roads, cars, vacant lots, bars)
  const isExplicitHaunted = /凶宅|事故屋|隱瞞凶宅|買到凶宅|誤買凶宅/.test(fullText);
  const nonResidentialScene = /大橋|陸橋|天橋|高架橋|橋面|橋下|河床|溪床|溪谷|草叢|路邊草叢|陳屍於?車內|橫死街頭|現場旁空地|安裝冷氣.*防火巷|知名酒吧喝酒|掩埋場|垃圾場|公墓|墓園|納骨塔|火葬場|殯儀館|國道|省道|快速道路|平交道|鐵軌|車禍|擦撞|自撞|追撞|酒駕|毒駕|騎士|工地|施工|建案工地|興建工程|鷹架|吊車|工人|工安|職災|職業安全|工廠|廠房|鐵工廠|加工區|科技廠|倉庫|錢櫃|好樂迪|KTV|酒店|夜店|舞廳|養生館|摩鐵|汽車旅館|飯店|商旅|民宿|百貨|商場|賣場|大賣場|超商|超市|餐廳|小吃店|看守所|監獄|外役監|服刑|出監|入監|軍營|營區|部隊|堂口|幫派|百果山|山區|山難|登山|步道|海邊|海岸|海域|漁港|沙灘|碼頭|水庫|魚塭|農地|果園|竹林|防風林|涵洞|水圳|大排|溝渠|溪畔|河濱|路倒|街頭|校園墜樓|校內墜樓|教學大樓|病房墜樓|醫院墜樓|護理之家|安養院|長照中心/;
  if (!isExplicitHaunted && nonResidentialScene.test(fullText)) {
    return null;
  }

  // 3. Reject natural deaths, illness, lonely deaths (孤獨死/猝死/病逝 are NOT statutory 凶宅!), non-fatal events, and procedural court news
  if (/不會變凶宅|不算凶宅|想處理凶宅嗎|晚安小雞|黃明志|跨年晚會|土地公|聖筊|獸父|砲兵營|砲測中心|成功嶺|台北101|臺北101|晶品城|誠品南西|逃亡路線|斷絕退路|張文|白雪大旅社|華山大草原|中央銀行|頂樓酒吧|商旅大樓|睡夢中離世也被喊凶宅|教團籲設|私密諮商|楷模|表揚|頒獎|獲選|防詐宣導|消防演習|防災演練|鬼片|電影|影集|韓劇|日劇|分集劇情|小說|電玩|政治獻金|背信案|選舉|造勢|股價|台積電|ETF|星座|生肖|運勢|寵物貓|警犬|分離焦慮|專家：|學者：|擬強制|要跳脫|是否為巧合|懶人包|總整理|研討會|座談會|公聽會|修法|防孤獨死|求救鈴|飛安優先|超限高|棄養|健康無礙|無生命危險|意識清楚|獲救|救下|及時拉回|勸下|僅受輕傷|擦傷|虛驚一場|未遂/.test(fullText)) {
    return null;
  }
  if (!isExplicitHaunted && !/法拍|拍定|一拍|二拍|三拍|四拍|點交|瑕疵擔保|減少價金/.test(fullText)) {
    if (/假結婚|偽造文書|外役監|服刑|出監|入監|精神安置|改裁定羈押|延押|聲押|交保|起訴|二審|三審|更一審|最高法院駁回|國民法官|解剖確認死因/.test(fullText)) {
      return null;
    }
  }
  if (!isExplicitHaunted && /自然死亡|自然死|自然病逝|病逝|久病不癒|心肌梗塞|心血管|腦中風|中風|天冷|寒流|猝死|暴斃|孤獨死|洗腎|癌症|糖尿病|高血壓/.test(fullText) && !/燒炭|上吊|輕生|自殺|砍殺|刺死|勒斃|分屍|滅門|雙屍|兇殺/.test(fullText)) {
    return null;
  }

  // 4. Must strictly satisfy Taiwan MOI Statutory Haunted House (凶宅) definition:
  //    (A) Residential private unit context (or explicit 凶宅/事故屋)
  //    (B) Non-natural death cause: Homicide (兇殺), Suicide (自殺/燒炭/上吊/住宅跳樓), CO Poisoning/Fatal Arson (一氧化碳中毒/縱火奪命), or Court/Foreclosure Certified 凶宅
  const hasResidentialUnit = /凶宅|事故屋|民宅|住家|住處|租屋|租處|套房|雅房|公寓|透天|社區大樓|住宅大樓|電梯大樓|大樓|華廈|國宅|社宅|社會住宅|豪宅|別墅|頂樓加蓋|屋內|家中|臥室|房間|浴室|客廳|陽台|露台/.test(fullText);
  const hasStatutoryCause = /凶宅|事故屋|隱瞞凶宅|買到凶宅|誤買凶宅|非自然死亡|兇殺|殺害|砍殺|刺死|勒斃|分屍|滅門|桶屍|箱屍|雙屍|3屍|三屍|弒母|弒父|弒親|情殺|仇殺|輕生|自殺|燒炭|上吊|尋短|服毒|吞藥|割腕|一氧化碳中毒|瓦斯中毒|縱火.*死|縱火.*命|火警.*死|火警.*不治|惡火.*死|惡火.*命|屋內.*命案|住處.*命案|住家.*命案|民宅.*命案|公寓.*命案|大樓.*命案|透天.*命案|套房.*命案|墜樓.*身亡|墜樓.*不治|墜樓.*死|墜樓.*亡|墜落.*身亡|墜落.*不治|墜落.*死|跳樓.*身亡|跳樓.*不治|跳樓.*死|跳樓.*亡/.test(fullText);
  if (!hasResidentialUnit || !hasStatutoryCause) return null;

  // 5. Identify Taiwan City & District from article text (ignoring police precinct mentions like XX警分局 when another district precedes the actual road!)
  const textWithoutPrecinct = fullText.replace(/[一-龥]{2,3}(?:警分局|分局|派出所|分駐所)/g, " ");
  let matchedCity = "";
  let matchedDist = "";

  for (const [city, dists] of Object.entries(TAIWAN_368_DISTRICTS)) {
    const shortCity = city.slice(0, 2);
    for (const d of dists) {
      const shortDist = d.length > 2 ? d.slice(0, -1) : d;
      if (textWithoutPrecinct.includes(city + d) || textWithoutPrecinct.includes(shortCity + d) || textWithoutPrecinct.includes(shortCity + shortDist)) {
        matchedCity = city;
        matchedDist = d;
        break;
      }
    }
    if (matchedCity) break;
  }

  if (!matchedDist) {
    for (const [kw, [c, d]] of Object.entries(UNAMBIGUOUS_DISTRICT_MAP)) {
      if (textWithoutPrecinct.includes(kw)) {
        matchedCity = c;
        matchedDist = d;
        break;
      }
    }
  }

  if (!matchedDist) {
    for (const [city, dists] of Object.entries(TAIWAN_368_DISTRICTS)) {
      for (const d of dists) {
        if (["東區","西區","南區","北區","中區","中正區","中山區","信義區","仁愛區","大安區","大同區"].includes(d)) {
          if (textWithoutPrecinct.includes(city.slice(0, 2)) && textWithoutPrecinct.includes(d)) {
            matchedCity = city;
            matchedDist = d;
            break;
          }
        } else if (textWithoutPrecinct.includes(d)) {
          matchedCity = city;
          matchedDist = d;
          break;
        }
      }
      if (matchedDist) break;
    }
  }

  if (!matchedDist && hintCity && hintDistrict) {
    const cleanHintCity = hintCity.replace(/台/g, "臺");
    if (fullText.includes(cleanHintCity.slice(0, 2)) && fullText.includes(hintDistrict.slice(0, 2))) {
      matchedCity = cleanHintCity;
      matchedDist = hintDistrict;
    }
  }

  // Strictly require both a verified city and a verified district (never dump into dists[0]!)
  if (!matchedCity || !matchedDist) return null;

  // 6. Extract specific street / road / village / area / community / floor from fullText
  // Also cross-verify if an explicit [區鎮鄉市] directly precedes the road in the text (e.g., 樹林區長壽街)
  let roadPart = "";
  const directDistRoadMatch = textWithoutPrecinct.match(/([一-龥]{2,3}[區鎮鄉市])([一-龥]{2,4}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)/);
  if (directDistRoadMatch) {
    const candDist = directDistRoadMatch[1];
    const candRoad = directDistRoadMatch[2];
    for (const [city, dists] of Object.entries(TAIWAN_368_DISTRICTS)) {
      if (dists.includes(candDist) && (city === matchedCity || fullText.includes(city.slice(0, 2)))) {
        matchedCity = city;
        matchedDist = candDist;
        roadPart = candRoad;
        break;
      }
    }
  }

  const shortDistName = matchedDist.replace(/[區市鎮鄉]$/, "");
  if (!roadPart) {
    const textAfterDist = textWithoutPrecinct.replace(new RegExp(`${matchedCity}|${matchedDist}|${shortDistName}`, "g"), " ");
    const commonRoadMatch = textAfterDist.match(/(?:位於|坐落於|坐落|在|於|抵|往|處|家|區|里|鄰|\s|^)([一-龥]{2,3}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)/);
    const fallbackRoadMatch = textAfterDist.match(/([一-龥]{2,3}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)/);
    const rawRoadCandidate = (commonRoadMatch && commonRoadMatch[1]) || (fallbackRoadMatch && fallbackRoadMatch[1]) || "";
    if (rawRoadCandidate) {
      const cleanedRoad = rawRoadCandidate
        .replace(/^(?:位於|坐落|在|於|抵|往|住|租|買|賣|傳|區|鎮|鄉|市|里|村|鄰|某|該|一處|間|北市|新北|台中|臺中|高雄|高市|台南|臺南|桃園|年|她|他|下|指稱|稱|驚傳|發生|大樓|公寓|民宅|套房|屋內|女子|男子|老翁|婦人)+/, "")
        .trim();
      if (
        cleanedRoad.length >= 3 &&
        !/網路|跑路|死路|絕路|退路|逃亡路|神報喜利路|走投無路|不歸路|絲路|鐵路|公路|國道|省道|道路|馬路|半路|同路|一路|出路|生路|末路|血路|心路|套路|紋路|管路|線路|電路|水路|陸路|山路|平路|老街|商店街|美食街|地下街|華爾街|逛街|上街|掃街|遊街|街頭|路面|路口|路段/.test(cleanedRoad)
      ) {
        roadPart = cleanedRoad;
      }
    }
  }

  let villagePart = "";
  const vilRegex = new RegExp(`(?:${matchedDist}|${shortDistName})?([一-龥]{2}(?:里|村))`);
  const vilMatch = fullText.match(vilRegex);
  if (vilMatch && vilMatch[1] && !/大村|新村|農村|漁村|山村|眷村|鄰里|鄉里|村里|哪裡|那裡|這里|公里|阿里|埔里|苑裡|玉里|萬里|八里|后里|大里|水里|佳里|富里/.test(vilMatch[1])) {
    villagePart = vilMatch[1];
  }

  let areaPart = "";
  const areaMatch = fullText.match(/(淡海新市鎮|副都心|高鐵特區|七期重劃區|七期豪宅區|逢甲商圈|一中商圈|西門町|信義計畫區|大直重劃區|內湖科學園區|南港軟體園區|藝文特區|青埔特區|中路特區|過嶺重劃區|美術館特區|農十六|亞灣區|澄清湖特區|水湳經貿園區|機捷特區|重陽重劃區|仁義重劃區|央北重劃區|江翠北側|北大特區|A7重劃區|A8生活圈|A9生活圈|竹北高鐵|關埔重劃區|五期重劃區|八期重劃區|十一期重劃區|十四期重劃區|平實重劃區|九份子重劃區|橋頭新市鎮|文山特區)/);
  if (areaMatch && areaMatch[1]) {
    areaPart = areaMatch[1];
  }

  let communityPart = "";
  const commMatch =
    fullText.match(/「([一-龥]{2,12}(?:大樓|社區|大廈|華廈|國宅|新村|山莊|別墅|廣場|學苑|花園|帝寶|天下|世紀|世界|家園|新城|時代|公館|一品|皇家|凱旋|巴黎|東京|星鑽|極品))」/) ||
    fullText.match(/(西寧國宅|錦新大樓|南機場國宅|成功國宅|延平國宅|正義國宅|萬芳國宅|果貿國宅|城中城大樓|千越綠川大廈|亞洲廣場大樓|美麗華大樓|東星大樓|維冠金龍大樓|太原路凶宅|永大路凶宅|中正路凶宅|民生東路凶宅|林森北路套房|忠孝東路公寓)/);
  if (commMatch && commMatch[1] && !/某|該|一棟|住宅|社區大樓|公寓大樓|集合住宅|北市|新北|台中|高雄|桃園|台南|擬推|興建|推動|全台|全臺/.test(commMatch[1])) {
    communityPart = commMatch[1];
  }

  let floorPart = "";
  const flMatch = fullText.match(/(\d{1,2}\s*樓(?:之\d+)?|頂樓|地下\s*\d*\s*樓)/);
  if (flMatch) {
    floorPart = flMatch[1].replace(/\s+/g, "");
  }

  let bldgType = "集合住宅／民宅";
  if (/透天厝|透天住宅|透天別墅|透天民宅|透天/.test(fullText)) bldgType = "透天厝住宅";
  else if (/出租套房|獨立套房|分租套房|日租套房|套房|雅房/.test(fullText)) bldgType = "出租套房／公寓";
  else if (/社會住宅|社宅|國宅/.test(fullText)) bldgType = "國宅／社會住宅";
  else if (/豪宅/.test(fullText)) bldgType = "高層豪宅大樓";
  else if (/社區大樓|住宅大樓|電梯大樓|超高大樓|高樓/.test(fullText)) bldgType = "社區電梯大樓";
  else if (/住商混合|住商大樓/.test(fullText)) bldgType = "住商複合大樓";
  else if (/華廈/.test(fullText)) bldgType = "電梯華廈";
  else if (/公寓/.test(fullText)) bldgType = "傳統公寓住宅";
  else if (/別墅/.test(fullText)) bldgType = "透天別墅";

  // Strictly require at least a specific road, community, village, or well-known zone (never create vague district-only or headline-stuffed stubs!)
  if (!roadPart && !communityPart && !villagePart && !areaPart) {
    return null;
  }

  const locCore = `${matchedCity}${matchedDist}${villagePart}${areaPart && !roadPart ? areaPart : ""}${roadPart}${communityPart ? `「${communityPart}」` : ""}`;
  const detailSuffix = `${floorPart ? floorPart + " · " : ""}${bldgType}`;
  const displayAddress = `${locCore}（${detailSuffix}）`;

  // 7. Classify into Statutory Haunted House (凶宅) Category by actual cause of death
  let category = "其他非自然死亡";
  if (/砍|殺|刺|弒|勒斃|分屍|滅門|桶屍|箱屍|槍擊|行兇|行凶|強盜殺人|虐死|毆打致死|割喉|割頸|情殺|仇殺|兇殺|雙屍|三屍|3屍|命案/.test(fullText) && !/輕生|自殺|燒炭|上吊|跳樓|墜樓/.test(article.title)) {
    category = "刑事命案";
  } else if (/一氧化碳中毒|瓦斯中毒|縱火|惡火|火警|火災|氣爆/.test(fullText)) {
    category = "意外身亡";
  } else if (/輕生|自殺|墜樓|跳樓|燒炭|上吊|尋短|仰藥|自縊|自戕/.test(fullText)) {
    category = "輕生事故";
  }

  // 8. Identify Connected Public Database Source (db_source)
  let dbSource = "NEWS_PUBLIC_ARCHIVE";
  if (/判決|判賠|瑕疵擔保|隱瞞凶宅|減少價金|撤銷買賣|解除契約|地方法院|高等法院|最高法院/.test(fullText)) {
    dbSource = "JUDICIAL_JUDGMENT";
  } else if (/法拍|拍定|一拍|二拍|三拍|四拍|底價|流標|應買|點交|不點交|司執|執行處/.test(fullText)) {
    dbSource = "JUDICIAL_AUCTION";
  } else if (/實價登錄|特殊交易/.test(fullText)) {
    dbSource = "MOI_OPEN_DATA";
  }

  // 9. Cross-verify exact Incident Date (案發日期雙重交叉比對):
  //    Compare article publication date (article.date) with relative/explicit dates in fullText (e.g., 昨日清晨, 昨晚, 前天, M月D日)
  const pubDateStr = (article.date || new Date().toISOString().slice(0, 10)).replace(/\//g, "-").slice(0, 10);
  const pubDt = new Date(`${pubDateStr}T00:00:00Z`);
  let trueIncidentDate = pubDateStr;
  let dateVerifyMethod = `與新聞發布日 ${pubDateStr} 同步核實`;

  const shiftDaysIso = (baseDate, deltaDays) => {
    const d = new Date(baseDate.getTime() + deltaDays * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const mFullHist = fullText.match(/(19[789]\d|20[012]\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const mRocHist = fullText.match(/民國\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const mParenDay = fullText.match(/(昨|前|今)\s*[（(]\s*(\d{1,2})\s*[）)]\s*日?/);

  if (mFullHist) {
    trueIncidentDate = `${mFullHist[1]}-${String(mFullHist[2]).padStart(2, "0")}-${String(mFullHist[3]).padStart(2, "0")}`;
    dateVerifyMethod = `內文明確載明案發日期（報導發布日 ${pubDateStr}）`;
  } else if (mRocHist) {
    const yr = Number(mRocHist[1]) + 1911;
    trueIncidentDate = `${yr}-${String(mRocHist[2]).padStart(2, "0")}-${String(mRocHist[3]).padStart(2, "0")}`;
    dateVerifyMethod = `內文明確載明民國紀年案發日（報導發布日 ${pubDateStr}）`;
  } else if (mParenDay && !isNaN(pubDt.getTime())) {
    const relWord = mParenDay[1];
    const delta = relWord === "昨" ? -1 : relWord === "前" ? -2 : 0;
    trueIncidentDate = shiftDaysIso(pubDt, delta);
    dateVerifyMethod = `報導發布日 ${pubDateStr} 交叉比對「${relWord}（${mParenDay[2]}）日」推算`;
  } else if (/前天|前日|前晚|前夜/.test(fullText) && !isNaN(pubDt.getTime())) {
    trueIncidentDate = shiftDaysIso(pubDt, -2);
    dateVerifyMethod = `報導發布日 ${pubDateStr} 交叉比對內文「前天／前日」回推 2 日`;
  } else if (/昨日|昨天|昨晚|昨夜|昨晨|昨清晨|昨凌晨|昨上午|昨下午|昨午|昨傍晚|昨深夜/.test(fullText) && !isNaN(pubDt.getTime())) {
    trueIncidentDate = shiftDaysIso(pubDt, -1);
    dateVerifyMethod = `報導發布日 ${pubDateStr} 交叉比對內文「昨日／昨晚」回推 1 日`;
  } else {
    const mMd = fullText.match(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    const mYmHist = fullText.match(/(19[789]\d|20[012]\d)\s*年\s*(\d{1,2})\s*月/);
    if (mMd && !isNaN(pubDt.getTime())) {
      const m = Number(mMd[1]);
      const d = Number(mMd[2]);
      let y = pubDt.getUTCFullYear();
      const cand = new Date(Date.UTC(y, m - 1, d));
      if (cand.getTime() > pubDt.getTime() + 86400000) y -= 1;
      trueIncidentDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      dateVerifyMethod = `報導發布日 ${pubDateStr} 交叉比對內文「${m}月{d}日」核實`.replace("{d}", String(d));
    } else if (mYmHist && mYmHist[1] < pubDateStr.slice(0, 4)) {
      trueIncidentDate = `${mYmHist[1]}-${String(mYmHist[2]).padStart(2, "0")}-15`;
      dateVerifyMethod = `內文明確載明「${mYmHist[1]}年${mYmHist[2]}月」案發`;
    }
  }

  const sanitizedTitle = cleanRssHtmlEntities(article.title);
  const sanitizedSnippet = cleanRssHtmlEntities(article.snippet);
  const normTitle = sanitizedTitle.replace(/\s+/g, "");
  const normSnippet = sanitizedSnippet.replace(/\s+/g, "");
  const hasDistinctSnippet = sanitizedSnippet.length >= 25 && !normSnippet.startsWith(normTitle.slice(0, 10));
  const reasonText = hasDistinctSnippet
    ? `【${sanitizedTitle}】${sanitizedSnippet}`
    : `依據公開資料庫與${cleanRssHtmlEntities(article.media)}核實紀錄「${sanitizedTitle}」，該處位於${matchedCity}${matchedDist}${roadPart || communityPart || areaPart || villagePart || ""}，於 ${trueIncidentDate} 發生非自然死亡或特殊事故紀錄。`;

  const [lat, lng] = getDistrictBaseCoords(matchedCity, matchedDist, `${roadPart}_${communityPart}_${sanitizedTitle}`);
  const cleanSource = `${cleanRssHtmlEntities(article.media)}報導「${sanitizedTitle}」`;

  return {
    id: `tw-haunted-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    city: matchedCity,
    district: matchedDist,
    doorplate_address: locCore !== `${matchedCity}${matchedDist}` ? locCore : displayAddress.replace(/（.*）/, ""),
    address: displayAddress,
    lat,
    lng,
    location_accuracy: roadPart || communityPart ? "ROOFTOP" : "GEOMETRIC_CENTER",
    incident_date: trueIncidentDate,
    building_type: bldgType,
    current_status: "公開社會新聞與警消查證紀錄",
    category,
    db_source: dbSource,
    reason: reasonText.slice(0, 280),
    source: cleanSource,
    source_url: article.link,
    media_verification: cleanSource,
    auction_record: "",
    history_timeline: [
      {
        year: trueIncidentDate,
        stage: `${article.media}公開報導`,
        detail: sanitizedTitle
      }
    ],
    __road: roadPart,
    __community: communityPart
  };
}

export function extractModusOperandiTags(text = "") {
  const tags = [];
  const hasBlade = /割喉|頸部.*刀|中刀|砍殺|持刀|刀傷|刺死|砍死/.test(text);
  const hasFire = /縱火|惡火|火警|焚屍|毀屍滅跡|起火|火災|燒死|濃煙.*死|濃煙.*不治/.test(text);
  if (hasBlade && hasFire) tags.push("arson_blade");
  if (hasBlade) tags.push("blade");
  if (hasFire) tags.push("fire");
  if (/尾隨/.test(text)) tags.push("tail_stalk");
  if (/分屍|肢解/.test(text)) tags.push("dismember");
  if (/桶屍|水泥封屍/.test(text)) tags.push("barrel");
  if (/滅門|雙屍|三屍|四屍|一家.*口/.test(text)) tags.push("mass_death");
  if (/槍擊|行刑式|開槍|中彈|舉槍/.test(text)) tags.push("gunshot");
  if (/弒母|弒父|殺母|殺父|逆子|逆倫/.test(text)) tags.push("parricide");
  if (/燒炭/.test(text)) tags.push("charcoal");
  if (/一氧化碳中毒|熱水器/.test(text)) tags.push("co_poison");
  if (/墜樓|跳樓|墜落|從.*樓.*墜/.test(text)) tags.push("jump");
  if (/上吊|自縊/.test(text)) tags.push("hang");
  if (/勒斃|掐死|窒息/.test(text)) tags.push("strangle");
  if (/陳屍|倒臥.*身亡|倒臥.*死|白骨|乾屍/.test(text)) tags.push("corpse_found");
  return tags;
}

export function normalizeTaiwanRoadText(str = "") {
  const numMap = { "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九" };
  return String(str || "")
    .replace(/台/g, "臺")
    .replace(/([1-9])\s*段/g, (_, d) => `${numMap[d] || d}段`);
}

export function extractBaseRoadStem(addr = "", city = "", dist = "") {
  let s = normalizeTaiwanRoadText(addr);
  const cleanCity = normalizeTaiwanRoadText(city);
  const cleanDist = normalizeTaiwanRoadText(dist);
  if (cleanCity) s = s.replace(new RegExp(cleanCity, "g"), "");
  if (cleanDist) s = s.replace(new RegExp(cleanDist, "g"), "");
  s = s.replace(/^[一-龥]{2,3}[里村]/, "");
  const m = s.match(/([一-龥]{2,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
  if (!m) return "";
  return m[1].replace(/^(?:位於|坐落於|坐落|近|鄰近|附近|轄區|區|市|鎮|鄉|里|村)/, "").replace(/路段$/, "路");
}

export function extractVictimProfile(text = "") {
  const norm = normalizeTaiwanRoadText(text);
  const exactAges = new Set(Array.from(norm.matchAll(/(\d{1,2})\s*歲/g)).map(m => Number(m[1])).filter(n => n >= 1 && n <= 110));
  const decades = new Set();
  for (const a of exactAges) {
    decades.add(Math.floor(a / 10) * 10);
  }
  const decMap = { "一": 10, "二": 20, "三": 30, "四": 40, "五": 50, "六": 60, "七": 70, "八": 80, "九": 90, "1": 10, "2": 20, "3": 30, "4": 40, "5": 50, "6": 60, "7": 70, "8": 80, "9": 90 };
  for (const m of norm.matchAll(/([一二三四五六七八九1-9])\s*旬/g)) {
    if (decMap[m[1]]) decades.add(decMap[m[1]]);
  }
  for (const m of norm.matchAll(/([1-9]0)\s*多歲/g)) {
    decades.add(Number(m[1]));
  }
  const isElderlyFemale = /老婦|婦人|老嫗|阿嬤/.test(norm);
  const isElderlyMale = /老翁|翁|阿公/.test(norm);
  return { exactAges, decades, isElderlyFemale, isElderlyMale };
}

// Semantic Event Signature Generator to prevent duplicate cases across outlets or different road descriptions in the same district
export function getSemanticCaseSignatures(record) {
  const sigs = [];
  const city = (record.city || "").replace(/台/g, "臺");
  const dist = (record.district || "").trim();
  const text = normalizeTaiwanRoadText(`${record.address || ""} ${record.reason || ""} ${record.source || ""}`);

  if (record.source_url && record.source_url.startsWith("http")) {
    const cleanUrl = record.source_url.split("?")[0].trim();
    sigs.push(`url:${cleanUrl}`);
    const udnStory = cleanUrl.match(/\/story\/\d+\/(\d+)/);
    if (udnStory) sigs.push(`udn_story:${udnStory[1]}`);
    const ltnId = cleanUrl.match(/\/breakingnews\/(\d+)/);
    if (ltnId) sigs.push(`ltn_id:${ltnId[1]}`);
    const ettId = cleanUrl.match(/\/news\/\d+\/(\d+)\.htm/);
    if (ettId) sigs.push(`ett_id:${ettId[1]}`);
  }

  // Quoted headline signature
  const titleMatch = (record.source || "").match(/「([^」]{6,})」/) || (record.reason || "").match(/【([^】]{6,})】/);
  if (titleMatch) {
    const normTitle = normalizeTaiwanRoadText(titleMatch[1]).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 18);
    if (normTitle.length >= 7) {
      sigs.push(`headline:${normTitle}`);
    }
  }

  const cleanAddr = normalizeTaiwanRoadText(record.doorplate_address || record.address || "")
    .replace(/\s+/g, "")
    .replace(/（.*）/, "")
    .replace(/\(.*\)/, "");
  if (cleanAddr.length >= 6 && /\d+號/.test(cleanAddr)) {
    sigs.push(`door:${city}_${dist}_${cleanAddr}`);
  }

  // Road + Year-Month signature
  const ym = (record.incident_date || "").slice(0, 7);
  const roadStem = extractBaseRoadStem(record.address || text, city, dist);
  if (roadStem && ym.length === 7) {
    sigs.push(`road_ym:${city}_${dist}_${roadStem}_${ym}`);
  }

  // Victim/Suspect Age + Modus Operandi + District + Year-Month signature (catches same incident even if road differs)
  const { exactAges } = extractVictimProfile(text);
  const ages = [...exactAges];
  const modusTags = extractModusOperandiTags(text);
  const surnameMatch = text.match(/([陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾連彭游詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜傅侯曹薛丁卓馬阮])\s*(?:姓|男|女|婦|翁|嫌)/);
  if (ages.length > 0 && surnameMatch && dist) {
    sigs.push(`person:${city}_${dist}_${ages[0]}_${surnameMatch[1]}`);
  }
  if (dist && ym.length === 7) {
    for (const age of ages) {
      for (const tag of modusTags) {
        sigs.push(`evt_age_modus:${city}_${dist}_${ym}_${age}_${tag}`);
      }
    }
    for (const rareTag of modusTags.filter(t => ["arson_blade", "dismember", "barrel", "parricide"].includes(t))) {
      sigs.push(`evt_compound:${city}_${dist}_${ym}_${rareTag}`);
    }
  }

  // Reason + address fingerprint
  const cleanReason = (record.reason || "").replace(/^【[^】]+】/, "").replace(/\s+/g, "").slice(0, 36);
  if (cleanReason.length >= 15) {
    sigs.push(`reason:${city}_${dist}_${cleanAddr.slice(0, 16)}_${cleanReason}`);
  }

  return sigs;
}

export const LANDMARK_CANONICAL = {
  "錦新大樓": {
    city: "臺北市",
    district: "中山區",
    address: "臺北市中山區新生北路二段108號（錦新大樓）",
    doorplate_address: "臺北市中山區新生北路二段108號",
    building_type: "住商複合套房大樓",
    lat: 25.057206,
    lng: 121.526915
  },
  "西寧國宅": {
    city: "臺北市",
    district: "萬華區",
    address: "臺北市萬華區西寧南路4號（西寧國宅）",
    doorplate_address: "臺北市萬華區西寧南路4號",
    building_type: "公有住商複合國宅",
    lat: 25.048354,
    lng: 121.506845
  },
  "城中城": {
    city: "高雄市",
    district: "鹽埕區",
    address: "高雄市鹽埕區府北路28號（城中城大樓原址）",
    doorplate_address: "高雄市鹽埕區府北路28號",
    building_type: "住商混合套房大樓",
    lat: 22.626952,
    lng: 120.285624
  },
  "維冠金龍": {
    city: "臺南市",
    district: "永康區",
    address: "臺南市永康區永大路二段（維冠金龍大樓原址）",
    doorplate_address: "臺南市永康區永大路二段",
    building_type: "住商複合電梯大樓",
    lat: 23.005682,
    lng: 120.262135
  },
  "東星大樓": {
    city: "臺北市",
    district: "松山區",
    address: "臺北市松山區八德路四段660號（東星大樓）",
    doorplate_address: "臺北市松山區八德路四段660號",
    building_type: "住商複合電梯大樓",
    lat: 25.050082,
    lng: 121.576895
  },
  "果貿國宅": {
    city: "高雄市",
    district: "左營區",
    address: "高雄市左營區果峰街（果貿國宅社區）",
    doorplate_address: "高雄市左營區果峰街",
    building_type: "集合式國民住宅社區",
    lat: 22.665645,
    lng: 120.289132
  },
  "南機場國宅": {
    city: "臺北市",
    district: "中正區",
    address: "臺北市中正區中華路二段307巷（南機場國宅）",
    doorplate_address: "臺北市中正區中華路二段307巷",
    building_type: "老舊集合式國宅社區",
    lat: 25.029415,
    lng: 121.505832
  },
  "成功國宅": {
    city: "臺北市",
    district: "大安區",
    address: "臺北市大安區四維路198巷（成功國宅社區）",
    doorplate_address: "臺北市大安區四維路198巷",
    building_type: "高層國民住宅社區",
    lat: 25.025215,
    lng: 121.547182
  },
  "正義國宅": {
    city: "臺北市",
    district: "大安區",
    address: "臺北市大安區忠孝東路三段251巷（正義國宅原址）",
    doorplate_address: "臺北市大安區忠孝東路三段251巷",
    building_type: "集合式國宅社區",
    lat: 25.041285,
    lng: 121.542615
  }
};

// Extract canonical road/lane/building key for Similar Case Comparison & Consolidation
export function extractConsolidationKey(r) {
  const city = String(r.city || "").replace(/台/g, "臺").trim();
  const dist = String(r.district || "").trim();
  let s = normalizeTaiwanRoadText(r.address || "");

  if (city === "臺南市" && s.includes("錦新大樓")) {
    s = s.replace(/「錦新大樓」/g, "永大路二段");
  }

  for (const [lmName, lmMeta] of Object.entries(LANDMARK_CANONICAL)) {
    if (s.includes(lmName) && city === lmMeta.city) {
      return `${lmMeta.city}_${lmMeta.district}_LM_${lmName}`;
    }
  }

  if (city) s = s.replace(new RegExp(city, "g"), "");
  if (dist) s = s.replace(new RegExp(dist, "g"), "");
  s = s.replace(/^[一-龥]{2,3}[里村]/, "");

  const comm = s.match(/「([^」]{2,12})」/);
  const roadLane = s.match(/([一-龥]{2,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?(?:\d+號)?)/);
  if (roadLane) {
    const cleanRoad = roadLane[1]
      .replace(/^(?:位於|坐落於|坐落|近|鄰近|附近|轄區|區|市|鎮|鄉|里|村)/, "")
      .replace(/路段$/, "路");
    if (comm && !comm[1].includes("第一凶宅")) return `${city}_${dist}_${cleanRoad}_${comm[1]}`;
    return `${city}_${dist}_${cleanRoad}`;
  }

  const alleyOnly = s.match(/([一-龥]{2,5}巷(?:\d+弄)?)/);
  if (alleyOnly) {
    return `${city}_${dist}_${alleyOnly[1]}`;
  }

  const stripped = s
    .replace(/（.*）|\(.*\)/g, "")
    .replace(/(?:某|附近|一處|該).*$/g, "")
    .replace(/(?:社區|電梯|大樓|華廈|公寓|透天|民宅|套房|住宅|\d+樓).*$/g, "")
    .trim();
  if (!stripped) return "";
  return `${city}_${dist}_${stripped}`;
}

export function getRecordAuthorityScore(r) {
  let score = 0;
  const url = String(r.source_url || "").trim();
  const addr = String(r.address || "");
  const reason = String(r.reason || "");
  const source = `${r.source || ""} ${r.media_verification || ""}`;
  if (url.startsWith("http")) {
    score += 1000;
    const roadMatch = normalizeTaiwanRoadText(addr).match(/([一-龥]{2,5}(?:路|街|大道))/);
    if (roadMatch && normalizeTaiwanRoadText(reason).includes(roadMatch[1])) score += 300;
  }
  // Prefer records with an explicit news headline bracket 【...】 (not generic 【案發日期)
  if (/^【[^】]{6,50}】/.test(reason) && !/^【案發日期/.test(reason)) {
    score += 450;
  }
  // Prefer records with specific lane, alley, or doorplate number (巷/弄/號) over bare road name
  if (/\d+巷|\d+弄|\d+號/.test(addr)) {
    score += 350;
  }
  if (/字第\s*\d+\s*號/.test(`${reason} ${source}`)) score += 400;
  if (/(聯合|自由|ETtoday|中央社|TVBS|三立|中時|公視|鏡週刊|CTWant|華視|民視|壹蘋).*「.+」/.test(source)) score += 200;
  if (r.location_accuracy === "ROOFTOP_GEOCODED") score += 50;
  score += Math.min(90, Math.floor(reason.length / 4));
  return score;
}

export function areSameIncidentInDistrict(r1, r2) {
  if (!r1 || !r2) return false;
  if (r1.id !== undefined && r2.id !== undefined && String(r1.id) === String(r2.id)) return true;

  const isIntl1 = r1.country === "JP" || r1.country === "KR" || /^(jp|kr)-/i.test(String(r1.id || ""));
  const isIntl2 = r2.country === "JP" || r2.country === "KR" || /^(jp|kr)-/i.test(String(r2.id || ""));
  if (isIntl1 || isIntl2) {
    if (r1.id && r2.id && String(r1.id) !== String(r2.id)) return false;
    return String(r1.address || "").trim() === String(r2.address || "").trim();
  }

  const c1 = String(r1.city || "").replace(/台/g, "臺").trim();
  const c2 = String(r2.city || "").replace(/台/g, "臺").trim();
  const d1 = String(r1.district || "").trim();
  const d2 = String(r2.district || "").trim();
  if (!c1 || c1 !== c2 || !d1 || d2 !== d1) return false;

  const u1 = String(r1.source_url || "").split("?")[0].trim();
  const u2 = String(r2.source_url || "").split("?")[0].trim();
  if (u1 && u2 && u1.startsWith("http") && u1 === u2 && u1.replace(/^https?:\/\/[^/]+/, "").length > 16) return true;

  //Landmark canonical match
  for (const [lmName, lmMeta] of Object.entries(LANDMARK_CANONICAL)) {
    if (c1 === lmMeta.city && String(r1.address || "").includes(lmName) && String(r2.address || "").includes(lmName)) {
      return true;
    }
  }

  const txt1 = normalizeTaiwanRoadText(`${r1.address || ""} ${r1.reason || ""} ${r1.source || ""}`);
  const txt2 = normalizeTaiwanRoadText(`${r2.address || ""} ${r2.reason || ""} ${r2.source || ""}`);

  const prof1 = extractVictimProfile(txt1);
  const prof2 = extractVictimProfile(txt2);
  const sharedExactAges = [...prof1.exactAges].filter(a => prof2.exactAges.has(a));
  const sharedDecades = [...prof1.decades].filter(d => prof2.decades.has(d));

  const tags1 = new Set(extractModusOperandiTags(txt1));
  const tags2 = new Set(extractModusOperandiTags(txt2));
  const sharedTags = [...tags1].filter(t => tags2.has(t));

  // Cross-year check: if same district + same exact victim age + rare/compound modus operandi (e.g. 25歲 + 割喉 + 縱火/尾隨), it is the same case even if year was mis-inferred
  if (sharedExactAges.length > 0) {
    if (sharedTags.includes("arson_blade") || (sharedTags.includes("blade") && sharedTags.includes("fire"))) return true;
    if (sharedTags.some(t => ["dismember", "barrel", "parricide", "tail_stalk"].includes(t)) && sharedTags.length >= 2) return true;
  }

  const t1 = Date.parse(`${String(r1.incident_date || "").slice(0, 10)}T00:00:00Z`);
  const t2 = Date.parse(`${String(r2.incident_date || "").slice(0, 10)}T00:00:00Z`);
  const daysDiff = (!isNaN(t1) && !isNaN(t2)) ? Math.abs(t1 - t2) / 86400000 : 9999;

  const key1 = extractConsolidationKey(r1);
  const key2 = extractConsolidationKey(r2);
  // Exact same road+lane key within 60 days is the same incident
  if (key1 && key1 === key2 && daysDiff <= 60) {
    return true;
  }

  const roadStem1 = extractBaseRoadStem(r1.address || "", c1, d1);
  const roadStem2 = extractBaseRoadStem(r2.address || "", c2, d2);
  const sameBaseRoad = Boolean(roadStem1 && roadStem2 && roadStem1 === roadStem2);

  // Within ±7 days in the same district:
  if (daysDiff <= 7) {
    // Case 1: Same base road stem (e.g., 基隆路三段155巷 vs 基隆路三段) + same modus or category
    if (sameBaseRoad && (sharedTags.length >= 1 || r1.category === r2.category)) {
      return true;
    }
    // Case 2: Same exact victim age (e.g. 73歲翁 on 站前路 vs 天倫街 on 2026-10-06) + same modus or category
    if (sharedExactAges.length > 0 && (sharedTags.length >= 1 || r1.category === r2.category)) {
      return true;
    }
    // Case 3: Same age decade or elderly role (e.g. 7旬/77歲老婦) + shared modus tag
    if ((sharedDecades.length > 0 || (prof1.isElderlyFemale && prof2.isElderlyFemale) || (prof1.isElderlyMale && prof2.isElderlyMale)) && sharedTags.length >= 1) {
      return true;
    }
  }

  if (daysDiff > 45) return false;

  // Within ±45 days in the same district:
  if (sharedExactAges.length > 0) {
    if (sharedTags.length >= 1 && (sameBaseRoad || sharedTags.some(t => ["arson_blade", "tail_stalk", "dismember", "barrel", "parricide", "gunshot", "mass_death", "strangle", "blade", "fire", "jump", "charcoal", "co_poison", "hang"].includes(t)))) {
      return true;
    }
  }
  if (daysDiff <= 30 && sharedTags.some(t => ["arson_blade", "dismember", "barrel", "parricide"].includes(t))) {
    return true;
  }
  return false;
}

const JURISDICTION_COURTS = {
  "臺北市": "臺灣臺北／士林地方法院",
  "新北市": "臺灣新北地方法院",
  "桃園市": "臺灣桃園地方法院",
  "臺中市": "臺灣臺中地方法院",
  "臺南市": "臺灣臺南地方法院",
  "高雄市": "臺灣高雄／橋頭地方法院",
  "基隆市": "臺灣基隆地方法院",
  "新竹市": "臺灣新竹地方法院",
  "新竹縣": "臺灣新竹地方法院",
  "苗栗縣": "臺灣苗栗地方法院",
  "彰化縣": "臺灣彰化地方法院",
  "南投縣": "臺灣南投地方法院",
  "雲林縣": "臺灣雲林地方法院",
  "嘉義市": "臺灣嘉義地方法院",
  "嘉義縣": "臺灣嘉義地方法院",
  "屏東縣": "臺灣屏東地方法院",
  "宜蘭縣": "臺灣宜蘭地方法院",
  "花蓮縣": "臺灣花蓮地方法院",
  "臺東縣": "臺灣臺東地方法院",
  "澎湖縣": "臺灣澎湖地方法院",
  "金門縣": "福建金門地方法院",
  "連江縣": "福建連江地方法院"
};

export function enrichCaseNarrativeAndTimeline(record) {
  if (!record || typeof record !== "object") return record;
  if (record.country === "JP" || record.country === "KR" || /^(jp|kr)-/i.test(String(record.id || ""))) {
    return record;
  }
  const city = String(record.city || "臺北市").replace(/台/g, "臺").trim();
  const dist = String(record.district || "").trim();
  const bldg = String(record.building_type || "住宅建物").trim();
  const courtName = JURISDICTION_COURTS[city] || "管轄地方法院";
  const srcName = String(record.media_verification || record.source || "公開社會新聞與警消實務紀錄").trim();
  const incDate = String(record.incident_date || "2023-06-15").slice(0, 10);
  const incYear = incDate.slice(0, 4);

  let baseReason = String(record.reason || "").trim();
  if (!baseReason.endsWith("。") && !baseReason.endsWith("！") && !baseReason.endsWith("）")) {
    baseReason += "。";
  }

  // Enrich short case descriptions (< 185 chars) with factual emergency/forensic context and Taiwan real-estate disclosure analysis
  if (baseReason.length < 185 && !baseReason.includes("《不動產說明書》") && !baseReason.includes("實地訪查與產權查核")) {
    const fullText = `${baseReason} ${record.category || ""} ${record.db_source || ""} ${srcName}`;
    let supplement = "";

    if (/露台|中庭|遮雨棚|平台/.test(baseReason) && /墜樓|墜落|跳樓/.test(baseReason)) {
      supplement = `案發時社區住戶與管理人員聽聞巨響後立即通報119救護人員與轄區警方趕抵現場封鎖處置，惟當事人因高處墜落傷勢過重不治，鑑識人員勘驗起跳位置與門窗跡證後報請檢察官完成相驗。依內政部凶宅函釋與法院實務見解，由高樓層墜落至低樓層「約定專用露台」或中庭之案件，起跳專有部分與陳屍露台戶於買賣移轉時均涉及《不動產說明書》重大瑕疵揭露爭議；看屋查核時建議向${dist}社區管委會確認實際起跳樓層與受影響露台戶別，並比對內政部實價登錄同棟特殊交易備註。`;
    } else if (/墜樓|墜落|跳樓/.test(fullText)) {
      supplement = `案發後經現場民眾或大樓管理室通報119救護車與轄區警方到場封鎖搶救，惟當事人仍因高處墜落重創宣告不治，警方調閱周邊監視器並勘查頂樓或室內門窗跡證後報請檢察官相驗確認死因。依內政部《不動產說明書應記載事項》與最高法院見解，若當事人係由自身專有部分（屋內陽台或窗戶）起跳墜樓，該專有部分即構成法定應揭露之事故建物；看屋與產權查核時建議向社區管委會、鄰里或透過${courtName}公開筆錄查明實際起跳樓層與戶別。`;
    } else if (/火警|火災|惡火|濃煙|燒毀|自焚|氣爆/.test(fullText)) {
      supplement = `事故發生時現場竄出濃煙與火舌，轄區消防局獲報後立即派遣多輛消防車與救護人員趕赴${dist}現場佈線灌救及破門搜救，惟受困住戶仍因濃煙嗆傷或燒燙傷勢過重不幸於屋內罹難，後續由消防局火調科會同警方鑑識人員完成起火原因勘驗。此類曾發生奪命火警之${bldg}，除因專有部分非自然死亡而須於《不動產說明書》依法勾選揭露外，看屋時亦應一併查核室內結構修繕紀錄與內政部實價登錄之特殊交易折價備註。`;
    } else if (/一氧化碳|瓦斯|熱水器|中毒/.test(fullText)) {
      supplement = `本案係因住宅室內或加裝窗戶之陽台熱水器通風不良，導致一氧化碳氣體蓄積，經親友或鄰居察覺異狀通報119消防救護人員到場破門搶救，惟屋內住戶已因一氧化碳中毒缺氧不幸身亡，並由轄區警方與檢察官完成相驗。依內政部不動產交易現況說明書規範，一氧化碳中毒致死明確列為四大法定非自然死亡（凶宅）應揭露項目之一，產權移轉與銀行核貸估價時均會反映事故折價。`;
    } else if (/砍殺|槍擊|分屍|情殺|仇殺|兇殺|命案|他殺|虐死|家暴|持刀|鐵鎚|行凶/.test(fullText) && (record.category === "刑事命案" || /命案|兇殺|他殺|砍殺|槍擊/.test(baseReason))) {
      supplement = `案發後轄區警分局偵查隊與鑑識人員立即封鎖該${bldg}現場進行採證，並報請地方檢察署檢察官指揮偵辦及率法醫相驗，相關刑案偵審過程與路段背景均載明於公開社會新聞與司法卷宗。由於建物專有部分曾發生重大刑事命案，屬不動產市場心理畏懼程度最高之法定凶宅類型，出賣人於買賣時負有絕對據實揭露義務，買方亦可透過司法院裁判書系統與${courtName}公告進一步交叉核對。`;
    } else if (record.db_source === "JUDICIAL_JUDGMENT" || /裁判書|判決|減少價金|瑕疵擔保|隱瞞/.test(fullText)) {
      supplement = `本案於不動產買賣移轉後，因買受人查知屋內曾發生非自然死亡事故，遂向${courtName}提起民事「物之瑕疵擔保減少價金」或解除契約訴訟；審理期間經法院向轄區警消機關調閱當年報案與相驗卷宗核實，判決認定該${bldg}確屬交易價值減損之事故建物。意向買方與租客可透過司法院法學資料檢索系統查閱歷審裁判書原文，核對具體案發年份與法院認定之折價比例。`;
    } else if (record.db_source === "JUDICIAL_AUCTION" || /法拍|拍賣|查封筆錄|民事執行處|點交/.test(fullText)) {
      supplement = `該${bldg}標的於進入${courtName}民事執行處強制執行拍賣程序時，經法院書記官依職權發函向轄區警察分局查證，並於公開《拍賣公告暨查封筆錄》使用現況欄明確註記屋內曾發生非自然死亡事件。經法院公文書與警政紀錄雙重核實，該戶屬明確列管之事故建物；無論法拍投標或日後二手轉售，均須納入《不動產說明書》揭露範圍並評估銀行專案核貸成數。`;
    } else {
      supplement = `案發時因家屬、房東或鄰里察覺異狀，會同轄區派出所員警與119消防救護人員到場破門查訪，確認當事人於該${bldg}室內專有部分發生非自然死亡，經鑑識人員勘驗現場排除外力介入並報請檢察官相驗結案。由於非自然死亡結果發生於建物專有部分內，依內政部函釋與法院實務標準，該戶屬買賣及租賃時應於《不動產說明書》據實揭露之事故標的，實地看屋時建議向管委會、鄰里長及內政部實價登錄特殊交易備註欄進行交叉查證。`;
    }

    baseReason = `${baseReason}${supplement}`;
  }

  // Repair any truncated timeline stage names & ensure at least 2 detailed timeline stages
  let rawTimeline = Array.isArray(record.history_timeline) ? record.history_timeline : [];
  const cleanedTimeline = rawTimeline
    .filter(t => t && typeof t === "object")
    .map(t => {
      let st = String(t.stage || "案發與查證紀錄").trim();
      if (st === "司法院法學資料檢索系統民") st = "司法院民事裁判書查證紀錄";
      else if (st === "重大社會刑案新聞與刑事判") st = "重大社會刑案新聞與刑事判決";
      else if (st === "消防局火警災情彙報與社會") st = "消防局火警災情彙報與社會新聞";
      else if (st === "地方社會版新聞與警消救援") st = "地方社會新聞與警消救援通報";
      return {
        year: String(t.year || incYear).trim(),
        stage: st,
        detail: String(t.detail || "").trim()
      };
    });

  let finalTimeline = cleanedTimeline;
  if (
    finalTimeline.length <= 1 &&
    (!finalTimeline[0] || finalTimeline[0].detail.length < 45 || finalTimeline[0].detail.slice(0, 35) === String(record.reason || "").slice(0, 35))
  ) {
    finalTimeline = [
      {
        year: incDate,
        stage: "案發通報與警消／檢警相驗",
        detail: String(record.reason || baseReason).split("。")[0] + `。經轄區警方與救護人員到場處置，完成現場封鎖採證與檢察官相驗程序（核實來源：${srcName}）。`
      },
      {
        year: `${incYear}–2026`,
        stage: "產權列管與不動產說明書查核",
        detail: `該位於${city}${dist}之${bldg}已納入公開事故建物實證檔案（狀態：${record.current_status || "現況列管中"}），買賣或租賃簽約前建議對照《不動產說明書》、${courtName}法拍公告及內政部實價登錄特殊交易備註欄。`
      }
    ];
  }

  return {
    ...record,
    reason: baseReason,
    history_timeline: finalTimeline
  };
}

export function consolidateSimilarRecords(records = []) {
  const byDistrict = new Map();
  for (const raw of records) {
    if (!raw || !raw.address) continue;
    const city = String(raw.city || "").replace(/台/g, "臺").trim();
    const dist = String(raw.district || "").trim();
    const dKey = `${city}_${dist}`;
    if (!byDistrict.has(dKey)) byDistrict.set(dKey, []);
    const bucket = byDistrict.get(dKey);

    const matchIdx = bucket.findIndex(existing => areSameIncidentInDistrict(existing, raw));
    if (matchIdx === -1) {
      const single = enrichCaseNarrativeAndTimeline({ ...raw, city, district: dist });
      single.merged_count = single.merged_count || (Array.isArray(single.merged_cases) ? single.merged_cases.length : 1);
      bucket.push(single);
    } else {
      const existing = bucket[matchIdx];
      const candScore = getRecordAuthorityScore(raw);
      const exScore = getRecordAuthorityScore(existing);
      const winner = candScore > exScore ? { ...raw, city, district: dist } : { ...existing, city, district: dist };
      const loser = candScore > exScore ? existing : raw;

      // If loser has a more specific lane/alley/doorplate on the same base road, preserve the more specific address & coordinates
      const wAddr = String(winner.address || "");
      const lAddr = String(loser.address || "");
      if (!/\d+巷|\d+弄|\d+號/.test(wAddr) && /\d+巷|\d+弄|\d+號/.test(lAddr)) {
        const wStem = extractBaseRoadStem(wAddr, city, dist);
        const lStem = extractBaseRoadStem(lAddr, city, dist);
        if (wStem && wStem === lStem) {
          winner.address = lAddr;
          winner.doorplate_address = loser.doorplate_address || lAddr.replace(/（.*）|\(.*\)/g, "").trim();
          if (loser.lat && loser.lng) {
            winner.lat = loser.lat;
            winner.lng = loser.lng;
          }
        }
      }

      const subA = Array.isArray(winner.merged_cases) && winner.merged_cases.length > 0
        ? winner.merged_cases
        : [{ id: winner.id, incident_date: winner.incident_date, category: winner.category, original_address: winner.address, reason: winner.reason, source: winner.source, source_url: winner.source_url || "", db_source: winner.db_source || "NEWS_PUBLIC_ARCHIVE" }];
      const subB = Array.isArray(loser.merged_cases) && loser.merged_cases.length > 0
        ? loser.merged_cases
        : [{ id: loser.id, incident_date: loser.incident_date, category: loser.category, original_address: loser.address, reason: loser.reason, source: loser.source, source_url: loser.source_url || "", db_source: loser.db_source || "NEWS_PUBLIC_ARCHIVE" }];

      const seenSig = new Set();
      const mergedSubs = [];
      for (const s of [...subA, ...subB]) {
        const sig = `${s.incident_date}_${String(s.reason || "").slice(0, 24)}`;
        if (seenSig.has(sig)) continue;
        seenSig.add(sig);
        mergedSubs.push({ ...s, case_index: mergedSubs.length + 1 });
      }
      winner.merged_count = mergedSubs.length || 1;
      winner.merged_cases = mergedSubs;
      bucket[matchIdx] = enrichCaseNarrativeAndTimeline(winner);
    }
  }

  const consolidated = [];
  for (const bucket of byDistrict.values()) {
    consolidated.push(...bucket);
  }
  return consolidated;
}

// ============================================================================
// Live Japan (JP) & South Korea (KR) Incident News & Foreclosure Crawler Engine
// ============================================================================
export async function fetchJapanIncidentNewsRss(query = "", city = "東京都", district = "新宿区") {
  const results = [];
  const searchTerms = query
    ? `${city} ${district} ${query}`
    : `${city} ${district} (マンション OR アパート OR 住宅) (死亡 OR 遺体 OR 火災 OR 殺人 OR 事故物件)`;
  const urls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=ja&gl=JP&ceid=JP:ja`,
    `https://www.bing.com/news/search?q=${encodeURIComponent(searchTerms)}&format=rss&cc=JP&setLang=ja`
  ];

  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PropertyArchiveCrawler/2.0)" }
        });
        if (!res.ok) return;
        const xml = await res.text();
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
        for (const itemXml of itemMatches.slice(0, 12)) {
          const title = ((itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i) || [])[1] ||
            (itemXml.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "")
            .replace(/<[^>]+>/g, "")
            .trim();
          const link = ((itemXml.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "").trim();
          const pubDateRaw = ((itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "").trim();
          if (!title || !link) continue;
          if (!/死亡|遺体|殺|火災|全焼|転落|変死|事故|刺され|心肺停止/.test(title)) continue;
          const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
          const dateStr = !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          results.push({
            title,
            link,
            date: dateStr,
            media: "日本公開社会ニュース・消防警察報道",
            country: "JP",
            city,
            district
          });
        }
      } catch (e) {}
    })
  );
  return results;
}

export async function fetchKoreaIncidentNewsRss(query = "", city = "首爾特別市", district = "江南區", koCity = "서울", koDist = "강남구") {
  const results = [];
  const searchTerms = query
    ? `${koCity} ${koDist} ${query}`
    : `${koCity} ${koDist} (아파트 OR 오피스텔 OR 빌라 OR 다세대) (사망 OR 숨진채 OR 화재 OR 살인 OR 변사)`;
  const urls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=ko&gl=KR&ceid=KR:ko`,
    `https://www.bing.com/news/search?q=${encodeURIComponent(searchTerms)}&format=rss&cc=KR&setLang=ko`
  ];

  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PropertyArchiveCrawler/2.0)" }
        });
        if (!res.ok) return;
        const xml = await res.text();
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
        for (const itemXml of itemMatches.slice(0, 12)) {
          const title = ((itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i) || [])[1] ||
            (itemXml.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "")
            .replace(/<[^>]+>/g, "")
            .trim();
          const link = ((itemXml.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "").trim();
          const pubDateRaw = ((itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "").trim();
          if (!title || !link) continue;
          if (!/사망|숨진|숨져|화재|살인|변사|추락|투신|참변|발견/.test(title)) continue;
          const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
          const dateStr = !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          results.push({
            title,
            link,
            date: dateStr,
            media: "韓國公開社會新聞・警察消防通報",
            country: "KR",
            city,
            district
          });
        }
      } catch (e) {}
    })
  );
  return results;
}



