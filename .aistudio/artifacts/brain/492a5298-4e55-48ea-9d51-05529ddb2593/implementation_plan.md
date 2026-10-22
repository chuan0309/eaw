# 背景語意與 AI 案件自動去重合併及介面審查說明全面淨化計畫

本計畫針對同行政區重複收錄之同一案件（例如同為桃園八德區 25 歲女租客遭尾隨割喉縱火命案，卻因不同來源分別記載「永忠街」與「介壽路二段583巷」而重複出現）導入後台語意特徵與 Gemini AI 輔助比對機制，自動以**附有真實新聞連結或判決字號之核實紀錄為主檔**進行無感合併；同時全面移除網站前端與資料庫中多餘的「案發日期雙重核實（報導發布日…回推 1 日）」及內文括號推算說明，讓所有審查、回推與合併邏輯 100% 於背景靜默執行。

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下為根據您的回覆確認之核心執行原則：

- **Confirmed Decision 1（同案異址自動合併原則）**：當後台偵測到同縣市、同行政區內兩筆以上紀錄屬於同一事件（如被害人年齡／性別、案發時間相近、死因與犯案手法高度吻合），系統將自動以**附有真實新聞原始連結（`source_url`）或司法院判決／法拍字號之紀錄**作為唯一主檔保留，並將缺乏連結或由推估產生之重複卡片直接合併消除。
- **Confirmed Decision 2（全面淨化系統審查與推算說明）**：完全移除詳情抽屜中的「案發時間與查證備註：案發日期雙重核實…」整行文字，以及內文中額外插入的「（2026年10月11日）」、「（同址／同路段整合紀錄…）」等系統推算字樣，僅保留純淨的真實案發日期、地址、原始案情摘要與外部查證連結。

---

## 1. Overview & Core Concept

- **What It Does**：
  1. **後台多維度語意特徵 + Gemini AI 案件去重合併引擎**：突破過去僅以「完全相同路名」合併的限制，針對同行政區、案發時間相近（如前後 30 天內或同年同月）的案件，自動比對**被害人年齡與性別特徵**（如 `25歲女`）、**死因與犯案手法特徵**（如 `尾隨`、`割喉／頸部刀傷`、`縱火／惡火`、`燒炭`、`墜樓` 等）及**關係人特徵**；並提供後台 Gemini AI（`gemini-3.8-flash`）批次語意判別端點，於資料入庫與整理時靜默合併同一案件。
  2. **零干擾純淨介面呈現**：刪除所有在前端展示給使用者的後台審查過程文字（包含 `auction_record` 中的「案發日期雙重核實…」與 `reason` 中的日期括號補註），使每筆案件卡片與詳情卷宗如同專業不動產產權資料庫般簡潔直觀。
- **Target Audience / Persona**：查詢不動產事故歷史的買方、租客、房仲與估價師，需要直接閱讀乾淨、無重複且無系統工程註記干擾的真實案情與新聞連結。
- **Key Value**：消除「同一案件因不同報導或推估路名而出現兩張卡片」的混亂，並徹底清除多餘的系統推算過程文字。

---

## 2. User Experience & Visual Design

- **Key User Flows**：
  - **瀏覽案件列表**：在桃園市八德區（及全台各行政區）瀏覽時，原本重複出現的「八德區介壽路二段583巷（25歲女割喉縱火案）」與「八德區永忠街（25歲盧姓女頸部刀傷惡火命案）」已於背景自動合併為唯一一筆附有聯合新聞網真實連結的「**桃園市八德區永忠街**」核實紀錄（案發日期 `2026-10-11`）。
  - **檢視案件詳情卷宗（Dossier Drawer）**：點擊進入詳情抽屜時，上方直接呈現案發日期 `2026-10-11` 與純淨新聞內文，下方查證區塊僅顯示「**查證來源出處**」與「**查看原始新聞報導**」按鈕，不再顯示第一張截圖中多餘的「案發時間與查證備註：案發日期雙重核實：2026-10-11（報導發布日…回推 1 日）」。
- **Visual Identity & Theme**：
  - 延續高對比專業產權卷宗風格（Neutral Slate `#0F172A` 搭配純白結構表面 `#FFFFFF` 與 `1px solid` 細線分隔）。
  - 嚴格遵守 **Anti-Slop 與無系統雜訊原則**：不在任何卡片或抽屜顯示後台檢核狀態、推算公式或合併過程說明。

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1：同行政區跨路名之「同案語意特徵指紋」與 Gemini AI 雙重去重**
  - *Chosen Approach*：結合確定性語意特徵指紋（同縣市行政區 + 被害人年齡／性別 + 核心死因／犯案手法關鍵詞 + 相近案發時間）與後台 Gemini AI（`gemini-3.8-flash`）語意比對，當判定為同一事件時，按權重排序：`具真實新聞 URL（source_url）且內文含明確路名之紀錄 > 具司法院判決／法拍字號之紀錄 > 一般紀錄`，直接保留最高權重主檔。
  - *Why*：既能毫秒級瞬間攔截並清除全庫中如「八德 25 歲女尾隨割喉縱火案」等跨路名重複案件，又能在新爬蟲入庫時透過 AI 語意確認避免漏網之魚。
- **Decision 2：移除所有暴露於前端的系統核實與日期推算字串**
  - *Chosen Approach*：清理資料庫與爬蟲產出中的 `案發日期雙重核實：...`、`案發日期核實：...`、內文插註的 `（YYYY年M月D日）` 以及 `（同址／同路段整合紀錄...）`，並在詳情抽屜將查證區塊精簡為純粹的「查證來源出處」與「原始報導連結」。
  - *Why*：使用者只需看到正確的最終日期與原始案情，不需在畫面上閱讀系統如何從「昨日清晨」回推日期的工程過程。

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌───────────────────────────────────────────────────────────────────────────┐
│                Background Silent Deduplication & Audit Pipeline           │
├───────────────────────────────────────────────────────────────────────────┤
│  Raw / Crawled Records                                                    │
│       │                                                                   │
│       ▼                                                                   │
│  [1. Silent Date & District Calibration]                                  │
│   • Computes exact incident_date from pubDate + relative terms silently   │
│   • Never injects "(報導發布日...回推1日)" or "(2026年10月11日)" into UI    │
│       │                                                                   │
│       ▼                                                                   │
│  [2. Semantic Fingerprint & Gemini AI Event Matcher]                      │
│   • Matches same (City + District) records sharing:                       │
│     - Victim age/gender (e.g., 25歲 + 女) + Modus operandi (割喉/刀傷+縱火)│
│     - Proximity in incident_date (or same year/month)                     │
│   • Winner Selection Priority:                                            │
│     1) Verified News URL (udn/ltn/ettoday/cna) with authentic street name │
│     2) Judicial Yuan Judgment / Foreclosure Case Number                   │
│       │                                                                   │
│       ▼                                                                   │
│  [3. Clean UI Presentation (Dossier Drawer & Case Cards)]                 │
│   • Displays only clean incident_date, doorplate, original reason,        │
│     media source name, and original report link                           │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State Cleanup**：
  - 針對全庫案件執行同行政區語意比對，將桃園八德區 `2026-10-12 介壽路二段583巷（25歲女租客尾隨割喉縱火案）` 自動併入附有聯合報真實新聞連結的 `2026-10-11 桃園市八德區永忠街` 主檔，並掃除全庫所有同類重複案件。
  - 清除全庫所有紀錄中 `reason` 與 `auction_record` 內含的系統核實推算說明，並移除前端 `renderAuctionVerificationBox` 中顯示「案發時間與查證備註」的冗餘列。
