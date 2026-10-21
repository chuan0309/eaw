# 聯盟推廣變現分析與社群導流分享系統（iChannels 買房／租屋搬家族群專項）

為協助平台透過 **iChannels（通路王）** 穩定創造導購分潤收益，本計畫在不破壞現有「高可信度地理資訊與產權查證」版面整潔度的前提下，新增 **「一鍵產生社群與論壇（PTT / Dcard / LINE / Threads）分享文案」** 與 **「推廣連結點擊次數統計與熱度分析中心」**，精準鎖定看屋、買房、租屋與搬家入厝族群進行導流與轉換追蹤。

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下為根據您的選擇所確立的核心功能與設計決策，請確認後點擊「Proceed」開始建置：

- **Confirmed Decision 1（核心推廣工具）**：實作「**一鍵產生社群與論壇分享文案按鈕**」與「**推廣連結點擊次數統計與熱度分析**」兩大模組。
- **Confirmed Decision 2（受眾與廣告品類定位）**：鎖定 **買房看屋與租屋搬家族群（居家清潔、家電、家具家飾、舒適居家選品）**，將現有 4 組 iChannels 推廣連結依看屋／交屋情境做精準點擊追蹤與成效排序。
- **Recommended Default（隱私與版面整潔原則）**：一般訪客僅會看到自然的「分享案件／複製論壇文案」按鈕與清爽的原生推薦卡片；「推廣點擊統計與導流中心」則收納於左下角「居家服務推薦 ▴」面板及頂部推廣分析視窗中，保持主畫面零干擾。

---

## 1. Overview & Core Concept

- **What It Does**：
  1. **一鍵社群與論壇導流文案產生器（Social & Forum Share Engine）**：
     - 在「案件詳情抽屜（Case Dossier Drawer）」與「左側區域篩選摘要列」新增 **「📤 分享查證結果／複製論壇文案」** 按鈕。
     - 支援三種高轉換社群格式一鍵複製：
       - **Dcard 購屋／租屋板 & PTT home-sale 格式**：自動帶入該案件之「行政區、路段門牌、案發日期、建物型態、座向風水方位」與「全臺公開資料庫查證網址（含該案或該行政區直連參數）」，方便在網友詢問看屋避雷時直接回文導流。
       - **LINE 看房群組／親友分享精簡格式**：適合一鍵轉傳至 LINE 買房群組或家庭群組。
       - **Threads / Facebook 房產討論串格式**：重點摘要該區段歷年統計筆數與查詢連結。
  2. **推廣連結點擊統計與熱度分析中心（Affiliate Click & Conversion Heat Analytics）**：
     - 自動攔截並記錄全站三大版位（`列表原生卡片 In-Feed`、`案件詳情抽屜 Drawer`、`左下角快捷列 Footer`）對 4 組 iChannels 推廣連結（宏立發專業清潔、HOLA 和樂家居、居家好物嚴選、JamaLady 舒適居家）的每一次點擊。
     - 同步儲存於後端 API（`/api/affiliate-stats`）與瀏覽器本地端，提供即時的 **各品牌總點擊數、各版位點擊佔比（哪個版位最容易被點）、今日／累計點擊熱度排行**，以及 **全站導流文案複製次數統計**。
- **Target Audience / Persona**：
  - **網站經營者（您）**：需要快速產出專業的看屋查證回文發佈至 Dcard、PTT、LINE 群組引流，並即時查看哪一個通路王廣告連結與哪一個版位帶來最多有效點擊。
  - **進站訪客（買房看屋、租屋族、法拍投資客）**：查完目標房屋有無事故紀錄後，透過分享按鈕將資訊轉傳給親友，並在準備交屋或搬家時點擊冷氣／水塔清洗、HOLA 軟裝寢具與家電優惠。
- **Key Value**：將「免費公開查證工具的高自然流量」順暢轉化為「社群口碑二次傳播（帶來更多新訪客）」與「高單價居家服務 CPS 分潤點擊」。

---

## 2. User Experience & Visual Design

- **Key User Flows**：
  1. **單一案件／區域論壇導流流程**：
     - 使用者開啟任一案件詳情抽屜 → 點擊標題列或門牌列旁的 **「📤 分享／論壇文案」** → 彈出輕量切換選單（`Dcard / PTT 看屋討論格式`、`LINE 群組轉傳格式`、`複製此案直連網址`） → 點擊後自動複製完整排版文案並顯示 Toast 提示，同時將該次分享計入導流統計。
  2. **推廣連結點擊自動追蹤與熱度排序**：
     - 當訪客點擊任一推廣卡片（不論位於列表第 3 筆下方、詳情抽屜或底部面板），系統立即透過 `navigator.sendBeacon` / 非阻塞 `fetch` 將 `{ adId, placement, city, lang }` 寫入統計引擎，完全不影響外連開啟速度。
  3. **開啟「推廣成效與導流分析中心」**：
     - 點擊左下角「居家服務推薦 ▴」面板內的 **「📊 推廣點擊統計與導流文案」** 按鈕，即可開啟乾淨的表格式數據面板，檢視 4 組推廣連結的點擊次數、熱度百分比條（Progress Bar）、版位表現（列表 vs. 詳情抽屜 vs. 底部列），並提供「全站區域看屋懶人包文案」一鍵複製功能。
- **Visual Identity & Theme**：
  - *Aesthetic Direction*：延續平台既有的「瑞士網格公部門實證檔案館（Civic-Tech & Editorial Precision）」風格，採用單層邊框（`1px solid #E2E8F0`）與高對比冷灰白底色，絕不使用俗豔紅黃促銷橫幅。
  - *Color Palette & Mood*：背景 `#FFFFFF` / `#F8FAFC`，主文字 `#0F172A`，數據指標與熱度條採用沉穩靛藍（`#4F46E5`）與翡翠綠（`#059669`）。
  - *Typography & Hierarchy*：標題與內文使用 `Plus Jakarta Sans` 與 `Noto Sans TC / JP / KR`；所有點擊計數、轉換率百分比與時間戳記嚴格套用 `JetBrains Mono` 等寬字體與 `tabular-nums` 對齊。
- **Interactive Feedback & Motion**：
  - 點擊任一推廣連結時，左下角面板與分析中心的計數器即時 `+1` 並更新熱度排名；點擊複製論壇文案時，按鈕顯示微互動勾選狀態與 Toast 通知。

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1：非阻塞式點擊追蹤（Zero-Latency Affiliate Outbound Clicks）**
  - *Chosen Approach*：保留原生 `<a href="https://..." target="_blank" rel="noopener noreferrer sponsored">` 標籤，確保瀏覽器與 iChannels 追蹤 Cookie 100% 正常寫入、絕不被彈窗阻擋器攔截；同時透過全域點擊委派（Event Delegation）與 `navigator.sendBeacon("/api/affiliate-click")` 在背景記錄點擊。
  - *Why*：若改用 JS `window.open` 或中轉頁，容易被手機瀏覽器攔截或影響 iChannels GID 歸因；原生 `<a>` 搭配背景 Beacon 兼顧 100% 分潤歸因成功率與精準統計。
- **Decision 2：針對買房／租屋搬家族群的情境化標籤強化**
  - *Chosen Approach*：在 4 組推廣卡片上加入符合買房／租屋痛點的精準行動標籤（例如：`交屋入厝必備`、`新居軟裝推薦`、`租屋家電優惠`、`居家舒適選品`），並支援四國語言（繁中 / EN / 日本語 / 한국어）同步顯示。
  - *Why*：提高看屋與搬家族群的點擊意願（CTR），同時維持卡片與案件列表一致的極簡專業質感。

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**：
```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Client UI (index.html - 4 Languages)                  │
├───────────────────────────────────┬─────────────────────────────────────┤
│  Social & Forum Copy Generator    │   Native Affiliate Placements (x3)  │
│  ┌─────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │ • Case Dossier Share Button │  │  │ 1. In-Feed List Card (#3)     │  │
│  │ • Dcard/PTT/LINE Templates  │  │  │ 2. Case Dossier Section 3B    │  │
│  │ • Deep-Link URL (?case=ID)  │  │  │ 3. Sidebar Footer Strip       │  │
│  └──────────────┬──────────────┘  └──┴───────────────┬───────────────┘  │
│                 │                                    │                  │
│                 ▼                                    ▼                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │       Affiliate Click & Share Telemetry Tracker (sendBeacon)      │  │
│  │     • Tracks { adId, placement, city, timestamp } + LocalCache    │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
│                                 │                                       │
│                                 ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │        Promotion & Click Analytics Modal (#promo-analytics)       │  │
│  │     • Click Leaderboard & Heat Bars by Brand (HLF/HOLA/OEYA/JAMA) │  │
│  │     • Placement Attribution Breakdown (In-Feed vs Drawer vs Bar)  │  │
│  │     • Ready-to-Post Forum Copy Templates (PTT / Dcard / LINE)     │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ POST /api/affiliate-click
                                  │ GET  /api/affiliate-stats
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Express Backend (server.js)                         │
│  • Persistent in-memory + disk-synced click & share counters            │
│  • Aggregates clicks by adId, placement, and city for heat analysis     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**：
  - `AFFILIATE_PARTNERS`：定義 4 組買房／租屋搬家推廣項目（`hlf_clean` 宏立發清潔、`hola_home` HOLA 和樂家居、`oeya_deals` 居家好物嚴選、`jama_comfort` JamaLady 舒適內著），包含網址、四語標題、四語描述與受眾情境標籤。
  - `affiliateStats`：記錄各 `adId` 的總點擊數（`clicksByAd`）、各版位點擊數（`clicksByPlacement`: `infeed` / `drawer` / `footer`）、社群分享複製次數（`shareCopies`），以及最近點擊時間。
- **Interactive Component & State Mapping**：
  - **案件直連網址解析（Deep-Link URL Routing）**：當外部網友從 Dcard / PTT / LINE 點擊您分享的網址（如 `?city=臺北市&district=中正區` 或 `?case=ID`）進站時，系統在 `loadAllData()` 完成後自動篩選該區或直接展開該筆案件詳情抽屜與推廣服務區塊，完成「論壇貼文 → 精準落地 → 點擊推廣連結」的閉環。
  - **一鍵分享與論壇文案切換器**：點擊案件詳情中的「分享查證結果」按鈕，可選擇複製「論壇回文版（Dcard / PTT）」、「LINE 看房群組版」或「區域統計版」，一鍵寫入剪貼簿並觸發 `/api/affiliate-click`（`type: "share"`）統計。
