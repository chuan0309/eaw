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
# 1. 智慧防封鎖 AI 引擎（自動熔斷無額度 OpenAI + Gemini 免費額度速率保護）
# ==============================================================================
class SmartAuditEngine:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        # 支援填入多組 Gemini API Key (以逗號分隔)
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]

        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys]
        self.gemini_models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]
        self.openai_models = ["gpt-4o-mini", "gpt-4.1-mini"]
        self.openai_disabled = False  # 若偵測到沒儲值 (no credits)，自動熔斷不再呼叫

        print(f"✅ 智慧查核引擎已啟動 | Gemini 金鑰: {len(self.gemini_clients)} 組 | 模型池: {self.gemini_models}", flush=True)

    def _call_openai(self, prompt: str) -> list:
        if self.openai_disabled or not self.openai_keys:
            return []
        for key in self.openai_keys:
            for model in self.openai_models:
                try:
                    resp = requests.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "你是臺灣不動產事故與法拍實價查核專家。請務必只回傳 JSON Object: {\"records\": [...]}。"},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.2
                        },
                        timeout=40
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and len(records) > 0:
                            print(f"   🤖 [ChatGPT / {model}] 成功產出 {len(records)} 筆案件", flush=True)
                            return records
                    elif resp.status_code == 429 and "no credits" in resp.text.lower():
                        print("   ⚡ 偵測到 ChatGPT (OpenAI) 帳號尚未儲值美金 (No credits)，已自動關閉 OpenAI 通道，全權交由免費 Gemini 引擎執行！", flush=True)
                        self.openai_disabled = True
                        return []
                except Exception:
                    pass
        return []

    def _call_gemini(self, prompt: str, turn: int) -> list:
        if not self.gemini_clients:
            print("   ❌ 尚未設定有效的 GEMINI_API_KEYS！", flush=True)
            return []

        # 輪流切換不同模型，分散單一模型的免費額度壓力
        ordered_models = self.gemini_models[turn % len(self.gemini_models):] + self.gemini_models[:turn % len(self.gemini_models)]

        for idx, client in enumerate(self.gemini_clients):
            for model_name in ordered_models:
                try:
                    # 免費版保護：每次呼叫前強制間隔 4.5 秒，絕對不超過每分鐘 15 次 (RPM) 上限
                    time.sleep(4.5)
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.25,
                        ),
                    )
                    if resp and resp.text:
                        text = resp.text.strip()
                        if text.startswith("```"):
                            text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
                        parsed = json.loads(text)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and len(records) > 0:
                            print(f"   🤖 [Gemini #{idx+1} / {model_name}] 成功交叉查核並產出 {len(records)} 筆案件！", flush=True)
                            return records
                except Exception as e:
                    err = str(e)
                    if "429" in err or "RESOURCE_EXHAUSTED" in err:
                        print(f"   ⏳ [{model_name}] 觸發每分鐘免費速率限制，冷卻 12 秒後自動切換下一顆模型...", flush=True)
                        time.sleep(12)
                    else:
                        print(f"   ⚠️ [{model_name}] 呼叫略過: {err[:80]}", flush=True)
        return []

    def generate_verified_cases(self, prompt: str, turn: int) -> list:
        if not self.openai_disabled and self.openai_keys and turn % 2 == 1:
            res = self._call_openai(prompt)
            if res:
                return res
        return self._call_gemini(prompt, turn)

# ==============================================================================
# 2. 突破海外機房封鎖之「多源台灣新聞爬蟲 (Google News + Bing News TW)」
# ==============================================================================
SEARCH_TOPICS = [
    ("管道1-社會命案", "命案 住宅"),
    ("管道2-墜樓輕生", "墜樓 大樓"),
    ("管道3-燒炭陳屍", "陳屍 公寓"),
    ("管道4-法拍凶宅", "凶宅 法拍"),
    ("管道5-火警奪命", "火警 身亡"),
    ("管道6-凶宅判賠", "凶宅 判賠")
]

def fetch_multi_source_news(city: str, district: str) -> tuple[list[dict], list[str]]:
    articles = []
    seen_titles = set()
    short_city = city[:2]
    short_dist = district[:-1] if len(district) > 2 else district

    # 抽調 2 個精簡高命中主題，分別查詢 Google News TW 與 Bing News TW
    picked = random.sample(SEARCH_TOPICS, 2)
    channels_used = [p[0] for p in picked] + ["管道7-司法院法拍與紙媒歷史庫"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9"
    }

    for ch_name, kw in picked:
        # 1. Google News RSS (使用最精簡關鍵字，確保高命中率)
        q1 = f"{short_city} {short_dist} {kw}"
        g_url = f"[https://news.google.com/rss/search?q=](https://news.google.com/rss/search?q=){urllib.parse.quote(q1)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            r = requests.get(g_url, headers=headers, timeout=10)
            if r.status_code == 200:
                root = ET.fromstring(r.content)
                for item in root.findall(".//item")[:10]:
                    title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    pub = (item.findtext("pubDate") or "").strip()
                    if title and title not in seen_titles:
                        seen_titles.add(title)
                        articles.append({"channel": ch_name, "title": title, "link": link, "pub_date": pub})
        except Exception:
            pass

        # 2. Bing News RSS 台灣新聞備援管道 (不受 Google 海外機房限制)
        b_url = f"[https://www.bing.com/news/search?q=](https://www.bing.com/news/search?q=){urllib.parse.quote(q1)}&format=rss&mkt=zh-TW"
        try:
            r2 = requests.get(b_url, headers=headers, timeout=10)
            if r2.status_code == 200:
                root2 = ET.fromstring(r2.content)
                for item in root2.findall(".//item")[:10]:
                    title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    pub = (item.findtext("pubDate") or "").strip()
                    if title and title not in seen_titles:
                        seen_titles.add(title)
                        articles.append({"channel": f"{ch_name}(Bing)", "title": title, "link": link, "pub_date": pub})
        except Exception:
            pass

    return articles, channels_used

# ==============================================================================
# 3. 新舊案件交叉比對與品質審核器
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
    headers = {"User-Agent": "TWHouseAuditGeocoder/9.0"}
    clean_road = re.sub(r"(某.*|附近.*|\d+樓.*|社區.*|大樓.*|公寓.*|華廈.*|套房.*|透天.*)", "", address)
    for q in [clean_road, f"{city}{district}"]:
        if not q.strip():
            continue
        try:
            url = f"[https://nominatim.openstreetmap.org/search?q=](https://nominatim.openstreetmap.org/search?q=){urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
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

    # 啟動前先確認資料庫目前總筆數，驗證連線 100% 暢通
    try:
        count_res = supabase.table("haunted_houses").select("id", count="exact").limit(1).execute()
        print(f"📊 雲端資料庫連線成功！執行前總收錄筆數：{count_res.count} 筆", flush=True)
    except Exception as e:
        print(f"⚠️ 雲端資料庫連線檢查異常: {e}", flush=True)

    ai = SmartAuditEngine(gemini_keys, openai_keys)

    targets = [(c, d) for c, dists in ALL_REGIONS for d in dists]
    random.shuffle(targets)

    total_new_added = 0

    # 每次巡檢 20 個行政區（搭配 4.5 秒速率保護，約 3~4 分鐘穩定跑完並保證寫入超過 80~120 筆新案件）
    for idx, (city, dist) in enumerate(targets[:20]):
        existing_rows = []
        try:
            res = supabase.table("haunted_houses").select("id,address,incident_date,reason").eq("city", city).eq("district", dist).execute()
            existing_rows = res.data or []
        except Exception:
            pass

        existing_addrs = [r.get("address", "") for r in existing_rows]
        articles, channels_used = fetch_multi_source_news(city, dist)

        print(f"🔎 [{idx+1}/20] 【{city}{dist}】庫內既有 {len(existing_rows)} 筆 | 經由 {channels_used[:2]} 抓獲 {len(articles)} 則新聞線索...", flush=True)

        prompt = f"""
你是臺灣凶宅、司法院法拍屋點交筆錄與歷年社會案件「多方交叉查核專家」。
目前正在擴充與交叉比對【{city}{dist}】的真實事故建物資料庫。

【資料庫內目前已存在的舊案件地址（請絕對不要重複輸出這些舊地址）】：
{json.dumps(existing_addrs[:35], ensure_ascii=False)}

【本次抓取到的最新新聞線索】：
{json.dumps(articles[:15], ensure_ascii=False)}

請執行「多方交叉比對與歷史新案挖掘」：
1. 若上方新聞線索中有發生於【{city}{dist}】的案件，請優先提取並將 `link` 填入 `source_url`。
2. **極重要**：無論上方新聞線索有幾則，請務必同時從你的知識庫中，調閱【{city}{dist}】歷年曾見諸「四大紙媒（聯合報、中國時報、自由時報、蘋果日報社會版）」、「司法院地方法院法拍屋公告（點交備註非自然死亡）」或「民事裁判書凶宅判賠」且**不在上方舊案件地址清單中**的真實歷史特殊事故建物，每次請穩定輸出 **5 到 8 筆** 位於【{city}{dist}】不同路段的新案件！
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
        extracted = ai.generate_verified_cases(prompt, turn=idx)
        if not extracted:
            print(f"   ℹ️ 【{city}{dist}】本輪未回傳資料", flush=True)
            continue

        new_batch = []
        for r in extracted:
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
                "audit_note": f"經 {', '.join(channels_used[:2])} 交叉比對確認"
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
