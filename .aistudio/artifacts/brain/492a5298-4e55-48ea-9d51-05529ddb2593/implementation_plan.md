# 法拍卷宗產權印鑑網站圖示（Favicon）、Google AdSense 廣告單元嵌入與預覽相容性優化計畫

本計畫針對您提出的三項需求進行升級：更換瀏覽器分頁左上角的專屬網站圖示（法拍卷宗與產權查證印鑑風格）、在左側案件列表與案件詳情抽屜底部嵌入您剛建立的 Google AdSense 回應式廣告單元（`ca-pub-4333106443725240` / `slot: 3488263290`），並全面排除導致 Google AdSense「廣告設定預覽」顯示找不到網頁的爬蟲與跨網域預覽限制。

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下為您於第一階段確認的設計與版位決策，確認無誤後點擊「Proceed」即可立即執行：

- **確認決策 1（瀏覽器分頁網站圖示 Favicon）**：採用 **「法拍卷宗與產權查證印鑑風格圖示」**（深石板藍底色搭配高對比白色法拍建物卷宗與朱紅色產權查證印鑑標記），同時內嵌於 HTML `<head>` 並輸出獨立靜態圖示檔，確保所有瀏覽器分頁、書籤與 Google 搜尋結果皆能清晰呈現。
- **確認決策 2（Google AdSense 廣告單元 `3488263290` 版位）**：同時嵌入於 **「左側案件列表與合作夥伴區塊下方」** 與 **「點開案件詳情抽屜（Dossier）底部的查證資訊下方」**，並設計安全觸發機制（`(adsbygoogle = window.adsbygoogle || []).push({})`）避免遮擋地圖操作或干擾閱讀。
- **確認決策 3（解決 AdSense 廣告設定預覽失敗）**：
  1. 在程式碼層面：更新 `robots.txt` 明確放行 `Mediapartners-Google` 與 `AdsBot-Google`、新增 Cloudflare Pages 專用 `_headers` 允許 Google AdSense 預覽器（`*.google.com`）嵌入預覽，並當偵測到 Google AdSense 預覽環境或爬蟲時自動略過首次進站免責聲明遮罩（避免預覽畫面被彈窗擋住）。
  2. 在 Cloudflare 與 AdSense 後台層面：提供簡明檢查清單（關閉 Cloudflare「機器人對抗模式 Bot Fight Mode」並開啟 AdSense 預覽頁右上角「自動廣告」開關）。

---

## 1. Overview & Core Concept

- **What It Does**：
  1. 為「臺灣特殊事故建物與產權紀錄查詢平台」建立專屬的「法拍卷宗與產權查證印鑑」高解析向量 Favicon 與 Apple Touch Icon，取代原本預設的藍色圓圈箭頭圖示。
  2. 將您的 Google AdSense 多媒體廣告單元（`data-ad-client="ca-pub-4333106443725240"`、`data-ad-slot="3488263290"`）整合進左側案件列表中的原生贊助區下方，以及右側案件詳情抽屜（Dossier）底部的外部查證與合作夥伴區塊下方。
  3. 強化網站對 Google AdSense 預覽代理伺服器（`Mediapartners-Google` / `google_ad_client` 預覽 iframe）的相容性。
- **Target Audience / Persona**：查詢全臺 3,052 筆特殊事故建物與法拍產權紀錄的買屋族、房仲與估價人員，以及透過 Google 搜尋與行動裝置瀏覽的訪客。
- **Key Value**：提升品牌專業辨識度（分頁圖示與搜尋結果小圖示）、啟用實質 Google AdSense 廣告收益版位，並讓 AdSense 後台預覽與自動廣告順利運作。

---

## 2. User Experience & Visual Design

- **Key User Flows**：
  1. **瀏覽器分頁與書籤辨識**：使用者開啟網站時，瀏覽器分頁立即顯示「法拍卷宗＋朱紅查證印鑑」圖示，與平台「產權與法拍實證」定位完全契合。
  2. **左側列表流暢瀏覽**：使用者在左側瀏覽案件卡片時，於第 3 筆案件後的合作夥伴推薦卡下方自然呈現 Google AdSense 回應式廣告單元（`slot: 3488263290`），不影響上方篩選器與右側 Google Maps 互動。
  3. **案件詳情抽屜深入查閱**：使用者點擊任一案件打開詳情抽屜（Dossier），在查閱完街景、案情與司法院／新聞外部查證連結後，於底部合作夥伴區塊下方顯示 Google AdSense 回應式廣告單元，並於抽屜展開且具備實際寬度時動態初始化廣告。
- **Visual Identity & Theme**：
  - *Aesthetic Direction*：Swiss Grid Civic-Tech（瑞士網格公共產權檔案庫風格）。
  - *Color Palette & Mood*：延續 `#0F172A`（深石板藍）主色、`#F8FAFC`（淺灰白背景）與 `#DC2626`（朱紅印鑑強調色），廣告容器採用與案件列表一致的細緻邊框（`border-slate-200/90`）與柔和底色（`bg-slate-50/75`）。
  - *Typography & Hierarchy*：維持 `Plus Jakarta Sans` + `Noto Sans TC` 與 `JetBrains Mono` 等寬數值字體。
- **Interactive Feedback & Motion**：
  - 當 AdSense 廣告尚未填充分發或處於審核階段時，廣告容器會自動收合或維持極簡留白，絕不產生破圖或刺眼空白框。

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1：雙重 Favicon 掛載策略（Inline Data URI + 獨立 `/favicon.svg` 靜態檔）**
  - *Chosen Approach*：同時在 `<head>` 內嵌 SVG Data URI `<link rel="icon">` 並建立 `/favicon.svg` 與 `/public/favicon.svg` 實體檔案。
  - *Why*：內嵌 Data URI 可確保瀏覽器分頁零延遲立即換上新圖示（不受舊快取影響），而獨立 `/favicon.svg` 則供 Google Search 爬蟲抓取顯示於搜尋結果旁。
- **Decision 2：動態安全載入 Google AdSense 單元（防止 `No slot size for availableWidth=0` 錯誤）**
  - *Chosen Approach*：針對左側列表與右側詳情抽屜中的 `<ins class="adsbygoogle" data-ad-slot="3488263290">`，使用容器寬度檢測與安全 `try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}` 機制，確保抽屜打開（非 `hidden` 狀態）時才觸發渲染。
  - *Why*：若在隱藏（`display: none`）的抽屜中直接呼叫 `adsbygoogle.push({})`，AdSense 腳本會因為偵測不到寬度而拋出錯誤並停止渲染廣告。
- **Decision 3：AdSense 預覽器自動略過首次免責聲明彈窗**
  - *Chosen Approach*：當系統偵測到頁面處於 `iframe` 預覽模式（如 Google AdSense 廣告設定預覽器）或網址帶有預覽參數時，自動略過全螢幕免責聲明遮罩，直接呈現完整地圖與案件列表。
  - *Why*：幫助 Google AdSense 預覽工具直接分析頁面版位結構，避免只抓到遮罩彈窗。

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        HTML <head> & Static Root                         │
│  • Custom Favicon ("法拍卷宗與產權查證印鑑" SVG + Data URI + Touch Icon)  │
│  • AdSense Script: pagead2.googlesyndication.com (ca-pub-4333106443725240)│
│  • Crawler & Frame Compatibility: robots.txt (Mediapartners-Google)      │
│    + Cloudflare Pages _headers (Allow *.google.com frame-ancestors)      │
└───────────────────┬──────────────────────────────────────┬───────────────┘
                    │                                      │
                    ▼                                      ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────┐
│   Left Case List (#list-container)    │  │ Case Dossier Drawer (#drawer) │
│  • Renders 3,052 calibrated cases     │  │  • Street View + Case Details │
│  • After 3rd case: Partner Grid       │  │  • External Verification Links│
│  • Directly below Partner Grid:       │  │  • Partner Grid + AdSense     │
│    <ins class="adsbygoogle"           │  │    <ins class="adsbygoogle"   │
│     data-ad-slot="3488263290">        │  │     data-ad-slot="3488263290">│
│  • Safe push() after DOM mount        │  │  • Triggered when drawer opens│
└───────────────────────────────────────┘  └───────────────────────────────┘
```

- **Interactive Component & State Mapping**：
  - **左側案件列表廣告版位**：在 `buildNativeInFeedPartnerCard()` 內部下方加入 Google AdSense `<ins class="adsbygoogle" data-ad-client="ca-pub-4333106443725240" data-ad-slot="3488263290" data-ad-format="auto" data-full-width-responsive="true"></ins>`，並在插入 DOM 後透過 `requestAnimationFrame` 安全執行 `(window.adsbygoogle = window.adsbygoogle || []).push({})`。
  - **案件詳情抽屜底部廣告版位**：在詳情抽屜 `Section 3B`（合作夥伴區塊）下方加入相同規格的 Google AdSense 回應式廣告容器，並於 `openCaseDossier()` 抽屜展開顯示後觸發廣告初始化（若尚未初始化）。
  - **AdSense 預覽與爬蟲相容性**：同步更新根目錄與 `/public` 下的 `robots.txt`、`favicon.svg` 與 `_headers`，確保 Cloudflare Pages 部署後 AdSense 預覽器與爬蟲暢通無阻。
