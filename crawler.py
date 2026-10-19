#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
new_crawler.py — 全新 Grounded 爬蟲
- 三個真實資料來源（Google News RSS 歷史三段 / 司法院 / 法拍屋）
- Grounded LLM 萃取（嚴禁幻想）
- 地址驗證層（Google Maps Geocoding / TGOS 備援，無 random jitter）
- 動態 verification_score
- Wayback Machine 自動存證
- 雙層入庫（主表 haunted_houses / staging unverified_incidents）
"""

import os
import sys
import json
import time
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, date
from typing import Optional

import requests
from supabase import create_client, Client

# ──────────────────────────────────────────────
# 環境變數
# ──────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
GEMINI_API_KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEYS", "").split(",") if k.strip()]
OPENAI_API_KEYS = [k.strip() for k in os.environ.get("OPENAI_API_KEYS", "").split(",") if k.strip()]
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")

# ──────────────────────────────────────────────
# 22 縣市固定基準座標
# ──────────────────────────────────────────────
CITY_BASE_COORDS = {
    "臺北市":   (25.0330, 121.5654),
    "新北市":   (25.0120, 121.4653),
    "桃園市":   (24.9937, 121.3010),
    "臺中市":   (24.1477, 120.6736),
    "臺南市":   (22.9999, 120.2269),
    "高雄市":   (22.6273, 120.3014),
    "基隆市":   (25.1276, 121.7392),
    "新竹市":   (24.8036, 120.9686),
    "嘉義市":   (23.4801, 120.4491),
    "新竹縣":   (24.8387, 121.0177),
    "苗栗縣":   (24.5602, 120.8214),
    "彰化縣":   (24.0518, 120.5161),
    "南投縣":   (23.9610, 120.9718),
    "雲林縣":   (23.7092, 120.4313),
    "嘉義縣":   (23.4518, 120.2554),
    "屏東縣":   (22.5519, 120.5487),
    "宜蘭縣":   (24.6941, 121.7379),
    "花蓮縣":   (23.9871, 121.6015),
    "臺東縣":   (22.7972, 121.1147),
    "澎湖縣":   (23.5711, 119.5793),
    "金門縣":   (24.4493, 118.3765),
    "連江縣":   (26.1505, 119.9497),
}

# ──────────────────────────────────────────────
# 全台 368 鄉鎮市區
# ──────────────────────────────────────────────
TAIWAN_368_DISTRICTS = [
    # 臺北市 (12)
    ("臺北市", "中正區"), ("臺北市", "大同區"), ("臺北市", "中山區"), ("臺北市", "松山區"),
    ("臺北市", "大安區"), ("臺北市", "萬華區"), ("臺北市", "信義區"), ("臺北市", "士林區"),
    ("臺北市", "北投區"), ("臺北市", "內湖區"), ("臺北市", "南港區"), ("臺北市", "文山區"),
    # 新北市 (29)
    ("新北市", "板橋區"), ("新北市", "三重區"), ("新北市", "中和區"), ("新北市", "永和區"),
    ("新北市", "新莊區"), ("新北市", "新店區"), ("新北市", "樹林區"), ("新北市", "鶯歌區"),
    ("新北市", "三峽區"), ("新北市", "淡水區"), ("新北市", "汐止區"), ("新北市", "瑞芳區"),
    ("新北市", "土城區"), ("新北市", "蘆洲區"), ("新北市", "五股區"), ("新北市", "泰山區"),
    ("新北市", "林口區"), ("新北市", "深坑區"), ("新北市", "石碇區"), ("新北市", "坪林區"),
    ("新北市", "三芝區"), ("新北市", "石門區"), ("新北市", "八里區"), ("新北市", "平溪區"),
    ("新北市", "雙溪區"), ("新北市", "貢寮區"), ("新北市", "金山區"), ("新北市", "萬里區"),
    ("新北市", "烏來區"),
    # 桃園市 (13)
    ("桃園市", "桃園區"), ("桃園市", "中壢區"), ("桃園市", "平鎮區"), ("桃園市", "八德區"),
    ("桃園市", "楊梅區"), ("桃園市", "蘆竹區"), ("桃園市", "大溪區"), ("桃園市", "龍潭區"),
    ("桃園市", "龜山區"), ("桃園市", "大園區"), ("桃園市", "觀音區"), ("桃園市", "新屋區"),
    ("桃園市", "復興區"),
    # 臺中市 (29)
    ("臺中市", "中區"), ("臺中市", "東區"), ("臺中市", "南區"), ("臺中市", "西區"),
    ("臺中市", "北區"), ("臺中市", "西屯區"), ("臺中市", "南屯區"), ("臺中市", "北屯區"),
    ("臺中市", "豐原區"), ("臺中市", "東勢區"), ("臺中市", "大甲區"), ("臺中市", "清水區"),
    ("臺中市", "沙鹿區"), ("臺中市", "梧棲區"), ("臺中市", "后里區"), ("臺中市", "神岡區"),
    ("臺中市", "潭子區"), ("臺中市", "大雅區"), ("臺中市", "新社區"), ("臺中市", "石岡區"),
    ("臺中市", "外埔區"), ("臺中市", "大安區"), ("臺中市", "烏日區"), ("臺中市", "大肚區"),
    ("臺中市", "龍井區"), ("臺中市", "霧峰區"), ("臺中市", "太平區"), ("臺中市", "大里區"),
    ("臺中市", "和平區"),
    # 臺南市 (37)
    ("臺南市", "中西區"), ("臺南市", "東區"), ("臺南市", "南區"), ("臺南市", "北區"),
    ("臺南市", "安平區"), ("臺南市", "安南區"), ("臺南市", "永康區"), ("臺南市", "歸仁區"),
    ("臺南市", "新化區"), ("臺南市", "左鎮區"), ("臺南市", "玉井區"), ("臺南市", "楠西區"),
    ("臺南市", "南化區"), ("臺南市", "仁德區"), ("臺南市", "關廟區"), ("臺南市", "龍崎區"),
    ("臺南市", "官田區"), ("臺南市", "麻豆區"), ("臺南市", "佳里區"), ("臺南市", "西港區"),
    ("臺南市", "七股區"), ("臺南市", "將軍區"), ("臺南市", "學甲區"), ("臺南市", "北門區"),
    ("臺南市", "新營區"), ("臺南市", "後壁區"), ("臺南市", "白河區"), ("臺南市", "東山區"),
    ("臺南市", "六甲區"), ("臺南市", "下營區"), ("臺南市", "柳營區"), ("臺南市", "鹽水區"),
    ("臺南市", "善化區"), ("臺南市", "大內區"), ("臺南市", "山上區"), ("臺南市", "新市區"),
    ("臺南市", "安定區"),
    # 高雄市 (38)
    ("高雄市", "新興區"), ("高雄市", "前金區"), ("高雄市", "苓雅區"), ("高雄市", "鹽埕區"),
    ("高雄市", "鼓山區"), ("高雄市", "旗津區"), ("高雄市", "前鎮區"), ("高雄市", "三民區"),
    ("高雄市", "楠梓區"), ("高雄市", "小港區"), ("高雄市", "左營區"), ("高雄市", "仁武區"),
    ("高雄市", "大社區"), ("高雄市", "東沙群島"), ("高雄市", "岡山區"), ("高雄市", "路竹區"),
    ("高雄市", "阿蓮區"), ("高雄市", "田寮區"), ("高雄市", "燕巢區"), ("高雄市", "橋頭區"),
    ("高雄市", "梓官區"), ("高雄市", "彌陀區"), ("高雄市", "永安區"), ("高雄市", "湖內區"),
    ("高雄市", "鳳山區"), ("高雄市", "大寮區"), ("高雄市", "林園區"), ("高雄市", "鳥松區"),
    ("高雄市", "大樹區"), ("高雄市", "旗山區"), ("高雄市", "美濃區"), ("高雄市", "六龜區"),
    ("高雄市", "內門區"), ("高雄市", "杉林區"), ("高雄市", "甲仙區"), ("高雄市", "桃源區"),
    ("高雄市", "那瑪夏區"), ("高雄市", "茂林區"),
    # 基隆市 (7)
    ("基隆市", "仁愛區"), ("基隆市", "信義區"), ("基隆市", "中正區"), ("基隆市", "中山區"),
    ("基隆市", "安樂區"), ("基隆市", "暖暖區"), ("基隆市", "七堵區"),
    # 新竹市 (3)
    ("新竹市", "東區"), ("新竹市", "北區"), ("新竹市", "香山區"),
    # 嘉義市 (2)
    ("嘉義市", "東區"), ("嘉義市", "西區"),
    # 新竹縣 (13)
    ("新竹縣", "竹北市"), ("新竹縣", "竹東鎮"), ("新竹縣", "新埔鎮"), ("新竹縣", "關西鎮"),
    ("新竹縣", "湖口鄉"), ("新竹縣", "新豐鄉"), ("新竹縣", "峨眉鄉"), ("新竹縣", "寶山鄉"),
    ("新竹縣", "北埔鄉"), ("新竹縣", "橫山鄉"), ("新竹縣", "芎林鄉"), ("新竹縣", "尖石鄉"),
    ("新竹縣", "五峰鄉"),
    # 苗栗縣 (18)
    ("苗栗縣", "苗栗市"), ("苗栗縣", "頭份市"), ("苗栗縣", "竹南鎮"), ("苗栗縣", "後龍鎮"),
    ("苗栗縣", "通霄鎮"), ("苗栗縣", "苑裡鎮"), ("苗栗縣", "造橋鄉"), ("苗栗縣", "西湖鄉"),
    ("苗栗縣", "頭屋鄉"), ("苗栗縣", "公館鄉"), ("苗栗縣", "銅鑼鄉"), ("苗栗縣", "三義鄉"),
    ("苗栗縣", "大湖鄉"), ("苗栗縣", "獅潭鄉"), ("苗栗縣", "泰安鄉"), ("苗栗縣", "三灣鄉"),
    ("苗栗縣", "南庄鄉"), ("苗栗縣", "卓蘭鎮"),
    # 彰化縣 (26)
    ("彰化縣", "彰化市"), ("彰化縣", "員林市"), ("彰化縣", "和美鎮"), ("彰化縣", "鹿港鎮"),
    ("彰化縣", "溪湖鎮"), ("彰化縣", "二林鎮"), ("彰化縣", "田中鎮"), ("彰化縣", "北斗鎮"),
    ("彰化縣", "彰化縣芬園鄉"), ("彰化縣", "花壇鄉"), ("彰化縣", "秀水鄉"), ("彰化縣", "福興鄉"),
    ("彰化縣", "線西鄉"), ("彰化縣", "大村鄉"), ("彰化縣", "埔鹽鄉"), ("彰化縣", "埔心鄉"),
    ("彰化縣", "永靖鄉"), ("彰化縣", "社頭鄉"), ("彰化縣", "二水鄉"), ("彰化縣", "田尾鄉"),
    ("彰化縣", "埤頭鄉"), ("彰化縣", "芳苑鄉"), ("彰化縣", "大城鄉"), ("彰化縣", "竹塘鄉"),
    ("彰化縣", "溪州鄉"), ("彰化縣", "名間鄉"),
    # 南投縣 (13)
    ("南投縣", "南投市"), ("南投縣", "埔里鎮"), ("南投縣", "草屯鎮"), ("南投縣", "竹山鎮"),
    ("南投縣", "集集鎮"), ("南投縣", "名間鄉"), ("南投縣", "鹿谷鄉"), ("南投縣", "中寮鄉"),
    ("南投縣", "魚池鄉"), ("南投縣", "國姓鄉"), ("南投縣", "水里鄉"), ("南投縣", "信義鄉"),
    ("南投縣", "仁愛鄉"),
    # 雲林縣 (20)
    ("雲林縣", "斗六市"), ("雲林縣", "斗南鎮"), ("雲林縣", "虎尾鎮"), ("雲林縣", "西螺鎮"),
    ("雲林縣", "土庫鎮"), ("雲林縣", "北港鎮"), ("雲林縣", "古坑鄉"), ("雲林縣", "大埤鄉"),
    ("雲林縣", "莿桐鄉"), ("雲林縣", "林內鄉"), ("雲林縣", "二崙鄉"), ("雲林縣", "崙背鄉"),
    ("雲林縣", "麥寮鄉"), ("雲林縣", "東勢鄉"), ("雲林縣", "褒忠鄉"), ("雲林縣", "臺西鄉"),
    ("雲林縣", "元長鄉"), ("雲林縣", "四湖鄉"), ("雲林縣", "口湖鄉"), ("雲林縣", "水林鄉"),
    # 嘉義縣 (18)
    ("嘉義縣", "太保市"), ("嘉義縣", "朴子市"), ("嘉義縣", "布袋鎮"), ("嘉義縣", "大林鎮"),
    ("嘉義縣", "民雄鄉"), ("嘉義縣", "溪口鄉"), ("嘉義縣", "新港鄉"), ("嘉義縣", "六腳鄉"),
    ("嘉義縣", "東石鄉"), ("嘉義縣", "義竹鄉"), ("嘉義縣", "鹿草鄉"), ("嘉義縣", "水上鄉"),
    ("嘉義縣", "中埔鄉"), ("嘉義縣", "竹崎鄉"), ("嘉義縣", "梅山鄉"), ("嘉義縣", "番路鄉"),
    ("嘉義縣", "大埔鄉"), ("嘉義縣", "阿里山鄉"),
    # 屏東縣 (33)
    ("屏東縣", "屏東市"), ("屏東縣", "潮州鎮"), ("屏東縣", "東港鎮"), ("屏東縣", "恆春鎮"),
    ("屏東縣", "萬丹鄉"), ("屏東縣", "長治鄉"), ("屏東縣", "麟洛鄉"), ("屏東縣", "九如鄉"),
    ("屏東縣", "里港鄉"), ("屏東縣", "鹽埔鄉"), ("屏東縣", "高樹鄉"), ("屏東縣", "萬巒鄉"),
    ("屏東縣", "內埔鄉"), ("屏東縣", "竹田鄉"), ("屏東縣", "新埤鄉"), ("屏東縣", "枋寮鄉"),
    ("屏東縣", "新園鄉"), ("屏東縣", "崁頂鄉"), ("屏東縣", "林邊鄉"), ("屏東縣", "南州鄉"),
    ("屏東縣", "佳冬鄉"), ("屏東縣", "琉球鄉"), ("屏東縣", "車城鄉"), ("屏東縣", "滿州鄉"),
    ("屏東縣", "枋山鄉"), ("屏東縣", "霧臺鄉"), ("屏東縣", "瑪家鄉"), ("屏東縣", "泰武鄉"),
    ("屏東縣", "來義鄉"), ("屏東縣", "春日鄉"), ("屏東縣", "獅子鄉"), ("屏東縣", "牡丹鄉"),
    ("屏東縣", "三地門鄉"),
    # 宜蘭縣 (12)
    ("宜蘭縣", "宜蘭市"), ("宜蘭縣", "羅東鎮"), ("宜蘭縣", "蘇澳鎮"), ("宜蘭縣", "頭城鎮"),
    ("宜蘭縣", "礁溪鄉"), ("宜蘭縣", "壯圍鄉"), ("宜蘭縣", "員山鄉"), ("宜蘭縣", "中山鄉"),
    ("宜蘭縣", "大同鄉"), ("宜蘭縣", "三星鄉"), ("宜蘭縣", "冬山鄉"), ("宜蘭縣", "五結鄉"),
    # 花蓮縣 (13)
    ("花蓮縣", "花蓮市"), ("花蓮縣", "鳳林鎮"), ("花蓮縣", "玉里鎮"), ("花蓮縣", "新城鄉"),
    ("花蓮縣", "吉安鄉"), ("花蓮縣", "壽豐鄉"), ("花蓮縣", "光復鄉"), ("花蓮縣", "豐濱鄉"),
    ("花蓮縣", "瑞穗鄉"), ("花蓮縣", "富里鄉"), ("花蓮縣", "秀林鄉"), ("花蓮縣", "萬榮鄉"),
    ("花蓮縣", "卓溪鄉"),
    # 臺東縣 (16)
    ("臺東縣", "臺東市"), ("臺東縣", "成功鎮"), ("臺東縣", "關山鎮"), ("臺東縣", "卑南鄉"),
    ("臺東縣", "鹿野鄉"), ("臺東縣", "池上鄉"), ("臺東縣", "東河鄉"), ("臺東縣", "長濱鄉"),
    ("臺東縣", "太麻里鄉"), ("臺東縣", "大武鄉"), ("臺東縣", "綠島鄉"), ("臺東縣", "海端鄉"),
    ("臺東縣", "延平鄉"), ("臺東縣", "金峰鄉"), ("臺東縣", "達仁鄉"), ("臺東縣", "蘭嶼鄉"),
    # 澎湖縣 (6)
    ("澎湖縣", "馬公市"), ("澎湖縣", "湖西鄉"), ("澎湖縣", "白沙鄉"), ("澎湖縣", "西嶼鄉"),
    ("澎湖縣", "望安鄉"), ("澎湖縣", "七美鄉"),
    # 金門縣 (6)
    ("金門縣", "金城鎮"), ("金門縣", "金沙鎮"), ("金門縣", "金湖鎮"), ("金門縣", "金寧鄉"),
    ("金門縣", "烈嶼鄉"), ("金門縣", "烏坵鄉"),
    # 連江縣 (4)
    ("連江縣", "南竿鄉"), ("連江縣", "北竿鄉"), ("連江縣", "莒光鄉"), ("連江縣", "東引鄉"),
]

# ──────────────────────────────────────────────
# 簡稱對照（搜尋用）
# ──────────────────────────────────────────────
CITY_SHORT = {
    "臺北市": "台北", "新北市": "新北", "桃園市": "桃園", "臺中市": "台中",
    "臺南市": "台南", "高雄市": "高雄", "基隆市": "基隆", "新竹市": "新竹市",
    "嘉義市": "嘉義市", "新竹縣": "新竹縣", "苗栗縣": "苗栗", "彰化縣": "彰化",
    "南投縣": "南投", "雲林縣": "雲林", "嘉義縣": "嘉義縣", "屏東縣": "屏東",
    "宜蘭縣": "宜蘭", "花蓮縣": "花蓮", "臺東縣": "台東", "澎湖縣": "澎湖",
    "金門縣": "金門", "連江縣": "連江",
}

# ──────────────────────────────────────────────
# HTTP Headers
# ──────────────────────────────────────────────
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HauntedHouseCrawler/2.0; +https://github.com/chuan0309/eaw)"
}

# ──────────────────────────────────────────────
# StrictTextLLMEngine — Gemini + OpenAI 輪詢
# ──────────────────────────────────────────────
class StrictTextLLMEngine:
    """Gemini 優先，耗盡後切 OpenAI，全部失敗拋例外。"""

    def __init__(self):
        self._gemini_idx = 0
        self._openai_idx = 0

    def call(self, prompt: str, temperature: float = 0.0) -> str:
        # 先嘗試 Gemini
        for _ in range(len(GEMINI_API_KEYS)):
            key = GEMINI_API_KEYS[self._gemini_idx % len(GEMINI_API_KEYS)]
            self._gemini_idx += 1
            result = self._call_gemini(key, prompt, temperature)
            if result is not None:
                return result

        # 再嘗試 OpenAI
        for _ in range(len(OPENAI_API_KEYS)):
            key = OPENAI_API_KEYS[self._openai_idx % len(OPENAI_API_KEYS)]
            self._openai_idx += 1
            result = self._call_openai(key, prompt, temperature)
            if result is not None:
                return result

        raise RuntimeError("所有 LLM API 金鑰均已耗盡或失敗")

    def _call_gemini(self, api_key: str, prompt: str, temperature: float) -> Optional[str]:
        try:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                "gemini-1.5-flash:generateContent"
                f"?key={api_key}"
            )
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024},
            }
            resp = requests.post(url, json=payload, timeout=30, headers=HEADERS)
            if resp.status_code == 429:
                print(f"  ⚠️ Gemini 金鑰 rate limit，切換下一組")
                return None
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip()
        except Exception as e:
            print(f"  ⚠️ Gemini 呼叫失敗：{e}")
            return None

    def _call_openai(self, api_key: str, prompt: str, temperature: float) -> Optional[str]:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": 1024,
            }
            resp = requests.post(
                url,
                json=payload,
                timeout=30,
                headers={**HEADERS, "Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 429:
                print(f"  ⚠️ OpenAI 金鑰 rate limit，切換下一組")
                return None
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"  ⚠️ OpenAI 呼叫失敗：{e}")
            return None


# ──────────────────────────────────────────────
# GroundedExtractor — Grounded LLM 萃取
# ──────────────────────────────────────────────
class GroundedExtractor(StrictTextLLMEngine):
    """嚴格 Grounded：只能從 source_item 中明確出現的文字提取事實。"""

    PROMPT_TEMPLATE = """你是一個法律與新聞事實結構化分析器。

【輸入素材（來自真實法院判決書或主流新聞）】：
標題: {title}
發佈日期: {pub_date}
來源網址: {url}
來源類型: {source_type}
摘要片段: {snippet}

【鐵律——違反者輸出無效】：
1. 你「只能」從上方輸入素材中已明確出現的文字進行提取，嚴禁使用任何外部知識或內部記憶！
2. 若素材中沒有明確提到案發地址，raw_address_extracted 必須填「未明確揭露」，絕對禁止自行猜測或補全門牌！
3. 若此素材與「非自然死亡、重大刑案、火災身亡、凶宅爭議」無明確關聯，直接回傳 {{"is_incident": false}}。
4. incident_date 禁止出現 2025 年及以後的年份。
5. 若標題或摘要中僅提到城市，未提到具體事故，直接回傳 {{"is_incident": false}}。

請輸出 JSON（不要加 markdown code fence）：
{{
  "is_incident": true,
  "incident_date": "YYYY-MM-DD（若只有年份則 YYYY-00-00，不確定填 0000-00-00）",
  "raw_address_extracted": "素材中出現的原句地址（原文照錄，若無則填未明確揭露）",
  "cause_of_death": "死因或事故類型（原文照錄，若無則填空）",
  "category": "刑事命案 / 輕生事故 / 意外身亡 / 自然或孤獨死 / 火災身亡 / 法拍與其他",
  "case_summary": "依據素材的 50-100 字客觀概述，不加任何推斷",
  "judicial_case_id": "判決字號（若無則填空字串）",
  "news_publisher": "媒體名稱（若可辨識）",
  "evidence_quality": "judicial_ruling / mainstream_news / rss_snippet"
}}"""

    def extract_from_source(self, source_item: dict, city: str, dist: str) -> Optional[dict]:
        """
        source_item 包含: title, url, pub_date, snippet (可能為空), source_type
        只能從這些欄位提取事實，嚴禁 LLM 補充任何外部記憶。
        回傳 dict 或 None（若 LLM 呼叫失敗）。
        """
        title = source_item.get("title", "")
        url = source_item.get("url", "")
        pub_date = source_item.get("pub_date", "")
        snippet = source_item.get("snippet", "（無摘要）")
        source_type = source_item.get("source_type", "news")

        prompt = self.PROMPT_TEMPLATE.format(
            title=title,
            pub_date=pub_date,
            url=url,
            source_type=source_type,
            snippet=snippet if snippet else "（無摘要）",
        )

        try:
            raw = self.call(prompt, temperature=0.0)
        except RuntimeError as e:
            print(f"  ❌ LLM 全部失敗：{e}")
            return None

        # 清理可能的 markdown fence
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            # 移除第一行和最後一行的 fence
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"  ⚠️ JSON 解析失敗（{e}）：{raw[:120]}")
            return None

        return result


# ──────────────────────────────────────────────
# A1. fetch_news_archive — Google News RSS 歷史三段
# ──────────────────────────────────────────────
def fetch_news_archive(city: str, dist: str, year_start: int, year_end: int) -> list[dict]:
    """抓 Google News RSS，時間段 [year_start, year_end]，最多 15 筆。"""
    city_short = CITY_SHORT.get(city, city.replace("市", "").replace("縣", ""))
    dist_short = dist.replace("區", "").replace("鎮", "").replace("鄉", "").replace("市", "")

    q = (
        f"{city_short} {dist_short} "
        f"(命案 OR 凶宅 OR 墜樓 OR 陳屍 OR 自縊 OR 縱火) "
        f"after:{year_start}-01-01 before:{year_end}-12-31"
    )
    url = (
        f"https://news.google.com/rss/search?"
        f"q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    )

    items = []
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return items
        for item_el in channel.findall("item")[:15]:
            title_el = item_el.find("title")
            link_el = item_el.find("link")
            pubdate_el = item_el.find("pubDate")
            desc_el = item_el.find("description")
            items.append({
                "title": title_el.text if title_el is not None else "",
                "url": link_el.text if link_el is not None else "",
                "pub_date": pubdate_el.text if pubdate_el is not None else "",
                "snippet": desc_el.text if desc_el is not None else "",
                "source_type": "news",
            })
    except Exception as e:
        print(f"  ⚠️ fetch_news_archive({year_start}-{year_end}) 失敗：{e}")

    return items


# ──────────────────────────────────────────────
# A2. fetch_judicial_cases — 司法院相關 RSS
# ──────────────────────────────────────────────
def fetch_judicial_cases(city: str, dist: str) -> list[dict]:
    """搜尋司法院相關裁判，最多 10 筆。"""
    city_short = CITY_SHORT.get(city, city.replace("市", "").replace("縣", ""))
    dist_short = dist.replace("區", "").replace("鎮", "").replace("鄉", "").replace("市", "")

    q = (
        f"{city_short} {dist_short} "
        f"(凶宅 判決 OR 非自然死亡 裁判 OR 瑕疵擔保 凶宅) "
        f"site:judicial.gov.tw"
    )
    url = (
        f"https://news.google.com/rss/search?"
        f"q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    )

    items = []
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return items
        for item_el in channel.findall("item")[:10]:
            title_el = item_el.find("title")
            link_el = item_el.find("link")
            pubdate_el = item_el.find("pubDate")
            desc_el = item_el.find("description")
            items.append({
                "title": title_el.text if title_el is not None else "",
                "url": link_el.text if link_el is not None else "",
                "pub_date": pubdate_el.text if pubdate_el is not None else "",
                "snippet": desc_el.text if desc_el is not None else "",
                "source_type": "judicial",
            })
    except Exception as e:
        print(f"  ⚠️ fetch_judicial_cases 失敗：{e}")

    return items


# ──────────────────────────────────────────────
# A3. fetch_auction_records — 法拍屋相關 RSS
# ──────────────────────────────────────────────
def fetch_auction_records(city: str, dist: str) -> list[dict]:
    """搜尋法拍屋公告（含凶宅關鍵字），最多 10 筆。"""
    city_short = CITY_SHORT.get(city, city.replace("市", "").replace("縣", ""))
    dist_short = dist.replace("區", "").replace("鎮", "").replace("鄉", "").replace("市", "")

    q = (
        f"{city_short} {dist_short} "
        f"(法拍屋 OR 司法拍賣 OR 強制執行) "
        f"(非自然死亡 OR 凶宅 OR 自殺 OR 命案)"
    )
    url = (
        f"https://news.google.com/rss/search?"
        f"q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    )

    items = []
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return items
        for item_el in channel.findall("item")[:10]:
            title_el = item_el.find("title")
            link_el = item_el.find("link")
            pubdate_el = item_el.find("pubDate")
            desc_el = item_el.find("description")
            items.append({
                "title": title_el.text if title_el is not None else "",
                "url": link_el.text if link_el is not None else "",
                "pub_date": pubdate_el.text if pubdate_el is not None else "",
                "snippet": desc_el.text if desc_el is not None else "",
                "source_type": "auction",
            })
    except Exception as e:
        print(f"  ⚠️ fetch_auction_records 失敗：{e}")

    return items


# ──────────────────────────────────────────────
# C. resolve_and_verify_address — 地址驗證層（無 jitter）
# ──────────────────────────────────────────────
def resolve_and_verify_address(
    city: str,
    dist: str,
    raw_address: str,
    gmaps_key: str,
) -> tuple[Optional[str], Optional[float], Optional[float], str]:
    """
    回傳: (final_addr, lat, lng, precision)
    precision: exact / approximate / district_center / failed
    完全移除 random.uniform，改用明確精度等級。
    """

    # 1. 地址未明確揭露 → 直接失敗
    if not raw_address or raw_address.strip() == "未明確揭露":
        return (None, None, None, "failed")

    # 補齊地址前綴
    full_query = raw_address
    if city not in raw_address:
        full_query = city + dist + raw_address

    # 2. Google Maps Geocoding API
    if gmaps_key:
        try:
            params = {
                "address": full_query,
                "key": gmaps_key,
                "language": "zh-TW",
                "region": "TW",
            }
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                result = data["results"][0]
                location_type = result["geometry"]["location_type"]
                lat = result["geometry"]["location"]["lat"]
                lng = result["geometry"]["location"]["lng"]
                formatted = result.get("formatted_address", "")

                # 判斷精度
                has_number = any(c.isdigit() for c in formatted[-10:])  # 末段有號碼
                if location_type == "ROOFTOP" and has_number:
                    precision = "exact"
                else:
                    precision = "approximate"

                return (formatted, lat, lng, precision)
        except Exception as e:
            print(f"  ⚠️ Google Maps Geocoding 失敗：{e}")

    # 3. TGOS 備援
    try:
        tgos_url = f"https://addr.tgos.tw/ADDR/json?ver=3&addr={urllib.parse.quote(full_query)}"
        resp = requests.get(tgos_url, timeout=15, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        # TGOS 回傳格式: [{"x": ..., "y": ..., "address": ...}, ...]
        if isinstance(data, list) and len(data) > 0:
            rec = data[0]
            # TGOS 使用 TWD97，需轉換；若有 wgs84x/wgs84y 則直接取
            lng = float(rec.get("wgs84x", rec.get("x", 0)))
            lat = float(rec.get("wgs84y", rec.get("y", 0)))
            if lat != 0 and lng != 0:
                return (rec.get("address", full_query), lat, lng, "approximate")
    except Exception as e:
        print(f"  ⚠️ TGOS 查詢失敗：{e}")

    # 4. 全部失敗 → 使用縣市固定座標
    base = CITY_BASE_COORDS.get(city)
    if base:
        return (f"{city}{dist}", base[0], base[1], "district_center")

    return (None, None, None, "failed")


# ──────────────────────────────────────────────
# D. compute_verification_score — 動態評分
# ──────────────────────────────────────────────
def compute_verification_score(
    evidence_quality: str,
    precision: str,
    has_judicial_id: bool,
    source_count: int,
) -> int:
    score = 0

    # evidence_quality
    if evidence_quality == "judicial_ruling":
        score += 60
    elif evidence_quality == "mainstream_news":
        score += 40
    elif evidence_quality == "rss_snippet":
        score += 15

    # precision
    if precision == "exact":
        score += 20
    elif precision == "approximate":
        score += 10
    elif precision == "district_center":
        score += 0

    # judicial id
    if has_judicial_id:
        score += 15

    # multi source
    if source_count >= 2:
        score += 5

    return min(score, 100)


# ──────────────────────────────────────────────
# E. snapshot_url — Wayback Machine 存證
# ──────────────────────────────────────────────
def snapshot_url(url: str) -> str:
    """嘗試提交到 Wayback Machine，失敗時回傳原 url。"""
    if not url or "archive.org" in url:
        return url
    try:
        r = requests.get(
            f"https://web.archive.org/save/{url}",
            timeout=12,
            headers=HEADERS,
        )
        if r.status_code in [200, 201]:
            return f"https://web.archive.org/web/{url}"
    except Exception:
        pass
    return url


# ──────────────────────────────────────────────
# 資料庫輔助
# ──────────────────────────────────────────────
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY 環境變數")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def count_by_district(supabase: Client) -> dict:
    """回傳 {(city, district): count} 字典（主表 haunted_houses）。"""
    try:
        resp = supabase.table("haunted_houses").select("city, district").execute()
        counts: dict = {}
        for row in resp.data:
            key = (row["city"], row["district"])
            counts[key] = counts.get(key, 0) + 1
        return counts
    except Exception as e:
        print(f"  ❌ 無法盤點 DB：{e}")
        return {}


def insert_main_table(supabase: Client, record: dict) -> bool:
    """寫入 haunted_houses 主表。"""
    try:
        supabase.table("haunted_houses").insert(record).execute()
        return True
    except Exception as e:
        print(f"  ❌ 寫入主表失敗：{e}")
        return False


def insert_staging_table(supabase: Client, record: dict) -> bool:
    """寫入 unverified_incidents staging 表。"""
    try:
        supabase.table("unverified_incidents").insert(record).execute()
        return True
    except Exception as e:
        print(f"  ❌ 寫入 staging 失敗：{e}")
        return False


def parse_incident_date(date_str: str) -> Optional[str]:
    """
    把 LLM 輸出的日期字串轉成 SQL DATE 字串（YYYY-MM-DD）。
    若年份不合理或為 0000-00-00 則回傳 None。
    """
    if not date_str or date_str.startswith("0000"):
        return None
    # 嘗試 YYYY-MM-DD
    try:
        parts = date_str.split("-")
        year = int(parts[0])
        if year < 1900 or year >= 2025:
            return None
        month = int(parts[1]) if len(parts) > 1 and parts[1] != "00" else 1
        day = int(parts[2]) if len(parts) > 2 and parts[2] != "00" else 1
        return date(year, month, day).isoformat()
    except Exception:
        return None


# ──────────────────────────────────────────────
# G. main()
# ──────────────────────────────────────────────
def main():
    print("🏚️ EAW 凶宅爬蟲 v2.0（Grounded 版）啟動")
    print(f"📅 執行時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 初始化
    try:
        supabase = get_supabase()
        print("✅ Supabase 連線成功")
    except RuntimeError as e:
        print(f"❌ {e}")
        sys.exit(1)

    if not GEMINI_API_KEYS and not OPENAI_API_KEYS:
        print("❌ 缺少 GEMINI_API_KEYS 或 OPENAI_API_KEYS，無法進行 LLM 萃取")
        sys.exit(1)

    extractor = GroundedExtractor()

    # 1. 盤點 DB 現有資料
    print("\n📊 盤點資料庫現有資料...")
    existing_counts = count_by_district(supabase)
    print(f"  ✅ 已有資料的鄉鎮數：{len(existing_counts)}")

    # 2. 取出資料量最少的 35 個鄉鎮
    all_districts = TAIWAN_368_DISTRICTS[:]
    sorted_districts = sorted(
        all_districts,
        key=lambda d: existing_counts.get(d, 0),
    )
    target_districts = sorted_districts[:35]
    print(f"\n🎯 本次處理鄉鎮（資料量最少 35 個）：")
    for city, dist in target_districts:
        cnt = existing_counts.get((city, dist), 0)
        print(f"  - {city} {dist}（現有 {cnt} 筆）")

    # 統計
    stats = {
        "total_sources": 0,
        "extracted_incidents": 0,
        "skipped_not_incident": 0,
        "address_failed": 0,
        "inserted_main": 0,
        "inserted_staging": 0,
        "errors": 0,
    }

    print("\n🚀 開始爬取與萃取...")
    print("=" * 60)

    for city, dist in target_districts:
        print(f"\n🏘️ 處理：{city} {dist}")

        # 3a. 呼叫三個資料源爬蟲
        sources: list[dict] = []

        # 新聞三段
        for year_start, year_end in [(2000, 2010), (2010, 2018), (2018, 2024)]:
            batch = fetch_news_archive(city, dist, year_start, year_end)
            print(f"  📰 新聞 {year_start}-{year_end}：{len(batch)} 筆")
            sources.extend(batch)
            time.sleep(0.5)

        # 司法院
        judicial = fetch_judicial_cases(city, dist)
        print(f"  ⚖️ 司法院：{len(judicial)} 筆")
        sources.extend(judicial)
        time.sleep(0.5)

        # 法拍屋
        auction = fetch_auction_records(city, dist)
        print(f"  🏦 法拍屋：{len(auction)} 筆")
        sources.extend(auction)
        time.sleep(0.5)

        # 3b. 去重（同一 URL 不重複處理）
        seen_urls: set = set()
        unique_sources: list[dict] = []
        for s in sources:
            u = s.get("url", "")
            if u and u not in seen_urls:
                seen_urls.add(u)
                unique_sources.append(s)
            elif not u:
                unique_sources.append(s)  # 無 URL 照樣處理

        print(f"  🔍 去重後共 {len(unique_sources)} 筆來源")
        stats["total_sources"] += len(unique_sources)

        for source_item in unique_sources:
            # 3c. Grounded LLM 萃取
            result = extractor.extract_from_source(source_item, city, dist)
            time.sleep(1)  # 避免 rate limit

            if result is None:
                stats["errors"] += 1
                continue

            # 3d. is_incident == false → 跳過
            if not result.get("is_incident", False):
                stats["skipped_not_incident"] += 1
                continue

            stats["extracted_incidents"] += 1
            print(f"  ✅ 命中事件：{source_item.get('title', '')[:50]}")

            raw_address = result.get("raw_address_extracted", "未明確揭露")
            evidence_quality = result.get("evidence_quality", "rss_snippet")
            judicial_case_id = result.get("judicial_case_id", "")
            category = result.get("category", "未分類")
            cause_of_death = result.get("cause_of_death", "")
            case_summary = result.get("case_summary", "")
            news_publisher = result.get("news_publisher", "")
            incident_date_str = result.get("incident_date", "0000-00-00")

            # 3e. 地址驗證
            final_addr, lat, lng, precision = resolve_and_verify_address(
                city, dist, raw_address, GOOGLE_MAPS_API_KEY
            )

            if precision == "failed":
                stats["address_failed"] += 1
                print(f"    📍 地址無法解析，進入 staging")
            else:
                print(f"    📍 地址：{final_addr}（精度：{precision}）")

            # 3f. 計算 verification_score
            has_judicial_id = bool(judicial_case_id.strip())
            verification_score = compute_verification_score(
                evidence_quality, precision, has_judicial_id, source_count=1
            )
            print(f"    📊 驗證分數：{verification_score}")

            # 3g. Wayback Machine 存證
            source_url = source_item.get("url", "")
            archive_url = snapshot_url(source_url)

            # 解析日期
            incident_date_parsed = parse_incident_date(incident_date_str)

            # 3h. 雙層入庫
            address_for_db = final_addr if final_addr else f"{city}{dist}（地址未揭露）"

            if verification_score >= 60 and precision != "failed":
                # 寫入 haunted_houses 主表
                main_record = {
                    "city": city,
                    "district": dist,
                    "address": address_for_db,
                    "lat": lat,
                    "lng": lng,
                    "incident_date": incident_date_parsed,
                    "category": category,
                    "reason": cause_of_death,
                    "source_url": source_url,
                    "source_type": source_item.get("source_type", "news"),
                    "judicial_case_id": judicial_case_id,
                    "evidence_quality": evidence_quality,
                    "precision": precision,
                    "verification_score": verification_score,
                    "media_verification": news_publisher,
                    "archive_url": archive_url,
                    "description": case_summary,
                }
                ok = insert_main_table(supabase, main_record)
                if ok:
                    stats["inserted_main"] += 1
                    print(f"    ✅ 已寫入主表（分數 {verification_score}）")
                else:
                    stats["errors"] += 1
            else:
                # 寫入 unverified_incidents staging 表
                staging_record = {
                    "city": city,
                    "district": dist,
                    "address": address_for_db,
                    "raw_address_extracted": raw_address,
                    "lat": lat,
                    "lng": lng,
                    "incident_date": incident_date_parsed,
                    "category": category,
                    "reason": cause_of_death,
                    "source_url": source_url,
                    "source_type": source_item.get("source_type", "news"),
                    "judicial_case_id": judicial_case_id,
                    "evidence_quality": evidence_quality,
                    "precision": precision,
                    "verification_score": verification_score,
                    "media_verification": news_publisher,
                    "archive_url": archive_url,
                    "audit_status": "pending",
                }
                ok = insert_staging_table(supabase, staging_record)
                if ok:
                    stats["inserted_staging"] += 1
                    print(f"    🔶 已寫入 staging（分數 {verification_score}）")
                else:
                    stats["errors"] += 1

    # 4. 印出完整統計
    print("\n" + "=" * 60)
    print("📈 執行完成統計報告")
    print("=" * 60)
    print(f"  🔎 總來源條目數：       {stats['total_sources']}")
    print(f"  ✅ 命中事件數：         {stats['extracted_incidents']}")
    print(f"  ⏭️  非事件略過：        {stats['skipped_not_incident']}")
    print(f"  📍 地址無法解析：       {stats['address_failed']}")
    print(f"  🏠 寫入主表（≥60分）：  {stats['inserted_main']}")
    print(f"  🔶 寫入 staging：       {stats['inserted_staging']}")
    print(f"  ❌ 錯誤次數：           {stats['errors']}")
    print(f"  📅 完成時間：           {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print("🎉 EAW 爬蟲 v2.0 執行完畢！")


if __name__ == "__main__":
    main()
