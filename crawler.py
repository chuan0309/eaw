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

class AllGeminiEngine:
    def __init__(self, api_keys_str: str):
        self.api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
        if not self.api_keys:
            raise ValueError("請在 GitHub Secrets 設定 GEMINI_API_KEYS！")

        self.priority_models = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]
        self.clients = [genai.Client(api_key=k) for k in self.api_keys]
        self.available_models = self._discover_all_models()
        print(f"✅ 已載入 {len(self.clients)} 組 API Key，啟用 {len(self.available_models)} 種模型輪詢：{self.available_models}")

    def _discover_all_models(self):
        discovered = list(self.priority_models)
        try:
            for m in self.clients[0].models.list():
                name = m.name.replace("models/", "")
                if "gemini" in name and not any(x in name for x in ["embedding", "vision", "audio", "imagen", "veo", "tts"]):
                    if name not in discovered:
                        discovered.append(name)
        except Exception as e:
            print(f"⚠️ 動態列舉模型略過，使用預設模型池: {e}")
        return discovered

    def extract_incident_json(self, raw_text: str) -> list:
        prompt = f"""
你是臺灣不動產特殊事故（凶宅）與歷史事件結構化專家。
請從以下新聞與法拍資訊中，提取所有「位於臺灣（含本島及澎湖、金門、馬祖離島）」且具有「明確縣市、行政區、路段、社區大樓名稱、地標或門牌」的非自然死亡、凶宅、命案、墜樓、燒炭、一氧化碳中毒、重大火警身亡或法拍凶宅註記事件。

請嚴格輸出 JSON Array 格式：
[
  {{
    "city": "標準臺灣縣市名稱（例如：臺北市、新北市、桃園市、臺中市、臺南市、高雄市等，台一律寫成臺）",
    "district": "行政區（例如：中山區、板橋區、西屯區、馬公市）",
    "address": "完整地址或路段+社區大樓/地標名稱（例如：臺北市中山區錦州街某大樓）",
    "incident_date": "YYYY-MM-DD（若無確切日填 YYYY-MM 或 歷史紀錄）",
    "category": "事故分類（如：法拍凶宅、墜樓事故、屋內輕生、命案事故、重大火警）",
    "reason": "50字內客觀簡述案發原因與經過"
  }}
]

待分析文本：
{raw_text[:14000]}
"""
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
                    print(f"🔄 [{model_name}] 切換下一顆模型... ({str(err)[:50]})")
                    time.sleep(0.8)
                    continue
        return []

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
    headers = {"User-Agent": "TaiwanHauntedHouseArchiveBot/2.0"}
    for q in [f"{city}{district}{address}", f"{city}{district}", city]:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200 and len(res.json()) > 0:
                hit = res.json()[0]
                time.sleep(1.1)
                # 加入微小隨機偏移避免同路段點位完全重疊
                return float(hit["lat"]) + random.uniform(-0.0008, 0.0008), float(hit["lon"]) + random.uniform(-0.0008, 0.0008)
        except Exception:
            pass
        time.sleep(1.0)
    base_lat, base_lng = CITY_CENTER_FALLBACK.get(city.replace("台", "臺"), (23.75, 120.95))
    return base_lat + random.uniform(-0.015, 0.015), base_lng + random.uniform(-0.015, 0.015)

# 全台各縣市與法拍事故深層關鍵字池，每次自動抽取多組關鍵字狂搜歷年與最新紀錄
ALL_SEARCH_QUERIES = [
    "台北 凶宅 法拍 判決", "新北 凶宅 法拍 社區", "桃園 凶宅 法拍 大樓",
    "台中 凶宅 法拍 套房", "台南 凶宅 法拍 透天", "高雄 凶宅 法拍 大樓",
    "基隆 新竹 苗栗 凶宅 法拍", "彰化 南投 雲林 凶宅 法拍", "嘉義 屏東 凶宅 法拍",
    "宜蘭 花蓮 台東 凶宅 法拍", "澎湖 金門 馬祖 命案 住宅",
    "非自然死亡 查封筆錄 點交", "實價登錄 特殊交易 凶宅", "墜樓 社區 中庭 身亡",
    "屋內 燒炭 一氧化碳 法拍", "買賣 凶宅 瑕疵擔保 判決"
]

def fetch_massive_feeds(batch_queries: list) -> str:
    combined = []
    for kw in batch_queries:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(kw)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            resp = requests.get(rss_url, timeout=15)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                for item in root.findall(".//item")[:20]:
                    title = item.findtext("title") or ""
                    desc = item.findtext("description") or ""
                    pub_date = item.findtext("pubDate") or ""
                    combined.append(f"[{pub_date}] {title} | {desc}")
        except Exception as e:
            print(f"⚠️ 抓取 {kw} 略過: {e}")
    return "\n".join(combined)

def main():
    supabase_url = os.environ.get("SUPABASE_URL", "https://cfmcvcscyfblcodemnkt.supabase.co")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS")

    if not supabase_key or not gemini_keys:
        raise RuntimeError("❌ 請在 GitHub Secrets 設定 SUPABASE_SERVICE_KEY 與 GEMINI_API_KEYS！")

    supabase: Client = create_client(supabase_url, supabase_key)
    ai_engine = AllGeminiEngine(gemini_keys)

    # 將關鍵字分成兩大批次連續爬取，每次執行都能抓進大量全台案件
    random.shuffle(ALL_SEARCH_QUERIES)
    batches = [ALL_SEARCH_QUERIES[:8], ALL_SEARCH_QUERIES[8:]]

    total_saved = 0
    for idx, batch in enumerate(batches, 1):
        print(f"🚀 執行第 {idx} 批次全台深層檢索：{batch}")
        raw_text = fetch_massive_feeds(batch)
        if not raw_text.strip():
            continue

        records = ai_engine.extract_incident_json(raw_text)
        for rec in records:
            city = (rec.get("city") or "").replace("台", "臺").strip()
            district = (rec.get("district") or "").strip()
            address = (rec.get("address") or "").strip()
            if not city or not address:
                continue

            lat, lng = geocode_taiwan_address(city, district, address)
            payload = {
                "city": city,
                "district": district or "全區",
                "address": address,
                "lat": lat,
                "lng": lng,
                "incident_date": rec.get("incident_date") or "歷史紀錄",
                "category": rec.get("category") or "非自然死亡",
                "reason": rec.get("reason") or "公開資料載明之特殊事故",
                "source": "AI 全自動巡檢入庫"
            }
            try:
                supabase.table("haunted_houses").upsert(payload, on_conflict="address").execute()
                total_saved += 1
                print(f"✔️ 已寫入雲端：[{city}{district}] {address}")
            except Exception as e:
                print(f"⚠️ 寫入略過 ({address}): {e}")

    print(f"🎉 本輪背景自動爬蟲完畢！共新增/更新 {total_saved} 筆案件。")

if __name__ == "__main__":
    main()
