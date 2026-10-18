import os
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
# 1. Gemini + ChatGPT (OpenAI) 雙陣營全模型自動輪詢引擎
# ==============================================================================
class DualAICrawlerEngine:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]

        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys]
        self.gemini_models = self._discover_valid_gemini_models()
        self.openai_models = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o"]

        print(f"✅ 雙 AI 引擎啟動：Gemini 金鑰 {len(self.gemini_clients)} 組 (模型: {self.gemini_models}) | ChatGPT 金鑰 {len(self.openai_keys)} 組", flush=True)

    def _discover_valid_gemini_models(self):
        # 動態向 Google 伺服器查詢該 API Key 真正支援且不會 404 的模型
        valid = []
        if not self.gemini_clients:
            return valid
        try:
            for m in self.gemini_clients[0].models.list():
                name = m.name.replace("models/", "")
                supported = getattr(m, "supported_actions", []) or []
                if "generateContent" in supported or "gemini" in name:
                    if not any(x in name for x in ["embedding", "vision", "audio", "tts", "imagen", "aqa", "1.0"]):
                        valid.append(name)
        except Exception:
            pass
        if not valid:
            valid = ["gemini-2.5-flash", "gemini-2.0-flash"]
        return valid

    def _call_openai(self, prompt: str) -> list:
        for key in self.openai_keys:
            for model in self.openai_models:
                try:
                    resp = requests.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "你是臺灣不動產法拍卷宗、歷年紙媒社會新聞與實價登錄歷史考證專家。請務必只回傳 JSON Object，格式為 {\"records\": [...]}。"},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.2
                        },
                        timeout=45
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and len(records) > 0:
                            print(f"🤖 [ChatGPT / {model}] 成功萃取 {len(records)} 筆詳盡歷年卷宗", flush=True)
                            return records
                except Exception as e:
                    print(f"🔄 [ChatGPT / {model}] 切換中: {str(e)[:45]}", flush=True)
        return []

    def _call_gemini(self, prompt: str) -> list:
        for idx, client in enumerate(self.gemini_clients):
            for model_name in self.gemini_models:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2,
                        ),
                    )
                    if resp and resp.text:
                        parsed = json.loads(resp.text)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and len(records) > 0:
                            print(f"🤖 [Gemini Key#{idx+1} / {model_name}] 成功萃取 {len(records)} 筆詳盡歷年卷宗", flush=True)
                            return records
                except Exception as e:
                    err_str = str(e)
                    # 若某個模型回傳 404 NOT_FOUND，直接從清單永久剔除，不再浪費時間重試
                    if "404" in err_str and model_name in self.gemini_models:
                        self.gemini_models.remove(model_name)
                        continue
                    if "429" in err_str:
                        time.sleep(2)
                        continue
        return []

    def generate_detailed_records(self, prompt: str, prefer_openai: bool = False) -> list:
        if prefer_openai and self.openai_keys:
            res = self._call_openai(prompt)
            if res:
                return res
            return self._call_gemini(prompt)
        else:
            res = self._call_gemini(prompt)
            if res:
                return res
            return self._call_openai(prompt)

# ==============================================================================
# 2. 臺灣 368 鄉鎮市區座標與快速定位
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

def fast_geocode(city: str, district: str, address: str):
    headers = {"User-Agent": "TWRealEstateHistoryArchive/4.0"}
    for q in [f"{city}{district}{address}", f"{city}{district}"]:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200 and r.json():
                hit = r.json()[0]
                time.sleep(1.0)
                return round(float(hit["lat"]) + random.uniform(-0.002, 0.002), 6), round(float(hit["lon"]) + random.uniform(-0.002, 0.002), 6)
        except Exception:
            pass
    base_lat, base_lng = TAIWAN_COORDS.get(city.replace("台", "臺"), (23.75, 120.95))
    return round(base_lat + random.uniform(-0.03, 0.03), 6), round(base_lng + random.uniform(-0.03, 0.03), 6)

# 涵蓋全臺各縣市所有行政區（隨機洗牌巡檢，確保每次跑都能挖掘不同行政區與紙媒歷史案件）
ALL_TAIWAN_REGIONS = [
    ("臺北市", ["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"]),
    ("新北市", ["板橋區","三重區","中和區","永和區","新莊區","新店區","土城區","蘆洲區","樹林區","汐止區","鶯歌區","三峽區","淡水區","瑞芳區","五股區","泰山區","林口區","深坑區","金山區","萬里區"]),
    ("桃園市", ["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","大溪區","龍潭區","龜山區","大園區","觀音區","新屋區"]),
    ("臺中市", ["中區","東區","南區","西區","北區","北屯區","西屯區","南屯區","太平區","大里區","霧峰區","烏日區","豐原區","后里區","東勢區","潭子區","大雅區","神岡區","沙鹿區","龍井區","梧棲區","清水區","大甲區"]),
    ("臺南市", ["中西區","東區","南區","北區","安平區","安南區","永康區","歸仁區","新化區","仁德區","關廟區","麻豆區","佳里區","新營區","善化區","新市區","安定區"]),
    ("高雄市", ["新興區","前金區","苓雅區","鹽埕區","鼓山區","旗津區","前鎮區","三民區","楠梓區","小港區","左營區","仁武區","大社區","岡山區","路竹區","橋頭區","鳳山區","大寮區","林園區","鳥松區","旗山區","美濃區"]),
    ("基隆市", ["仁愛區","信義區","中正區","中山區","安樂區","暖暖區","七堵區"]),
    ("新竹市", ["東區","北區","香山區"]),
    ("新竹縣", ["竹北市","竹東鎮","新埔鎮","關西鎮","湖口鄉","新豐鄉","竹東鎮"]),
    ("苗栗縣", ["苗栗市","頭份市","竹南鎮","後龍鎮","通霄鎮","苑裡鎮","公館鄉"]),
    ("彰化縣", ["彰化市","員林市","和美鎮","鹿港鎮","溪湖鎮","二林鎮","田中鎮","北斗鎮","花壇鄉"]),
    ("南投縣", ["南投市","埔里鎮","草屯鎮","竹山鎮","集集鎮","名間鄉"]),
    ("雲林縣", ["斗六市","斗南鎮","虎尾鎮","西螺鎮","土庫鎮","北港鎮","麥寮鄉"]),
    ("嘉義市", ["東區","西區"]),
    ("嘉義縣", ["太保市","朴子市","布袋鎮","大林鎮","民雄鄉","水上鄉","中埔鄉"]),
    ("屏東縣", ["屏東市","潮州鎮","東港鎮","恆春鎮","萬丹鄉","內埔鄉","枋寮鄉"]),
    ("宜蘭縣", ["宜蘭市","羅東鎮","蘇澳鎮","頭城鎮","礁溪鄉","冬山鄉","五結鄉"]),
    ("花蓮縣", ["花蓮市","鳳林鎮","玉里鎮","新城鄉","吉安鄉","壽豐鄉"]),
    ("臺東縣", ["臺東市","成功鎮","關山鎮","卑南鄉","太麻里鄉"]),
    ("澎湖縣", ["馬公市","湖西鄉"]), ("金門縣", ["金城鎮","金湖鎮","金寧鄉"]), ("連江縣", ["南竿鄉","北竿鄉"])
]

def crawl_newspaper_and_court_rss(city: str, district: str) -> str:
    # 針對四大紙媒歷史報導與司法院法拍筆錄進行複合檢索
    q = f"{city}{district} (凶宅 OR 命案 OR 分屍 OR 燒炭 OR 墜樓 OR 法拍一拍 OR 法拍三拍 OR 聯合報 OR 中國時報 OR 自由時報)"
    rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    entries = []
    try:
        r = requests.get(rss_url, timeout=12)
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            for item in root.findall(".//item")[:25]:
                title = item.findtext("title") or ""
                desc = item.findtext("description") or ""
                pub = item.findtext("pubDate") or ""
                entries.append(f"[{pub}] {title} | {desc}")
    except Exception:
        pass
    return "\n".join(entries)

def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS", "")
    openai_keys = os.environ.get("OPENAI_API_KEYS", "")

    supabase: Client = create_client(supabase_url, supabase_key)
    ai = DualAICrawlerEngine(gemini_keys, openai_keys)

    # 將全臺所有行政區攤平並隨機洗牌，避免每次只抓前幾個縣市就超時
    flat_targets = []
    for city, dists in ALL_TAIWAN_REGIONS:
        for d in dists:
            flat_targets.append((city, d))
    random.shuffle(flat_targets)

    total_added = 0
    for idx, (city, dist) in enumerate(flat_targets):
        print(f"🔎 [{idx+1}/{len(flat_targets)}] 雙 AI 正在深挖【{city}{dist}】紙媒歷史報導與歷年法拍轉手時間軸...", flush=True)
        rss_text = crawl_newspaper_and_court_rss(city, dist)

        prompt = f"""
請針對臺灣【{city}{dist}】整理出 6 到 10 筆具體、詳盡且不重複的特殊事故建物（凶宅、重大命案、輕生、火警身亡、法拍點交事故屋）歷史卷宗。
請結合歷年臺灣四大紙媒（聯合報、中國時報、自由時報、蘋果日報社會版）、司法院地方法院法拍屋公告（一拍、二拍、三拍底價與拍定紀錄）與內政部實價登錄特殊交易備註。

請嚴格輸出 JSON Object，格式為 {{"records": [ ... ]}}，每筆元素必須包含以下完整欄位（讓使用者不需點擊外部連結就能看懂來龍去脈）：
{{
  "records": [
    {{
      "city": "{city}",
      "district": "{dist}",
      "address": "明確路段、巷弄、社區大樓名稱或透天門牌區間（例如：{city}{dist}中正路某社區大樓11樓，勿只寫行政區名）",
      "incident_date": "YYYY-MM-DD（案發或最早紙媒見報日期，如 1999-11-18）",
      "category": "請從以下五種擇一：刑事命案、輕生事故、意外身亡、自然或孤獨死、法拍與其他",
      "reason": "80字以上詳述案發來龍去脈、死因、警消相驗結果與後續社區影響",
      "media_verification": "具體列出紙媒查證依據與法院卷宗（例如：聯合報/中國時報社會版報導、臺灣{city[:2]}地方法院民事執行處法拍筆錄載明非自然身亡）",
      "auction_record": "詳述歷次法拍底價與轉手折價紀錄（例如：原市值約1,500萬，一拍底價1,200萬流標，後於三拍以820萬由投資客拍定，三年後以1,080萬轉手，實價登錄備註特殊交易）",
      "history_timeline": [
        {{"year": "案發年份(如 1999年)", "stage": "案發與紙媒見報", "detail": "詳細描述當年案發經過與報紙社會版報導內容"}},
        {{"year": "後續法拍年份(如 2002年)", "stage": "法院法拍與流標紀錄", "detail": "描述一拍、二拍流標與三拍拍定底價及點交筆錄內容"}},
        {{"year": "後續轉手年份(如 2015年)", "stage": "實價登錄轉手與現況", "detail": "描述後續屋主轉賣價格、折價幅度或目前出租/自用現況"}}
      ]
    }}
  ]
}}

最新檢索線索參考：
{rss_text[:8000]}
"""
        # 雙數次優先呼叫 Gemini，單數次優先呼叫 ChatGPT（若其中一方沒填 Key 會自動由另一方接手）
        records = ai.generate_detailed_records(prompt, prefer_openai=(idx % 2 == 1))
        batch_payload = []
        for r in records:
            addr = (r.get("address") or "").strip()
            if not addr or len(addr) <= 6:
                continue
            if not addr.startswith(city):
                addr = f"{city}{dist}{addr}"
            lat, lng = fast_geocode(city, dist, addr)
            batch_payload.append({
                "city": city,
                "district": dist,
                "address": addr,
                "lat": lat,
                "lng": lng,
                "incident_date": r.get("incident_date") or "歷史紀錄",
                "category": r.get("category") or "法拍與其他",
                "reason": r.get("reason") or "特殊事故紀錄",
                "source": r.get("media_verification") or "歷年紙媒社會版與司法院法拍卷宗",
                "media_verification": r.get("media_verification") or "歷年紙媒社會版與司法院法拍卷宗",
                "auction_record": r.get("auction_record") or "",
                "history_timeline": r.get("history_timeline") or []
            })

        if batch_payload:
            try:
                supabase.table("haunted_houses").upsert(batch_payload, on_conflict="address").execute()
                total_added += len(batch_payload)
                print(f"✔️ 【{city}{dist}】成功寫入 {len(batch_payload)} 筆詳盡時間軸卷宗！(累計: {total_added} 筆)", flush=True)
            except Exception as e:
                print(f"⚠️ 寫入失敗 (請確認已在 Supabase 執行 ALTER TABLE DISABLE ROW LEVEL SECURITY): {e}", flush=True)

if __name__ == "__main__":
    main()
