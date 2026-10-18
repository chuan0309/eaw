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
        print(f"✅ 已啟動 {len(self.clients)} 把金鑰 × {len(self.available_models)} 個模型池：{self.available_models}")

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

    def generate_json(self, prompt: str) -> list:
        for client in self.clients:
            for model_name in self.available_models:
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
                        data = json.loads(resp.text)
                        if isinstance(data, list):
                            return data
                except Exception as e:
                    print(f"🔄 [{model_name}] 忙碌切換中: {str(e)[:45]}")
                    time.sleep(0.8)
        return []

# 臺灣各縣市精準基準座標
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
    headers = {"User-Agent": "TWRealEstateIncidentBot/3.0"}
    for q in [f"{city}{district}{address}", f"{city}{district}"]:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&countrycodes=tw&format=json&limit=1"
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200 and r.json():
                hit = r.json()[0]
                time.sleep(1.0)
                # 加上極微小偏移避免同一條路或同一行政區的多筆座標完全重疊在一起
                return round(float(hit["lat"]) + random.uniform(-0.0025, 0.0025), 6), round(float(hit["lon"]) + random.uniform(-0.0025, 0.0025), 6)
        except Exception:
            pass
    base_lat, base_lng = TAIWAN_COORDS.get(city.replace("台", "臺"), (23.75, 120.95))
    return round(base_lat + random.uniform(-0.03, 0.03), 6), round(base_lng + random.uniform(-0.03, 0.03), 6)

# 全臺重點鄉鎮市區地毯式搜尋池（確保包含桃園八德、中壢、雙北、台中、台南、高雄等所有行政區）
TARGET_REGIONS = [
    ("桃園市", ["八德區", "中壢區", "桃園區", "平鎮區", "蘆竹區", "楊梅區", "龜山區", "龍潭區", "大溪區", "大園區"]),
    ("臺北市", ["中山區", "萬華區", "大安區", "信義區", "內湖區", "文山區", "士林區", "北投區", "松山區", "中正區", "大同區", "南港區"]),
    ("新北市", ["板橋區", "三重區", "中和區", "永和區", "新莊區", "新店區", "土城區", "淡水區", "蘆洲區", "汐止區", "三峽區", "林口區", "鶯歌區"]),
    ("臺中市", ["西屯區", "北屯區", "北區", "南屯區", "西區", "中區", "豐原區", "大里區", "太平區", "沙鹿區", "烏日區"]),
    ("高雄市", ["三民區", "左營區", "鳳山區", "苓雅區", "前鎮區", "楠梓區", "鼓山區", "新興區", "鹽埕區", "小港區", "岡山區"]),
    ("臺南市", ["永康區", "東區", "中西區", "北區", "安南區", "安平區", "南區", "仁德區", "歸仁區", "善化區", "新營區"]),
    ("基隆市", ["仁愛區", "信義區", "安樂區", "中正區"]),
    ("新竹市", ["東區", "北區", "香山區"]),
    ("新竹縣", ["竹北市", "竹東鎮", "湖口鄉", "新豐鄉"]),
    ("苗栗縣", ["頭份市", "苗栗市", "竹南鎮"]),
    ("彰化縣", ["彰化市", "員林市", "鹿港鎮", "和美鎮"]),
    ("南投縣", ["草屯鎮", "南投市", "埔里鎮"]),
    ("雲林縣", ["斗六市", "虎尾鎮", "北港鎮"]),
    ("嘉義市", ["西區", "東區"]),
    ("嘉義縣", ["民雄鄉", "水上鄉", "太保市"]),
    ("屏東縣", ["屏東市", "潮州鎮", "東港鎮"]),
    ("宜蘭縣", ["羅東鎮", "宜蘭市", "礁溪鄉"]),
    ("花蓮縣", ["花蓮市", "吉安鄉", "新城鄉"]),
    ("臺東縣", ["臺東市", "卑南鄉"]),
    ("澎湖縣", ["馬公市"]), ("金門縣", ["金城鎮", "金湖鎮"]), ("連江縣", ["南竿鄉"])
]

def crawl_region_rss(city: str, district: str) -> str:
    q = f"{city}{district} (凶宅 OR 命案 OR 墜樓 OR 燒炭 OR 陳屍 OR 火警身亡 OR 法拍)"
    rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    entries = []
    try:
        r = requests.get(rss_url, timeout=12)
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            for item in root.findall(".//item")[:20]:
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
    gemini_keys = os.environ.get("GEMINI_API_KEYS")

    supabase: Client = create_client(supabase_url, supabase_key)
    ai = AllGeminiEngine(gemini_keys)

    total_added = 0
    for city, districts in TARGET_REGIONS:
        for dist in districts:
            print(f"🚀 正在深度搜集【{city}{dist}】歷年凶宅、法拍與社會死亡事故紀錄...", flush=True)
            rss_text = crawl_region_rss(city, dist)

            prompt = f"""
你是臺灣歷年凶宅、司法院法拍屋特殊事故筆錄與社會案件公開資料庫整理專家。
目標行政區：【{city}{dist}】
請結合以下最新檢索摘要，以及公開歷史新聞、司法院法拍屋公告、實價登錄特殊交易備註中曾發生於【{city}{dist}】的真實特殊事故建物/社會案件紀錄，整理出 5 到 12 筆具體且不重複的事故紀錄。

請嚴格輸出 JSON Array，每個元素格式如下：
[
  {{
    "city": "{city}",
    "district": "{dist}",
    "address": "完整地址或具體路段+社區/大樓/透天型態（例如：{city}{dist}介壽路一段某住商大樓8樓）",
    "incident_date": "YYYY-MM-DD（真實或歷史記載年月，如 2019-06-15）",
    "category": "請務必從以下五種擇一：刑事命案、輕生事故、意外身亡、自然或孤獨死、法拍與其他",
    "reason": "詳細說明死因與案件背景（例如：屋內燒炭輕生、高處墜樓身亡、感情或債務糾紛兇殺命案、獨居久病陳屍屋內多日、住宅火警嗆傷身亡、地方法院法拍筆錄載明非自然身亡）",
    "source": "資料來源（如：司法院法拍屋公告、司法院裁判書系統、歷年社會新聞檔案、實價登錄特殊備註）"
  }}
]

檢索參考文本：
{rss_text[:10000]}
"""
            records = ai.generate_json(prompt)
            batch_payload = []
            for r in records:
                addr = (r.get("address") or "").strip()
                if not addr:
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
                    "reason": r.get("reason") or "公開資料載明之特殊事故",
                    "source": r.get("source") or "司法院法拍/公開新聞歷史庫"
                })

            if batch_payload:
                try:
                    supabase.table("haunted_houses").upsert(batch_payload, on_conflict="address").execute()
                    total_added += len(batch_payload)
                    print(f"✔️ 【{city}{dist}】已成功寫入 {len(batch_payload)} 筆！目前累計新增 {total_added} 筆", flush=True)
                except Exception as e:
                    print(f"⚠️ 寫入略過: {e}", flush=True)

    print(f"🎉 全臺地毯式巡檢完成！共新增/更新 {total_added} 筆案件。", flush=True)

if __name__ == "__main__":
    main()
