import os
import json
import time
import urllib.parse
import xml.etree.ElementTree as ET
import requests
from google import genai
from google.genai import types
from supabase import create_client, Client

# ==============================================================================
# 1. 多組 API Key 與「全 Gemini 模型池」自動輪詢引擎 (Multi-Key & All-Model Rotator)
# ==============================================================================
class AllGeminiEngine:
    def __init__(self, api_keys_str: str):
        # 支援填入多組 API Key (以逗號分隔)
        self.api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
        if not self.api_keys:
            raise ValueError("請設定至少一組 GEMINI_API_KEYS 環境變數！")

        # 預設優先順序模型池 + 動態探測帳號內所有可用模型
        self.priority_models = [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]
        self.clients = [genai.Client(api_key=k) for k in self.api_keys]
        self.available_models = self._discover_all_models()
        print(f"✅ 已載入 {len(self.clients)} 組 API Key，共啟用 {len(self.available_models)} 種可用 AI 模型輪詢：{self.available_models}")

    def _discover_all_models(self):
        discovered = list(self.priority_models)
        try:
            for m in self.clients[0].models.list():
                name = m.name.replace("models/", "")
                if "gemini" in name and "embedding" not in name and "vision" not in name and "audio" not in name:
                    if name not in discovered:
                        discovered.append(name)
        except Exception as e:
            print(f"⚠️ 動態列舉模型時略過，使用預設全模型池: {e}")
        return discovered

    def extract_incident_json(self, raw_text: str) -> list:
        prompt = f"""
你是臺灣不動產特殊事故（凶宅）資料結構化專家。
請從以下文本中，找出所有「位於臺灣」且「有明確路段、社區大樓名稱、地標或門牌地址」的非自然死亡、凶宅、命案、墜樓、燒炭、火警身亡或法拍點交註記事故。
若文本完全無關或沒有任何臺灣地點，請回傳空陣列 []。

請嚴格輸出 JSON Array 格式，每個元素包含以下欄位：
[
  {{
    "city": "標準臺灣縣市名稱（例如：臺北市、新北市、臺中市、高雄市，台一律寫成臺）",
    "district": "行政區（例如：中山區、板橋區、西屯區）",
    "address": "完整地址或路段+社區大樓名稱（例如：臺北市中山區林森北路某大樓）",
    "incident_date": "YYYY-MM-DD（若僅知年月請填 YYYY-MM，未知填 歷史紀錄）",
    "category": "事故分類（如：墜樓、命案、輕生、重大火警、法拍凶宅註記）",
    "reason": "50字以內客觀簡述案發原因與經過"
  }}
]

待分析文本：
{raw_text[:12000]}
"""
        # 雙重迴圈：輪詢每一把 API Key × 每一個可用 Gemini 模型
        for key_idx, client in enumerate(self.clients):
            for model_name in self.available_models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1,
                        ),
                    )
                    if response and response.text:
                        data = json.loads(response.text)
                        if isinstance(data, list):
                            print(f"🤖 成功由 [Key#{key_idx+1} / {model_name}] 萃取 {len(data)} 筆資料")
                            return data
                except Exception as err:
                    print(f"🔄 [Key#{key_idx+1} / {model_name}] 忙碌或受限，自動切換下一顆模型... ({str(err)[:60]})")
                    time.sleep(1)
                    continue
        return []

# ==============================================================================
# 2. 免費臺灣地址轉經緯度引擎 (OpenStreetMap Nominatim + 行政區保底座標)
# ==============================================================================
CITY_CENTER_FALLBACK = {
    "臺北市": (25.0330, 121.5654), "新北市": (25.0169, 121.4628), "桃園市": (24.9936, 121.3010),
    "臺中市": (24.1477, 120.6736), "臺南市": (22.9997, 120.2270), "高雄市": (22.6273, 120.3014),
    "基隆市": (25.1276, 121.7392), "新竹市": (24.8138, 120.9675), "新竹縣": (24.8387, 121.0177),
    "苗栗縣": (24.5602, 120.8214), "彰化縣": (24.0518, 120.5161), "南投縣": (23.9610, 120.9719),
    "雲林縣": (23.7092, 120.4313), "嘉義市": (23.4801, 120.4491), "嘉義縣": (23.4518, 120.2555),
    "屏東縣": (22.6761, 120.4929), "宜蘭縣": (24.7021, 121.7378), "花蓮縣": (23.9872, 121.6015),
    "臺東縣": (22.7583, 121.1444), "澎湖縣": (23.5711, 119.5793), "金門縣": (24.4493, 118.3767),
    "連江縣": (26.1605, 119.9519)
}

def geocode_taiwan_address(city: str, district: str, address: str):
    headers = {"User-Agent": "TaiwanHauntedHouseArchiveBot/1.0"}
    queries = [
        f"{city}{district}{address}",
        f"{city}{district}",
        f"{city}"
    ]
    for q in queries:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200 and len(res.json()) > 0:
                hit = res.json()[0]
                time.sleep(1.1)  # 遵守 OSM 每秒 1 次禮貌限制
                return float(hit["lat"]), float(hit["lon"])
        except Exception:
            pass
        time.sleep(1.1)
    return CITY_CENTER_FALLBACK.get(city.replace("台", "臺"), (23.75, 120.95))

# ==============================================================================
# 3. 多來源資料抓取器（Google News 台灣社會與法拍關鍵字 RSS + 公開歷史資料集）
# ==============================================================================
SEARCH_KEYWORDS = [
    "台灣 凶宅 法拍",
    "非自然死亡 社區 大樓",
    "墜樓 社區 地址",
    "凶宅 實價登錄 備註",
    "命案 住宅 大樓",
    "法拍屋 凶宅 點交"
]

def fetch_latest_feeds() -> str:
    combined_entries = []
    for kw in SEARCH_KEYWORDS:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(kw)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            resp = requests.get(rss_url, timeout=15)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                for item in root.findall(".//item")[:15]:
                    title = item.findtext("title") or ""
                    desc = item.findtext("description") or ""
                    pub_date = item.findtext("pubDate") or ""
                    combined_entries.append(f"【日期】{pub_date}\n【標題】{title}\n【摘要】{desc}\n---")
        except Exception as e:
            print(f"⚠️ 抓取關鍵字 {kw} 失敗: {e}")
    return "\n".join(combined_entries)

def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS")

    if not all([supabase_url, supabase_key, gemini_keys]):
        raise RuntimeError("❌ 缺少環境變數！請確認已設定 SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEYS")

    supabase: Client = create_client(supabase_url, supabase_key)
    ai_engine = AllGeminiEngine(gemini_keys)

    print("🔍 開始抓取全臺最新法拍、裁判書新聞與特殊事故動態...")
    raw_feed_text = fetch_latest_feeds()
    if not raw_feed_text.strip():
        print("今日無新增文本。")
        return

    # 分批送入全模型 AI 引擎萃取結構化凶宅資料
    extracted_records = ai_engine.extract_incident_json(raw_feed_text)
    print(f"📦 AI 共萃取出 {len(extracted_records)} 筆候選事故紀錄，準備定位並寫入雲端資料庫...")

    saved_count = 0
    for rec in extracted_records:
        city = (rec.get("city") or "").replace("台", "臺").strip()
        district = (rec.get("district") or "").strip()
        address = (rec.get("address") or "").strip()
        if not city or not address:
            continue

        lat, lng = geocode_taiwan_address(city, district, address)
        payload = {
            "city": city,
            "district": district or "未知行政區",
            "address": address,
            "lat": lat,
            "lng": lng,
            "incident_date": rec.get("incident_date") or "歷史紀錄",
            "category": rec.get("category") or "非自然死亡",
            "reason": rec.get("reason") or "公開資料載明之特殊事故",
            "source": "AI 全自動巡檢入庫"
        }
        try:
            # 使用 upsert 依據 address 自動去重，已經存在的地址會更新，新地址會直接新增
            supabase.table("haunted_houses").upsert(payload, on_conflict="address").execute()
            saved_count += 1
            print(f"✔️ 已永久寫入雲端：[{city}{district}] {address} ({lat}, {lng})")
        except Exception as db_err:
            print(f"⚠️ 寫入失敗 ({address}): {db_err}")

    print(f"🎉 本次自動巡檢完成！共新增/更新 {saved_count} 筆真實資料。")

if __name__ == "__main__":
    main()
