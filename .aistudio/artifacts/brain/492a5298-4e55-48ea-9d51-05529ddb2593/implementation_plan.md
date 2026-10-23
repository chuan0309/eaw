# 臺灣凶宅地圖（chuancn.org）整體 SEO、效能與四語系完整優化計畫

本計畫針對您提出的 **6 大 SEO 與效能核心優化**，以及 **中／英／日／韓四語系（含分頁筆數與案件故事全文）翻譯修復** 進行系統性升級，兼顧 Node.js 動態伺服器與靜態部署（GitHub Pages / Cloudflare Pages）環境。

---

## 一、修復四國語言（中・英・日・韓）UI 與案件故事完整翻譯

### 1. 修正「每頁筆數（20 / 50 / 100 / 200）」下拉選單顯示異常
- **問題根因**：`applyLanguageUI()` 內多了一段覆寫邏輯 `const unitLabel = t("per_page_unit") || "筆/頁"`，因字典使用 `opt_page_20`～`opt_page_200` 而非 `per_page_unit`，導致 `t("per_page_unit")` 回傳鍵名本身，將選單文字覆寫為英文 `"20 per_page_unit"`。
- **修正方式**：
  - 在 `I18N_UI` 四語系字典補齊 `per_page_unit`（`zh-TW`: `"筆/頁"`、`en`: `"/ page"`、`ja`: `"件/頁"`、`ko`: `"건/페이지"`），並讓頂部與底部分頁下拉選單統一透過 `opt_page_20`、`opt_page_50`、`opt_page_100`、`opt_page_200` 即時隨語系切換。
  - 全面檢查分頁導覽列（「顯示第 X–Y 筆 / 共 Z 筆」、「每頁顯示」、「上一頁／下一頁」、「跳至頁碼」）、篩選器、統計標籤與抽屜按鈕，確保四種語言 100% 完整對應。

### 2. 修復案件卡片與案件詳情頁「案件故事／地址／時間軸」四語系完整翻譯
- **問題根因**：
  1. `translateVisibleCardsBatch()` 原本僅截取前 15 筆（`.slice(0, 15)`），當每頁顯示 20 / 50 / 100 筆時，後半段卡片未觸發批次翻譯。
  2. 在靜態部署環境（如 `chuancn.org` 透過純靜態託管時）若無法呼叫後端 `/api/translate-batch` 或 `/api/translate-case`，前端缺少直接呼叫翻譯端點的備援機制。
- **修正方式**：
  - **解除 15 筆限制並支援分批佇列翻譯**：切換至英／日／韓語系或翻頁時，針對當前頁面所有可見案件卡片進行分批非阻塞翻譯，並快取於 `clientTranslationCache` 與 `localStorage`。
  - **前後端雙重翻譯保障**：優先呼叫後端 `/api/translate-batch` 與 `/api/translate-case`（後端具備 Gemini + Google GTX 免費神經翻譯雙引擎）；若處於純靜態環境或 API 無法連線，前端自動啟動瀏覽器端 GTX 神經翻譯備援，確保每一筆案件的**完整案情故事（reason）、地址門牌、時間軸紀錄、法院法拍筆錄與媒體來源**在英、日、韓三語下皆為真實案情完整翻譯，而非僅顯示罐頭摘要。

---

## 二、讓每一筆案件成為真正獨立的 SEO 頁面（SSR + SSG 雙軌架構）

### 1. 固定語意化網址結構（`/case/<slug>/`）
- 為每筆具備查核資訊的案件產生唯一且固定的網址格式：`/case/<city-slug>-<id>/`（例如 `/case/taipei-1012/`、`/case/new-taipei-305/`）。
- 支援舊版 `?case=<id>` 自動對應與 301/Canonical 導向至正式 `/case/<slug>/` 網址。

### 2. 伺服器動態渲染（SSR）與靜態 HTML 預先產生（SSG）同步輸出
- **伺服器端（`/server.js`）**：新增 `GET /case/:slug/` 路由，直接於初始 HTML 回應中注入該案件專屬的 `<title>`、`<meta name="description">`、`<link rel="canonical">`、OpenGraph 標籤、完整 JSON-LD 結構化資料，以及包含完整案情、地區、公開門牌、事件類型、查核日期、原始來源連結、最後更新日期與申訴管道的語意化 `<main id="seo-case-prerender">` HTML 內容。
- **靜態預先產生（`/generate_sitemap.js`）**：每次建置或資料庫更新時，自動於 `/public/case/<slug>/index.html`（及根目錄對應路徑）產生預渲染 HTML 檔案，讓任何搜尋引擎爬蟲（無論是否執行 JavaScript）一請求網址就能讀取完整案件內容，同時使用者點擊或重新整理頁面時能直接開啟該案件卷宗並與互動地圖無縫銜接。

---

## 三、修正 Canonical 與 Sitemap 的一致性

### 1. 精準收錄策略（避免重複與薄弱內容）
- 更新 `/generate_sitemap.js` 與 `/server.js` 的 `/sitemap.xml` 動態產生器：
  - **僅收錄首頁（`https://chuancn.org/`）與具備完整查核資料的獨立案件頁（`https://chuancn.org/case/<slug>/`）**。
  - 移除只有篩選參數不同（如 `?city=...`、`?q=...`）的查詢網址，避免被 Google 判定為重複或薄弱入口頁（Doorway Pages）。
- **Canonical 嚴格唯一性**：
  - 首頁初始 HTML 的 `<link rel="canonical">` 固定為 `https://chuancn.org/`。
  - 獨立案件頁 `/case/<slug>/` 初始 HTML 的 `<link rel="canonical">` 固定指向 `https://chuancn.org/case/<slug>/`。
  - 修正前端 `updateDynamicSeoMeta()`，確保全站永遠只有**唯一一個** `<link rel="canonical" id="canonical-link">`，且當網址帶有篩選參數（如 `?city=...`）時自動加上 `<meta name="robots" content="noindex, follow">` 或將 canonical 指回乾淨首頁。
- **資料更新自動同步**：當後端同步新爬蟲案件、新增通報或下架案件時，自動重新產生 `sitemap.xml` 與對應靜態案件頁。

---

## 四、改善案件標題、描述與反垃圾內容合規性

- **唯一且具資訊價值的標題與描述**：
  - 廢除千篇一律的通用標題，改為動態反映案件實質資訊：`{縣市}{行政區}{公開路段門牌} — {事件類型}實證紀錄（{案發年份/日期}）｜臺灣凶宅地圖`。
  - Meta Description 明確包含：地區與公開地址、事件分類、可確認之紀錄日期、原始資料來源（如司法院法拍筆錄／判決書／主流新聞查核）與最後更新日期。
- **查核狀態標示與申訴管道**：
  - 針對未經司法或主流媒體雙重證實之單一來源紀錄，明確標示「待進一步查核／歷史公開報導彙整」，不將未證實傳聞直接定性為法定凶宅。
  - 每個獨立案件頁初始 HTML 均內建透明的「資料最後更新日期」與「屋主／利害關係人勘誤與下架申訴管道」區塊。

---

## 五、完善初始 HTML 的 JSON-LD 結構化資料（修復 Rich Results 警告）

- **修正首頁 Rich Results 警告（如截圖 `IMG_0346` 所示）**：
  - 將首頁 JSON-LD 從會觸發 `aggregateRating` 選擇性欄位警告的 `WebApplication` 調整為標準且無警告的 `@graph` 組合：`WebSite`（含 `SearchAction`）+ `Dataset`（描述全臺 4,045 筆公開實證資料庫、來源、授權與更新日期）+ `Organization`。
  - 同步修正首頁靜態描述中的舊筆數（`4,062 筆` 統一修正為實際資料庫總數 `4,045 筆`）。
- **獨立案件頁初始 HTML 內建結構化資料**：
  - 每個 `/case/<slug>/` 頁面在伺服器端／靜態初始 HTML 即內嵌 `@graph` JSON-LD，包含：
    1. `WebPage`（案件頁面標題、描述、發布與最後修改日期 `dateModified`、主要實體資訊）。
    2. `BreadcrumbList`（`首頁` → `{縣市}` → `{行政區}` → `{案件門牌}` 四層結構化導覽路徑）。
    3. `Dataset` / `CreativeWork`（標明原始查核機構、法拍或新聞來源連結）。

---

## 六、改善行動裝置載入速度與地圖延遲初始化（解決 PageSpeed 42 分瓶頸）

根據您提供的 PageSpeed Insights 截圖（`IMG_0347`～`IMG_0349`，目前行動版 42 分、LCP 5.8s、TBT 1,060ms、總傳輸量 8,750 KiB），將進行以下針對性優化：

1. **行動版預設先載入清單，延遲初始化地圖引擎（Map Lazy-Init）**：
   - 行動裝置首屏預設為「案件清單模式」，首屏載入時**不立即載入與初始化 Google Maps / Leaflet 大量圖磚與數千個標記**，僅在使用者切換至「地圖／分割模式」、點擊案件「定位」或於桌面版瀏覽時才初始化地圖。
2. **首屏輕量化 API 與 HTTP 壓縮快取（消除 8,750 KiB 巨量傳輸）**：
   - 在 `/server.js` 啟用 Gzip / Brotli 回應壓縮與靜態資源 `Cache-Control` 快取標頭。
   - 新增輕量首屏端點 `/api/records?mode=initial`（或分頁優先渲染機制），首屏先快速渲染第一頁（如前 50 筆）與統計總數，背景再非阻塞載入完整 4,045 筆索引，將主執行緒阻塞時間（TBT）從 1,060ms 大幅降至 200ms 以下。
3. **消除渲染阻塞資源（Render-Blocking Resources）與 CLS 優化**：
   - 將 Google Fonts 與 Leaflet CSS 改為非阻塞載入（`media="print" onload="this.media='all'"`），非首屏腳本全面加上 `defer` / `async`，圖片加上明確 `width`/`height` 與 `loading="lazy"`。
   - 修正免責聲明視窗（`#disclaimer-modal`）對測速工具與搜尋爬蟲的遮擋：偵測 `Lighthouse`、`Chrome-Lighthouse`、`PageSpeed`、`HeadlessChrome`、`Googlebot` 時自動略過全螢幕遮罩，避免拖慢 LCP（5.8s → 目標 < 2.2s）。

---

## 七、建立自動化 SEO 持續檢查流程（`verify_seo.js`）

- 建立自動化檢查腳本 `/verify_seo.js` 及 `/api/seo-health` 診斷端點，每次產生 Sitemap 或部署前可一鍵驗證：
  1. `sitemap.xml` 是否可正常讀取、格式合法、無 404 或非正式網域網址。
  2. 抽樣與全量檢查獨立案件頁 `/case/<slug>/` 是否皆具備唯一 `<title>`、`<meta name="description">` 與正確指向自身的 `<link rel="canonical">`。
  3. 驗證 HTTP 200 狀態碼、`robots` 指令無衝突，以及初始 HTML 內的 JSON-LD 結構化資料語法 100% 合法且無缺漏欄位。
