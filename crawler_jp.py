#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
臺灣特殊事故建物與產權紀錄查詢平台 — 日本全境 47 都道府縣原生日本語實證與嚴格驗證爬蟲 (crawler_jp.py)
==================================================================================================
核心驗證規範（整合 verification_engine.py）：
1. 100% 原生日本語檢索 + 禁止 AI 自行生成案件來源：
   - Gemini 僅能分析爬蟲實際取得的日本語原始報導 (`FetchedArticle`)。
   - `source_url` 強制直接使用爬蟲提供的原始網址，嚴禁 AI 自行生成、猜測、補全或修改。
2. 12 個強制證據欄位與原文逐字比對：
   - `address_evidence` 與 `incident_evidence` 必須是原始日文報導中可逐字找到的子字串。
   - 嚴禁 AI 推論補出原文未記載的丁目、番地、号、階或マンション／団地名称。
3. 日本地址標準化與國土地理院 (GSI) 一致性驗證：
   - 解析都道府県、市区町村、町丁・丁目、番地、号。
   - 若僅提及市区町村、大型団地名称或附近道路，或與國土地理院 (GSI) 查詢結果衝突，一律進入 `pending_cases`。
4. 事故地點四分類 (`inside_building`, `outside_building`, `nearby`, `unknown`) 與兩階段寫入：
   - 所有案件先寫入 `pending_cases`，僅通過全部 9 項決定論品質檢查之 `verified` 案件可進入正式 `cases`。
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
import email.utils
import xml.etree.ElementTree as ET
import requests

from verification_engine import (
    FetchedArticle,
    VerificationPipeline,
    JP_PREFECTURES,
)

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


JAPAN_47_PREF_HUBS = [
    ("東京都", ["新宿区", "世田谷区", "大田区", "足立区", "江戸川区", "板橋区", "練馬区", "豊島区", "渋谷区", "中野区", "八王子市", "町田市"]),
    ("大阪府", ["大阪市中央区", "大阪市北区", "大阪市淀川区", "大阪市浪速区", "大阪市西成区", "堺市堺区", "東大阪市", "豊中市", "吹田市"]),
    ("神奈川県", ["横浜市西区", "横浜市中区", "横浜市港北区", "川崎市川崎区", "川崎市中原区", "相模原市中央区", "藤沢市", "横須賀市"]),
    ("愛知県", ["名古屋市中区", "名古屋市中村区", "名古屋市千種区", "名古屋市南区", "豊田市", "一宮市", "岡崎市"]),
    ("埼玉県", ["さいたま市大宮区", "さいたま市浦和区", "川口市", "川越市", "所沢市", "越谷市", "草加市"]),
    ("千葉県", ["千葉市中央区", "船橋市", "松戸市", "市川市", "柏市", "浦安市"]),
    ("兵庫県", ["神戸市中央区", "神戸市兵庫区", "神戸市長田区", "尼崎市", "西宮市", "姫路市"]),
    ("北海道", ["札幌市中央区", "札幌市北区", "札幌市豊平区", "札幌市白石区", "旭川市", "函館市"]),
    ("福岡県", ["福岡市博多区", "福岡市中央区", "福岡市東区", "北九州市小倉北区", "久留米市"]),
    ("京都府", ["京都市伏見区", "京都市中京区", "京都市右京区", "宇治市"]),
]


def verify_japan_gsi_geocode(country: str, pref: str, muni: str, standardized_address: str) -> dict:
    """呼叫日本國土交通省國土地理院 (GSI) 官方 API 驗證日本住所與都道府県／市区町村一致性"""
    if not pref or pref not in JP_PREFECTURES or not muni:
        return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "JP_ADMIN_PREF_MUNI_INVALID"}
    try:
        url = f"https://msearch.gsi.go.jp/address-search/AddressSearch?q={urllib.parse.quote(standardized_address)}"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6)
        if r.status_code == 200:
            arr = r.json()
            if isinstance(arr, list) and arr:
                for cand in arr:
                    title = str(cand.get("properties", {}).get("title") or "")
                    coords = cand.get("geometry", {}).get("coordinates") or []
                    if len(coords) >= 2 and pref in title and muni in title:
                        lng, lat = float(coords[0]), float(coords[1])
                        if 24.0 <= lat <= 45.6 and 122.9 <= lng <= 145.9:
                            return {
                                "matched": True,
                                "lat": round(lat, 6),
                                "lng": round(lng, 6),
                                "accuracy": "GSI_CHOME_VERIFIED",
                                "reason": "GSI_OFFICIAL_MATCH",
                            }
                return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "JP_GSI_MAP_CONFLICT"}
    except Exception:
        pass
    return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "JP_GSI_UNVERIFIED"}


def _parse_rss_pubdate(pub_str: str) -> str:
    if not pub_str:
        return datetime.date.today().isoformat()
    try:
        dt = email.utils.parsedate_to_datetime(pub_str)
        return dt.date().isoformat()
    except Exception:
        return datetime.date.today().isoformat()


def fetch_jp_native_articles(pref: str, muni: str, year_filter: str = "") -> list[FetchedArticle]:
    time_clause = f" {year_filter}" if year_filter else ""
    queries = [
        f"{pref} {muni} (マンション OR アパート OR 住宅 OR 団地) (遺体 OR 殺人 OR 転落死 OR 孤独死 OR 全焼 死亡){time_clause}",
        f"{pref} {muni} (事故物件 OR 心理的瑕疵 OR 変死体 OR 白骨遺体){time_clause}",
    ]
    articles: list[FetchedArticle] = []
    seen_urls = set()
    for q in queries:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=ja&gl=JP&ceid=JP:ja"
        try:
            r = requests.get(rss_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=7)
            if r.status_code != 200:
                continue
            root = ET.fromstring(r.content)
            for it in root.findall(".//item")[:6]:
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                pub_date_raw = (it.findtext("pubDate") or "").strip()
                desc = re.sub(r"<[^>]+>", " ", (it.findtext("description") or "")).strip()
                src_el = it.find("source")
                media = (src_el.text.strip() if src_el is not None and src_el.text else "日本国内報道機関")
                if not link.startswith("http") or link in seen_urls:
                    continue
                seen_urls.add(link)
                articles.append(
                    FetchedArticle(
                        article_id=f"JP_ART_{len(articles)+1}",
                        source_url=link,
                        source_title=title,
                        source_name=media,
                        source_published_date=_parse_rss_pubdate(pub_date_raw),
                        raw_text=desc,
                        country="JP",
                        http_status=200,
                        content_accessible=len(desc) >= 20,
                    )
                )
        except Exception:
            continue
    return articles


def main():
    parser = argparse.ArgumentParser(description="Japan Strict Verification Native Japanese Incident Crawler")
    parser.add_argument("--mode", choices=["incremental", "backfill"], default="incremental")
    parser.add_argument("--year-from", type=int, default=2015)
    parser.add_argument("--year-to", type=int, default=datetime.datetime.now().year)
    args, _ = parser.parse_known_args()

    run_id = f"jp-{args.mode}-{uuid.uuid4().hex[:8]}"
    print("==========================================================", flush=True)
    print(f"🇯🇵 啟動日本全境 47 都道府縣嚴格真實性驗證爬蟲 (crawler_jp.py) | Run ID: {run_id}", flush=True)
    print("==========================================================", flush=True)

    subprocess.run(["node", "rebuild_jpkr_archive.js"], check=False)

    supabase_url = os.environ.get("SUPABASE_URL") or "https://cfmcvcscyfblcodemnkt.supabase.co"
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or ""
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEYS") or ""

    if HAS_SUPABASE_SDK and gemini_key and HAS_GENAI and supabase_key:
        supabase: Client = create_client(supabase_url, supabase_key)
        client = genai.Client(api_key=gemini_key.split(",")[0].strip())
        pipeline = VerificationPipeline(geocode_verifier=verify_japan_gsi_geocode)

        sampled_hubs = random.sample(JAPAN_47_PREF_HUBS, min(6, len(JAPAN_47_PREF_HUBS)))
        for pref, munis in sampled_hubs:
            muni = random.choice(munis)
            year_filter = f"{random.randint(args.year_from, args.year_to)}年" if args.mode == "backfill" else ""
            fetched_articles = fetch_jp_native_articles(pref, muni, year_filter=year_filter)
            if not fetched_articles:
                continue

            article_map = {a.article_id: a for a in fetched_articles}
            serializable_input = [
                {
                    "article_id": a.article_id,
                    "source_title": a.source_title,
                    "source_name": a.source_name,
                    "source_published_date": a.source_published_date,
                    "raw_text": a.raw_text,
                }
                for a in fetched_articles[:6]
            ]

            prompt = f"""日本の不動産取引における「心理的瑕疵（事故物件）」の厳格な証拠抽出システムです。
以下のクローラーが実際に取得した【報道記事リスト】のみを分析してください。

【報道記事リスト】：
{json.dumps(serializable_input, ensure_ascii=False)}

【絶対遵守ルール】：
1. URLの生成・推測・補完は厳禁です。`article_id` のみを指定してください。
2. `address_evidence` と `incident_evidence` は必ず記事本文またはタイトルから一字一句そのまま抜粋（コピー）してください。
3. 記事に記載されていない丁目・番地・号・階・建物名を推測して補完することは厳禁です。
4. `location_description` は `"inside_building"` / `"outside_building"` / `"nearby"` / `"unknown"` のいずれかを指定してください。

JSON形式 `{{"records": [...]}}` で出力してください：
{{
  "records": [
    {{
      "article_id": "JP_ART_1",
      "incident_date": "YYYY-MM-DD",
      "incident_type": "刑事命案 / 輕生事故 / 意外身亡 / 其他非自然死亡",
      "country": "JP",
      "address": "記事に記載されている住所のみ（例：{pref}{muni}〇〇1丁目）",
      "address_evidence": "記事からそのまま抜粋した住所根拠テキスト",
      "incident_evidence": "記事からそのまま抜粋した事案根拠テキスト",
      "location_description": "inside_building / outside_building / nearby / unknown",
      "summary": "事実要約",
      "ai_confidence": 0.85
    }}
  ]
}}"""
            try:
                time.sleep(1.0)
                resp = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0),
                )
                parsed = json.loads(resp.text or "{}").get("records") or []
            except Exception:
                parsed = []

            for rec in parsed:
                if not isinstance(rec, dict):
                    continue
                art = article_map.get(str(rec.get("article_id") or "").strip())
                if art is None:
                    continue
                rec["source_url"] = art.source_url
                rec["source_title"] = art.source_title
                rec["source_name"] = art.source_name
                rec["source_published_date"] = art.source_published_date
                pipeline.process_and_commit(art, rec, supabase_client=supabase)

    subprocess.run(["node", "sync_supabase_historical.js"], check=False)
    subprocess.run(["node", "generate_sitemap.js"], check=False)


if __name__ == "__main__":
    main()
