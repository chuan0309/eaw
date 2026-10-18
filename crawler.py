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
# 1. 嚴格白名單之 Gemini + ChatGPT (OpenAI) 雙引擎
# ==============================================================================
class DualAICrawlerEngine:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]

        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys]
        # 嚴格白名單：只使用支援 JSON Structured Output 的正式 Gemini 模型，絕不呼叫 lyria/gemma/robotics
        self.gemini_models = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ]
        self.openai_models = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"]

        print(f"✅ 雙 AI 審查爬蟲啟動：Gemini 金鑰 {len(self.gemini_clients)} 組 | ChatGPT 金鑰 {len(self.openai_keys)} 組", flush=True)

    def _call_openai(self, prompt: str) -> list:
        for key in self.openai_keys:
            for model in self.openai_models:
                try:
                    resp = requests.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "你是臺灣不動產事故與社會新聞事實查核官。嚴禁編造「某出租套房」、「某知名社區」等無路名之空泛資料，且同一案件絕對不可拆成多筆輸出。請回傳 JSON Object: {\"records\": [...]}。"},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.1
                        },
                        timeout=45
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and records:
                            print(f"🤖 [ChatGPT / {model}] 萃取並完成同案合併共 {len(records)} 筆", flush=True)
                            return records
                except Exception:
                    pass
        return []

    def _call_gemini(self, prompt: str) -> list:
        for idx, client in enumerate(self.gemini_clients):
            for model_name in list(self.gemini_models):
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1,
                        ),
                    )
                    if resp and resp.text:
                        parsed = json.loads(resp.text)
                        records = parsed.get("records") if isinstance(parsed, dict) else parsed
                        if isinstance(records, list) and records:
                            print(f"🤖 [Gemini Key#{idx+1} / {model_name}] 萃取並完成同案合併共 {len(records)} 筆", flush=True)
                            return records
                except Exception as e:
                    err_str = str(e)
                    if "404" in err_str and model_name in self.gemini_models:
                        self.gemini_models.remove(model_name)
                    elif "429" in err_str:
                        time.sleep(1.5)
        return []

    def extract_and_verify(self, prompt: str, prefer_openai: bool = False) -> list:
        if prefer_openai and self.openai_keys:
            return self._call_openai(prompt) or self._call_gemini(prompt)
        return self._call_gemini(prompt) or self._call_openai(prompt)

# ==============================================================================
# 2. 後端自我審查與「同案重複稽核比對器」
# ==============================================================================
def extract_bigrams(text: str) -> set:
    cleaned = re.sub(r"[^\u4e00-\u9fa50-9]", "", text or "")
    return {cleaned[i:i+2] for i in range(len(cleaned) - 1)}

def text_similarity(a: str, b: str) -> float:
    sa, sb = extract_bigrams(a), extract_bigrams(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / min(len(sa), len(sb))

def normalize_addr_core(city: str, dist: str, addr: str) -> str:
    s = (addr or "").replace("台", "臺").replace(city, "").replace(dist, "")
    return re.sub(r"(某|知名|出租|套房|大樓|社區|公寓|華廈|住宅|透天|民宅|大廈)", "", s).strip()

def self_audit_record(rec: dict) -> tuple[bool, int, str]:
    addr = (rec.get("address") or "").strip()
    reason = (rec.get("reason") or "").strip()
    source_url = (rec.get("source_url") or "").strip()

    # 嚴格要求必須有「路、街、段、巷、弄、號」或明確知名大樓名，嚴禁「桃園市八德區某出租套房」過關！
    has_road = bool(re.search(r"[路街段巷弄號]|錦新|西寧|太原|維冠|城中城|東星|博士|龍邦|衛爾康", addr))
    is_vague = bool(re.search(r"某出租|某知名|某新大樓|某大樓|某社區|某透天|某公寓", addr)) and not bool(re.search(r"[路街段巷弄號]", addr))

    if is_vague or not has_road or len(addr) < 8:
        return False, 0, "退件：無具體路名街巷(僅寫某套房/某大樓)"

    score = 70
    notes = ["具備明確路名與建物位置"]
    if source_url.startswith("http"):
        score += 18
        notes.append("附原始新聞網址")
    if re.search(r"\d{4}-\d{2}-\d{2}", rec.get("incident_date") or ""):
        score += 7
        notes.append("日期明確")
    if len(reason) >= 30:
        score += 4

    return True, min(score, 99), " · ".join(notes)

def is_duplicate_case(candidate: dict, existing_list: list) -> bool:
    c_city = (candidate.get("city") or "").replace("台", "臺")
    c_dist = (candidate.get("district") or "").strip()
    c_date = (candidate.get("incident_date") or "")[:10]
    c_core = normalize_addr_core(c_city, c_dist, candidate.get("address") or "")

    for ex in existing_list:
        e_city = (ex.get("city") or "").replace("台", "臺")
        e_dist = (ex.get("district") or "").strip()
        if c_city != e_city or c_dist != e_dist:
            continue
        e_date = (ex.get("incident_date") or "")[:10]
        e_core = normalize_addr_core(e_city, e_dist, ex.get("address") or "")

        if c_core and e_core and c_core == e_core:
            return True
        if c_date and e_date and c_date == e_date and c_date != "歷史紀錄":
            if text_similarity(candidate.get("reason", ""), ex.get("reason", "")) >= 0.35:
                return True
        if text_similarity(candidate.get("reason", ""), ex.get("reason", "")) >= 0.45:
            return True
    return False

# ==============================================================================
# 3. 座標定位與真實新聞 RSS 網址爬取
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
    headers = {"User-Agent": "TWVerifiedIncidentBot/6.0"}
    for q in [f"{city}{district}{address}", f"{city}{district}"]:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200 and r.json():
                hit = r.json()[0]
                time.sleep(1.0)
                return round(float(hit["lat"]) + random.uniform(-0.0012, 0.0012), 6), round(float(hit["lon"]) + random.uniform(-0.0012, 0.0012), 6)
        except Exception:
            pass
    base_lat, base_lng = TAIWAN_COORDS.get(city.replace("台", "臺"), (23.75, 120.95))
    return round(base_lat + random.uniform(-0.025, 0.025), 6), round(base_lng + random.uniform(-0.025, 0.025), 6)

ALL_TAIWAN_REGIONS = [
    ("臺北市", ["中山區","萬華區","大安區","信義區","內湖區","文山區","士林區","北投區","松山區","中正區","大同區","南港區"]),
    ("新北市", ["板橋區","三重區","中和區","永和區","新莊區","新店區","土城區","蘆洲區","樹林區","汐止區","三峽區","淡水區","林口區"]),
    ("桃園市", ["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","龜山區","龍潭區","大溪區"]),
    ("臺中市", ["西屯區","北屯區","北區","南屯區","西區","中區","東區","南區","豐原區","大里區","太平區","沙鹿區","梧棲區"]),
    ("臺南市", ["永康區","東區","中西區","北區","安南區","安平區","南區","仁德區","歸仁區","新營區"]),
    ("高雄市", ["三民區","左營區","鳳山區","苓雅區","前鎮區","楠梓區","鼓山區","新興區","鹽埕區","小港區","岡山區"]),
    ("基隆市", ["仁愛區","信義區","安樂區","中正區"]),
    ("新竹市", ["東區","北區","香山區"]),
    ("新竹縣", ["竹北市","竹東鎮","湖口鄉"]),
    ("彰化縣", ["彰化市","員林市","鹿港鎮"]),
    ("屏東縣", ["屏東市","潮州鎮","東港鎮"]),
    ("宜蘭縣", ["宜蘭市","羅東鎮","礁溪鄉"]),
    ("花蓮縣", ["花蓮市","吉安鄉"])
]

def fetch_rss_with_real_links(city: str, district: str) -> list[dict]:
    q = f"{city}{district} (凶宅 OR 命案 OR 分屍 OR 墜樓 OR 燒炭 OR 法拍 OR 火警身亡)"
    rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    articles = []
    try:
        r = requests.get(rss_url, timeout=12)
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            for item in root.findall(".//item")[:20]:
                title = item.findtext("title") or ""
                link = item.findtext("link") or ""
                pub_date = item.findtext("pubDate") or ""
                source_el = item.find("source")
                media_name = source_el.text if source_el is not None else "新聞報導"
                articles.append({
                    "title": title,
                    "link": link,
                    "pub_date": pub_date,
                    "media": media_name
                })
    except Exception:
        pass
    return articles

def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS", "")
    openai_keys = os.environ.get("OPENAI_API_KEYS", "")

    supabase: Client = create_client(supabase_url, supabase_key)
    ai = DualAICrawlerEngine(gemini_keys, openai_keys)

    flat_targets = [(c, d) for c, dists in ALL_TAIWAN_REGIONS for d in dists]
    random.shuffle(flat_targets)

    total_verified_saved = 0
    for idx, (city, dist) in enumerate(flat_targets):
        articles = fetch_rss_with_real_links(city, dist)
        if not articles:
            continue

        # 先從雲端撈出該行政區既有案件，供入庫前同案比對防重
        existing_in_dist = []
        try:
            res = supabase.table("haunted_houses").select("city,district,address,incident_date,reason").eq("city", city).eq("district", dist).execute()
            existing_in_dist = res.data or []
        except Exception:
            pass

        print(f"🔎 [{idx+1}/{len(flat_targets)}] 正在審查【{city}{dist}】新聞並比對既有 {len(existing_in_dist)} 筆卷宗防重複...", flush=True)
        articles_json_str = json.dumps(articles, ensure_ascii=False, indent=2)

        prompt = f"""
你是臺灣不動產事故與社會新聞事實查核官。
以下是【{city}{dist}】的新聞清單（含標題 title、媒體 media、日期 pub_date 與真實網址 link）：
{articles_json_str}

請嚴格執行「同案合併」與「真偽自我審查」：
1. 若有多篇新聞報導同一起案件（例如同一宗命案、墜樓或火警），請務必合併為單一筆最詳盡的紀錄，絕對不可拆成「某出租套房」與「某出租套房大樓」兩筆重複案件！
2. `address` 欄位必須包含明確的「路、街、段、巷、弄、號」與建物名稱（例如：「{city}{dist}介壽路一段某出租套房大樓」）。嚴禁只寫「{city}{dist}某出租套房」而無路名！若不知道確切路名，請直接捨棄不輸出。
3. 請將新聞清單中對應的真實 `link` 填入 `source_url`。

請輸出 JSON Object 格式 {{"records": [...]}}：
{{
  "records": [
    {{
      "city": "{city}",
      "district": "{dist}",
      "address": "必須包含明確路名/街名之地址",
      "incident_date": "YYYY-MM-DD",
      "category": "從以下五種擇一：刑事命案、輕生事故、意外身亡、自然或孤獨死、法拍與其他",
      "reason": "詳述真實案發經過與死因（勿編造罐頭公式文字）",
      "source_url": "新聞清單中對應的真實 link 網址",
      "media_verification": "媒體名稱與報導標題摘要",
      "auction_record": "若有真實法拍底價或拍定紀錄請填寫，無則留空字串",
      "history_timeline": [
        {{"year": "YYYY-MM-DD", "stage": "案發與媒體查證紀錄", "detail": "具體案情與媒體報導摘要"}}
      ]
    }}
  ]
}}
"""
        extracted = ai.extract_and_verify(prompt, prefer_openai=(idx % 2 == 1))
        verified_batch = []

        for r in extracted:
            passed, score, audit_note = self_audit_record(r)
            if not passed:
                print(f"   ❌ 自我審查退件：{r.get('address')} ({audit_note})", flush=True)
                continue

            addr = r["address"].strip()
            if not addr.startswith(city):
                addr = f"{city}{dist}{addr.replace(city, '').replace(dist, '')}"
            r["address"] = addr

            # 與資料庫既有案件及本批次案件進行同案去重稽核
            if is_duplicate_case(r, existing_in_dist + verified_batch):
                print(f"   ♻️ 稽核攔截同案重複資料：{addr}", flush=True)
                continue

            lat, lng = fast_geocode(city, dist, addr)
            verified_batch.append({
                "city": city,
                "district": dist,
                "address": addr,
                "lat": lat,
                "lng": lng,
                "incident_date": r.get("incident_date") or "歷史紀錄",
                "category": r.get("category") or "法拍與其他",
                "reason": r.get("reason") or "",
                "source": r.get("media_verification") or "新聞媒體查證報導",
                "source_url": r.get("source_url") or "",
                "media_verification": r.get("media_verification") or "",
                "auction_record": r.get("auction_record") or "",
                "history_timeline": r.get("history_timeline") or [],
                "verification_score": score,
                "audit_note": audit_note
            })

        if verified_batch:
            try:
                supabase.table("haunted_houses").upsert(verified_batch, on_conflict="address").execute()
                total_verified_saved += len(verified_batch)
                print(f"   ✔️ 通過稽核並成功寫入 {len(verified_batch)} 筆獨立案件！(累計新增: {total_verified_saved})", flush=True)
            except Exception as e:
                print(f"   ⚠️ 資料庫寫入失敗: {e}", flush=True)

if __name__ == "__main__":
    main()
