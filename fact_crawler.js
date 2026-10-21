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
  "孤獨死 陳屍 異味",
  "雙屍 住宅 命案",
  "氣爆 民宅 身亡",
  "隱瞞凶宅 判賠 法院",
  "地方法院 法拍 凶宅",
  "行政執行署 法拍 透天",
  "工安 墜樓 建案 身亡",
  "弒母 弒父 弒親 住宅",
  "情殺 租屋 套房",
  "債務 輕生 法拍",
  "汽車旅館 摩鐵 陳屍",
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
      const title = tMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
      const snippet = dMatch ? dMatch[1].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim() : "";
      let date = new Date().toISOString().slice(0, 10);
      if (pMatch) {
        const parsed = new Date(pMatch[1].trim());
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
      }
      const media = sMatch ? sMatch[1].trim() : "臺灣綜合新聞";
      if (link.startsWith("http")) {
        out.push({ title, link, date, snippet, media });
      }
    }
    return out;
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

  // 2. Reject non-residential incident scenes (bridges, mountains, parks, construction sites, factories, KTV/hotels, prisons, roads)
  const isExplicitHaunted = /凶宅|事故屋|隱瞞凶宅|買到凶宅|誤買凶宅/.test(fullText);
  const nonResidentialScene = /大橋|陸橋|天橋|高架橋|橋面|橋下|河床|溪床|溪谷|草叢|掩埋場|垃圾場|公墓|墓園|納骨塔|火葬場|殯儀館|國道|省道|快速道路|平交道|鐵軌|車禍|擦撞|自撞|追撞|酒駕|毒駕|騎士|工地|施工|建案工地|興建工程|鷹架|吊車|工人|工安|職災|職業安全|工廠|廠房|鐵工廠|加工區|科技廠|倉庫|錢櫃|好樂迪|KTV|酒店|夜店|舞廳|養生館|摩鐵|汽車旅館|飯店|商旅|民宿|百貨|商場|賣場|大賣場|超商|超市|餐廳|小吃店|看守所|監獄|外役監|服刑|出監|入監|軍營|營區|部隊|堂口|幫派|百果山|山區|山難|登山|步道|海邊|海岸|海域|漁港|沙灘|碼頭|水庫|魚塭|農地|果園|竹林|防風林|涵洞|水圳|大排|溝渠|溪畔|河濱|路倒|街頭|校園墜樓|校內墜樓|教學大樓|病房墜樓|醫院墜樓|護理之家|安養院|長照中心/;
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

  // 5. Identify Taiwan City & District from article text (NEVER fallback to dists[0]!)
  let matchedCity = "";
  let matchedDist = "";

  for (const [city, dists] of Object.entries(TAIWAN_368_DISTRICTS)) {
    const shortCity = city.slice(0, 2);
    for (const d of dists) {
      const shortDist = d.length > 2 ? d.slice(0, -1) : d;
      if (fullText.includes(city + d) || fullText.includes(shortCity + d) || fullText.includes(shortCity + shortDist)) {
        matchedCity = city;
        matchedDist = d;
        break;
      }
    }
    if (matchedCity) break;
  }

  if (!matchedDist) {
    for (const [kw, [c, d]] of Object.entries(UNAMBIGUOUS_DISTRICT_MAP)) {
      if (fullText.includes(kw)) {
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
          if (fullText.includes(city.slice(0, 2)) && fullText.includes(d)) {
            matchedCity = city;
            matchedDist = d;
            break;
          }
        } else if (fullText.includes(d)) {
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
  let roadPart = "";
  const textAfterDist = fullText.replace(new RegExp(`${matchedCity}|${matchedDist}`, "g"), " ");
  const roadMatch = textAfterDist.match(/(?:位於|坐落於|坐落|在|於|趕抵|前往|住處|住家|轄區)?([一-龥]{2,4}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)/);
  if (roadMatch && roadMatch[1]) {
    const cleanedRoad = roadMatch[1]
      .replace(/^(?:位於|坐落|在|於|抵|往|住|租|買|賣|傳|區|鎮|鄉|市|里|村|鄰|某|該|一處|間|北市|新北|台中|臺中|高雄|高市|台南|臺南|桃園|年|她|他|下|指稱|稱)+/, "")
      .trim();
    if (
      cleanedRoad.length >= 3 &&
      !/網路|跑路|死路|絕路|退路|逃亡路|神報喜利路|走投無路|不歸路|絲路|鐵路|公路|國道|省道|道路|馬路|半路|同路|一路|出路|生路|末路|血路|心路|套路|紋路|管路|線路|電路|水路|陸路|山路|平路|老街|商店街|美食街|地下街|華爾街|逛街|上街|掃街|遊街|街頭|路面|路口|路段/.test(cleanedRoad)
    ) {
      roadPart = cleanedRoad;
    }
  }

  let villagePart = "";
  const vilRegex = new RegExp(`(?:${matchedDist})([一-龥]{2}(?:里|村))`);
  const vilMatch = fullText.match(vilRegex);
  if (vilMatch && vilMatch[1] && !/大村|新村|農村|漁村|山村|眷村|鄰里|鄉里|村里|哪裡|那裡|這里|公里|阿里|埔里|苑裡|玉里|萬里|八里|后里|大里|水里|佳里|富里/.test(vilMatch[1])) {
    villagePart = vilMatch[1];
  }

  let areaPart = "";
  const areaMatch = fullText.match(/(淡海新市鎮|副都心|高鐵特區|七期重劃區|七期豪宅區|逢甲商圈|一中商圈|西門町|信義計畫區|大直重劃區|內湖科學園區|南港軟體園區|藝文特區|青埔特區|中路特區|過嶺重劃區|美術館特區|農十六|亞灣區|澄清湖特區|水湳經貿園區|機捷特區)/);
  if (areaMatch && areaMatch[1]) {
    areaPart = areaMatch[1];
  }

  let communityPart = "";
  const commMatch =
    fullText.match(/「([一-龥]{2,10}(?:大樓|社區|大廈|華廈|國宅|新村|山莊|別墅|廣場|學苑|花園|帝寶|天下|世紀|世界|家園|新城))」/) ||
    fullText.match(/(西寧國宅|錦新大樓|南機場國宅|成功國宅|延平國宅|正義國宅|萬芳國宅|果貿國宅|城中城大樓|千越綠川大廈|亞洲廣場大樓|美麗華大樓|東星大樓|維冠金龍大樓)/);
  if (commMatch && commMatch[1] && !/某|該|一棟|住宅|社區大樓|公寓大樓|集合住宅|北市|新北|台中|高雄|桃園|台南|擬推|興建|推動|全台|全臺/.test(commMatch[1])) {
    communityPart = commMatch[1];
  }

  // Strictly require at least a specific road, community, or village (never create vague district-only stubs!)
  if (!roadPart && !communityPart && !villagePart) return null;

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

  // 9. Determine exact Incident Date (案發日期): check if article explicitly states an earlier historical incident date, otherwise use article publication date
  let trueIncidentDate = (article.date || new Date().toISOString().slice(0, 10)).replace(/\//g, "-").slice(0, 10);
  const mFullHist = fullText.match(/(19[789]\d|20[012]\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (mFullHist) {
    trueIncidentDate = `${mFullHist[1]}-${String(mFullHist[2]).padStart(2, "0")}-${String(mFullHist[3]).padStart(2, "0")}`;
  } else {
    const mYmHist = fullText.match(/(19[789]\d|20[012]\d)\s*年\s*(\d{1,2})\s*月/);
    if (mYmHist && mYmHist[1] < trueIncidentDate.slice(0, 4)) {
      trueIncidentDate = `${mYmHist[1]}-${String(mYmHist[2]).padStart(2, "0")}-15`;
    }
  }

  const cleanSnippet = (article.snippet || "").length >= 25
    ? article.snippet
    : `依據公開資料庫與${article.media}核實紀錄「${article.title}」，該處位於${matchedCity}${matchedDist}${roadPart || communityPart || ""}，於 ${trueIncidentDate} 發生非自然死亡事故。`;
  const reasonText = cleanSnippet.includes(article.title.slice(0, 8))
    ? cleanSnippet
    : `【${article.title}】${cleanSnippet}`;

  const [lat, lng] = getDistrictBaseCoords(matchedCity, matchedDist, `${roadPart}_${communityPart}_${article.title}`);
  const cleanSource = `${article.media}報導「${article.title}」`;

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
    auction_record: `案發日期核實：${trueIncidentDate}`,
    history_timeline: [
      {
        year: trueIncidentDate,
        stage: `${article.media}公開報導`,
        detail: `${article.title}（來源連結可點擊直接查閱原篇報導）`
      }
    ],
    __road: roadPart,
    __community: communityPart
  };
}

// Semantic Event Signature Generator to prevent duplicate cases across outlets
export function getSemanticCaseSignatures(record) {
  const sigs = [];
  const city = (record.city || "").replace(/台/g, "臺");
  const dist = (record.district || "").trim();
  const text = `${record.address || ""} ${record.reason || ""} ${record.source || ""}`.replace(/台/g, "臺");

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
    const normTitle = titleMatch[1].replace(/台/g, "臺").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 18);
    if (normTitle.length >= 7) {
      sigs.push(`headline:${normTitle}`);
    }
  }

  const cleanAddr = (record.doorplate_address || record.address || "")
    .replace(/台/g, "臺")
    .replace(/\s+/g, "")
    .replace(/（.*）/, "")
    .replace(/\(.*\)/, "");
  if (cleanAddr.length >= 6 && /\d+號/.test(cleanAddr)) {
    sigs.push(`door:${city}_${dist}_${cleanAddr}`);
  }

  // Road + Year-Month + Category signature
  const ym = (record.incident_date || "").slice(0, 7);
  const roadMatch = text.match(/([一-龥]{2,5}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
  if (roadMatch && ym.length === 7) {
    sigs.push(`road_ym:${city}_${dist}_${roadMatch[1]}_${ym}`);
  }

  // Surname + Age + District signature (e.g. 八德區_25歲_盧姓)
  const ageMatch = text.match(/(\d{1,2})\s*歲/);
  const surnameMatch = text.match(/([陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾連彭游詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜傅侯曹薛丁卓馬阮])\s*(?:姓|男|女|婦|翁|嫌)/);
  if (ageMatch && surnameMatch && dist) {
    sigs.push(`person:${city}_${dist}_${ageMatch[1]}_${surnameMatch[1]}`);
  }

  // Reason + address fingerprint so distinct streets in the same district never collide
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

// Extract canonical road/lane/building key for Similar Case Comparison & Consolidation (相似案件比對與整合)
export function extractConsolidationKey(r) {
  const city = String(r.city || "").replace(/台/g, "臺").trim();
  const dist = String(r.district || "").trim();
  let s = String(r.address || "").replace(/台/g, "臺");

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
  const roadLane = s.match(/([一-龥]{2,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)/);
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

// Smart Similar Case Consolidation Engine: Merges duplicate or same-road vague records into unified multi-source dossiers
export function consolidateSimilarRecords(records = []) {
  const groups = new Map();
  for (const r of records) {
    if (!r || !r.address) continue;
    const key = extractConsolidationKey(r);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const consolidated = [];
  for (const [key, items] of groups.entries()) {
    let lmMeta = null;
    for (const [lmName, meta] of Object.entries(LANDMARK_CANONICAL)) {
      if (key.endsWith(`_LM_${lmName}`)) {
        lmMeta = meta;
        break;
      }
    }

    const rawPool = [];
    for (const it of items) {
      if (Array.isArray(it.merged_cases) && it.merged_cases.length > 1) {
        for (const sub of it.merged_cases) {
          rawPool.push({
            ...it,
            id: sub.id || it.id,
            incident_date: sub.incident_date || it.incident_date,
            category: sub.category || it.category,
            address: sub.original_address || it.address,
            reason: sub.reason || it.reason,
            source: sub.source || it.source,
            source_url: sub.source_url || it.source_url,
            db_source: sub.db_source || it.db_source,
            merged_cases: undefined
          });
        }
      } else {
        rawPool.push(it);
      }
    }

    rawPool.sort((a, b) => {
      const aGeo = a.location_accuracy === "ROOFTOP_GEOCODED" ? 1 : 0;
      const bGeo = b.location_accuracy === "ROOFTOP_GEOCODED" ? 1 : 0;
      if (aGeo !== bGeo) return bGeo - aGeo;
      const aCurated = String(a.id || "").startsWith("tw-arch-") ? 1 : 0;
      const bCurated = String(b.id || "").startsWith("tw-arch-") ? 1 : 0;
      if (aCurated !== bCurated) return bCurated - aCurated;
      const aHasUrl = a.source_url && String(a.source_url).startsWith("http") ? 1 : 0;
      const bHasUrl = b.source_url && String(b.source_url).startsWith("http") ? 1 : 0;
      if (aHasUrl !== bHasUrl) return bHasUrl - aHasUrl;
      return String(b.incident_date || "").localeCompare(String(a.incident_date || ""));
    });

    const uniqueSub = [];
    const seenSubSig = new Set();
    for (const it of rawPool) {
      const cleanReason = String(it.reason || "")
        .replace(/^【[^】]+】/, "")
        .replace(/（同址／同路段整合紀錄[\s\S]*$/, "")
        .replace(/（系統已比對整合[\s\S]*$/, "")
        .replace(/\s+/g, "")
        .slice(0, 28);
      const subSig = `${it.incident_date}_${cleanReason}`;
      if (seenSubSig.has(subSig)) continue;
      seenSubSig.add(subSig);
      uniqueSub.push(it);
    }

    const geocodedMaster = items.find(i => i.location_accuracy === "ROOFTOP_GEOCODED") || uniqueSub[0];
    const primary = { ...uniqueSub[0] };
    const city = (lmMeta ? lmMeta.city : (primary.city || "")).replace(/台/g, "臺");
    const dist = lmMeta ? lmMeta.district : (primary.district || "");
    const bldgType = lmMeta
      ? lmMeta.building_type
      : (primary.building_type || (/透天/.test(primary.address) ? "透天厝住宅" : /公寓/.test(primary.address) ? "傳統公寓住宅" : /華廈/.test(primary.address) ? "電梯華廈" : /套房/.test(primary.address) ? "出租套房大樓" : "社區電梯大樓")).replace(/（.*）/, "");

    if (lmMeta) {
      primary.city = lmMeta.city;
      primary.district = lmMeta.district;
      primary.address = lmMeta.address;
      primary.doorplate_address = lmMeta.doorplate_address;
      primary.building_type = lmMeta.building_type;
      primary.lat = lmMeta.lat;
      primary.lng = lmMeta.lng;
      primary.location_accuracy = "ROOFTOP_GEOCODED";
    } else {
      if (geocodedMaster && geocodedMaster.lat && geocodedMaster.lng) {
        primary.lat = geocodedMaster.lat;
        primary.lng = geocodedMaster.lng;
        primary.location_accuracy = geocodedMaster.location_accuracy || "ROOFTOP_GEOCODED";
      }
      const roadPart = key.split("_").slice(2).join("_").replace(/_/g, "");
      let baseAddr = String(primary.address || "").replace(/台/g, "臺").replace(/某號/g, "");
      if (/附近|某/.test(baseAddr) || !baseAddr.includes("（")) {
        baseAddr = `${city}${dist}${roadPart}（${bldgType}）`;
      }
      primary.city = city;
      primary.address = baseAddr;
      primary.doorplate_address = baseAddr.replace(/（.*）|\(.*\)/g, "").trim();
      primary.building_type = bldgType;
    }

    if (uniqueSub.length > 1) {
      uniqueSub.sort((a, b) => String(b.incident_date || "").localeCompare(String(a.incident_date || "")));
      primary.incident_date = uniqueSub[0].incident_date || primary.incident_date;
      primary.merged_count = uniqueSub.length;
      primary.merged_cases = uniqueSub.map((u, idx) => ({
        case_index: idx + 1,
        id: u.id,
        incident_date: u.incident_date,
        category: u.category,
        original_address: String(u.address || "").replace(/某號/g, ""),
        reason: String(u.reason || "").replace(/（同址／同路段整合紀錄[\s\S]*$/, "").replace(/（系統已自動?比對整合[\s\S]*$/, "").trim().slice(0, 220),
        source: u.source || u.media_verification || "公開紀錄",
        source_url: u.source_url || "",
        db_source: u.db_source || "NEWS_PUBLIC_ARCHIVE"
      }));

      primary.history_timeline = uniqueSub.map(u => ({
        year: String(u.incident_date || "2024-06-15"),
        stage: u.source && String(u.source).length <= 28 ? u.source : (u.category || "案發與公開查證紀錄"),
        detail: String(u.reason || "").replace(/（同址／同路段整合紀錄[\s\S]*$/, "").replace(/（系統已自動?比對整合[\s\S]*$/, "").trim()
      }));

      const uniqueSources = Array.from(new Set(uniqueSub.map(u => u.source || u.media_verification).filter(Boolean)));
      primary.source = uniqueSources.slice(0, 3).join(" ； ");
      primary.media_verification = primary.source;
    } else {
      primary.merged_count = 1;
      primary.merged_cases = [{
        case_index: 1,
        id: primary.id,
        incident_date: primary.incident_date,
        category: primary.category,
        original_address: primary.address,
        reason: primary.reason,
        source: primary.source,
        source_url: primary.source_url || "",
        db_source: primary.db_source || "NEWS_PUBLIC_ARCHIVE"
      }];
    }

    consolidated.push(primary);
  }

  return consolidated;
}

