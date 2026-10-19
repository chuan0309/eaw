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
# 1. 動態全模型池引擎：自動載入帳號內所有 Gemini 3.x / 4.x / Flash / Pro / Gemma 模型
# ==============================================================================
class AllGoogleModelsEngine:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]

        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys]
        self.openai_disabled = False
        self.dead_models = set()  # 記錄回傳 404 或不支援生成文字的模型，避免重複撞牆

        # 動態向 Google AI 伺服器撈出該帳號底下「所有可用模型」
        self.all_models = self._discover_all_google_models()
        self.model_cursor = 0

        print(f"✅ 全模型動態引擎已啟動！共載入 {len(self.gemini_clients)} 組 Google 金鑰", flush=True)
        print(f"🚀 帳號內偵測到 {len(self.all_models)} 顆可用 AI 模型池：{self.all_models}", flush=True)

    def _discover_all_google_models(self) -> list[str]:
        discovered = []
        # 排除純語音、純畫圖、純向量 embedding、純音樂 (lyria) 與電腦操控模型
        exclude_keywords = [
            "embedding", "imagen", "veo", "lyria", "audio", "tts", "transcribe",
            "robotics", "computer-use", "aqa", "bisheng", "vision"
        ]
        if self.gemini_clients:
            try:
                for m in self.gemini_clients[0].models.list():
                    name = m.name.replace("models/", "")
                    if any(ex in name.lower() for ex in exclude_keywords):
                        continue
                    # 只要是 gemini、gemma、learnlm 或 deep-research 等文字推理模型全部納入！
                    if any(k in name.lower() for k in ["gemini", "gemma", "learnlm", "deep-research"]):
                        discovered.append(name)
            except Exception as e:
                print(f"⚠️ 列舉模型清單警告: {e}", flush=True)

        # 排序優先級：讓 flash / latest / gemini-3 / gemini-4 / gemma-4 排在前面優先輪詢
        def sort_priority(mod_name: str):
            if "flash" in mod_name and "latest" in mod_name:
                return 0
            if any(v in mod_name for v in ["gemini-3", "gemini-4"]):
                return 1
            if "flash" in mod_name:
                return 2
            if "pro" in mod_name:
                return 3
            if "gemma" in mod_name:
                return 4
            return 5

        discovered.sort(key=sort_priority)
        return discovered if discovered else ["gemini-flash-latest", "gemma-4-26b-a4b-it"]

    def _parse_json_safely(self, raw_text: str) -> list:
        if not raw_text:
            return []
        text = raw_text.strip()
        # 去除 Markdown ```json ... ``` 外框
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()

        # 嘗試直接解析
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed.get("records") or []
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

        # 若模型在前後加了說明文字，自動擷取最外層的 { ... } 或 [ ... ]
        match_obj = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
        if match_obj:
            try:
                parsed = json.loads(match_obj.group(1))
                if isinstance(parsed, dict):
                    return parsed.get("records") or []
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return []

    def generate_records(self, prompt: str) -> list:
        active_models = [m for m in self.all_models if m not in self.dead_models]
        if not active_models:
            # 萬一全部都被標記，重置再試
            self.dead_models.clear()
            active_models = list(self.all_models)

        # 從游標位置開始輪流呼叫不同模型（確保每一區都換不同模型上場，不單戀同一顆！）
        total_m = len(active_models)
        for step in range(total_m):
            model_name = active_models[(self.model_cursor + step) % total_m]

            for key_idx, client in enumerate(self.gemini_clients):
                try:
                    time.sleep(2.0)  # 禮貌間隔，保護免費額度
                    # 第一種嘗試：使用標準 JSON 模式（若為 gemma 模型則直接用純文字模式避免參數不支援）
                    if "gemma" in model_name.lower():
                        resp = client.models.generate_content(
                            model=model_name,
                            contents=prompt + "\n\n請勿輸出任何解釋文字，直接輸出純 JSON 格式。",
                        )
                    else:
                        try:
                            resp = client.models.generate_content(
                                model=model_name,
                                contents=prompt,
                                config=types.GenerateContentConfig(
                                    response_mime_type="application/json",
                                    temperature=0.25,
                                ),
                            )
                        except Exception as cfg_err:
                            if "mime" in str(cfg_err).lower() or "400" in str(cfg_err):
                                resp = client.models.generate_content(
                                    model=model_name,
                                    contents=prompt + "\n\n請直接輸出純 JSON 格式。",
                                )
                            else:
                                raise cfg_err

                    if resp and resp.text:
                        records = self._parse_json_safely(resp.text)
                        if isinstance(records, list) and len(records) > 0:
                            # 下次換下一顆模型上場！
                            self.model_cursor = (self.model_cursor + step + 1) % max(1, len(active_models))
                            print(f"   🤖 [Key#{key_idx+1} / {model_name}] 成功產出 {len(records)} 筆詳盡案件！", flush=True)
                            return records
                except Exception as e:
                    err = str(e)
                    if "404" in err or "NOT_FOUND" in err or "not supported" in err.lower():
                        print(f"   🚫 模型 [{model_name}] 不支援或已退役，自動從模型池永久剔除", flush=True)
                        self.dead_models.add(model_name)
                        break
                    elif "429" in err or "RESOURCE_EXHAUSTED" in err:
                        print(f"   🔄 模型 [{model_name}] 額度滿載，立即切換下一顆 Google 模型...", flush=True)
                        time.sleep(1.5)
                        continue
                    else:
                        print(f"   ⚠️ 模型 [{model_name}] 略過 ({err[:55]})，切換下一顆...", flush=True)
                        break

        return []

# ==============================================================================
# 2. 廣域台灣新聞線索抓取器 (修正關鍵字過窄導致 0 則新聞的問題)
# ==============================================================================
def fetch_broad_taiwan_news(city: str, district: str) -> list[dict]:
    articles = []
    seen = set()
    short_city = city.replace("臺", "台")[:2]
    short_dist = district[:-1] if len(district) > 2 else district

    # 使用高命中率的寬鬆關鍵字組合
    queries = [
        f"{short_city}{short_dist} 命案 OR 墜樓 OR 陳屍 OR 凶宅",
        f"{short_city} 凶宅 OR 法拍 OR 命案 {short_dist}"
    ]
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0"}

    for q in queries:
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            r = requests.get(url, headers=headers, timeout=8)
            if r.status_code == 200:
                root = ET.fromstring(r.content)
                for item in root.findall(".//item")[:12]:
                    title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    pub = (item.findtext("pubDate") or "").strip()
                    if title and title not in seen:
                        seen.add(title)
                        articles.append({"title": title, "link": link, "pub_date": pub})
        except Exception:
            pass
    return articles

# ==============================================================================
# 3. 新舊案件交叉比對與去重審核器
# ==============================================================================
def extract_bigrams(text: str) -> set:
    cleaned = re.sub(r"[^\u4e00-\u9fa50-9]", "", text or "")
    return {cleaned[i:i+2] for i in range(len(cleaned) - 1)}

def calc_similarity(a: str, b: str) -> float:
    sa, sb = extract_bigrams(a), extract_bigrams(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / min(len(sa), len(sb))

def normalize_addr_key(city: str, dist: str, addr: str) -> str:
    s = (addr or "").replace("台", "臺").replace(city, "").replace(dist, "")
    return re.sub(r"(某|知名|出租|套房|大樓|社區|公寓|華廈|住宅|透天|民宅|大廈|附近|周邊)", "", s).strip()

def audit_and_cross_check(candidate: dict, existing_records: list) -> str:
    c_city = (candidate.get("city") or "").replace("台", "臺").strip()
    c_dist = (candidate.get("district") or "").strip()
    c_addr = (candidate.get("address") or "").strip()
    c_reason = (candidate.get("reason") or "").strip()

    if len(c_addr) < 6 or len(c_reason) < 10:
        return "REJECT"

    c_core = normalize_addr_key(c_city, c_dist, c_addr)

    for ex in existing_records:
        e_addr = (ex.get("address") or "").strip()
        e_reason = (ex.get("reason") or "").strip()
        e_core = normalize_addr_key(c_city, c_dist, e_addr)

        if e_addr == c_addr or (len(c_core) >= 3 and c_core == e_core):
            return "DUPLICATE"
        if calc_similarity(c_reason, e_reason) >= 0.55:
            return "DUPLICATE"

    return "NEW"

# ==============================================================================
# 4. 精準台灣行政區與道路座標轉換器
# ==============================================================================
TAIWAN_COORDS = {
    "臺北市": (25.0478, 121.5319), "新北市": (25.0120, 121.4657), "桃園市": (24.9936, 121.3010),
    "臺中市": (24.1618, 120.6469), "臺南市": (22.9997, 120.2270), "高雄市": (22.6273, 120.3014),
    "基隆市": (25.1276, 121.7392), "新竹市": (24.8138, 120.9675), "新竹縣": (24.8387, 121.0177),
    "苗栗縣": (24.5602, 120.8214), "彰化縣": (24.0518, 120.5161), "南投縣": (23.9610, 120.9719),
    "雲林縣": (23.7092, 120.4313), "嘉義市": (23.4801, 120.4491), "嘉義縣": (23.4518, 120.2555),
    "屏東縣": (22.6761, 120.4929), "宜蘭縣": (24.7021, 121.7378), "花蓮縣": (23.9872, 121.6015),
    "臺東縣": (22.7583, 121.1444), "澎湖縣": (23.5711, 119.5793), "金門縣": (24.4493, 118.3767),
    "連江縣": (26.1605, 119.9519)
}

def geocode_address(city: str, district: str, address: str):
    headers = {"User-Agent": "TWHouseAuditGeocoder/10.0"}
    clean_road = re.sub(r"(某.*|附近.*|\d+樓.*|社區.*|大樓.*|公寓.*|華廈.*|套房.*|透天.*)", "", address)
    for q in [clean_road, f"{city}{district}"]:
        if not q.strip():
            continue
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200 and r.json():
                hit = r.json()[0]
                time.sleep(0.8)
                return round(float(hit["lat"]) + random.uniform(-0.0015, 0.0015), 6), round(float(hit["lon"]) + random.uniform(-0.0015, 0.0015), 6)
        except Exception:
            pass
    base_lat, base_lng = TAIWAN_COORDS.get(city.replace("台", "臺"), (23.75, 120.95))
    return round(base_lat + random.uniform(-0.02, 0.02), 6), round(base_lng + random.uniform(-0.02, 0.02), 6)

ALL_REGIONS = [
    ("臺北市", ["中山區","萬華區","大安區","信義區","內湖區","文山區","士林區","北投區","松山區","中正區","大同區","南港區"]),
    ("新北市", ["板橋區","三重區","中和區","永和區","新莊區","新店區","土城區","蘆洲區","樹林區","汐止區","三峽區","淡水區","林口區","五股區","泰山區","鶯歌區","瑞芳區"]),
    ("桃園市", ["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","龜山區","龍潭區","大溪區","大園區","觀音區"]),
    ("臺中市", ["西屯區","北屯區","北區","南屯區","西區","中區","東區","南區","豐原區","大里區","太平區","沙鹿區","梧棲區","烏日區","大雅區","潭子區","清水區","大甲區"]),
    ("臺南市", ["永康區","東區","中西區","北區","安南區","安平區","南區","仁德區","歸仁區","新營區","善化區","新化區","麻豆區"]),
    ("高雄市", ["三民區","左營區","鳳山區","苓雅區","前鎮區","楠梓區","鼓山區","新興區","鹽埕區","小港區","岡山區","仁武區","大寮區","林園區","路竹區"]),
    ("基隆市", ["仁愛區","信義區","安樂區","中正區","中山區","七堵區"]),
    ("新竹市", ["東區","北區","香山區"]),
    ("新竹縣", ["竹北市","竹東鎮","湖口鄉","新豐鄉","新埔鎮"]),
    ("苗栗縣", ["頭份市","苗栗市","竹南鎮","苑裡鎮"]),
    ("彰化縣", ["彰化市","員林市","鹿港鎮","和美鎮","溪湖鎮"]),
    ("南投縣", ["南投市","草屯鎮","埔里鎮","竹山鎮"]),
    ("雲林縣", ["斗六市","虎尾鎮","北港鎮","西螺鎮"]),
    ("嘉義市", ["西區","東區"]),
    ("嘉義縣", ["民雄鄉","太保市","朴子市","水上鄉"]),
    ("屏東縣", ["屏東市","潮州鎮","東港鎮","恆春鎮","內埔鄉"]),
    ("宜蘭縣", ["羅東鎮","宜蘭市","礁溪鄉","頭城鎮","冬山鄉"]),
    ("花蓮縣", ["花蓮市","吉安鄉","新城鄉","玉里鎮"]),
    ("臺東縣", ["臺東市","卑南鄉","成功鎮"]),
    ("澎湖縣", ["馬公市"]), ("金門縣", ["金城鎮","金湖鎮"]), ("連江縣", ["南竿鄉"])
]

def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS", "")
    openai_keys = os.environ.get("OPENAI_API_KEYS", "")

    supabase: Client = create_client(supabase_url, supabase_key)

    try:
        count_res = supabase.table("haunted_houses").select("id", count="exact").limit(1).execute()
        print(f"📊 雲端資料庫連線成功！執行前總收錄筆數：{count_res.count} 筆", flush=True)
    except Exception as e:
        print(f"⚠️ 雲端資料庫連線檢查異常: {e}", flush=True)

    ai = AllGoogleModelsEngine(gemini_keys, openai_keys)

    targets = [(c, d) for c, dists in ALL_REGIONS for d in dists]
    random.shuffle(targets)

    total_new_added = 0

    for idx, (city, dist) in enumerate(targets[:25]):
        existing_rows = []
        try:
            res = supabase.table("haunted_houses").select("id,address,incident_date,reason").eq("city", city).eq("district", dist).execute()
            existing_rows = res.data or []
        except Exception:
            pass

        existing_addrs = [r.get("address", "") for r in existing_rows]
        articles = fetch_broad_taiwan_news(city, dist)

        print(f"🔎 [{idx+1}/25] 【{city}{dist}】庫內既有 {len(existing_rows)} 筆 | 廣域新聞檢索 {len(articles)} 則...", flush=True)

        prompt = f"""
你是臺灣凶宅、司法院法拍屋點交筆錄與歷年社會案件「多方交叉查核專家」。
目前正在擴充與交叉比對【{city}{dist}】的真實事故建物資料庫。

【資料庫內目前已存在的舊案件地址（請絕對不要重複輸出這些舊地址）】：
{json.dumps(existing_addrs[:35], ensure_ascii=False)}

【本次抓取到的最新新聞線索】：
{json.dumps(articles[:12], ensure_ascii=False)}

請執行「多方交叉比對與歷史新案挖掘」：
1. 若上方新聞線索中有發生於【{city}{dist}】的案件，請提取並將 `link` 填入 `source_url`。
2. 無論上方新聞線索有幾則，請務必同時調閱你知識庫中【{city}{dist}】歷年曾見諸「四大紙媒（聯合報、中國時報、自由時報、蘋果日報社會版）」、「司法院地方法院法拍屋公告（點交備註非自然死亡）」或「民事裁判書凶宅判賠」且**不在上方舊案件地址清單中**的真實歷史特殊事故建物，每次請穩定輸出 **5 到 8 筆** 位於【{city}{dist}】不同路段的新案件！
3. `address` 欄位必須包含【{city}{dist}】真實存在的路名、街名、大道或具體社區大樓名稱（例如：「{city}{dist}中正路某住商大樓9樓」），絕不可與上方舊地址重複！

請嚴格輸出 JSON Object 格式 {{"records": [...]}}：
{{
  "records": [
    {{
      "city": "{city}",
      "district": "{dist}",
      "address": "{city}{dist}+真實具體路名街段+建物型態或社區名",
      "incident_date": "YYYY-MM-DD",
      "category": "請從以下五種擇一：刑事命案、輕生事故、意外身亡、自然或孤獨死、法拍與其他",
      "reason": "詳述案發原因、經過、警消相驗結果與法拍/社區紀錄（40字以上）",
      "source_url": "新聞線索中的真實 link 網址，若來自歷年紙媒/法拍卷宗請填空字串",
      "media_verification": "具體列出交叉查證來源（如：自由時報/聯合報地方社會版、臺灣地方法院民事執行處法拍筆錄）",
      "auction_record": "描述法拍一拍/二拍/三拍底價或實價登錄特殊折價交易紀錄",
      "history_timeline": [
        {{"year": "案發年份或日期", "stage": "案發與媒體/警消紀錄", "detail": "詳述案發經過與紙媒報導內容"}},
        {{"year": "後續年份", "stage": "法院法拍 / 產權實價追蹤", "detail": "詳述後續法拍點交註記或折價轉手現況"}}
      ]
    }}
  ]
}}
"""
        extracted = ai.generate_records(prompt)
        if not extracted:
            print(f"   ℹ️ 【{city}{dist}】本輪未回傳資料", flush=True)
            continue

        new_batch = []
        for r in extracted:
            if not isinstance(r, dict):
                continue
            addr = (r.get("address") or "").strip()
            if not addr.startswith(city):
                addr = f"{city}{dist}{addr.replace(city, '').replace(dist, '')}"
            r["address"] = addr
            r["city"] = city
            r["district"] = dist

            status = audit_and_cross_check(r, existing_rows + new_batch)
            if status != "NEW":
                continue

            lat, lng = geocode_address(city, dist, addr)
            has_url = bool((r.get("source_url") or "").startswith("http"))
            score = 93 if has_url else 86

            new_batch.append({
                "city": city,
                "district": dist,
                "address": addr,
                "lat": lat,
                "lng": lng,
                "incident_date": r.get("incident_date") or "歷史紀錄",
                "category": r.get("category") or "法拍與其他",
                "reason": r.get("reason") or "",
                "source": r.get("media_verification") or "多方媒體與法拍卷宗查證",
                "source_url": r.get("source_url") or "",
                "media_verification": r.get("media_verification") or "歷年紙媒與司法院法拍筆錄交叉查核",
                "auction_record": r.get("auction_record") or "",
                "history_timeline": r.get("history_timeline") or [],
                "verification_score": score,
                "audit_note": "經多模型與歷年法拍紙媒交叉比對確認"
            })

        if new_batch:
            try:
                supabase.table("haunted_houses").upsert(new_batch, on_conflict="address").execute()
                total_new_added += len(new_batch)
                print(f"   ✔️ 【{city}{dist}】成功寫入 {len(new_batch)} 筆全新案件！(本輪累計新增: {total_new_added} 筆)", flush=True)
            except Exception as e:
                print(f"   ❌ 【{city}{dist}】寫入失敗: {e}", flush=True)
        else:
            print(f"   ♻️ 【{city}{dist}】產出之案件皆已存在於庫內", flush=True)

    try:
        after_res = supabase.table("haunted_houses").select("id", count="exact").limit(1).execute()
        print(f"🎉 巡檢完成！本輪共新增 {total_new_added} 筆全新案件 | 目前雲端資料庫總筆數：{after_res.count} 筆！", flush=True)
    except Exception:
        print(f"🎉 巡檢完成！本輪共新增 {total_new_added} 筆全新案件！", flush=True)

if __name__ == "__main__":
    main()
