import os
import csv
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
# 1. 全 Gemini 模型池自動輪詢引擎
# ==============================================================================
class AllGeminiEngine:
    def __init__(self, api_keys_str: str):
        self.api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
        if not self.api_keys:
            raise ValueError("請設定 GEMINI_API_KEYS 環境變數！")

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

    def _discover_all_models(self):
        discovered = list(self.priority_models)
        try:
            for m in self.clients[0].models.list():
                name = m.name.replace("models/", "")
                if "gemini" in name and not any(x in name for x in ["embedding", "vision", "audio", "tts", "imagen"]):
                    if name not in discovered:
                        discovered.append(name)
        except Exception:
            pass
        return discovered

    def extract_incidents(self, raw_text: str) -> list:
        prompt = f"""
你是臺灣凶宅、法拍特殊事故與歷年社會案件資料庫專家。
請從以下文本中提取所有位於臺灣的死亡事故建物紀錄，並嚴格分類死因。
請輸出 JSON Array，格式如下：
[
  {{
    "city": "標準臺灣縣市名（台一律寫作臺，如：臺北市、新北市、桃園市、臺中市、臺南市、高雄市等）",
    "district": "行政區（如：中山區、板橋區、西屯區）",
    "address": "明確路段、社區大樓名稱、巷弄或門牌地址",
    "incident_date": "YYYY-MM-DD（若僅知年份填 YYYY-01-01，未知填 歷史紀錄）",
    "category": "請務必從以下五種擇一填入：刑事命案、輕生事故、意外身亡、自然或孤獨死、法拍與其他",
    "reason": "詳細說明死因與案發經過（例如：屋內燒炭輕生、感情糾紛兇殺命案、高處墜樓身亡、獨居長者久病未發現、火災濃煙嗆傷身亡、法院法拍筆錄載明非自然身亡）"
  }}
]
文本內容：
{raw_text[:15000]}
"""
        for client in self.clients:
            for model_name in self.available_models:
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
                        data = json.loads(resp.text)
                        if isinstance(data, list):
                            return data
                except Exception as e:
                    print(f"切換模型 ({model_name}): {str(e)[:50]}")
                    time.sleep(0.8)
        return []

# ==============================================================================
# 2. 臺灣各縣市與常見行政區快速座標定位（免除慢速單筆查詢卡住，並加微小偏移避免重疊）
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
    headers = {"User-Agent": "TWRealEstateIncidentBot/2.0"}
    q = f"{city}{district}{address}"
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200 and r.json():
            hit = r.json()[0]
            time.sleep(1.0)
            return float(hit["lat"]), float(hit["lon"])
    except Exception:
        pass
    base_lat, base_lng = TAIWAN_COORDS.get(city.replace("台", "臺"), (23.75, 120.95))
    return round(base_lat + random.uniform(-0.035, 0.035), 6), round(base_lng + random.uniform(-0.035, 0.035), 6)

# ==============================================================================
# 3. 批量匯入本地或遠端 CSV 歷史大數據 (讓你不用手打，一次塞入幾千筆)
# ==============================================================================
def bulk_import_csv_if_exists(supabase: Client, csv_path="historical_seed.csv"):
    if not os.path.exists(csv_path):
        return
    print(f"📂 偵測到歷史大數據檔案 {csv_path}，開始高速批量灌入雲端資料庫...")
    batch = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            city = (row.get("city") or row.get("縣市") or "臺北市").replace("台", "臺")
            district = row.get("district") or row.get("行政區") or "未知行政區"
            address = row.get("address") or row.get("地址") or row.get("位置")
            if not address:
                continue
            lat = float(row["lat"]) if row.get("lat") else TAIWAN_COORDS.get(city, (25.04, 121.53))[0] + random.uniform(-0.03, 0.03)
            lng = float(row["lng"]) if row.get("lng") else TAIWAN_COORDS.get(city, (25.04, 121.53))[1] + random.uniform(-0.03, 0.03)
            batch.append({
                "city": city,
                "district": district,
                "address": address,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "incident_date": row.get("incident_date") or row.get("日期") or "歷史紀錄",
                "category": row.get("category") or row.get("分類") or "法拍與其他",
                "reason": row.get("reason") or row.get("原因") or "歷年凶宅清冊收錄案件",
                "source": "歷史公開資料庫批量匯入"
            })
            if len(batch) >= 500:
                supabase.table("haunted_houses").upsert(batch, on_conflict="address").execute()
                print(f"🚀 已批量灌入 {len(batch)} 筆歷史資料！")
                batch = []
    if batch:
        supabase.table("haunted_houses").upsert(batch, on_conflict="address").execute()
        print(f"🚀 已批量灌入最後 {len(batch)} 筆歷史資料！")

# ==============================================================================
# 4. 全臺 22 縣市 × 各類死因（兇殺、輕生、意外、孤獨死、法拍）廣域自動搜尋
# ==============================================================================
SEARCH_QUERIES = [
    "臺北市 凶宅 法拍 命案 墜樓", "新北市 凶宅 燒炭 墜樓 社區", "桃園市 凶宅 法拍 非自然死亡",
    "臺中市 凶宅 墜樓 命案 大樓", "臺南市 凶宅 法拍 輕生 住宅", "高雄市 凶宅 命案 墜樓 火警",
    "基隆 新竹 苗栗 凶宅 法拍 命案", "彰化 南投 雲林 凶宅 輕生 法拍", "嘉義 屏東 宜蘭 花蓮 臺東 凶宅 命案",
    "獨居 暴斃 陳屍 住宅 發現", "情殺 仇殺 分屍 住宅 凶宅", "一氧化碳中毒 住宅 身亡"
]

def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    gemini_keys = os.environ.get("GEMINI_API_KEYS")

    supabase: Client = create_client(supabase_url, supabase_key)
    # 先檢查有沒有整包的 CSV 歷史檔案可以一次灌入
    bulk_import_csv_if_exists(supabase)

    ai = AllGeminiEngine(gemini_keys)

    for q in SEARCH_QUERIES:
        print(f"🔎 正在巡檢主題：{q}")
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            resp = requests.get(rss_url, timeout=15)
            if resp.status_code != 200:
                continue
            root = ET.fromstring(resp.content)
            items_text = []
            for item in root.findall(".//item")[:25]:
                title = item.findtext("title") or ""
                desc = item.findtext("description") or ""
                pub = item.findtext("pubDate") or ""
                items_text.append(f"[{pub}] {title} - {desc}")

            if not items_text:
                continue

            records = ai.extract_incidents("\n".join(items_text))
            batch_payload = []
            for r in records:
                city = (r.get("city") or "").replace("台", "臺").strip()
                district = (r.get("district") or "未知行政區").strip()
                address = (r.get("address") or "").strip()
                if not city or not address:
                    continue
                lat, lng = fast_geocode(city, district, address)
                batch_payload.append({
                    "city": city,
                    "district": district,
                    "address": address,
                    "lat": lat,
                    "lng": lng,
                    "incident_date": r.get("incident_date") or "歷史紀錄",
                    "category": r.get("category") or "法拍與其他",
                    "reason": r.get("reason") or "特殊事故紀錄",
                    "source": "AI 全臺廣域巡檢"
                })
            if batch_payload:
                supabase.table("haunted_houses").upsert(batch_payload, on_conflict="address").execute()
                print(f"✅ 主題 [{q}] 成功入庫 {len(batch_payload)} 筆！")
        except Exception as e:
            print(f"⚠️ 巡檢略過: {e}")

if __name__ == "__main__":
    main()
