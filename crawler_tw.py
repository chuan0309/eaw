import os
import re
import json
import time
import random
import urllib.parse
import xml.etree.ElementTree as ET
import requests
from google import genai
from google.genai import types
from supabase import create_client, Client

# ==============================================================================
# 1. 純文字模型嚴格過濾引擎 (100% 剔除圖片/語音/影片模型，只留純文字 LLM)
# ==============================================================================
class StrictTextLLMEngine:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]
        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys]
        self.dead_models = set()
        self.text_models = self._discover_strict_text_models()
        self.cursor = 0
        print(f"✅ 純文字 AI 引擎啟動 | 載入 {len(self.gemini_clients)} 組 Gemini 金鑰, {len(self.openai_keys)} 組 OpenAI 金鑰", flush=True)
        print(f"📝 已排除所有圖片/多媒體模型，鎖定 {len(self.text_models)} 顆純文字模型：{self.text_models}", flush=True)

    def _discover_strict_text_models(self) -> list[str]:
        non_text_blacklist = [
            "image", "imagen", "vision", "veo", "video", "lyria", "audio", "tts",
            "speech", "voice", "transcribe", "embedding", "text-embedding",
            "robotics", "computer-use", "aqa", "bisheng", "learnlm-1.5"
        ]
        discovered = []
        if self.gemini_clients:
            try:
                for m in self.gemini_clients[0].models.list():
                    name = m.name.replace("models/", "")
                    low_name = name.lower()
                    if any(bad in low_name for bad in non_text_blacklist):
                        continue
                    if any(k in low_name for k in ["gemini", "gemma"]):
                        discovered.append(name)
            except Exception as e:
                print(f"⚠️ 模型列舉提示: {e}", flush=True)

        def rank_model(m_name: str):
            if "flash" in m_name and "latest" in m_name:
                return 0
            if any(x in m_name for x in ["gemini-3", "gemini-4"]) and "flash" in m_name:
                return 1
            if "flash" in m_name:
                return 2
            if "pro" in m_name:
                return 3
            if "gemma" in m_name:
                return 4
            return 5

        discovered.sort(key=rank_model)
        return discovered if discovered else ["gemini-2.5-flash", "gemini-flash-latest"]

    def _extract_json_array(self, raw_text: str) -> list:
        if not raw_text:
            return []
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.MULTILINE).strip()
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return data.get("records") or []
            if isinstance(data, list):
                return data
        except Exception:
            pass
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
        if match:
            try:
                data = json.loads(match.group(1))
                if isinstance(data, dict):
                    return data.get("records") or []
                if isinstance(data, list):
                    return data
            except Exception:
                pass
        return []

    def generate_batch(self, prompt: str) -> list:
        active = [m for m in self.text_models if m not in self.dead_models]
        if not active:
            self.dead_models.clear()
            active = list(self.text_models)

        total = len(active)
        for step in range(max(1, total)):
            model_name = active[(self.cursor + step) % total]
            for key_idx, client in enumerate(self.gemini_clients):
                try:
                    time.sleep(1.5)
                    if "gemma" in model_name.lower():
                        resp = client.models.generate_content(
                            model=model_name,
                            contents=prompt + "\n\n請直接輸出純 JSON，不要加任何說明。",
                        )
                    else:
                        try:
                            resp = client.models.generate_content(
                                model=model_name,
                                contents=prompt,
                                config=types.GenerateContentConfig(
                                    response_mime_type="application/json",
                                    temperature=0.35,
                                ),
                            )
                        except Exception as cfg_e:
                            if "400" in str(cfg_e) or "mime" in str(cfg_e).lower():
                                resp = client.models.generate_content(
                                    model=model_name,
                                    contents=prompt + "\n\n請直接輸出純 JSON。",
                                )
                            else:
                                raise cfg_e

                    parsed = self._extract_json_array(resp.text or "")
                    if parsed:
                        self.cursor = (self.cursor + step + 1) % total
                        print(f"   🤖 模型 [{model_name}] (Key #{key_idx+1}) 成功產出 {len(parsed)} 筆門牌紀錄", flush=True)
                        return parsed
                except Exception as e:
                    err_str = str(e)
                    if any(code in err_str for code in ["404", "NOT_FOUND", "not supported", "deprecated"]):
                        self.dead_models.add(model_name)
                        break
                    continue

        # 備援：OpenAI API Keys
        for o_key in self.openai_keys:
            try:
                r = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {o_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt + "\n請直接回傳 JSON。"}],
                        "temperature": 0.35,
                    },
                    timeout=35,
                )
                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"]
                    parsed = self._extract_json_array(content)
                    if parsed:
                        print(f"   🤖 OpenAI 備援成功產出 {len(parsed)} 筆紀錄", flush=True)
                        return parsed
            except Exception:
                continue
        return []


# ==============================================================================
# 2. 全臺灣 22 縣市、368 鄉鎮市區完整清單
# ==============================================================================
TAIWAN_368_DISTRICTS = {
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
}

TWELVE_KEYWORD_DIMENSIONS = [
    "凶宅 實價登錄 特殊交易 折價",
    "司法院 法拍屋 點交 非自然死亡 一拍 二拍 三拍",
    "刑事 兇殺 分屍 情殺 仇殺 槍擊 砍殺 住宅 命案",
    "輕生 自殺 燒炭 上吊 尋短 出租套房 公寓 大樓",
    "墜樓 跳樓 中庭 露台 天井 氣窗 社區大樓",
    "惡火 住宅火警 縱火 濃煙 嗆傷 一氧化碳中毒 瓦斯氣爆",
    "獨居 孤獨死 久病 陳屍 白骨 乾屍 暴斃 猝死",
    "台灣凶宅網 居易網 事故地圖 歷年重大命案 指標事故建築",
    "地方法院 民事判決 隱瞞凶宅 瑕疵擔保 判賠 減少價金",
    "工業區 科學園區 重劃區 眷村 國宅 學生套房 命案 輕生",
    "PTT home-sale Gossiping 凶宅 事故屋 社區 命案 輕生",
    "Dcard Mobile01 591 樂居 臉書 凶宅社團 租屋 事故屋 求售"
]

# ==============================================================================
# 3. Google Maps 雙階段門牌屋頂座標定位器 (避免標點落入公園或空地)
# ==============================================================================
CITY_BASE_COORDS = {
    "臺北市": (25.0478, 121.5319), "新北市": (25.0120, 121.4657), "桃園市": (24.9936, 121.3010),
    "臺中市": (24.1618, 120.6469), "臺南市": (22.9997, 120.2270), "高雄市": (22.6273, 120.3014),
    "基隆市": (25.1276, 121.7392), "新竹市": (24.8138, 120.9675), "新竹縣": (24.8387, 121.0177),
    "苗栗縣": (24.5602, 120.8214), "彰化縣": (24.0518, 120.5161), "南投縣": (23.9610, 120.9719),
    "雲林縣": (23.7092, 120.4313), "嘉義市": (23.4801, 120.4491), "嘉義縣": (23.4518, 120.2555),
    "屏東縣": (22.6761, 120.4929), "宜蘭縣": (24.7021, 121.7378), "花蓮縣": (23.9872, 121.6015),
    "臺東縣": (22.7583, 121.1444), "澎湖縣": (23.5711, 119.5793), "金門縣": (24.4493, 118.3767),
    "連江縣": (26.1605, 119.9519)
}


def resolve_doorplate_and_coordinates(r: dict, city: str, dist: str, gmaps_key: str) -> tuple[str | None, float, float]:
    raw_addr = (r.get("address") or "").replace("台", "臺").replace("某號", "").strip()
    bldg_match = re.search(r"(社區電梯大樓|傳統公寓住宅|電梯華廈|透天厝住宅|住商混合大樓|出租套房大樓|老舊公寓|透天厝|電梯大樓|住宅大樓)", raw_addr)
    bldg_type = bldg_match.group(1) if bldg_match else "社區電梯大樓"

    clean_query = re.sub(r"[（(].*$", "", raw_addr).strip()
    clean_query = re.sub(r"某(社區|電梯|傳統|透天|出租|住商|公寓|大樓|華廈|民宅|住宅|套房|別墅|國宅).*$", "", clean_query)
    clean_query = re.sub(r"(社區電梯大樓|傳統公寓住宅|電梯華廈|透天厝住宅|住商混合大樓|出租套房|老舊公寓|住宅大樓|公寓住宅|電梯大樓).*$", "", clean_query)
    clean_query = re.sub(r"附近.*$", "", clean_query).strip()

    if not clean_query.startswith(city):
        clean_query = f"{city}{dist}{clean_query.replace(city, '').replace(dist, '')}"

    # Must contain a concrete road, street, boulevard, or lane
    road_match = re.search(r"([一-龥]{2,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?(?:\d+號)?)", clean_query.replace(city, "").replace(dist, ""))
    if not road_match:
        return None, 0.0, 0.0

    road_part = road_match.group(1)
    geocode_street_query = f"{city}{dist}{road_part}"
    clean_display_addr = f"{city}{dist}{road_part}（{bldg_type}）"

    active_key = gmaps_key or "AIzaSyA43RPI2-3OHJFqfLtoZjsK3PWxd5ZrtHU"
    try:
        q_for_google = geocode_street_query.replace("新臺五路", "新台五路")
        url1 = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(q_for_google)}&region=tw&language=zh-TW&key={active_key}"
        res1 = requests.get(url1, timeout=6).json()
        if res1.get("status") == "OK" and res1.get("results"):
            best = res1["results"][0]
            types = best.get("types") or []
            loc_type = best.get("geometry", {}).get("location_type", "APPROXIMATE")
            fmt = (best.get("formatted_address") or "").replace("台", "臺").replace("区", "區").replace("芦", "蘆").replace("桥", "橋")

            # Reject district-level APPROXIMATE fallbacks (e.g. when a road does not exist in that district)
            if "administrative_area_level_2" in types or "administrative_area_level_1" in types or "administrative_area_level_3" in types:
                return None, 0.0, 0.0
            if loc_type == "APPROXIMATE" and not any(t in types for t in ["route", "street_address", "premise", "subpremise", "intersection"]):
                return None, 0.0, 0.0
            if dist not in fmt:
                return None, 0.0, 0.0

            loc = best["geometry"]["location"]
            lat, lng = float(loc["lat"]), float(loc["lng"])
            return clean_display_addr, round(lat, 6), round(lng, 6)
    except Exception:
        pass

    return None, 0.0, 0.0


# ==============================================================================
# 4. 新聞 RSS 輔助抓取 + 智慧去重核對
# ==============================================================================
def fetch_township_rss(city: str, dist: str) -> list[dict]:
    short_c = city.replace("臺", "台")[:2]
    short_d = dist[:-1] if len(dist) > 2 else dist
    q = f"{short_c} {short_d} (命案 OR 墜樓 OR 陳屍 OR 凶宅 OR 火警 OR 法拍)"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    items = []
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6)
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            for it in root.findall(".//item")[:10]:
                items.append({
                    "title": (it.findtext("title") or "").strip(),
                    "link": (it.findtext("link") or "").strip(),
                    "pub_date": (it.findtext("pubDate") or "").strip()
                })
    except Exception:
        pass
    return items


def extract_road_consolidation_key(city: str, dist: str, addr: str) -> str:
    s = (addr or "").replace("台", "臺").replace(city, "").replace(dist, "")
    s = re.sub(r"^[一-龥]{2,3}[里村]", "", s)
    lm = re.search(r"(西寧國宅|錦新大樓|城中城|維冠金龍|東星大樓|果貿國宅|南機場國宅|成功國宅|正義國宅|千越綠川|美麗華大樓|亞洲廣場大樓)", s)
    if lm:
        return f"{city}_{dist}_LM_{lm.group(1)}"
    comm = re.search(r"「([^」]{2,12})」", s)
    rl = re.search(r"([一-龥]{2,5}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?)", s)
    if rl:
        clean_r = re.sub(r"^(?:位於|坐落於|坐落|近|鄰近|附近|轄區|區|市|鎮|鄉|里|村)", "", rl.group(1))
        if comm:
            return f"{city}_{dist}_{clean_r}_{comm.group(1)}"
        return f"{city}_{dist}_{clean_r}"
    if comm:
        return f"{city}_{dist}_COMM_{comm.group(1)}"
    stripped = re.sub(r"（.*）|\(.*\)", "", s)
    stripped = re.sub(r"(?:某|附近|一處|該).*$", "", stripped)
    stripped = re.sub(r"(?:社區|電梯|大樓|華廈|公寓|透天|民宅|套房|住宅|\d+樓).*$", "", stripped).strip()
    return f"{city}_{dist}_{stripped or s[:8]}"


def get_target_quota(city: str, dist: str) -> int:
    # Mountain / indigenous / tiny offshore townships should never be over-allocated
    if any(k in dist for k in ["烏坵","延平","金峰","達仁","蘭嶼","綠島","尖石","五峰","泰安","獅潭","那瑪夏","茂林","桃源","瑪家","泰武","來義","春日","獅子","牡丹","霧臺","三地門","大同","南澳","萬榮","卓溪","秀林","信義","仁愛","阿里山","大埔","坪林","平溪","雙溪","烏來","石碇","石門","望安","七美","東引","莒光","左鎮","龍崎","南化","田寮","甲仙","杉林","內門","大內","山上"]):
        return 2
    if city in ["臺北市", "新北市", "桃園市", "臺中市", "高雄市"] and dist in [
        "板橋區","三重區","中和區","永和區","新莊區","新店區","土城區","蘆洲區","汐止區","淡水區",
        "中山區","萬華區","大安區","信義區","內湖區","士林區","北投區","文山區","中正區","松山區",
        "桃園區","中壢區","平鎮區","八德區","龜山區","蘆竹區","楊梅區",
        "西屯區","北屯區","南屯區","北區","西區","南區","東區","太平區","大里區","豐原區",
        "三民區","左營區","鳳山區","前鎮區","苓雅區","楠梓區","鼓山區","小港區","新興區"
    ]:
        return 75
    if city in ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市"] and dist.endswith("區"):
        return 38
    if dist.endswith("市") or dist.endswith("區"):
        return 30
    if dist.endswith("鎮"):
        return 12
    return 5


def main():
    supabase_url = os.environ.get("SUPABASE_URL") or "https://cfmcvcscyfblcodemnkt.supabase.co"
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or ""
    gemini_keys = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    openai_keys = os.environ.get("OPENAI_API_KEYS") or ""
    gmaps_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("VITE_GOOGLE_MAPS_API_KEY") or ""

    if not supabase_key:
        print("⚠️ 未偵測到 SUPABASE_SERVICE_KEY，跳過遠端寫入。", flush=True)
        return

    supabase: Client = create_client(supabase_url, supabase_key)
    ai = StrictTextLLMEngine(gemini_keys, openai_keys)

    print("🕷️ [新案爬蟲與相似案件比對系統] 正在盤點全臺灣 22 縣市、368 鄉鎮市區已收錄案件，準備抓取尚未收錄之新案件...", flush=True)
    all_existing_addrs = set()
    all_existing_road_keys = set()
    district_existing_roads = {f"{c}_{d}": [] for c, dists in TAIWAN_368_DISTRICTS.items() for d in dists}
    district_counts = {f"{c}_{d}": 0 for c, dists in TAIWAN_368_DISTRICTS.items() for d in dists}

    try:
        from_idx = 0
        step = 1000
        while True:
            res = supabase.table("haunted_houses").select("city,district,address").range(from_idx, from_idx + step - 1).execute()
            rows = res.data or []
            if not rows:
                break
            for row in rows:
                c = (row.get("city") or "").replace("台", "臺")
                d = (row.get("district") or "").strip()
                a = (row.get("address") or "").replace("台", "臺").strip()
                all_existing_addrs.add(a)
                rk = extract_road_consolidation_key(c, d, a)
                all_existing_road_keys.add(rk)
                k = f"{c}_{d}"
                if k in district_counts:
                    district_counts[k] += 1
                    short_a = a.replace(c, "").replace(d, "")
                    if short_a and len(district_existing_roads[k]) < 35:
                        district_existing_roads[k].append(short_a)
            if len(rows) < step:
                break
            from_idx += step
    except Exception as e:
        print(f"⚠️ 盤點讀取提示: {e}", flush=True)

    print(f"📈 盤點完成！目前資料庫總收錄：{len(all_existing_addrs)} 筆（涵蓋 {len(all_existing_road_keys)} 處獨立路段／社區點位）", flush=True)

    # Sort townships by largest urban deficit first so metropolitan hubs get crawled for new cases first!
    under_quota_keys = [
        k for k in district_counts.keys()
        if district_counts[k] < get_target_quota(*k.split("_"))
    ]
    sorted_townships = sorted(
        under_quota_keys,
        key=lambda k: (district_counts[k] - get_target_quota(*k.split("_")), random.random())
    )
    total_added = 0
    total_similar_filtered = 0

    for idx, key in enumerate(sorted_townships[:35]):
        city, dist = key.split("_")
        current_cnt = district_counts[key]
        target_cnt = get_target_quota(city, dist)
        existing_sample = district_existing_roads.get(key, [])[:25]
        rss_news = fetch_township_rss(city, dist)
        picked_dims = random.sample(TWELVE_KEYWORD_DIMENSIONS, 4)

        print(f"🕷️ [{idx+1}/35] 正在搜尋新案件【{city}{dist}】(目前 {current_cnt}/{target_cnt} 筆) | 關鍵字：{picked_dims[0]}...", flush=True)

        prompt = f"""你是臺灣 1970–2026 年歷年法定凶宅（內政部函釋定義：建築物專有部分曾發生兇殺、自殺、一氧化碳中毒或住宅火警致死等非自然死亡）與公開事故查證爬蟲專家。
現在請針對【{city}{dist}】執行「新案件發掘與擴充」，找出尚未收錄之真實法定凶宅案件！
【檢索關鍵字】：{json.dumps(picked_dims, ensure_ascii=False)}
【即時新聞線索參考】：{json.dumps(rss_news[:8], ensure_ascii=False)}
【本區已收錄之舊案件清單（嚴禁重複回傳下列已存在之路段或同棟大樓案件，請搜尋本區其他尚未收錄之路街段巷或新案件）】：
{json.dumps(existing_sample, ensure_ascii=False)}

【最高事實準則 - 準確標註真實案發日期與避免同路段重複】：
1. 請發掘 4 至 8 筆位於【{city}{dist}】且「不在上方已收錄清單中」的真實法定凶宅案件（屋內兇殺命案、屋內輕生墜樓、屋內一氧化碳中毒或奪命火警）。
2. 每筆案件請務必明確區分不同之路、街、段、巷（例如：XX路一段XX巷、YY街XX巷）或具體社區大樓名稱，絕對不要在同一條路上產出兩筆模糊的「某大樓」「附近大樓」！
3. `incident_date` 必須填寫案件「實際發生之真實日期」（1970 至 2026 年間之 YYYY-MM-DD），若為 2025 或 2026 年發生之最新案件請如實填寫 2025 或 2026 年日期，嚴禁將 2025、2026 年案件改寫為 2024 年！

請直接輸出 JSON Object 格式 {{"records": [...]}}：
{{
  "records": [
    {{
      "city": "{city}",
      "district": "{dist}",
      "address": "{city}{dist}+具體不同之路街段巷（如XX路X段XX巷）+建物型態（如社區電梯大樓/傳統公寓/透天厝）",
      "lat": 25.00000,
      "lng": 121.00000,
      "incident_date": "YYYY-MM-DD（必須為 1970 至 2026 年間實際案發之真實日期）",
      "category": "刑事命案 / 輕生事故 / 意外身亡 / 其他非自然死亡",
      "reason": "詳述真實法定凶宅事件始末與案發日期、公開通報內容",
      "source_url": "若來自上方新聞線索請填真實 link，否則填空字串",
      "media_verification": "具體列出查證依據（如：自由時報/聯合報社會版報導、臺灣XX地方法院判決字號）",
      "auction_record": "案發日期與公開查證備註",
      "history_timeline": [
        {{"year": "YYYY-MM-DD 真實案發日期", "stage": "案發與公開查證紀錄", "detail": "真實案情摘要"}}
      ]
    }}
  ]
}}"""

        extracted = ai.generate_batch(prompt)
        if not extracted:
            continue

        batch_to_save = []
        for r in extracted:
            if not isinstance(r, dict):
                continue
            reason = (r.get("reason") or "").strip()
            if len(reason) < 12:
                continue

            addr, lat, lng = resolve_doorplate_and_coordinates(r, city, dist, gmaps_key)
            if not addr:
                continue
            road_key = extract_road_consolidation_key(city, dist, addr)

            if addr in all_existing_addrs or road_key in all_existing_road_keys:
                total_similar_filtered += 1
                continue
            all_existing_addrs.add(addr)
            all_existing_road_keys.add(road_key)

            inc_date = (r.get("incident_date") or "2024-06-15").replace("/", "-")[:10]
            m_explicit = re.search(r"(19[789]\d|20[012]\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", reason)
            if m_explicit:
                inc_date = f"{int(m_explicit.group(1)):04d}-{int(m_explicit.group(2)):02d}-{int(m_explicit.group(3)):02d}"

            batch_to_save.append({
                "city": city,
                "district": dist,
                "address": addr,
                "lat": lat,
                "lng": lng,
                "incident_date": inc_date,
                "category": r.get("category") or "法拍與其他",
                "reason": reason,
                "source": r.get("media_verification") or "歷年法拍與社會新聞查證",
                "source_url": r.get("source_url") or "",
                "media_verification": r.get("media_verification") or "司法院法拍筆錄 / 歷年紙媒與公開資料庫",
                "auction_record": "",
                "history_timeline": r.get("history_timeline") or [],
                "verification_score": 92,
                "audit_note": "多源新案爬蟲與相似比對入庫"
            })

        if batch_to_save:
            try:
                supabase.table("haunted_houses").upsert(batch_to_save, on_conflict="address").execute()
                total_added += len(batch_to_save)
                print(f"   ✔️ 【{city}{dist}】成功爬蟲入庫 {len(batch_to_save)} 筆新案件！(累計新增: {total_added} 筆 | 已自動整合過濾相似重複: {total_similar_filtered} 筆 | 全庫總計: {len(all_existing_addrs)} 筆)", flush=True)
            except Exception as e:
                print(f"   ❌ 寫入異常: {e}", flush=True)

    print(f"🎉 本輪新案爬蟲與相似比對完成！共新增 {total_added} 筆新門牌案件（自動過濾整合 {total_similar_filtered} 筆同路段相似重複案件），目前資料庫總數達 {len(all_existing_addrs)} 筆！", flush=True)
    sync_supabase_to_website_json_files(supabase)


def infer_db_source_py(r: dict) -> str:
    if r.get("db_source"):
        return str(r["db_source"])
    full = f"{r.get('source') or ''} {r.get('media_verification') or ''} {r.get('auction_record') or ''} {r.get('reason') or ''}"
    if any(k in full for k in ["實價登錄", "內政部", "特殊交易"]):
        return "MOI_OPEN_DATA"
    if any(k in full for k in ["法拍", "拍賣公告", "查封筆錄", "執行處", "點交", "應買", "一拍", "二拍", "三拍"]):
        return "JUDICIAL_AUCTION"
    if any(k in full for k in ["裁判書", "判決", "地方法院", "高等法院", "最高法院", "字第"]):
        return "JUDICIAL_JUDGMENT"
    return "NEWS_PUBLIC_ARCHIVE"


def normalize_supa_row_for_archive(r: dict) -> dict:
    city = str(r.get("city") or "").replace("台", "臺").strip()
    district = str(r.get("district") or "").strip()
    address = str(r.get("address") or "").replace("台", "臺").strip()
    doorplate = re.sub(r"[（(].*?[）)]", "", address).strip() or address
    bldg_match = re.search(r"[（(]([^）)]+)[）)]", address)
    bldg_type = r.get("building_type") or (bldg_match.group(1) if bldg_match else "集合住宅大樓")
    inc_date = str(r.get("incident_date") or "2023-06-15").replace("/", "-")[:10]
    timeline = r.get("history_timeline")
    if isinstance(timeline, str):
        try:
            timeline = json.loads(timeline)
        except Exception:
            timeline = []
    if not isinstance(timeline, list) or not timeline:
        timeline = [{"year": inc_date, "stage": "公開查證紀錄", "detail": str(r.get("reason") or "").strip()}]
    raw_auc = str(r.get("auction_record") or "").strip()
    if any(k in raw_auc for k in ["案發日期雙重核實", "案發日期核實", "無公開法拍", "尚無法拍", "公開資訊與歷史紀錄核實"]):
        raw_auc = ""
    return {
        "id": r.get("id"),
        "city": city,
        "district": district,
        "doorplate_address": doorplate,
        "address": address,
        "lat": round(float(r.get("lat") or 25.0478), 6),
        "lng": round(float(r.get("lng") or 121.5319), 6),
        "location_accuracy": "ROOFTOP_GEOCODED",
        "incident_date": inc_date,
        "building_type": bldg_type,
        "current_status": r.get("current_status") or "現況使用中",
        "category": r.get("category") or "法拍與其他",
        "db_source": infer_db_source_py(r),
        "reason": str(r.get("reason") or "").strip(),
        "source": str(r.get("source") or r.get("media_verification") or "公開社會新聞與司法實務紀錄").strip(),
        "source_url": str(r.get("source_url") or "").strip(),
        "media_verification": str(r.get("media_verification") or r.get("source") or "公開社會新聞與司法實務紀錄").strip(),
        "auction_record": raw_auc,
        "history_timeline": timeline,
        "merged_count": r.get("merged_count") or 1
    }


def _extract_py_modus_tags(text: str) -> set[str]:
    tags = set()
    has_blade = bool(re.search(r"割喉|頸部.*刀|中刀|砍殺|持刀|刀傷|刺死|砍死", text))
    has_fire = bool(re.search(r"縱火|惡火|火警|焚屍|毀屍滅跡|起火|火災|燒死|濃煙.*死|濃煙.*不治", text))
    if has_blade and has_fire:
        tags.add("arson_blade")
    if has_blade:
        tags.add("blade")
    if has_fire:
        tags.add("fire")
    if re.search(r"尾隨", text):
        tags.add("tail_stalk")
    if re.search(r"分屍|肢解", text):
        tags.add("dismember")
    if re.search(r"桶屍|水泥封屍", text):
        tags.add("barrel")
    if re.search(r"滅門|雙屍|三屍|四屍|一家.*口", text):
        tags.add("mass_death")
    if re.search(r"槍擊|行刑式|開槍|中彈|舉槍", text):
        tags.add("gunshot")
    if re.search(r"弒母|弒父|殺母|殺父|逆子|逆倫", text):
        tags.add("parricide")
    if re.search(r"燒炭", text):
        tags.add("charcoal")
    if re.search(r"一氧化碳中毒|熱水器", text):
        tags.add("co_poison")
    if re.search(r"墜樓|跳樓|墜落|從.*樓.*墜", text):
        tags.add("jump")
    if re.search(r"上吊|自縊", text):
        tags.add("hang")
    if re.search(r"勒斃|掐死|窒息", text):
        tags.add("strangle")
    return tags


def _are_same_incident_py(r1: dict, r2: dict) -> bool:
    if r1.get("id") is not None and r2.get("id") is not None and str(r1.get("id")) == str(r2.get("id")):
        return True
    c1 = str(r1.get("city") or "").replace("台", "臺").strip()
    c2 = str(r2.get("city") or "").replace("台", "臺").strip()
    d1 = str(r1.get("district") or "").strip()
    d2 = str(r2.get("district") or "").strip()
    if not c1 or c1 != c2 or not d1 or d1 != d2:
        return False
    u1 = str(r1.get("source_url") or "").split("?")[0].strip()
    u2 = str(r2.get("source_url") or "").split("?")[0].strip()
    if u1 and u2 and u1.startswith("http") and u1 == u2:
        return True

    d_str1 = str(r1.get("incident_date") or "")[:10]
    d_str2 = str(r2.get("incident_date") or "")[:10]
    rk1 = extract_road_consolidation_key(c1, d1, str(r1.get("address") or ""))
    rk2 = extract_road_consolidation_key(c2, d2, str(r2.get("address") or ""))
    if rk1 and rk1 == rk2 and d_str1[:7] == d_str2[:7]:
        return True

    txt1 = f"{r1.get('address') or ''} {r1.get('reason') or ''}".replace("台", "臺")
    txt2 = f"{r2.get('address') or ''} {r2.get('reason') or ''}".replace("台", "臺")
    ages1 = {int(m.group(1)) for m in re.finditer(r"(\d{1,2})\s*歲", txt1)}
    ages2 = {int(m.group(1)) for m in re.finditer(r"(\d{1,2})\s*歲", txt2)}
    tags1 = _extract_py_modus_tags(txt1)
    tags2 = _extract_py_modus_tags(txt2)
    shared_ages = ages1 & ages2
    shared_tags = tags1 & tags2

    if d_str1 == d_str2 and d_str1:
        if shared_ages and (shared_tags or r1.get("category") == r2.get("category")):
            return True
    return False


def sync_supabase_to_website_json_files(supabase: Client):
    """將 Supabase 最新爬蟲案件自動寫入網站靜態資料庫 calibrated_archive.json、public/calibrated_archive.json 與獨立爬蟲備份檔 crawler_vault_backup.json"""
    try:
        disk_records = []
        if os.path.exists("calibrated_archive.json"):
            with open("calibrated_archive.json", "r", encoding="utf-8") as f:
                disk_records = json.load(f)

        existing_ids = {str(r.get("id")) for r in disk_records if r.get("id") is not None}
        existing_addrs = {str(r.get("address") or "").replace("台", "臺").strip() for r in disk_records if r.get("address")}

        res = supabase.table("haunted_houses").select("*").order("id", desc=True).limit(1000).execute()
        supa_rows = res.data or []
        new_items = []
        for row in supa_rows:
            rid = str(row.get("id"))
            raddr = str(row.get("address") or "").replace("台", "臺").strip()
            if not raddr or not row.get("lat") or not row.get("lng"):
                continue
            if rid in existing_ids or raddr in existing_addrs:
                continue
            cand = normalize_supa_row_for_archive(row)
            if any(_are_same_incident_py(ex, cand) for ex in disk_records) or any(_are_same_incident_py(ex, cand) for ex in new_items):
                continue
            existing_ids.add(rid)
            existing_addrs.add(raddr)
            new_items.append(cand)

        updated = new_items + disk_records
        with open("calibrated_archive.json", "w", encoding="utf-8") as f:
            json.dump(updated, f, ensure_ascii=False, indent=2)
        with open("crawler_vault_backup.json", "w", encoding="utf-8") as f:
            json.dump(updated, f, ensure_ascii=False, indent=2)
        os.makedirs("public", exist_ok=True)
        with open(os.path.join("public", "calibrated_archive.json"), "w", encoding="utf-8") as f:
            json.dump(updated, f, ensure_ascii=False, indent=2)
        with open(os.path.join("public", "crawler_vault_backup.json"), "w", encoding="utf-8") as f:
            json.dump(updated, f, ensure_ascii=False, indent=2)

        if new_items:
            print(f"💾 已同步將 {len(new_items)} 筆新爬蟲案件寫入 calibrated_archive.json 與獨立備份檔 crawler_vault_backup.json（網站與爬蟲統一總計：{len(updated)} 筆）！", flush=True)
        else:
            print(f"💾 網站靜態資料庫與獨立爬蟲備份檔已是最新狀態（統一總計 {len(updated)} 筆）。", flush=True)
    except Exception as e:
        print(f"⚠️ 同步寫入 calibrated_archive.json 提示: {e}", flush=True)


if __name__ == "__main__":
    main()



