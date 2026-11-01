#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
臺灣特殊事故建物與產權紀錄查詢平台 — 台灣真實案件自動化蒐集與查證系統 (crawler_tw.py)
========================================================================================
設計原則：
1. 100% 證據驅動（Evidence-Only）：僅能從真實新聞、司法院裁判書、法院法拍公告及政府公開資料擷取，嚴禁 AI 憑空生成案件。
2. 嚴格凶宅判定：
   - 排除一般無傷亡火災、單純自然病逝、道路車禍或未經查證之網路傳聞。
   - 若新聞僅提及某社區名稱而無具體路街段巷或無法確認是否為專有部分事故，一律移入 `pending_cases` 待查證表，不直接公開。
3. 多來源歸戶與去重（Multi-Source Deduplication）：
   - 同一案件若由多家媒體報導，主表 `haunted_houses` (檢視表 `cases`) 僅保留單一案件，並將所有原始新聞連結寫入 `case_sources`。
4. 支援兩種執行模式：
   - `--mode incremental`（預設，GitHub Actions 每 6 小時定時增量巡檢）
   - `--mode backfill --year-from 2000 --year-to 2026`（歷年歷史資料回溯）
"""

import os
import re
import sys
import uuid
import json
import time
import random
import argparse
import datetime
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
import requests

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    BeautifulSoup = None
    HAS_BS4 = False

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    genai = None
    types = None
    HAS_GENAI = False

try:
    from supabase import create_client, Client
    HAS_SUPABASE_SDK = True
except ImportError:
    create_client = None
    Client = object
    HAS_SUPABASE_SDK = False


# ==============================================================================
# 1. 台灣繁體中文多維度檢索關鍵字矩陣（涵蓋新聞、裁判書、法拍、警消實證）
# ==============================================================================
TW_SEARCH_KEYWORD_MATRIX = {
    "news_homicide": [
        "住宅 命案 陳屍 警方 封鎖",
        "公寓 砍殺 刺死 兇嫌 命案",
        "大樓 勒斃 分屍 情殺 仇殺 陳屍",
        "出租套房 命案 房東 發現 遺體",
        "透天厝 逆倫 弒親 命案 相驗",
    ],
    "news_suicide_jump": [
        "社區大樓 墜樓 當場死亡 報驗",
        "公寓 燒炭 一氧化碳 輕生 陳屍",
        "住宅 尋短 輕生 破門 明顯死亡",
        "大樓 墜落 中庭 露台 送醫不治",
    ],
    "news_fatal_fire_lonely": [
        "民宅 火警 惡火 焦屍 葬身火窟",
        "公寓 火災 受困 嗆傷 送醫不治 1死",
        "住宅 一氧化碳中毒 熱水器 不治身亡",
        "獨居 孤獨死 陳屍多日 發出異味 破門",
    ],
    "judicial_auction": [
        "法拍 凶宅 拍賣公告 非自然死亡 底價",
        "地方法院 民事執行處 查封筆錄 屋內 輕生 命案",
        "行政執行署 拍賣 事故屋 凶宅 點交",
    ],
    "judicial_judgment": [
        "地方法院 民事判決 凶宅 物之瑕疵擔保 減少價金",
        "高等法院 判決 隱瞞 非自然死亡 不動產說明書",
    ],
}

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


# ==============================================================================
# 2. 台灣地址標準化與空間定位驗證器
# ==============================================================================
ZH_DIGIT_MAP = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
ARABIC_TO_ZH_SEC = {
    "1段": "一段", "2段": "二段", "3段": "三段", "4段": "四段", "5段": "五段",
    "6段": "六段", "7段": "七段", "8段": "八段", "9段": "九段", "10段": "十段"
}


def _zh_num_to_arabic(zh_str: str) -> str:
    if re.match(r"^\d+$", zh_str):
        return zh_str
    if zh_str == "十":
        return "10"
    if "十" in zh_str:
        parts = zh_str.split("十")
        t = ZH_DIGIT_MAP.get(parts[0], 1) if parts[0] else 1
        o = ZH_DIGIT_MAP.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
        return str(t * 10 + o)
    return "".join(str(ZH_DIGIT_MAP.get(ch, ch)) for ch in zh_str)


def standardize_taiwan_address(raw_addr: str, city: str, dist: str) -> dict:
    """
    將台灣地址標準化為：
    - standardized_doorplate: 臺北市萬華區寶興街XX巷
    - display_address: 臺北市萬華區寶興街XX巷（傳統公寓住宅）
    - has_concrete_road: 是否包含明確路／街／大道／巷／村里門牌（若僅有社區名稱則為 False）
    - is_community_only: 是否僅提及社區名稱而無具體路街與棟別
    """
    s = str(raw_addr or "").strip()
    s = s.replace("台", "臺").replace("巿", "市")
    # 全形數字轉半形
    s = s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    # 段數統一轉中文數字（一段～九段）
    for k, v in ARABIC_TO_ZH_SEC.items():
        s = s.replace(k, v)
    # 巷、弄、號、樓統一轉阿拉伯數字
    s = re.sub(
        r"([一二三四五六七八九十〇零]{1,3})(巷|弄|號|樓)",
        lambda m: f"{_zh_num_to_arabic(m.group(1))}{m.group(2)}",
        s
    )

    bldg_match = re.search(
        r"(社區電梯大樓|傳統公寓住宅|電梯華廈|透天厝住宅|住商混合大樓|出租套房大樓|老舊公寓|透天厝|電梯大樓|住宅大樓|集合住宅|出租套房|國宅)",
        s
    )
    bldg_type = bldg_match.group(1) if bldg_match else "集合住宅大樓"

    clean_core = re.sub(r"[（(].*?[）)]", "", s).strip()
    clean_core = re.sub(r"某(社區|電梯|傳統|透天|出租|住商|公寓|大樓|華廈|民宅|住宅|套房|別墅|國宅).*$", "", clean_core)
    clean_core = re.sub(r"附近.*$", "", clean_core).strip()

    body_after_dist = clean_core.replace(city, "").replace(dist, "").strip()
    road_match = re.search(
        r"([一-龥]{2,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?(?:\d+巷)?(?:\d+弄)?(?:\d+號)?)",
        body_after_dist
    )
    comm_match = re.search(r"「([^」]{2,14})」|([一-龥]{2,8}(?:社區|國宅|大樓|華廈|新城))", body_after_dist)
    community_name = (comm_match.group(1) or comm_match.group(2)) if comm_match else ""

    if not road_match:
        return {
            "has_concrete_road": False,
            "is_community_only": bool(community_name),
            "standardized_doorplate": f"{city}{dist}{body_after_dist}",
            "display_address": f"{city}{dist}{body_after_dist}（{bldg_type}）",
            "road_part": "",
            "community_name": community_name,
            "building_type": bldg_type,
        }

    road_part = road_match.group(1)
    # 重要防呆：不能因為新聞僅提及某大型社區且無門牌號數，就將整個社區直接列為凶宅
    doorplate = f"{city}{dist}{road_part}"
    display = f"{doorplate}（{bldg_type}）"
    return {
        "has_concrete_road": True,
        "is_community_only": False,
        "standardized_doorplate": doorplate,
        "display_address": display,
        "road_part": road_part,
        "community_name": community_name,
        "building_type": bldg_type,
    }


def geocode_taiwan_address(doorplate: str, dist: str, gmaps_key: str) -> tuple[float, float, str]:
    """使用 Google Maps Geocoding API 與 ArcGIS 雙重驗證台灣門牌／路段座標"""
    active_key = gmaps_key or os.environ.get("GOOGLE_MAPS_API_KEY") or ""
    if active_key:
        try:
            q_for_google = doorplate.replace("新臺五路", "新台五路")
            url = (
                f"https://maps.googleapis.com/maps/api/geocode/json"
                f"?address={urllib.parse.quote(q_for_google)}&region=tw&language=zh-TW&key={active_key}"
            )
            res = requests.get(url, timeout=6).json()
            if res.get("status") == "OK" and res.get("results"):
                best = res["results"][0]
                types_list = best.get("types") or []
                loc_type = best.get("geometry", {}).get("location_type", "APPROXIMATE")
                fmt = (best.get("formatted_address") or "").replace("台", "臺").replace("区", "區")
                if not any(t in types_list for t in ["administrative_area_level_1", "administrative_area_level_2", "administrative_area_level_3"]):
                    if dist in fmt or dist[:-1] in fmt:
                        loc = best["geometry"]["location"]
                        lat, lng = float(loc["lat"]), float(loc["lng"])
                        if 21.8 <= lat <= 26.4 and 118.1 <= lng <= 122.2:
                            return round(lat, 6), round(lng, 6), loc_type
        except Exception:
            pass

    try:
        q_arc = doorplate.replace("新臺五路", "新台五路")
        arc_url = (
            f"https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
            f"?SingleLine={urllib.parse.quote(q_arc)}&countryCode=TWN&maxLocations=1&f=json"
        )
        arc_res = requests.get(arc_url, timeout=6).json()
        cands = arc_res.get("candidates") or []
        if cands and cands[0].get("score", 0) >= 84 and cands[0].get("location"):
            cand_addr = (cands[0].get("address") or "").replace("台", "臺")
            dist_short = dist[:-1] if len(dist) > 2 else dist
            if dist_short in cand_addr:
                lat = float(cands[0]["location"]["y"])
                lng = float(cands[0]["location"]["x"])
                if 21.8 <= lat <= 26.4 and 118.1 <= lng <= 122.2:
                    return round(lat, 6), round(lng, 6), "STREET_GEOCODED"
    except Exception:
        pass

    return 0.0, 0.0, "UNVERIFIED"


# ==============================================================================
# 3. 公開新聞、法拍與裁判書 RSS / HTML 擷取器
# ==============================================================================
def fetch_article_body_snippet(url: str) -> str:
    """嘗試抓取原始文章頁面內文前 600 字，提供 AI 抽取更精確之案發路段與日期"""
    if not url or not url.startswith("http") or not HAS_BS4:
        return ""
    try:
        r = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=5,
            allow_redirects=True,
        )
        if r.status_code != 200 or "text/html" not in (r.headers.get("Content-Type") or ""):
            return ""
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) >= 20]
        body = " ".join(paragraphs)[:650]
        return body
    except Exception:
        return ""


def fetch_tw_public_sources(city: str, dist: str, year_filter: str = "") -> list[dict]:
    """
    結合 Google News RSS 與 Bing News RSS 抓取台灣地方社會新聞、法拍公告報導與法院判決報導
    """
    short_c = city.replace("臺", "台")[:2]
    short_d = dist[:-1] if len(dist) > 2 else dist
    time_clause = f" {year_filter}" if year_filter else ""
    queries = [
        f"{short_c} {short_d} (命案 OR 陳屍 OR 墜樓 OR 凶宅 OR 住宅火警 OR 一氧化碳中毒){time_clause}",
        f"{short_c} {short_d} (法拍 凶宅 OR 查封筆錄 非自然死亡 OR 判決 隱瞞凶宅){time_clause}",
    ]
    collected = []
    seen_links = set()

    for q in queries:
        g_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        b_url = f"https://www.bing.com/news/search?q={urllib.parse.quote(q)}&format=rss&mkt=zh-TW"
        for feed_url, feed_provider in [(g_url, "GoogleNews_TW"), (b_url, "BingNews_TW")]:
            try:
                r = requests.get(feed_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=7)
                if r.status_code != 200:
                    continue
                root = ET.fromstring(r.content)
                for it in root.findall(".//item")[:8]:
                    title = (it.findtext("title") or "").strip()
                    link = (it.findtext("link") or "").strip()
                    pub_date = (it.findtext("pubDate") or "").strip()
                    desc = re.sub(r"<[^>]+>", " ", (it.findtext("description") or "")).strip()
                    source_el = it.find("source")
                    media_name = (source_el.text.strip() if source_el is not None and source_el.text else "")
                    if not media_name and " - " in title:
                        media_name = title.rsplit(" - ", 1)[-1].strip()
                    if not link.startswith("http") or link in seen_links:
                        continue
                    seen_links.add(link)
                    body_snippet = fetch_article_body_snippet(link) if len(collected) < 4 else ""
                    collected.append({
                        "title": title,
                        "link": link,
                        "pub_date": pub_date,
                        "media_name": media_name or feed_provider,
                        "snippet": f"{desc} {body_snippet}".strip()[:700],
                    })
            except Exception:
                continue
    return collected


# ==============================================================================
# 4. 嚴格純文字 AI 證據抽取引擎（禁止憑空捏造，支援待查證分流）
# ==============================================================================
class EvidenceExtractorAI:
    def __init__(self, gemini_keys_str: str, openai_keys_str: str):
        self.gemini_keys = [k.strip() for k in (gemini_keys_str or "").split(",") if k.strip()]
        self.openai_keys = [k.strip() for k in (openai_keys_str or "").split(",") if k.strip()]
        self.gemini_clients = [genai.Client(api_key=k) for k in self.gemini_keys] if (HAS_GENAI and self.gemini_keys) else []

    def extract_verified_incidents(self, city: str, dist: str, articles: list[dict]) -> list[dict]:
        if not articles or not self.gemini_clients:
            return []
        prompt = f"""你是「臺灣特殊事故建物與產權紀錄查詢平台」的法務與新聞證據查核系統。
請嚴格從下方提供的【真實公開文章列表】中，辨識並抽取位於【{city}{dist}】的住宅非自然死亡事故（兇殺命案、輕生／墜樓、住宅奪命火警、一氧化碳中毒、孤獨死、法院法拍凶宅或瑕疵擔保判決）。

【真實公開文章列表】：
{json.dumps(articles[:10], ensure_ascii=False)}

【嚴格真實性與防幻覺規範】：
1. 絕對禁止憑空編造案件、地址、日期或網址！每筆輸出的 `source_url` 必須 100% 來自上方文章列表的 `link`。
2. 排除以下非凶宅事件：
   - 一般無人員死亡之火災（「無人傷亡」、「幸無大礙」）
   - 道路交通事故、工廠工安意外、醫院內病逝、山區／河域溺水
   - 未經證實之靈異傳聞或都市傳說
3. 地址精確度與社區防誤判規範：
   - 若文章明確記載「路／街／大道／段／巷」等具體地點，請填入 `extracted_location` 並設 `has_specific_road: true`。
   - 若文章僅提及某個大型社區名稱（如「某國宅」、「XX社區」）但無具體路街或無法確認發生於哪一棟，或者僅提及行政區而無路名，請將 `is_ambiguous_location` 設為 `true`（系統會自動將其放入 `pending_cases` 待查證資料表，不會直接公開誤傷整個社區）。

請輸出純 JSON 格式 `{{"records": [...]}}`：
{{
  "records": [
    {{
      "source_url": "上方文章列表中對應的真實 link",
      "source_title": "上方文章的原始 title",
      "source_name": "新聞媒體或法院機構名稱",
      "source_type": "news / judicial_auction / judicial_judgment / government_open_data",
      "incident_date": "YYYY-MM-DD（從內文或 pub_date 推算之案發或報導日期）",
      "extracted_location": "{city}{dist}+文章中提及的路街段巷或地點原文",
      "building_type": "社區電梯大樓 / 傳統公寓住宅 / 透天厝住宅 / 出租套房 / 集合住宅大樓",
      "category": "刑事命案 / 輕生事故 / 意外身亡 / 其他非自然死亡 / 法拍與其他",
      "summary": "根據文章客觀摘錄事故發生經過、傷亡確認與警消／法院查證摘要（80~180字）",
      "has_specific_road": true,
      "is_ambiguous_location": false,
      "pending_reason": "若 is_ambiguous_location 為 true，請說明原因（如 ADDRESS_TOO_VAGUE 或 COMMUNITY_ONLY_NO_UNIT），否則填空字串",
      "ai_confidence": 0.92
    }}
  ]
}}"""
        for client in self.gemini_clients:
            for model_name in ["gemini-2.5-flash", "gemini-flash-latest"]:
                try:
                    time.sleep(1.2)
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1,
                        ),
                    )
                    raw = (resp.text or "").strip()
                    data = json.loads(raw)
                    if isinstance(data, dict) and isinstance(data.get("records"), list):
                        return data["records"]
                except Exception:
                    continue
        return []


# ==============================================================================
# 5. 案件指紋計算與跨媒體重複案件歸戶
# ==============================================================================
def build_case_fingerprint(country: str, city: str, dist: str, road_part: str, incident_date: str, category: str) -> str:
    ym = (incident_date or "2024-01")[:7]
    clean_road = re.sub(r"\d+號.*$", "", road_part or "").strip()
    return f"{country}_{city}_{dist}_{clean_road}_{ym}_{category}"


def main():
    parser = argparse.ArgumentParser(description="Taiwan Verified Property Incident Crawler")
    parser.add_argument("--mode", choices=["incremental", "backfill"], default="incremental")
    parser.add_argument("--year-from", type=int, default=2015)
    parser.add_argument("--year-to", type=int, default=datetime.datetime.now().year)
    parser.add_argument("--max-districts", type=int, default=28)
    args, _ = parser.parse_known_args()

    supabase_url = os.environ.get("SUPABASE_URL") or "https://cfmcvcscyfblcodemnkt.supabase.co"
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbWN2Y3NjeWZibGNvZGVtbmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDA4ODEsImV4cCI6MjEwNzg3Njg4MX0.GNqVP4IfmPW5Nxbx7K5zcGwu3RI05ZnPoEOuOasQApo"
    )
    gemini_keys = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    openai_keys = os.environ.get("OPENAI_API_KEYS") or ""
    gmaps_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("VITE_GOOGLE_MAPS_API_KEY") or ""

    run_id = f"tw-{args.mode}-{uuid.uuid4().hex[:8]}"
    print(f"🇹🇼 啟動台灣真實事故建物查證爬蟲 | Run ID: {run_id} | 模式: {args.mode}", flush=True)

    # 先執行既有的 RSS 實證與歷史歸檔同步器，確保基礎實證庫完整
    subprocess.run(["node", "sync_supabase_historical.js"], check=False)

    if not HAS_SUPABASE_SDK or not gemini_keys:
        print("ℹ️ 未提供額外 GEMINI_API_KEY，已完成無金鑰 Google/Bing RSS 實證同步與網站靜態庫更新。", flush=True)
        return

    supabase: Client = create_client(supabase_url, supabase_key)
    ai = EvidenceExtractorAI(gemini_keys, openai_keys)

    # 建立 crawl_logs 初始紀錄
    try:
        supabase.table("crawl_logs").insert({
            "run_id": run_id,
            "country": "TW",
            "crawl_mode": args.mode,
            "sources_queried": ["GoogleNews_TW", "BingNews_TW", "Judicial_Auction_News", "Judicial_Judgment_News"],
            "status": "running",
        }).execute()
    except Exception:
        pass

    # 讀取既有案件建立去重索引 (address -> row, fingerprint -> row)
    existing_by_addr = {}
    existing_by_fp = {}
    try:
        res = supabase.table("haunted_houses").select(
            "id,city,district,address,doorplate_address,incident_date,category,source_url,media_verification,merged_count,case_fingerprint"
        ).limit(10000).execute()
        for row in (res.data or []):
            addr = str(row.get("address") or "").replace("台", "臺").strip()
            existing_by_addr[addr] = row
            fp = row.get("case_fingerprint")
            if fp:
                existing_by_fp[fp] = row
    except Exception as e:
        print(f"⚠️ 讀取既有案件索引提示: {e}", flush=True)

    all_pairs = [(c, d) for c, dists in TAIWAN_368_DISTRICTS.items() for d in dists]
    random.shuffle(all_pairs)
    target_pairs = all_pairs[: args.max_districts]

    articles_fetched = 0
    cases_inserted = 0
    sources_linked = 0
    pending_saved = 0
    duplicates_merged = 0

    for idx, (city, dist) in enumerate(target_pairs):
        year_filter = ""
        if args.mode == "backfill":
            picked_year = random.randint(args.year_from, args.year_to)
            year_filter = f"{picked_year}年"

        articles = fetch_tw_public_sources(city, dist, year_filter=year_filter)
        if not articles:
            continue
        articles_fetched += len(articles)
        valid_url_map = {a["link"]: a for a in articles}

        extracted = ai.extract_verified_incidents(city, dist, articles)
        for item in extracted:
            if not isinstance(item, dict):
                continue
            src_url = str(item.get("source_url") or "").strip()
            if not src_url.startswith("http") or src_url not in valid_url_map:
                continue
            summary = str(item.get("summary") or "").strip()
            if len(summary) < 15 or re.search(r"無人傷亡|幸無人員傷亡|0人傷亡", summary):
                continue

            raw_loc = str(item.get("extracted_location") or "").strip()
            std = standardize_taiwan_address(raw_loc, city, dist)
            inc_date = str(item.get("incident_date") or datetime.date.today().isoformat())[:10]
            cat = str(item.get("category") or "法拍與其他").strip()
            src_name = str(item.get("source_name") or valid_url_map[src_url].get("media_name") or "台灣公開社會新聞").strip()
            src_title = str(item.get("source_title") or valid_url_map[src_url].get("title") or "").strip()
            src_type = str(item.get("source_type") or "news").strip()
            confidence = float(item.get("ai_confidence") or 0.85)

            # 若地點僅提及模糊社區名稱、無具體路街段巷、或 AI 判定待查證 -> 寫入 pending_cases
            if (
                not std["has_concrete_road"]
                or item.get("is_ambiguous_location") is True
                or confidence < 0.70
            ):
                p_reason = str(item.get("pending_reason") or ("COMMUNITY_ONLY_NO_UNIT" if std["is_community_only"] else "ADDRESS_TOO_VAGUE"))
                try:
                    supabase.table("pending_cases").upsert({
                        "country": "TW",
                        "city": city,
                        "district": dist,
                        "raw_location_text": raw_loc,
                        "standardized_address": std["standardized_doorplate"],
                        "incident_date": inc_date,
                        "category": cat,
                        "summary": summary,
                        "source_name": src_name,
                        "source_title": src_title,
                        "source_url": src_url,
                        "pending_reason": p_reason,
                        "ai_confidence": confidence,
                        "raw_payload": item,
                        "review_status": "pending",
                    }, on_conflict="source_url").execute()
                    pending_saved += 1
                except Exception:
                    pass
                continue

            # 進行台灣門牌／路段座標驗證
            lat, lng, loc_acc = geocode_taiwan_address(std["standardized_doorplate"], dist, gmaps_key)
            if lat == 0.0 or lng == 0.0:
                try:
                    supabase.table("pending_cases").upsert({
                        "country": "TW",
                        "city": city,
                        "district": dist,
                        "raw_location_text": raw_loc,
                        "standardized_address": std["standardized_doorplate"],
                        "incident_date": inc_date,
                        "category": cat,
                        "summary": summary,
                        "source_name": src_name,
                        "source_title": src_title,
                        "source_url": src_url,
                        "pending_reason": "GEOCODE_LOW_CONFIDENCE",
                        "ai_confidence": confidence,
                        "raw_payload": item,
                        "review_status": "pending",
                    }, on_conflict="source_url").execute()
                    pending_saved += 1
                except Exception:
                    pass
                continue

            fp = build_case_fingerprint("TW", city, dist, std["road_part"], inc_date, cat)
            matched_existing = existing_by_addr.get(std["display_address"]) or existing_by_fp.get(fp)

            # 若為同一事故的不同媒體報導 -> 不重複新增案件，僅關聯至 case_sources 並更新 merged_count
            if matched_existing and matched_existing.get("id"):
                case_id = matched_existing["id"]
                duplicates_merged += 1
                try:
                    supabase.table("case_sources").upsert({
                        "case_id": case_id,
                        "country": "TW",
                        "source_name": src_name,
                        "source_type": src_type,
                        "source_title": src_title,
                        "source_url": src_url,
                        "published_date": inc_date,
                        "raw_excerpt": summary[:300],
                    }, on_conflict="source_url").execute()
                    sources_linked += 1
                    new_merged = int(matched_existing.get("merged_count") or 1) + 1
                    supabase.table("haunted_houses").update({
                        "merged_count": new_merged,
                        "verification_status": "multi_source_verified",
                        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    }).eq("id", case_id).execute()
                except Exception:
                    pass
                continue

            # 寫入新查證案件至主表 haunted_houses
            new_row = {
                "country": "TW",
                "city": city,
                "district": dist,
                "address": std["display_address"],
                "doorplate_address": std["standardized_doorplate"],
                "lat": lat,
                "lng": lng,
                "incident_date": inc_date,
                "category": cat,
                "reason": f"【{src_name}公開查證】{src_title} — {summary}",
                "source": src_name,
                "source_title": src_title,
                "source_url": src_url,
                "media_verification": f"{src_name} 公開連結查證",
                "building_type": std["building_type"],
                "location_accuracy": loc_acc,
                "verification_status": "verified",
                "verification_score": int(confidence * 100),
                "case_fingerprint": fp,
                "source_type": src_type,
                "db_source": "JUDICIAL_AUCTION" if "法拍" in summary else ("JUDICIAL_JUDGMENT" if "判決" in summary else "NEWS_PUBLIC_ARCHIVE"),
                "history_timeline": [{"year": inc_date, "stage": "公開查證紀錄", "detail": summary}],
                "merged_count": 1,
            }
            try:
                ins = supabase.table("haunted_houses").upsert(new_row, on_conflict="address").execute()
                inserted_rows = ins.data or []
                cases_inserted += 1
                if inserted_rows and inserted_rows[0].get("id"):
                    cid = inserted_rows[0]["id"]
                    existing_by_addr[std["display_address"]] = inserted_rows[0]
                    existing_by_fp[fp] = inserted_rows[0]
                    supabase.table("case_sources").upsert({
                        "case_id": cid,
                        "country": "TW",
                        "source_name": src_name,
                        "source_type": src_type,
                        "source_title": src_title,
                        "source_url": src_url,
                        "published_date": inc_date,
                        "raw_excerpt": summary[:300],
                    }, on_conflict="source_url").execute()
                    sources_linked += 1
            except Exception as e:
                print(f"   ⚠️ 寫入異常: {e}", flush=True)

    # 更新 crawl_logs 完成紀錄
    try:
        supabase.table("crawl_logs").update({
            "articles_fetched": articles_fetched,
            "cases_inserted": cases_inserted,
            "sources_linked": sources_linked,
            "pending_saved": pending_saved,
            "duplicates_merged": duplicates_merged,
            "status": "completed",
            "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }).eq("run_id", run_id).execute()
    except Exception:
        pass

    print(
        f"✅ 台灣爬蟲執行完畢 | 抓取文章: {articles_fetched} | 新增核實案件: {cases_inserted} | "
        f"多來源歸戶合併: {duplicates_merged} | 移入待查證(pending_cases): {pending_saved}",
        flush=True,
    )
    subprocess.run(["node", "generate_sitemap.js"], check=False)


if __name__ == "__main__":
    main()
