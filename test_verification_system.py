#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
臺灣與日本特殊事故建物查詢平台 — 24 組資料真實性與防幻覺自動化驗證測試套件 (test_verification_system.py)
====================================================================================================
測試涵蓋範圍：
1. 台灣與日本正確且證據齊全之建物內案件 (Cases 01 - 04) -> verified
2. 虛構／竄改網址、404 不存在文章、無法存取內容 (Cases 05 - 07) -> rejected / pending
3. 標題不一致、AI 虛構證據文字、AI 推論補全原文未載之門牌號與樓層 (Cases 08 - 12) -> rejected
4. 地址模糊（僅行政區、僅大型社區名稱、日本無丁目）與地圖查詢衝突 (Cases 13 - 17) -> pending
5. 事故發生在建物外 (outside_building)、附近地標 (nearby)、地點不明 (unknown)、無傷亡火警 (Cases 18 - 21) -> rejected / pending
6. 虛構事故日期、Gemini 高信心分數 (0.99) 企圖闖關、重複案件與多媒體同案件合併 (Cases 22 - 24)
"""

import sys
import json
import datetime
from verification_engine import FetchedArticle, VerificationPipeline


def custom_test_geocode_verifier(country: str, city: str, district: str, standardized_address: str) -> dict:
    """模擬真實 Google Maps / 日本國土地理院 (GSI) 查詢與衝突檢測"""
    # 模擬地圖查詢衝突案例
    if "臺北市大安區中正路10巷5號" in standardized_address:
        return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "MAP_DISTRICT_CONFLICT"}
    if "東京都渋谷区道玄坂99丁目1番" in standardized_address:
        return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "JP_GSI_MAP_CONFLICT"}
    return VerificationPipeline._default_geocode_verifier(country, city, district, standardized_address)


def run_24_verification_tests():
    pipeline = VerificationPipeline(
        geocode_verifier=custom_test_geocode_verifier,
        reference_today=datetime.date(2026, 11, 1),
    )

    test_cases = [
        # ------------------------------------------------------------------
        # 1 ~ 4：真實有效之台灣與日本案件（應通過全部 9 項檢查 -> verified）
        # ------------------------------------------------------------------
        {
            "id": "TC01_TW_VALID_HOMICIDE_INSIDE",
            "desc": "台灣真實案件：萬華區公寓屋內命案（原文逐字證據齊全、地址精確、建物內）",
            "article": FetchedArticle(
                article_id="ART_01",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4601001",
                source_title="北市萬華寶興街公寓驚傳命案 警破門見男子陳屍屋內",
                source_name="自由時報",
                source_published_date="2026-03-15",
                raw_text="台北市萬華區寶興街40巷12號3樓一處傳統公寓今日上午驚傳命案，轄區警方獲報破門進入，發現一名52歲男子陳屍屋內客廳，現場拉起封鎖線採證。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4601001",
                "source_title": "北市萬華寶興街公寓驚傳命案 警破門見男子陳屍屋內",
                "source_name": "自由時報",
                "incident_date": "2026-03-15",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺北市萬華區寶興街40巷12號3樓",
                "address_evidence": "台北市萬華區寶興街40巷12號3樓一處傳統公寓",
                "incident_evidence": "轄區警方獲報破門進入，發現一名52歲男子陳屍屋內客廳",
                "location_description": "inside_building",
                "summary": "萬華區寶興街40巷12號3樓公寓發生屋內命案，警方破門發現男子陳屍屋內。",
                "ai_confidence": 0.92,
            },
            "expected_status": "verified",
            "expected_promoted": True,
        },
        {
            "id": "TC02_TW_VALID_COURT_AUCTION",
            "desc": "台灣真實案件：板橋區地方法院法拍查封筆錄載明屋內燒炭輕生（verified）",
            "article": FetchedArticle(
                article_id="ART_02",
                source_url="https://udn.com/news/story/7320/7890123",
                source_title="板橋中山路二段電梯華廈法拍 筆錄載明前屋主屋內燒炭身亡",
                source_name="聯合新聞網",
                source_published_date="2026-04-10",
                raw_text="新北地院今日公告拍賣位於新北市板橋區中山路二段85巷16號5樓之電梯華廈，查封筆錄明確記載前租客於屋內燒炭輕生不治身亡。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://udn.com/news/story/7320/7890123",
                "source_title": "板橋中山路二段電梯華廈法拍 筆錄載明前屋主屋內燒炭身亡",
                "source_name": "聯合新聞網",
                "incident_date": "2026-04-10",
                "incident_type": "輕生事故",
                "country": "TW",
                "address": "新北市板橋區中山路2段85巷16號5樓",
                "address_evidence": "位於新北市板橋區中山路二段85巷16號5樓之電梯華廈",
                "incident_evidence": "查封筆錄明確記載前租客於屋內燒炭輕生不治身亡",
                "location_description": "inside_building",
                "summary": "新北地院法拍板橋區中山路二段85巷16號5樓華廈，筆錄載明屋內燒炭身亡。",
                "ai_confidence": 0.95,
            },
            "expected_status": "verified",
            "expected_promoted": True,
        },
        {
            "id": "TC03_JP_VALID_MANSION_HOMICIDE",
            "desc": "日本真實案件：東京都新宿区歌舞伎町2丁目マンション室内殺人事件（verified）",
            "article": FetchedArticle(
                article_id="ART_03",
                source_url="https://www3.nhk.or.jp/news/html/20260512/k10014000011000.html",
                source_title="新宿区歌舞伎町のマンション室内で男性殺害 警視庁が捜査",
                source_name="NHKニュース",
                source_published_date="2026-05-12",
                raw_text="12日未明、東京都新宿区歌舞伎町2丁目15番のマンションの部屋の中で、住人の男性が血を流して倒れているのが見つかり、その場で死亡が確認されました。警視庁は殺人事件として捜査しています。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www3.nhk.or.jp/news/html/20260512/k10014000011000.html",
                "source_title": "新宿区歌舞伎町のマンション室内で男性殺害 警視庁が捜査",
                "source_name": "NHKニュース",
                "incident_date": "2026-05-12",
                "incident_type": "刑事命案",
                "country": "JP",
                "address": "東京都新宿区歌舞伎町2丁目15番",
                "address_evidence": "東京都新宿区歌舞伎町2丁目15番のマンションの部屋の中で",
                "incident_evidence": "住人の男性が血を流して倒れているのが見つかり、その場で死亡が確認されました",
                "location_description": "inside_building",
                "summary": "東京都新宿区歌舞伎町2丁目15番のマンション室内で住人男性が殺害された事件。",
                "ai_confidence": 0.94,
            },
            "expected_status": "verified",
            "expected_promoted": True,
        },
        {
            "id": "TC04_JP_VALID_APARTMENT_FIRE_FATALITY",
            "desc": "日本真實案件：大阪市浪速区日本橋3丁目アパート室内火災死亡（verified）",
            "article": FetchedArticle(
                article_id="ART_04",
                source_url="https://www.asahi.com/articles/ASS6020001",
                source_title="大阪・浪速区のアパート一室が全焼 焼け跡から1人の遺体",
                source_name="朝日新聞",
                source_published_date="2026-06-20",
                raw_text="20日午前、大阪府大阪市浪速区日本橋3丁目8番のアパートの一室から火が出て、室内が全焼し、焼け跡から住人とみられる1人の遺体が見つかりました。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www.asahi.com/articles/ASS6020001",
                "source_title": "大阪・浪速区のアパート一室が全焼 焼け跡から1人の遺体",
                "source_name": "朝日新聞",
                "incident_date": "2026-06-20",
                "incident_type": "意外身亡",
                "country": "JP",
                "address": "大阪府大阪市浪速区日本橋3丁目8番",
                "address_evidence": "大阪府大阪市浪速区日本橋3丁目8番のアパートの一室",
                "incident_evidence": "室内が全焼し、焼け跡から住人とみられる1人の遺体が見つかりました",
                "location_description": "inside_building",
                "summary": "大阪市浪速区日本橋3丁目8番のアパート一室が全焼し、焼け跡から遺体発見。",
                "ai_confidence": 0.91,
            },
            "expected_status": "verified",
            "expected_promoted": True,
        },

        # ------------------------------------------------------------------
        # 5 ~ 7：虛假網址、AI 竄改網址、404 不存在文章、無法存取內容
        # ------------------------------------------------------------------
        {
            "id": "TC05_AI_FABRICATED_URL",
            "desc": "AI 虛構或竄改新聞網址（與爬蟲原始網址不符 -> 強制 rejected）",
            "article": FetchedArticle(
                article_id="ART_05",
                source_url="https://www.cna.com.tw/news/asoc/202603010011.aspx",
                source_title="台中西屯住宅火警 警消搶救",
                source_name="中央社",
                source_published_date="2026-03-01",
                raw_text="台中市西屯區黎明路二段10巷8號民宅今日發生火警，屋內1人送醫不治。",
                country="TW",
            ),
            "candidate": {
                # AI 自行修改了網址尾碼
                "source_url": "https://www.cna.com.tw/news/asoc/202603019999_fake.aspx",
                "source_title": "台中西屯住宅火警 警消搶救",
                "source_name": "中央社",
                "incident_date": "2026-03-01",
                "incident_type": "意外身亡",
                "country": "TW",
                "address": "臺中市西屯區黎明路二段10巷8號",
                "address_evidence": "台中市西屯區黎明路二段10巷8號民宅",
                "incident_evidence": "今日發生火警，屋內1人送醫不治",
                "location_description": "inside_building",
                "ai_confidence": 0.98,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC06_ARTICLE_HTTP_404_NOT_FOUND",
            "desc": "原始文章不存在 (HTTP 404 -> 強制 rejected)",
            "article": FetchedArticle(
                article_id="ART_06",
                source_url="https://news.tvbs.com.tw/local/99999999",
                source_title="不存在的新聞標題",
                source_name="TVBS新聞網",
                source_published_date="2026-03-10",
                raw_text="",
                country="TW",
                http_status=404,
                content_accessible=False,
            ),
            "candidate": {
                "source_url": "https://news.tvbs.com.tw/local/99999999",
                "source_title": "不存在的新聞標題",
                "incident_date": "2026-03-10",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺北市中山區林森北路100號",
                "address_evidence": "臺北市中山區林森北路100號",
                "incident_evidence": "陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.90,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC07_ARTICLE_HTTP_503_UNCONFIRMED_CONTENT",
            "desc": "原始文章暫時無法存取或內容過短無法確認 (HTTP 503 -> pending)",
            "article": FetchedArticle(
                article_id="ART_07",
                source_url="https://www.ettoday.net/news/20260401/2700001.htm",
                source_title="高雄民宅驚傳意外",
                source_name="ETtoday",
                source_published_date="2026-04-01",
                raw_text="連線逾時",
                country="TW",
                http_status=503,
                content_accessible=False,
            ),
            "candidate": {
                "source_url": "https://www.ettoday.net/news/20260401/2700001.htm",
                "source_title": "高雄民宅驚傳意外",
                "incident_date": "2026-04-01",
                "incident_type": "其他非自然死亡",
                "country": "TW",
                "address": "高雄市三民區建國二路10號",
                "address_evidence": "高雄市三民區建國二路10號",
                "incident_evidence": "陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.88,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },

        # ------------------------------------------------------------------
        # 8 ~ 12：標題不符、AI 捏造不存在於原文的證據、AI 推論補全門牌或樓層
        # ------------------------------------------------------------------
        {
            "id": "TC08_SOURCE_TITLE_MISMATCH",
            "desc": "AI 回傳的 source_title 與爬蟲實際抓取的頁面標題不符 (-> rejected)",
            "article": FetchedArticle(
                article_id="ART_08",
                source_url="https://news.pts.org.tw/article/700001",
                source_title="台南永康住宅政策說明會 吸引大批市民參與",
                source_name="公視新聞",
                source_published_date="2026-05-01",
                raw_text="台南市永康區中華路120號今日舉辦社會住宅招租說明會，現場民眾踴躍。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.pts.org.tw/article/700001",
                "source_title": "台南永康中華路大樓驚傳命案",
                "incident_date": "2026-05-01",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺南市永康區中華路120號",
                "address_evidence": "台南市永康區中華路120號",
                "incident_evidence": "台南市永康區中華路120號今日舉辦社會住宅招租說明會",
                "location_description": "inside_building",
                "ai_confidence": 0.91,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC09_HALLUCINATED_ADDRESS_EVIDENCE",
            "desc": "AI 虛構原文中根本不存在的 address_evidence (-> rejected)",
            "article": FetchedArticle(
                article_id="ART_09",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4602002",
                source_title="桃園某出租套房驚傳房客陳屍屋內",
                source_name="自由時報",
                source_published_date="2026-05-03",
                raw_text="桃園市一名房東今日前往出租套房收租時，聞到濃烈異味，破門發現房客已陳屍屋內多日。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4602002",
                "source_title": "桃園某出租套房驚傳房客陳屍屋內",
                "incident_date": "2026-05-03",
                "incident_type": "其他非自然死亡",
                "country": "TW",
                "address": "桃園市桃園區中正路50巷6號4樓",
                # 原文根本沒寫中正路50巷6號4樓
                "address_evidence": "位於桃園市桃園區中正路50巷6號4樓的出租套房",
                "incident_evidence": "破門發現房客已陳屍屋內多日",
                "location_description": "inside_building",
                "ai_confidence": 0.95,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC10_HALLUCINATED_INCIDENT_EVIDENCE",
            "desc": "AI 虛構原文中不存在的 incident_evidence (-> rejected)",
            "article": FetchedArticle(
                article_id="ART_10",
                source_url="https://udn.com/news/story/7320/7890555",
                source_title="新竹市東區光復路一段公寓瓦斯外洩 消防員及時排煙無傷亡",
                source_name="聯合新聞網",
                source_published_date="2026-05-05",
                raw_text="新竹市東區光復路一段30巷5號一處公寓今日傳出瓦斯味，消防局到場關閉氣閥並通風，現場無人傷亡。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://udn.com/news/story/7320/7890555",
                "source_title": "新竹市東區光復路一段公寓瓦斯外洩 消防員及時排煙無傷亡",
                "incident_date": "2026-05-05",
                "incident_type": "意外身亡",
                "country": "TW",
                "address": "新竹市東區光復路一段30巷5號",
                "address_evidence": "新竹市東區光復路一段30巷5號一處公寓",
                "incident_evidence": "警消破門發現屋內住戶一氧化碳中毒明顯死亡",
                "location_description": "inside_building",
                "ai_confidence": 0.90,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC11_TW_AI_INFERRED_MISSING_DOORPLATE_AND_FLOOR",
            "desc": "台灣案例：原文僅寫『臺灣大道三段某大樓』，AI 自行推論補出『188號11樓』(-> rejected)",
            "article": FetchedArticle(
                article_id="ART_11",
                source_url="https://www.cna.com.tw/news/asoc/202605080022.aspx",
                source_title="台中西屯臺灣大道三段某大樓住戶陳屍屋內",
                source_name="中央社",
                source_published_date="2026-05-08",
                raw_text="台中市西屯區臺灣大道三段一棟住宅大樓今日下午傳出命案，警消破門發現一名住戶陳屍屋內。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://www.cna.com.tw/news/asoc/202605080022.aspx",
                "source_title": "台中西屯臺灣大道三段某大樓住戶陳屍屋內",
                "incident_date": "2026-05-08",
                "incident_type": "其他非自然死亡",
                "country": "TW",
                # AI 擅自補出原文未記載的 188號11樓
                "address": "臺中市西屯區臺灣大道三段188號11樓",
                "address_evidence": "台中市西屯區臺灣大道三段一棟住宅大樓",
                "incident_evidence": "警消破門發現一名住戶陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.93,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC12_JP_AI_INFERRED_MISSING_BANCHI_FLOOR",
            "desc": "日本案例：原文僅寫『東京都豊島区池袋2丁目のマンション』，AI 擅自補出『10番5号8階』(-> rejected)",
            "article": FetchedArticle(
                article_id="ART_12",
                source_url="https://www3.nhk.or.jp/news/html/20260518/k10014000022000.html",
                source_title="東京・池袋のマンション室内で遺体発見",
                source_name="NHKニュース",
                source_published_date="2026-05-18",
                raw_text="18日午前、東京都豊島区池袋2丁目のマンション室内で住人が死亡しているのが見つかりました。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www3.nhk.or.jp/news/html/20260518/k10014000022000.html",
                "source_title": "東京・池袋のマンション室内で遺体発見",
                "incident_date": "2026-05-18",
                "incident_type": "其他非自然死亡",
                "country": "JP",
                # AI 捏造了原文沒有的 10番5号8階
                "address": "東京都豊島区池袋2丁目10番5号8階",
                "address_evidence": "東京都豊島区池袋2丁目のマンション室内",
                "incident_evidence": "マンション室内で住人が死亡しているのが見つかりました",
                "location_description": "inside_building",
                "ai_confidence": 0.92,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },

        # ------------------------------------------------------------------
        # 13 ~ 17：地址驗證（僅行政區、僅大型社區名稱、日本無町丁、地圖查詢結果衝突 -> pending）
        # ------------------------------------------------------------------
        {
            "id": "TC13_TW_VAGUE_DISTRICT_ONLY",
            "desc": "台灣案例：文章僅提及『高雄市三民區某透天厝』無具體路街 (-> pending)",
            "article": FetchedArticle(
                article_id="ART_13",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4603001",
                source_title="高雄三民區某透天厝火警 1人陳屍屋內",
                source_name="自由時報",
                source_published_date="2026-06-01",
                raw_text="高雄市三民區一棟透天厝今日凌晨發生火警，消防人員撲滅火勢後在2樓發現1名住戶陳屍屋內。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4603001",
                "source_title": "高雄三民區某透天厝火警 1人陳屍屋內",
                "incident_date": "2026-06-01",
                "incident_type": "意外身亡",
                "country": "TW",
                "address": "高雄市三民區",
                "address_evidence": "高雄市三民區一棟透天厝",
                "incident_evidence": "在2樓發現1名住戶陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.85,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC14_TW_COMMUNITY_NAME_ONLY_PROTECTION",
            "desc": "台灣案例：僅提及『新北市新店區某大型千戶社區』無門牌棟別（保護整個社區不被誤標 -> pending）",
            "article": FetchedArticle(
                article_id="ART_14",
                source_url="https://udn.com/news/story/7320/7890888",
                source_title="新店某大型千戶社區傳墜樓 住戶送醫不治",
                source_name="聯合新聞網",
                source_published_date="2026-06-05",
                raw_text="新北市新店區某大型千戶社區今日上午發生一起墜樓意外，一名住戶自住處墜落身亡，警方正釐清確切棟別。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://udn.com/news/story/7320/7890888",
                "source_title": "新店某大型千戶社區傳墜樓 住戶送醫不治",
                "incident_date": "2026-06-05",
                "incident_type": "輕生事故",
                "country": "TW",
                "address": "新北市新店區某大型千戶社區",
                "address_evidence": "新北市新店區某大型千戶社區",
                "incident_evidence": "一名住戶自住處墜落身亡",
                "location_description": "inside_building",
                "ai_confidence": 0.89,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC15_JP_VAGUE_MUNICIPALITY_ONLY",
            "desc": "日本案例：僅提及『福岡県福岡市博多区のアパート』無町丁・丁目 (-> pending)",
            "article": FetchedArticle(
                article_id="ART_15",
                source_url="https://www.yomiuri.co.jp/national/20260610-OYT1T50011/",
                source_title="福岡市博多区のアパート室内で孤独死か",
                source_name="読売新聞",
                source_published_date="2026-06-10",
                raw_text="10日午後、福岡県福岡市博多区のアパートの室内で高齢男性の遺体が見つかりました。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www.yomiuri.co.jp/national/20260610-OYT1T50011/",
                "source_title": "福岡市博多区のアパート室内で孤独死か",
                "incident_date": "2026-06-10",
                "incident_type": "其他非自然死亡",
                "country": "JP",
                "address": "福岡県福岡市博多区",
                "address_evidence": "福岡県福岡市博多区のアパートの室内",
                "incident_evidence": "アパートの室内で高齢男性の遺体が見つかりました",
                "location_description": "inside_building",
                "ai_confidence": 0.80,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC16_TW_MAP_GEOCODE_CONFLICT",
            "desc": "台灣案例：文章地址與地圖查詢結果不一致（臺北市大安區中正路10巷5號 -> pending）",
            "article": FetchedArticle(
                article_id="ART_16",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4603999",
                source_title="北市大安區中正路10巷民宅命案",
                source_name="自由時報",
                source_published_date="2026-06-12",
                raw_text="台北市大安區中正路10巷5號民宅今日驚傳命案，警方破門發現一人陳屍屋內。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4603999",
                "source_title": "北市大安區中正路10巷民宅命案",
                "incident_date": "2026-06-12",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺北市大安區中正路10巷5號",
                "address_evidence": "台北市大安區中正路10巷5號民宅",
                "incident_evidence": "警方破門發現一人陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.95,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC17_JP_GSI_MAP_CONFLICT",
            "desc": "日本案例：文章地址與國土地理院 (GSI) 查詢結果衝突（渋谷区道玄坂99丁目1番 -> pending）",
            "article": FetchedArticle(
                article_id="ART_17",
                source_url="https://www.asahi.com/articles/ASS6150009",
                source_title="渋谷区道玄坂99丁目のマンション室内で事件",
                source_name="朝日新聞",
                source_published_date="2026-06-15",
                raw_text="15日、東京都渋谷区道玄坂99丁目1番のマンション室内で男性の遺体が見つかりました。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www.asahi.com/articles/ASS6150009",
                "source_title": "渋谷区道玄坂99丁目のマンション室内で事件",
                "incident_date": "2026-06-15",
                "incident_type": "刑事命案",
                "country": "JP",
                "address": "東京都渋谷区道玄坂99丁目1番",
                "address_evidence": "東京都渋谷区道玄坂99丁目1番のマンション室内",
                "incident_evidence": "マンション室内で男性の遺体が見つかりました",
                "location_description": "inside_building",
                "ai_confidence": 0.94,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },

        # ------------------------------------------------------------------
        # 18 ~ 21：事故地點判斷（建物外 outside_building、附近 nearby、不明 unknown、非死亡火警）
        # ------------------------------------------------------------------
        {
            "id": "TC18_OUTSIDE_BUILDING_STREET_FIGHT",
            "desc": "事故發生在建物外：大樓前馬路上街頭鬥毆命案 (outside_building -> rejected)",
            "article": FetchedArticle(
                article_id="ART_18",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4604100",
                source_title="新北三重正義北路大樓前馬路砍人 1男送醫不治",
                source_name="自由時報",
                source_published_date="2026-07-01",
                raw_text="新北市三重區正義北路68號大樓前馬路今日凌晨發生街頭砍殺命案，兩派人馬在門前道路衝突，1名男子遭刺傷送醫不治。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4604100",
                "source_title": "新北三重正義北路大樓前馬路砍人 1男送醫不治",
                "incident_date": "2026-07-01",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "新北市三重區正義北路68號",
                "address_evidence": "新北市三重區正義北路68號大樓前馬路",
                "incident_evidence": "大樓前馬路今日凌晨發生街頭砍殺命案，兩派人馬在門前道路衝突，1名男子遭刺傷送醫不治",
                "location_description": "inside_building",  # 即使 AI 誤填 inside_building，驗證器也會強制糾正為 outside_building 並剔除
                "ai_confidence": 0.96,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC19_NEARBY_LANDMARK_INCIDENT",
            "desc": "事故發生在附近：文章僅拿マンション作為地標，實際發生在近くの路上 (nearby -> rejected)",
            "article": FetchedArticle(
                article_id="ART_19",
                source_url="https://www3.nhk.or.jp/news/html/20260705/k10014000033000.html",
                source_title="世田谷区のマンション近くの路上で男性死亡 ひき逃げか",
                source_name="NHKニュース",
                source_published_date="2026-07-05",
                raw_text="5日未明、東京都世田谷区三軒茶屋2丁目10番のマンション近くの路上で、男性が倒れているのが見つかり死亡が確認されました。",
                country="JP",
            ),
            "candidate": {
                "source_url": "https://www3.nhk.or.jp/news/html/20260705/k10014000033000.html",
                "source_title": "世田谷区のマンション近くの路上で男性死亡 ひき逃げか",
                "incident_date": "2026-07-05",
                "incident_type": "意外身亡",
                "country": "JP",
                "address": "東京都世田谷区三軒茶屋2丁目10番",
                "address_evidence": "東京都世田谷区三軒茶屋2丁目10番のマンション近くの路上",
                "incident_evidence": "マンション近くの路上で、男性が倒れているのが見つかり死亡が確認されました",
                "location_description": "nearby",
                "ai_confidence": 0.91,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC20_UNKNOWN_LOCATION_DESCRIPTION",
            "desc": "事故地點不明：無法確認在屋內或屋外 (unknown -> pending)",
            "article": FetchedArticle(
                article_id="ART_20",
                source_url="https://www.cna.com.tw/news/asoc/202607100055.aspx",
                source_title="中壢中北路男子倒臥送醫不治 詳細事發處待釐清",
                source_name="中央社",
                source_published_date="2026-07-10",
                raw_text="桃園市中壢區中北路25巷10號今日上午傳出一名男子失去呼吸心跳送醫不治，究竟是在何處發生意外仍待警方進一步調查釐清。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://www.cna.com.tw/news/asoc/202607100055.aspx",
                "source_title": "中壢中北路男子倒臥送醫不治 詳細事發處待釐清",
                "incident_date": "2026-07-10",
                "incident_type": "其他非自然死亡",
                "country": "TW",
                "address": "桃園市中壢區中北路25巷10號",
                "address_evidence": "桃園市中壢區中北路25巷10號",
                "incident_evidence": "傳出一名男子失去呼吸心跳送醫不治，究竟是在何處發生意外仍待警方進一步調查釐清",
                "location_description": "unknown",
                "ai_confidence": 0.85,
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC21_NON_FATAL_FIRE_EXCLUDED",
            "desc": "非凶宅事故：住宅火警但『無人傷亡』 (-> rejected)",
            "article": FetchedArticle(
                article_id="ART_21",
                source_url="https://udn.com/news/story/7320/7891222",
                source_title="北市信義區莊敬路公寓廚房起火 幸無人傷亡",
                source_name="聯合新聞網",
                source_published_date="2026-07-12",
                raw_text="台北市信義區莊敬路190巷12號2樓公寓今日中午發生火警，消防員迅速撲滅火勢，現場無人傷亡。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://udn.com/news/story/7320/7891222",
                "source_title": "北市信義區莊敬路公寓廚房起火 幸無人傷亡",
                "incident_date": "2026-07-12",
                "incident_type": "意外身亡",
                "country": "TW",
                "address": "臺北市信義區莊敬路190巷12號2樓",
                "address_evidence": "台北市信義區莊敬路190巷12號2樓公寓",
                "incident_evidence": "今日中午發生火警，消防員迅速撲滅火勢，現場無人傷亡",
                "location_description": "inside_building",
                "ai_confidence": 0.95,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },

        # ------------------------------------------------------------------
        # 22 ~ 24：虛構事故日期、高信心分數防闖關、重複案件與跨媒體同案件歸戶合併
        # ------------------------------------------------------------------
        {
            "id": "TC22_HALLUCINATED_FUTURE_OR_UNFOUNDED_DATE",
            "desc": "AI 捏造未來日期或原文毫無根據之事故日期 (2028-12-31 -> rejected)",
            "article": FetchedArticle(
                article_id="ART_22",
                source_url="https://news.ltn.com.tw/news/society/breakingnews/4605001",
                source_title="台南東區長榮路公寓傳命案 警封鎖調查",
                source_name="自由時報",
                source_published_date="2026-07-15",
                raw_text="台南市東區長榮路二段32巷6號3樓公寓今日發生命案，一名住戶陳屍屋內。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://news.ltn.com.tw/news/society/breakingnews/4605001",
                "source_title": "台南東區長榮路公寓傳命案 警封鎖調查",
                "incident_date": "2028-12-31",  # 虛構未來日期
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺南市東區長榮路二段32巷6號3樓",
                "address_evidence": "台南市東區長榮路二段32巷6號3樓公寓",
                "incident_evidence": "今日發生命案，一名住戶陳屍屋內",
                "location_description": "inside_building",
                "ai_confidence": 0.97,
            },
            "expected_status": "rejected",
            "expected_promoted": False,
        },
        {
            "id": "TC23_HIGH_CONFIDENCE_099_CANNOT_BYPASS_VERIFICATION",
            "desc": "禁止因 Gemini confidence=0.99 就標記為 verified（地址僅有路段無巷號 -> 強制 pending）",
            "article": FetchedArticle(
                article_id="ART_23",
                source_url="https://www.cna.com.tw/news/asoc/202607180088.aspx",
                source_title="北市內湖成功路四段民宅傳一氧化碳中毒 1人不治",
                source_name="中央社",
                source_published_date="2026-07-18",
                raw_text="台北市內湖區成功路四段一處民宅今日凌晨發生一氧化碳中毒意外，1名住戶於屋內送醫不治。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://www.cna.com.tw/news/asoc/202607180088.aspx",
                "source_title": "北市內湖成功路四段民宅傳一氧化碳中毒 1人不治",
                "incident_date": "2026-07-18",
                "incident_type": "意外身亡",
                "country": "TW",
                "address": "臺北市內湖區成功路四段",
                "address_evidence": "台北市內湖區成功路四段一處民宅",
                "incident_evidence": "發生一氧化碳中毒意外，1名住戶於屋內送醫不治",
                "location_description": "inside_building",
                "ai_confidence": 0.99,  # 高達 0.99 的信心分數，但缺少巷弄與門牌號
            },
            "expected_status": "pending",
            "expected_promoted": False,
        },
        {
            "id": "TC24_MULTI_NEWS_SAME_INCIDENT_MERGE",
            "desc": "跨媒體重複案件合併：中央社報導與 TC01 同一宗萬華寶興街40巷12號3樓命案（合併來源，不重複建案）",
            "article": FetchedArticle(
                article_id="ART_24",
                source_url="https://www.cna.com.tw/news/asoc/202603150099.aspx",
                source_title="萬華寶興街40巷公寓命案 檢警相驗釐清死因",
                source_name="中央社",
                source_published_date="2026-03-15",
                raw_text="台北市萬華區寶興街40巷12號3樓公寓今日上午發生命案，警方破門發現52歲男子陳屍屋內，檢察官下午前往相驗。",
                country="TW",
            ),
            "candidate": {
                "source_url": "https://www.cna.com.tw/news/asoc/202603150099.aspx",
                "source_title": "萬華寶興街40巷公寓命案 檢警相驗釐清死因",
                "source_name": "中央社",
                "incident_date": "2026-03-15",
                "incident_type": "刑事命案",
                "country": "TW",
                "address": "臺北市萬華區寶興街40巷12號3樓",
                "address_evidence": "台北市萬華區寶興街40巷12號3樓公寓",
                "incident_evidence": "警方破門發現52歲男子陳屍屋內",
                "location_description": "inside_building",
                "summary": "中央社跟進報導萬華區寶興街40巷12號3樓公寓屋內命案。",
                "ai_confidence": 0.96,
            },
            "expected_status": "verified",
            "expected_promoted": True,
            "expected_duplicate_action": "MERGED_MULTI_SOURCE",
        },
    ]

    print("=" * 100)
    print("🔍 開始執行台灣與日本事故建物資料真實性驗證系統測試（共 24 組測試案例）")
    print("=" * 100)

    passed = 0
    failed = 0

    for idx, tc in enumerate(test_cases, start=1):
        res = pipeline.process_and_commit(tc["article"], tc["candidate"])
        actual_status = res["verification_status"]
        actual_promoted = res["promoted_to_formal_cases"]
        reasons_str = ", ".join(res["quality_check_report"]["reasons"])

        status_match = actual_status == tc["expected_status"]
        promo_match = actual_promoted == tc["expected_promoted"]
        dup_match = True
        if "expected_duplicate_action" in tc:
            dup_match = res.get("duplicate_action") == tc["expected_duplicate_action"]

        ok = status_match and promo_match and dup_match
        if ok:
            passed += 1
            badge = "✅ PASS"
        else:
            failed += 1
            badge = "❌ FAIL"

        print(
            f"[{idx:02d}/24] {badge} | {tc['id']}\n"
            f"        說明: {tc['desc']}\n"
            f"        預期狀態: {tc['expected_status']:8s} | 實際狀態: {actual_status:8s} | "
            f"進入正式庫: {str(actual_promoted):5s} | 原因碼: {reasons_str}"
        )

    # 驗證最終資料庫狀態完整性
    formal_cases = pipeline.formal_cases_store
    pending_cases = pipeline.pending_cases_store
    case_sources = pipeline.case_sources_store

    # 確保沒有任何一筆 pending 或 rejected 或非 inside_building 的案件進入正式表
    invalid_in_formal = [
        c for c in formal_cases
        if c["verification_status"] != "verified"
        or c["location_description"] != "inside_building"
        or not c["address_evidence"]
        or not c["incident_evidence"]
    ]

    print("=" * 100)
    print("📊 測試總結報告 (Verification Pipeline Summary)")
    print("-" * 100)
    print(f"• 測試案例總數              : {len(test_cases)} 筆")
    print(f"• 通過測試數                : {passed} / {len(test_cases)} 筆")
    print(f"• 第一階段寫入 pending_cases : {len(pending_cases)} 筆（100% 先進隔離審核表）")
    print(f"• 晉升正式表 cases 獨立案件數 : {len(formal_cases)} 筆（TC01~TC04 共 4 筆獨立真實案件，TC24 自動歸戶合併至 TC01）")
    print(f"• 多來源證據表 case_sources  : {len(case_sources)} 筆（TC01 擁有 2 篇不同媒體來源，merged_count = {formal_cases[0]['merged_count']}）")
    print(f"• 錯誤／幻覺資料進入正式表數 : {len(invalid_in_formal)} 筆（必須為 0）")
    print("=" * 100)

    if failed > 0 or len(invalid_in_formal) > 0 or len(formal_cases) != 4:
        sys.exit(1)


if __name__ == "__main__":
    run_24_verification_tests()
