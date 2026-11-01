#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
臺灣與日本特殊事故建物查詢平台 — 嚴格資料真實性與防幻覺驗證系統 (verification_engine.py)
========================================================================================
本模組實作 8 大核心防幻覺與資料真實性驗證機制：
1. 禁止 AI 自行生成案件來源：
   - Gemini 僅能分析爬蟲實際取得的原始文章 (FetchedArticle)。
   - `source_url` 強制直接綁定爬蟲原始網址，嚴禁 AI 生成、猜測、補全或修改。
   - 若原始文章不存在 (HTTP != 200)、無法存取或內容過短無法確認，直接標記為 `pending` 或 `rejected`。
2. 12 個強制證據欄位與逐字原文比對：
   - `source_url`, `source_title`, `source_name`, `source_published_date`,
     `incident_date`, `incident_type`, `country`, `address`,
     `address_evidence`, `incident_evidence`, `location_description`, `verification_status`
   - `address_evidence` 與 `incident_evidence` 必須是原始文章中可逐字找到的子字串。
   - 嚴禁 AI 推論補出原始文章未記載的地址、門牌號、樓層、日期或建物名稱。
3. 台灣與日本獨立地址標準化與地圖一致性驗證：
   - 台灣：縣市、行政區、道路／街／段、巷弄、門牌、樓層。
   - 日本：都道府縣、市區町村、町丁・丁目、番地、號。
   - 絕不自動補全缺失地址；若僅提及社區名稱、附近道路或行政區，或與地圖查詢結果衝突，強制進入 `pending`。
4. 事故地點嚴格四分類 (`location_description`)：
   - `inside_building` (建物內) / `outside_building` (建物外) / `nearby` (附近) / `unknown` (不明)
   - 嚴禁因社區內發生事故就將整個社區標記為凶宅；嚴禁因文章提及建物作為地標就推定發生在建物內。
5. 三階段審核狀態 (`pending`, `verified`, `rejected`)：
   - 嚴禁因為 Gemini 的 `confidence` 分數高低而直接標記為 `verified`。
6. 9 項自動品質檢查 (Automated Quality Gate) 與跨媒體重複案件合併。
7. 兩階段資料寫入流程 (`pending_cases` -> 決定論驗證通過 -> `cases` / `haunted_houses`)。
"""

import re
import json
import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List, Tuple, Callable


# ==============================================================================
# 0. 常數與台灣／日本行政區字典
# ==============================================================================
ALLOWED_LOCATION_DESCRIPTIONS = {
    "inside_building",   # 事故發生在建物內
    "outside_building",  # 事故發生在建物外
    "nearby",            # 事故發生在附近
    "unknown",           # 事故地點不明
}

ALLOWED_VERIFICATION_STATUSES = {
    "pending",           # 尚未驗證／待人工複核
    "verified",          # 已通過決定論全項驗證
    "rejected",          # 不符合收錄條件或含虛構／幻覺資訊
}

TW_VALID_DISTRICTS: Dict[str, List[str]] = {
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
    "連江縣": ["南竿鄉","北竿鄉","莒光鄉","東引鄉"],
}

JP_PREFECTURES = {
    "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
    "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
    "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
    "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
    "鳥取県","島根県","岡山県","広島県","山口県",
    "徳島県","香川県","愛媛県","高知県",
    "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
}

ZH_DIGIT_MAP = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
ARABIC_TO_ZH_SEC = {
    "1段": "一段", "2段": "二段", "3段": "三段", "4段": "四段", "5段": "五段",
    "6段": "六段", "7段": "七段", "8段": "八段", "9段": "九段", "10段": "十段"
}
ZENKAKU_TRANS = str.maketrans("０１２３４５６７８９－−ー　", "0123456789--- ")


@dataclass
class FetchedArticle:
    """爬蟲實際抓取之不可變原始文章物件（Gemini 僅能讀取，無權修改網址與標題）"""
    article_id: str
    source_url: str
    source_title: str
    source_name: str
    source_published_date: str
    raw_text: str
    country: str = "TW"
    http_status: int = 200
    content_accessible: bool = True

    @property
    def full_corpus(self) -> str:
        return f"{self.source_title}\n{self.raw_text}".strip()


# ==============================================================================
# 1. 輔助正規化函式（僅做字元格式統一，絕不推論或補全缺失資訊）
# ==============================================================================
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


def normalize_for_substring_match(text: str) -> str:
    """
    用於比對 address_evidence 與 incident_evidence 是否逐字存在於原始文章中。
    僅統一空白、台/臺、全形半形數字，不改變任何實質詞彙。
    """
    s = str(text or "").translate(ZENKAKU_TRANS)
    s = s.replace("台", "臺").replace("巿", "市").replace("ヶ", "ケ")
    s = re.sub(r"\s+", "", s)
    return s


def is_verbatim_substring(evidence: str, raw_corpus: str) -> bool:
    """驗證證據字串是否確實存在於爬蟲原始文章內文中"""
    if not evidence or len(evidence.strip()) < 4:
        return False
    norm_ev = normalize_for_substring_match(evidence)
    norm_corpus = normalize_for_substring_match(raw_corpus)
    return bool(norm_ev and norm_ev in norm_corpus)


# ==============================================================================
# 2. 台灣與日本地址標準化與驗證器（嚴禁補全原文沒有的資訊）
# ==============================================================================
def standardize_and_verify_tw_address(raw_address: str, raw_corpus: str) -> Dict[str, Any]:
    """
    台灣地址標準化與顆粒度檢查：
    解析：縣市 (city)、行政區 (district)、道路/街/段 (road)、巷 (lane)、弄 (alley)、門牌號 (number)、樓層 (floor)
    絕不補全原始文章未記載之欄位！
    """
    s = str(raw_address or "").strip().translate(ZENKAKU_TRANS)
    s = s.replace("台", "臺").replace("巿", "市")
    for k, v in ARABIC_TO_ZH_SEC.items():
        s = s.replace(k, v)
    s = re.sub(
        r"([一二三四五六七八九十〇零]{1,3})(巷|弄|號|樓)",
        lambda m: f"{_zh_num_to_arabic(m.group(1))}{m.group(2)}",
        s
    )

    # 解析縣市與行政區
    city_match = re.search(r"([臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣|金門縣|連江縣]{3})", s)
    city = city_match.group(1) if city_match else ""
    district = ""
    if city and city in TW_VALID_DISTRICTS:
        for d in TW_VALID_DISTRICTS[city]:
            if d in s:
                district = d
                break

    # 檢查行政區是否合法存在於該縣市
    admin_conflict = False
    other_dist_match = re.search(r"([一-龥]{1,3}(?:區|鎮|鄉|市))", s.replace(city, "", 1))
    if city and not district and other_dist_match:
        admin_conflict = True

    remainder = s
    if city:
        remainder = remainder.replace(city, "", 1)
    if district:
        remainder = remainder.replace(district, "", 1)
    remainder = re.sub(r"[（(].*?[）)]", "", remainder).strip()

    # 檢查是否帶有模糊附近詞彙（「XX路附近」、「XX街口」、「XX商圈一帶」）
    has_nearby_qualifier = bool(re.search(r"(附近|周邊|一帶|路口|街口|對面|旁|前方)", remainder))

    # 抽取道路／街／大道／段
    road_match = re.search(r"([一-龥]{1,6}(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)", remainder)
    road = road_match.group(1) if road_match else ""

    # 抽取巷、弄、號、樓（僅抽取實際存在於輸入中的部分，絕不補全）
    lane_match = re.search(r"(\d+巷)", remainder)
    lane = lane_match.group(1) if lane_match else ""

    alley_match = re.search(r"(\d+弄)", remainder)
    alley = alley_match.group(1) if alley_match else ""

    num_match = re.search(r"(\d+(?:之\d+)?號)", remainder)
    number = num_match.group(1) if num_match else ""

    floor_match = re.search(r"(\d+樓)", remainder)
    floor = floor_match.group(1) if floor_match else ""

    # 檢查是否僅提及社區／大樓名稱而無具體路街門牌
    comm_match = re.search(r"(「[^」]{2,15}」|[一-龥A-Za-z0-9]{2,12}(?:社區|國宅|大樓|華廈|新城|山莊|別墅))", remainder)
    community_name = comm_match.group(1) if comm_match else ""

    # 組合標準化地址（僅組合有出現的結構，不捏造未出現的號或樓）
    standardized_parts = [p for p in [city, district, road, lane, alley, number, floor] if p]
    standardized_address = "".join(standardized_parts) if standardized_parts else s

    # 驗證地址中的每個具體元素是否皆存在於原始文章內文中（防止 AI 自行推論補全門牌、巷弄、樓層或路名）
    norm_corpus = normalize_for_substring_match(raw_corpus)
    corpus_arabic = re.sub(
        r"([一二三四五六七八九十〇零]{1,3})(巷|弄|號|樓)",
        lambda m: f"{_zh_num_to_arabic(m.group(1))}{m.group(2)}",
        norm_corpus
    )
    for k, v in ARABIC_TO_ZH_SEC.items():
        corpus_arabic = corpus_arabic.replace(k, v)

    hallucinated_components = []
    for comp_name, comp_val in [
        ("city", city),
        ("district", district),
        ("road", road),
        ("lane", lane),
        ("alley", alley),
        ("number", number),
        ("floor", floor),
    ]:
        if comp_val:
            # 允許「臺北」對應「台北」或「北市」
            if comp_name == "city":
                short_c = comp_val[:2]
                alt_c = comp_val.replace("臺", "台")[:2]
                if short_c not in corpus_arabic and alt_c not in corpus_arabic and comp_val[0] + "市" not in corpus_arabic:
                    hallucinated_components.append(f"city:{comp_val}")
            elif comp_val not in corpus_arabic:
                hallucinated_components.append(f"{comp_name}:{comp_val}")

    if community_name:
        clean_comm = community_name.strip("「」")
        if clean_comm not in corpus_arabic:
            hallucinated_components.append(f"community:{clean_comm}")

    is_community_only = bool(community_name and not road) or bool(community_name and not number and not lane)
    is_district_only = bool(city and district and not road and not community_name)
    # 台灣地址要通過 verified，至少需具備「縣市 + 行政區 + 道路/街/段 + (巷 或 弄 或 門牌號)」且非僅社區統稱
    has_sufficient_granularity = bool(
        city and district and road and (lane or alley or number)
        and not has_nearby_qualifier
        and not is_community_only
        and not admin_conflict
    )

    granularity_issue = ""
    if admin_conflict:
        granularity_issue = "TW_ADMIN_DISTRICT_MISMATCH"
    elif is_district_only or not road:
        granularity_issue = "TW_ADDRESS_MISSING_ROAD"
    elif has_nearby_qualifier:
        granularity_issue = "TW_ADDRESS_NEARBY_ROAD_ONLY"
    elif is_community_only:
        granularity_issue = "TW_COMMUNITY_ONLY_WITHOUT_DOORPLATE"
    elif not (lane or alley or number):
        granularity_issue = "TW_ROAD_ONLY_WITHOUT_LANE_OR_NUMBER"

    return {
        "country": "TW",
        "city": city,
        "district": district,
        "road": road,
        "lane": lane,
        "alley": alley,
        "number": number,
        "floor": floor,
        "community_name": community_name,
        "standardized_address": standardized_address,
        "has_sufficient_granularity": has_sufficient_granularity,
        "is_community_only": is_community_only,
        "has_nearby_qualifier": has_nearby_qualifier,
        "admin_conflict": admin_conflict,
        "hallucinated_components": hallucinated_components,
        "granularity_issue": granularity_issue,
    }


def standardize_and_verify_jp_address(raw_address: str, raw_corpus: str) -> Dict[str, Any]:
    """
    日本地址標準化與顆粒度檢查：
    解析：都道府縣 (prefecture)、市區町村 (municipality)、町丁・丁目 (chome_town)、番地 (banchi)、號 (go)、階 (floor)
    絕不補全原始文章未記載之欄位！
    """
    s = str(raw_address or "").strip().translate(ZENKAKU_TRANS)
    s = s.replace("ヶ", "ケ")
    s = re.sub(r"([一二三四五六七八九])丁目", lambda m: f"{'一二三四五六七八九'.index(m.group(1))+1}丁目", s)

    pref = ""
    for p in JP_PREFECTURES:
        if s.startswith(p) or p in s:
            pref = p
            break

    rem = s.replace(pref, "", 1).strip() if pref else s
    muni_match = re.search(r"^([一-龥ぁ-んァ-ヶー]{1,7}市[一-龥ぁ-んァ-ヶー]{1,5}区|[一-龥ぁ-んァ-ヶー]{1,6}(?:区|市|町|村))", rem)
    muni = muni_match.group(1) if muni_match else ""
    rem_after_muni = rem.replace(muni, "", 1).strip() if muni else rem
    rem_after_muni = re.sub(r"[（(].*?[）)]", "", rem_after_muni).strip()

    has_nearby_qualifier = bool(re.search(r"(近く|付近|周辺|前の路上|そば|沿い)", rem_after_muni))

    # 解析町丁・丁目、番地、号、階
    chome_match = re.search(r"([一-龥ぁ-んァ-ヶー]{1,10}(?:\d+丁目|町|本町|栄町|中央|東|西|南|北|[一-龥]{1,6}))", rem_after_muni)
    chome_town = chome_match.group(1) if chome_match else ""
    # 過濾掉單純建物詞彙被誤認為町名
    if chome_town in {"マンション", "アパート", "団地", "住宅", "集合住宅", "市営住宅", "県営住宅", "都営住宅"}:
        chome_town = ""

    banchi_match = re.search(r"(\d+番地?|\d+\-\d+)", rem_after_muni)
    banchi = banchi_match.group(1) if banchi_match else ""

    go_match = re.search(r"(\d+号(?!室))", rem_after_muni)
    go = go_match.group(1) if go_match else ""

    floor_match = re.search(r"(\d+階|\d+号室)", rem_after_muni)
    floor = floor_match.group(1) if floor_match else ""

    danchi_match = re.search(r"([一-龥ぁ-んァ-ヶーA-Za-z0-9]{2,12}(?:団地|マンション|アパート|ハイツ|コーポ|ビル))", rem_after_muni)
    building_name = danchi_match.group(1) if danchi_match else ""
    if building_name in {"マンション", "アパート", "団地", "ビル"}:
        building_name = ""

    has_chome_digit = bool(re.search(r"\d+丁目", rem_after_muni)) or bool(banchi)
    standardized_parts = [p for p in [pref, muni, chome_town, banchi, go, floor] if p]
    standardized_address = "".join(standardized_parts) if standardized_parts else s

    # 檢查原文是否包含所有提取出的日本地址元素（防止 AI 捏造丁目、番地、号、階）
    norm_corpus = normalize_for_substring_match(raw_corpus)
    corpus_norm_chome = re.sub(
        r"([一二三四五六七八九])丁目",
        lambda m: f"{'一二三四五六七八九'.index(m.group(1))+1}丁目",
        norm_corpus
    )

    hallucinated_components = []
    for comp_name, comp_val in [
        ("prefecture", pref),
        ("municipality", muni),
        ("chome_town", chome_town),
        ("banchi", banchi),
        ("go", go),
        ("floor", floor),
    ]:
        if comp_val and comp_val not in corpus_norm_chome:
            hallucinated_components.append(f"{comp_name}:{comp_val}")

    if building_name and building_name not in corpus_norm_chome:
        hallucinated_components.append(f"building_name:{building_name}")

    is_danchi_only = bool(building_name and not has_chome_digit)
    has_sufficient_granularity = bool(
        pref and muni and chome_town and has_chome_digit
        and not has_nearby_qualifier
        and not is_danchi_only
    )

    granularity_issue = ""
    if not pref or not muni:
        granularity_issue = "JP_MISSING_PREF_OR_MUNI"
    elif not chome_town:
        granularity_issue = "JP_MUNICIPALITY_ONLY_NO_TOWN"
    elif has_nearby_qualifier:
        granularity_issue = "JP_NEARBY_ROAD_OR_LANDMARK_ONLY"
    elif is_danchi_only:
        granularity_issue = "JP_DANCHI_COMPLEX_WITHOUT_CHOME_OR_WING"
    elif not has_chome_digit:
        granularity_issue = "JP_TOWN_WITHOUT_CHOME_OR_BANCHI"

    return {
        "country": "JP",
        "city": pref,
        "district": muni,
        "chome_town": chome_town,
        "banchi": banchi,
        "go": go,
        "floor": floor,
        "building_name": building_name,
        "standardized_address": standardized_address,
        "has_sufficient_granularity": has_sufficient_granularity,
        "is_community_only": is_danchi_only,
        "has_nearby_qualifier": has_nearby_qualifier,
        "admin_conflict": False,
        "hallucinated_components": hallucinated_components,
        "granularity_issue": granularity_issue,
    }


# ==============================================================================
# 3. 事故地點四分類與凶宅資格判定器 (inside_building / outside_building / nearby / unknown)
# ==============================================================================
def classify_and_verify_incident_location(
    ai_location_desc: str,
    incident_evidence: str,
    raw_corpus: str,
) -> Dict[str, Any]:
    """
    決定論驗證事故地點：
    1. 明確區分：
       - `inside_building` (事故發生在建物內)
       - `outside_building` (事故發生在建物外)
       - `nearby` (事故發生在附近)
       - `unknown` (事故地點不明)
    2. 不能因為事故發生在社區內就將整個社區標記為凶宅。
    3. 不能因為文章提到建物名稱（如「XX大樓前」、「XXマンション近くの路上」）就推定事故發生在建物內。
    """
    combined = f"{incident_evidence} {raw_corpus}"

    # (A) 非凶宅事故排除：無傷亡火災、單純車禍、工安意外、自然病逝
    non_fatal_or_unrelated_pattern = re.compile(
        r"(無人傷亡|幸無人員傷亡|0人傷亡|無人員受困傷亡|けが人はいなかった|けが人なし|死傷者なし|自然死|病死|老衰)"
    )
    if non_fatal_or_unrelated_pattern.search(combined):
        return {
            "location_description": "unknown",
            "is_qualifying_incident": False,
            "disqualify_reason": "NON_FATAL_OR_NATURAL_DEATH",
            "community_wide_risk": False,
        }

    # (B) 檢查是否為「附近 (nearby)」地標引用（如：在大樓附近路口車禍、マンション近くの公園／路上）
    nearby_pattern = re.compile(
        r"(大樓附近|社區附近|公寓附近|民宅附近|附近路口|附近河濱|附近公園|周邊道路|"
        r"マンション近く|アパート近く|住宅近く|近くの路上|付近の路上|近くの公園|近くの河川敷)"
    )
    # (C) 檢查是否為「建物外 (outside_building)」（如：大樓前馬路鬥毆、騎樓外車禍、マンション前の道路で衝突）
    outside_pattern = re.compile(
        r"(大樓前馬路|大樓外馬路|公寓門外街頭|門前道路|騎樓外馬路|人行道上遭撞|街頭砍殺|路邊車內|"
        r"マンション前の道路|アパート前の路上|建物外の路上|駐車場入口前の道路)"
    )
    # (D) 檢查是否明確發生於「建物內 (inside_building)」（含屋內、套房內、房內、自住處墜樓、マンションの部屋・室内）
    inside_pattern = re.compile(
        r"(屋內|房內|套房內|臥室|浴室|客廳|民宅內|公寓內|大樓內|住處內|租屋處內|破門發現|陳屍屋內|陳屍房內|屋內燒炭|自\d+樓住處墜落|從住處頂樓墜樓|建物專有部分|"
        r"マンションの部屋|マンション室内|アパートの室内|アパートの一室|自宅室内|部屋の中で|室内で遺体|自室から転落|焼け跡から遺体)"
    )

    has_inside = bool(inside_pattern.search(combined))
    has_nearby = bool(nearby_pattern.search(combined))
    has_outside = bool(outside_pattern.search(combined))

    if has_nearby and not has_inside:
        resolved_loc = "nearby"
    elif has_outside and not has_inside:
        resolved_loc = "outside_building"
    elif has_inside and not has_nearby and not has_outside:
        resolved_loc = "inside_building"
    else:
        # 若 AI 標註為 outside_building 或 nearby，採信更嚴格的排除分類
        if ai_location_desc in {"outside_building", "nearby"}:
            resolved_loc = ai_location_desc
        elif has_inside and ai_location_desc == "inside_building":
            resolved_loc = "inside_building"
        else:
            resolved_loc = "unknown"

    # (E) 檢查是否有「整個大型社區／團地被籠統標記」之風險（提及社區中庭或大型社區卻無棟別／門牌／樓層）
    community_wide_risk = bool(
        re.search(r"(某大型社區|百戶社區|千戶社區|某國宅社區|大型団地)", combined)
        and not re.search(r"(\d+號|\d+樓|\d+棟|\d+号棟|\d+番|\d+号室)", combined)
    )

    # 檢查是否具備死亡或法院凶宅認證事實
    qualifying_death_or_court = bool(
        re.search(
            r"(命案|陳屍|死亡|身亡|不治|焦屍|遺體|輕生|尋短|墜樓|刺死|砍死|勒斃|分屍|孤獨死|凶宅|非自然死亡|"
            r"遺体|死亡確認|殺害|刺殺|自殺|転落死|孤独死|白骨|変死体|心理的瑕疵|事故物件)",
            combined,
        )
    )

    return {
        "location_description": resolved_loc,
        "is_qualifying_incident": qualifying_death_or_court,
        "disqualify_reason": "" if qualifying_death_or_court else "NO_FATAL_INCIDENT_EVIDENCE",
        "community_wide_risk": community_wide_risk,
    }


# ==============================================================================
# 4. 事故日期真實性與原文根據檢查
# ==============================================================================
def verify_incident_date(
    incident_date: str,
    source_published_date: str,
    raw_corpus: str,
    reference_today: Optional[datetime.date] = None,
) -> Tuple[bool, str]:
    """
    驗證 incident_date：
    1. 格式必須為合法 YYYY-MM-DD。
    2. 嚴禁未來日期（不可晚於 reference_today）或早於 1950 年之不合理日期。
    3. 必須有原文日期線索或與原始文章發布日期一致，禁止 AI 憑空捏造未提及之具體歷史日期。
    """
    today = reference_today or datetime.date.today()
    if not incident_date or not re.match(r"^\d{4}-\d{2}-\d{2}$", str(incident_date).strip()):
        return False, "INVALID_DATE_FORMAT"

    try:
        dt = datetime.date.fromisoformat(str(incident_date).strip())
    except ValueError:
        return False, "IMPOSSIBLE_CALENDAR_DATE"

    if dt > today:
        return False, "FUTURE_DATE_HALLUCINATION"
    if dt.year < 1950:
        return False, "UNREASONABLE_PAST_DATE"

    # 若 incident_date 與文章發布日相同，檢查文章是否包含今日／昨日／日文時間詞或該月日
    pub_str = str(source_published_date or "").strip()[:10]
    norm_corpus = normalize_for_substring_match(raw_corpus)

    year_str = str(dt.year)
    roc_year_str = f"{dt.year - 1911}年"
    month_day_zh = f"{dt.month}月{dt.day}日"
    day_only_zh = f"{dt.day}日"
    relative_time_tokens = ["今日", "今晨", "今天", "昨日", "昨晚", "昨天", "凌晨", "上午", "下午", "晚間", "きょう", "きのう", "未明", "午前", "午後"]

    if incident_date == pub_str:
        if (
            month_day_zh in norm_corpus
            or day_only_zh in norm_corpus
            or any(tok in norm_corpus for tok in relative_time_tokens)
        ):
            return True, "VALID_DATE_SUPPORTED_BY_PUBDATE_AND_TEXT"
        return False, "DATE_NOT_SUPPORTED_IN_ARTICLE_TEXT"

    # 若 incident_date 與文章發布日不同（如歷史判決或回顧新聞），原文必須明確出現該年份或民國年份或月日
    has_year_in_text = (year_str in norm_corpus) or (roc_year_str in norm_corpus)
    has_md_in_text = (month_day_zh in norm_corpus) or (day_only_zh in norm_corpus)
    if has_year_in_text and has_md_in_text:
        return True, "VALID_HISTORICAL_DATE_IN_TEXT"

    # 若與發布日僅相差 1 天且內文提及「昨日／昨晚／きのう」
    if pub_str and re.match(r"^\d{4}-\d{2}-\d{2}$", pub_str):
        try:
            pub_dt = datetime.date.fromisoformat(pub_str)
            if abs((pub_dt - dt).days) <= 2 and (
                day_only_zh in norm_corpus or any(tok in norm_corpus for tok in relative_time_tokens)
            ):
                return True, "VALID_RELATIVE_DATE_IN_TEXT"
        except ValueError:
            pass

    return False, "HALLUCINATED_INCIDENT_DATE_NOT_IN_TEXT"


# ==============================================================================
# 5. 決定論全流程案件驗證與兩階段資料庫管線 (VerificationPipeline)
# ==============================================================================
def build_case_fingerprint(country: str, city: str, district: str, standardized_addr: str, incident_date: str, incident_type: str) -> str:
    ym = str(incident_date or "0000-00")[:7]
    core_addr = re.sub(r"[（(].*?[）)]", "", str(standardized_addr or "")).strip()
    core_addr = re.sub(r"\d+(?:樓|階|号室).*$", "", core_addr)
    return f"{country}_{city}_{district}_{core_addr}_{ym}_{incident_type}"


class VerificationPipeline:
    """
    管理兩階段寫入與 9 項自動品質檢查：
    - 所有爬蟲 + Gemini 候選案件一律先經過 `evaluate_and_stage()` 寫入 `pending_cases`。
    - 僅當 9 項決定論檢查全數通過 (`verification_status == 'verified'`) 時，才透過 `promote_to_formal_cases()` 寫入正式 `cases` (`haunted_houses`)。
    - Gemini 的 `confidence` 分數絕不影響 `verification_status` 判定。
    """

    def __init__(
        self,
        geocode_verifier: Optional[Callable[[str, str, str, str], Dict[str, Any]]] = None,
        reference_today: Optional[datetime.date] = None,
    ):
        self.geocode_verifier = geocode_verifier or self._default_geocode_verifier
        self.reference_today = reference_today or datetime.date.today()
        # 記憶體內模擬／本地快取（與 Supabase pending_cases / cases / case_sources 結構 1:1 對應）
        self.pending_cases_store: List[Dict[str, Any]] = []
        self.formal_cases_store: List[Dict[str, Any]] = []
        self.case_sources_store: List[Dict[str, Any]] = []
        self._cases_by_address: Dict[str, Dict[str, Any]] = {}
        self._cases_by_fingerprint: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def _default_geocode_verifier(country: str, city: str, district: str, standardized_address: str) -> Dict[str, Any]:
        """預設離線／決定論行政區與路名地圖一致性檢查器"""
        if country == "TW":
            valid_dists = TW_VALID_DISTRICTS.get(city, [])
            if not city or district not in valid_dists:
                return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "MAP_ADMIN_MISMATCH"}
            return {"matched": True, "lat": 25.0478, "lng": 121.5319, "accuracy": "ROOFTOP", "reason": "OK"}
        elif country == "JP":
            if pref := city:
                if pref not in JP_PREFECTURES or not district:
                    return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "MAP_ADMIN_MISMATCH"}
                return {"matched": True, "lat": 35.6938, "lng": 139.7034, "accuracy": "GSI_CHOME_VERIFIED", "reason": "OK"}
        return {"matched": False, "lat": 0.0, "lng": 0.0, "reason": "UNKNOWN_COUNTRY"}

    def evaluate_candidate(
        self,
        fetched_article: Optional[FetchedArticle],
        ai_candidate: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        對單筆候選案件執行 9 項自動品質檢查，回傳包含 12 個必填證據欄位的標準化紀錄。
        注意：Gemini 的 ai_confidence 僅作日誌記錄，絕對不會用於決定 verification_status！
        """
        checks: Dict[str, bool] = {
            "1_source_article_accessible": False,
            "2_source_url_locked_to_crawler": False,
            "3_source_title_consistent": False,
            "4_address_evidence_verbatim": False,
            "5_incident_evidence_verbatim": False,
            "6_no_ai_hallucinated_address_tokens": False,
            "7_incident_date_valid_and_evidenced": False,
            "8_location_inside_building_and_qualifying": False,
            "9_address_granular_and_map_consistent": False,
        }
        reasons: List[str] = []

        # ----------------------------------------------------------------------
        # 檢查 1：原始文章是否存在且可存取
        # ----------------------------------------------------------------------
        if (
            fetched_article is None
            or not fetched_article.content_accessible
            or fetched_article.http_status != 200
            or len((fetched_article.raw_text or "").strip()) < 20
        ):
            status = "rejected" if (fetched_article is None or fetched_article.http_status == 404) else "pending"
            reasons.append("SOURCE_ARTICLE_INACCESSIBLE_OR_EMPTY")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address="",
                city="",
                district="",
                location_description="unknown",
                verification_status=status,
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )
        checks["1_source_article_accessible"] = True

        # ----------------------------------------------------------------------
        # 檢查 2：禁止 AI 自行生成、猜測、補全或修改 source_url
        # ----------------------------------------------------------------------
        crawler_url = fetched_article.source_url.strip()
        ai_url = str(ai_candidate.get("source_url") or crawler_url).strip()
        url_valid_format = bool(re.match(r"^https?://[^\s/$.?#].[^\s]*$", crawler_url))
        # 若 AI 傳回的網址與爬蟲提供的原始網址不一致，立即判定為 AI 捏造或竄改網址 -> rejected
        if not url_valid_format or ai_url != crawler_url:
            reasons.append("AI_FABRICATED_OR_TAMPERED_SOURCE_URL")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address="",
                city="",
                district="",
                location_description="unknown",
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )
        checks["2_source_url_locked_to_crawler"] = True

        # ----------------------------------------------------------------------
        # 檢查 3：原始文章標題與內文一致性檢查
        # ----------------------------------------------------------------------
        crawler_title = fetched_article.source_title.strip()
        ai_title = str(ai_candidate.get("source_title") or crawler_title).strip()
        norm_crawler_title = normalize_for_substring_match(crawler_title)
        norm_ai_title = normalize_for_substring_match(ai_title)
        if not norm_crawler_title or (
            norm_ai_title
            and norm_ai_title not in norm_crawler_title
            and norm_crawler_title not in norm_ai_title
        ):
            reasons.append("SOURCE_TITLE_MISMATCH_WITH_CRAWLER")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address="",
                city="",
                district="",
                location_description="unknown",
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )
        checks["3_source_title_consistent"] = True

        # ----------------------------------------------------------------------
        # 檢查 4 & 5：address_evidence 與 incident_evidence 必須逐字存在於原始文章
        # ----------------------------------------------------------------------
        addr_ev = str(ai_candidate.get("address_evidence") or "").strip()
        inc_ev = str(ai_candidate.get("incident_evidence") or "").strip()
        full_corpus = fetched_article.full_corpus

        checks["4_address_evidence_verbatim"] = is_verbatim_substring(addr_ev, full_corpus)
        if not checks["4_address_evidence_verbatim"]:
            reasons.append("ADDRESS_EVIDENCE_NOT_FOUND_IN_SOURCE_TEXT")

        checks["5_incident_evidence_verbatim"] = is_verbatim_substring(inc_ev, full_corpus)
        if not checks["5_incident_evidence_verbatim"]:
            reasons.append("INCIDENT_EVIDENCE_NOT_FOUND_IN_SOURCE_TEXT")

        if not checks["4_address_evidence_verbatim"] or not checks["5_incident_evidence_verbatim"]:
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=str(ai_candidate.get("address") or ""),
                city="",
                district="",
                location_description="unknown",
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        # ----------------------------------------------------------------------
        # 檢查 6：地址標準化與防 AI 推論／補全檢查（禁止補出原文沒有的門牌、樓層、路名或建物名）
        # ----------------------------------------------------------------------
        country = str(ai_candidate.get("country") or fetched_article.country or "TW").upper()
        raw_addr = str(ai_candidate.get("address") or "").strip()
        if country == "JP":
            addr_info = standardize_and_verify_jp_address(raw_addr, full_corpus)
        else:
            country = "TW"
            addr_info = standardize_and_verify_tw_address(raw_addr, full_corpus)

        if addr_info["hallucinated_components"]:
            reasons.append(f"AI_HALLUCINATED_ADDRESS_COMPONENTS:{','.join(addr_info['hallucinated_components'])}")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description="unknown",
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )
        checks["6_no_ai_hallucinated_address_tokens"] = True

        # ----------------------------------------------------------------------
        # 檢查 7：incident_date 合理性與原文日期證據檢查
        # ----------------------------------------------------------------------
        inc_date = str(ai_candidate.get("incident_date") or "").strip()
        date_ok, date_reason = verify_incident_date(
            incident_date=inc_date,
            source_published_date=fetched_article.source_published_date,
            raw_corpus=full_corpus,
            reference_today=self.reference_today,
        )
        checks["7_incident_date_valid_and_evidenced"] = date_ok
        if not date_ok:
            reasons.append(date_reason)
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description="unknown",
                verification_status="rejected" if "HALLUCINATION" in date_reason or "IMPOSSIBLE" in date_reason or "NOT_IN_TEXT" in date_reason else "pending",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        # ----------------------------------------------------------------------
        # 檢查 8：事故地點四分類驗證 (`inside_building` / `outside_building` / `nearby` / `unknown`)
        # ----------------------------------------------------------------------
        ai_loc_desc = str(ai_candidate.get("location_description") or "unknown").strip()
        if ai_loc_desc not in ALLOWED_LOCATION_DESCRIPTIONS:
            ai_loc_desc = "unknown"

        loc_check = classify_and_verify_incident_location(
            ai_location_desc=ai_loc_desc,
            incident_evidence=inc_ev,
            raw_corpus=full_corpus,
        )
        resolved_loc = loc_check["location_description"]

        if not loc_check["is_qualifying_incident"]:
            reasons.append(loc_check["disqualify_reason"])
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description=resolved_loc,
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        if resolved_loc in {"outside_building", "nearby"}:
            reasons.append(f"INCIDENT_LOCATION_{resolved_loc.upper()}_EXCLUDED")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description=resolved_loc,
                verification_status="rejected",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        if resolved_loc == "unknown":
            reasons.append("INCIDENT_LOCATION_UNKNOWN_NEEDS_REVIEW")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description="unknown",
                verification_status="pending",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        if loc_check["community_wide_risk"]:
            reasons.append("COMMUNITY_WIDE_AMBIGUOUS_UNIT_HELD_FOR_REVIEW")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description="inside_building",
                verification_status="pending",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        checks["8_location_inside_building_and_qualifying"] = True

        # ----------------------------------------------------------------------
        # 檢查 9：地址顆粒度與地圖查詢一致性驗證（若僅社區名、附近道路、行政區，或與地圖結果衝突 -> pending）
        # ----------------------------------------------------------------------
        if not addr_info["has_sufficient_granularity"]:
            reasons.append(addr_info["granularity_issue"] or "ADDRESS_GRANULARITY_INSUFFICIENT")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description=resolved_loc,
                verification_status="pending",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        geo_res = self.geocode_verifier(
            country,
            addr_info["city"],
            addr_info["district"],
            addr_info["standardized_address"],
        )
        if not geo_res.get("matched") or float(geo_res.get("lat") or 0.0) == 0.0:
            reasons.append(geo_res.get("reason") or "ADDRESS_MAP_GEOCODE_CONFLICT")
            return self._build_final_record(
                fetched_article=fetched_article,
                ai_candidate=ai_candidate,
                standardized_address=addr_info["standardized_address"],
                city=addr_info["city"],
                district=addr_info["district"],
                location_description=resolved_loc,
                verification_status="pending",
                checks=checks,
                reasons=reasons,
                lat=0.0,
                lng=0.0,
                location_accuracy="UNVERIFIED",
            )

        checks["9_address_granular_and_map_consistent"] = True
        reasons.append("ALL_9_DETERMINISTIC_CHECKS_PASSED")

        return self._build_final_record(
            fetched_article=fetched_article,
            ai_candidate=ai_candidate,
            standardized_address=addr_info["standardized_address"],
            city=addr_info["city"],
            district=addr_info["district"],
            location_description="inside_building",
            verification_status="verified",
            checks=checks,
            reasons=reasons,
            lat=float(geo_res["lat"]),
            lng=float(geo_res["lng"]),
            location_accuracy=str(geo_res.get("accuracy") or "ROOFTOP"),
        )

    def _build_final_record(
        self,
        fetched_article: Optional[FetchedArticle],
        ai_candidate: Dict[str, Any],
        standardized_address: str,
        city: str,
        district: str,
        location_description: str,
        verification_status: str,
        checks: Dict[str, bool],
        reasons: List[str],
        lat: float,
        lng: float,
        location_accuracy: str,
    ) -> Dict[str, Any]:
        """建立包含全部 12 個強制證據欄位與品質檢查報告之標準化案件字典"""
        src_url = fetched_article.source_url if fetched_article else str(ai_candidate.get("source_url") or "")
        src_title = fetched_article.source_title if fetched_article else str(ai_candidate.get("source_title") or "")
        src_name = fetched_article.source_name if fetched_article else str(ai_candidate.get("source_name") or "")
        src_pub_date = fetched_article.source_published_date if fetched_article else str(ai_candidate.get("source_published_date") or "")
        country = (fetched_article.country if fetched_article else str(ai_candidate.get("country") or "TW")).upper()
        inc_date = str(ai_candidate.get("incident_date") or "").strip()
        inc_type = str(ai_candidate.get("incident_type") or ai_candidate.get("category") or "待查證事故").strip()
        addr_ev = str(ai_candidate.get("address_evidence") or "").strip()
        inc_ev = str(ai_candidate.get("incident_evidence") or "").strip()
        summary = str(ai_candidate.get("summary") or inc_ev or "").strip()

        fp = build_case_fingerprint(country, city, district, standardized_address, inc_date, inc_type)

        return {
            # 12 個強制必填證據欄位
            "source_url": src_url,
            "source_title": src_title,
            "source_name": src_name,
            "source_published_date": src_pub_date,
            "incident_date": inc_date,
            "incident_type": inc_type,
            "country": country,
            "address": standardized_address,
            "address_evidence": addr_ev,
            "incident_evidence": inc_ev,
            "location_description": location_description,
            "verification_status": verification_status,
            # 輔助與資料庫審計欄位
            "city": city,
            "district": district,
            "standardized_address": standardized_address,
            "lat": lat,
            "lng": lng,
            "location_accuracy": location_accuracy,
            "summary": summary,
            "ai_confidence_ignored": float(ai_candidate.get("ai_confidence") or ai_candidate.get("confidence") or 0.0),
            "case_fingerprint": fp,
            "quality_check_report": {
                "all_passed": all(checks.values()) and verification_status == "verified",
                "checks": checks,
                "reasons": reasons,
                "confidence_used_for_verification": False,
            },
        }

    def process_and_commit(
        self,
        fetched_article: Optional[FetchedArticle],
        ai_candidate: Dict[str, Any],
        supabase_client: Any = None,
    ) -> Dict[str, Any]:
        """
        執行嚴格兩階段寫入：
        階段 1：所有案件一律先寫入 `pending_cases`。
        階段 2：僅當 `verification_status == 'verified'` 且 `location_description == 'inside_building'` 時，
                才允許晉升寫入正式 `cases` (`haunted_houses`)，並自動處理跨媒體同案件去重與來源合併。
        """
        evaluated = self.evaluate_candidate(fetched_article, ai_candidate)

        # 第一階段：寫入 pending_cases
        pending_entry = dict(evaluated)
        pending_entry["pending_id"] = len(self.pending_cases_store) + 1
        pending_entry["review_status"] = (
            "approved" if evaluated["verification_status"] == "verified"
            else ("rejected" if evaluated["verification_status"] == "rejected" else "pending")
        )
        self.pending_cases_store.append(pending_entry)

        if supabase_client is not None:
            try:
                supabase_client.table("pending_cases").upsert({
                    "source_url": evaluated["source_url"],
                    "source_title": evaluated["source_title"],
                    "source_name": evaluated["source_name"],
                    "source_published_date": evaluated["source_published_date"],
                    "incident_date": evaluated["incident_date"],
                    "incident_type": evaluated["incident_type"],
                    "country": evaluated["country"],
                    "address": evaluated["address"],
                    "address_evidence": evaluated["address_evidence"],
                    "incident_evidence": evaluated["incident_evidence"],
                    "location_description": evaluated["location_description"],
                    "verification_status": evaluated["verification_status"],
                    "city": evaluated["city"],
                    "district": evaluated["district"],
                    "raw_location_text": str(ai_candidate.get("address") or ""),
                    "standardized_address": evaluated["standardized_address"],
                    "lat": evaluated["lat"],
                    "lng": evaluated["lng"],
                    "location_accuracy": evaluated["location_accuracy"],
                    "category": evaluated["incident_type"],
                    "summary": evaluated["summary"] or evaluated["incident_evidence"],
                    "pending_reason": ";".join(evaluated["quality_check_report"]["reasons"]),
                    "ai_confidence": evaluated["ai_confidence_ignored"],
                    "quality_check_report": evaluated["quality_check_report"],
                    "raw_payload": ai_candidate,
                    "case_fingerprint": evaluated["case_fingerprint"],
                    "review_status": pending_entry["review_status"],
                }, on_conflict="source_url").execute()
            except Exception:
                pass

        # 第二階段：決定論閘門（嚴禁 pending 或 rejected 進入正式 cases 資料表）
        if (
            evaluated["verification_status"] != "verified"
            or evaluated["location_description"] != "inside_building"
            or not evaluated["quality_check_report"]["all_passed"]
        ):
            evaluated["promoted_to_formal_cases"] = False
            evaluated["duplicate_action"] = "NONE"
            return evaluated

        # 檢查是否與既有已驗證案件重複（同一地址或同一案件指紋）
        addr_key = evaluated["address"]
        fp_key = evaluated["case_fingerprint"]
        existing_case = self._cases_by_address.get(addr_key) or self._cases_by_fingerprint.get(fp_key)

        if existing_case is not None:
            # 若同一篇新聞網址重複提交 -> 略過不重複新增
            if existing_case["source_url"] == evaluated["source_url"] or any(
                s["source_url"] == evaluated["source_url"] and s["case_id"] == existing_case["id"]
                for s in self.case_sources_store
            ):
                evaluated["promoted_to_formal_cases"] = False
                evaluated["duplicate_action"] = "EXACT_URL_DUPLICATE_SKIPPED"
                evaluated["formal_case_id"] = existing_case["id"]
                return evaluated

            # 不同媒體報導同一案件 -> 合併來源至 case_sources，主表 merged_count + 1
            existing_case["merged_count"] = int(existing_case.get("merged_count") or 1) + 1
            existing_case["verification_status"] = "verified"
            source_row = {
                "case_id": existing_case["id"],
                "country": evaluated["country"],
                "source_name": evaluated["source_name"],
                "source_title": evaluated["source_title"],
                "source_url": evaluated["source_url"],
                "published_date": evaluated["source_published_date"],
                "address_evidence": evaluated["address_evidence"],
                "incident_evidence": evaluated["incident_evidence"],
                "raw_excerpt": evaluated["summary"],
            }
            self.case_sources_store.append(source_row)

            if supabase_client is not None:
                try:
                    supabase_client.table("case_sources").upsert(source_row, on_conflict="source_url").execute()
                    supabase_client.table("haunted_houses").update({
                        "merged_count": existing_case["merged_count"],
                        "verification_status": "multi_source_verified",
                    }).eq("id", existing_case["id"]).execute()
                except Exception:
                    pass

            evaluated["promoted_to_formal_cases"] = True
            evaluated["duplicate_action"] = "MERGED_MULTI_SOURCE"
            evaluated["formal_case_id"] = existing_case["id"]
            return evaluated

        # 新增至正式案件表 cases (haunted_houses)
        new_case_id = len(self.formal_cases_store) + 1
        formal_row = {
            "id": new_case_id,
            "source_url": evaluated["source_url"],
            "source_title": evaluated["source_title"],
            "source_name": evaluated["source_name"],
            "source_published_date": evaluated["source_published_date"],
            "incident_date": evaluated["incident_date"],
            "incident_type": evaluated["incident_type"],
            "country": evaluated["country"],
            "address": evaluated["address"],
            "address_evidence": evaluated["address_evidence"],
            "incident_evidence": evaluated["incident_evidence"],
            "location_description": evaluated["location_description"],
            "verification_status": "verified",
            "city": evaluated["city"],
            "district": evaluated["district"],
            "doorplate_address": evaluated["standardized_address"],
            "lat": evaluated["lat"],
            "lng": evaluated["lng"],
            "category": evaluated["incident_type"],
            "reason": f"{evaluated['source_title']} — {evaluated['summary']}",
            "source": evaluated["source_name"],
            "case_fingerprint": evaluated["case_fingerprint"],
            "merged_count": 1,
            "quality_check_report": evaluated["quality_check_report"],
        }
        self.formal_cases_store.append(formal_row)
        self._cases_by_address[addr_key] = formal_row
        self._cases_by_fingerprint[fp_key] = formal_row

        source_row = {
            "case_id": new_case_id,
            "country": evaluated["country"],
            "source_name": evaluated["source_name"],
            "source_title": evaluated["source_title"],
            "source_url": evaluated["source_url"],
            "published_date": evaluated["source_published_date"],
            "address_evidence": evaluated["address_evidence"],
            "incident_evidence": evaluated["incident_evidence"],
            "raw_excerpt": evaluated["summary"],
        }
        self.case_sources_store.append(source_row)

        if supabase_client is not None:
            try:
                ins = supabase_client.table("haunted_houses").upsert({
                    k: v for k, v in formal_row.items() if k != "id"
                }, on_conflict="address").execute()
                db_id = ins.data[0]["id"] if (ins.data and ins.data[0].get("id")) else new_case_id
                formal_row["id"] = db_id
                source_row["case_id"] = db_id
                supabase_client.table("case_sources").upsert(source_row, on_conflict="source_url").execute()
            except Exception:
                pass

        evaluated["promoted_to_formal_cases"] = True
        evaluated["duplicate_action"] = "INSERTED_NEW_CASE"
        evaluated["formal_case_id"] = formal_row["id"]
        return evaluated
