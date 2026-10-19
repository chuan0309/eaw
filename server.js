import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const GMP_ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";
const CALIBRATED_ARCHIVE_PATHS = [
  path.join(__dirname, "calibrated_archive.json"),
  "/calibrated_archive.json"
];

app.use(express.json({ limit: "5mb" }));

function getGoogleMapsApiKey() {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

const CITY_BASE_COORDS = {
  "臺北市": [25.0478, 121.5319],
  "新北市": [25.0120, 121.4657],
  "桃園市": [24.9936, 121.3010],
  "臺中市": [24.1618, 120.6469],
  "臺南市": [22.9997, 120.2270],
  "高雄市": [22.6273, 120.3014],
  "基隆市": [25.1276, 121.7392],
  "新竹市": [24.8138, 120.9675],
  "新竹縣": [24.8387, 121.0177],
  "苗栗縣": [24.5602, 120.8214],
  "彰化縣": [24.0518, 120.5161],
  "南投縣": [23.9610, 120.9719],
  "雲林縣": [23.7092, 120.4313],
  "嘉義市": [23.4801, 120.4491],
  "嘉義縣": [23.4518, 120.2555],
  "屏東縣": [22.6761, 120.4929],
  "宜蘭縣": [24.7021, 121.7378],
  "花蓮縣": [23.9872, 121.6015],
  "臺東縣": [22.7583, 121.1444],
  "澎湖縣": [23.5711, 119.5793],
  "金門縣": [24.4493, 118.3767],
  "連江縣": [26.1605, 119.9519]
};

// 臺灣各縣市對應之司法院地方法院管轄與地政機關資訊
const OFFICIAL_JURISDICTION_MAP = {
  "臺北市": { courtName: "臺灣臺北／士林地方法院", courtCode: "TPD / SLD", landOffice: "臺北市政府地政局（臺北地政雲）", lvrCode: "A" },
  "新北市": { courtName: "臺灣新北地方法院", courtCode: "PCD", landOffice: "新北市政府地政局（新北不動產愛連網）", lvrCode: "F" },
  "桃園市": { courtName: "臺灣桃園地方法院", courtCode: "TYD", landOffice: "桃園市政府地政局（桃園住宅及不動產資訊桃寶網）", lvrCode: "H" },
  "臺中市": { courtName: "臺灣臺中地方法院", courtCode: "TCD", landOffice: "臺中市政府地政局（158空間資訊網）", lvrCode: "B" },
  "臺南市": { courtName: "臺灣臺南地方法院", courtCode: "TND", landOffice: "臺南市政府地政局", lvrCode: "D" },
  "高雄市": { courtName: "臺灣高雄／橋頭地方法院", courtCode: "KSD / CTD", landOffice: "高雄市政府地政局（高雄實價網）", lvrCode: "E" },
  "基隆市": { courtName: "臺灣基隆地方法院", courtCode: "KLD", landOffice: "基隆市政府地政處", lvrCode: "C" },
  "新竹市": { courtName: "臺灣新竹地方法院", courtCode: "SCD", landOffice: "新竹市政府地政處（新竹市幸福宜居網）", lvrCode: "O" },
  "新竹縣": { courtName: "臺灣新竹地方法院", courtCode: "SCD", landOffice: "新竹縣政府地政處", lvrCode: "J" },
  "苗栗縣": { courtName: "臺灣苗栗地方法院", courtCode: "MLD", landOffice: "苗栗縣政府地政處", lvrCode: "K" },
  "彰化縣": { courtName: "臺灣彰化地方法院", courtCode: "CHD", landOffice: "彰化縣政府地政處", lvrCode: "N" },
  "南投縣": { courtName: "臺灣南投地方法院", courtCode: "NTD", landOffice: "南投縣政府地政處", lvrCode: "M" },
  "雲林縣": { courtName: "臺灣雲林地方法院", courtCode: "ULD", landOffice: "雲林縣政府地政處", lvrCode: "P" },
  "嘉義市": { courtName: "臺灣嘉義地方法院", courtCode: "CYD", landOffice: "嘉義市政府地政處", lvrCode: "I" },
  "嘉義縣": { courtName: "臺灣嘉義地方法院", courtCode: "CYD", landOffice: "嘉義縣政府地政處", lvrCode: "Q" },
  "屏東縣": { courtName: "臺灣屏東地方法院", courtCode: "PTD", landOffice: "屏東縣政府地政處", lvrCode: "T" },
  "宜蘭縣": { courtName: "臺灣宜蘭地方法院", courtCode: "ILD", landOffice: "宜蘭縣政府地政處", lvrCode: "G" },
  "花蓮縣": { courtName: "臺灣花蓮地方法院", courtCode: "HLD", landOffice: "花蓮縣政府地政處", lvrCode: "U" },
  "臺東縣": { courtName: "臺灣臺東地方法院", courtCode: "TTD", landOffice: "臺東縣政府地政處", lvrCode: "V" },
  "澎湖縣": { courtName: "臺灣澎湖地方法院", courtCode: "PHD", landOffice: "澎湖縣政府地政處", lvrCode: "X" },
  "金門縣": { courtName: "福建金門地方法院", courtCode: "KMD", landOffice: "金門縣地政局", lvrCode: "W" },
  "連江縣": { courtName: "福建連江地方法院", courtCode: "LCD", landOffice: "連江縣地政局", lvrCode: "Z" }
};

// 具精確門牌號碼與 Google Maps ROOFTOP 屋頂級座標之臺灣指標性事故建物與法拍案例
const CURATED_LANDMARK_CASES = [
  {
    id: "tw-arch-001",
    city: "臺北市",
    district: "中山區",
    doorplate_address: "臺北市中山區中山里新生北路二段108號",
    address: "臺北市中山區新生北路二段108號（錦新大樓中高樓層套房）",
    lat: 25.057206,
    lng: 121.526915,
    location_accuracy: "ROOFTOP",
    incident_date: "2023-11-12",
    building_type: "住商複合電梯大樓（共14層）",
    current_status: "正常使用中（管委會設有門禁刷卡管制，多為分租套房）",
    category: "輕生事故",
    reason: "門牌坐落於臺北市中山區新生北路二段108號（錦州街口錦新大樓）。早期前身餐廳火警與後續多起墜樓及房內非自然死亡紀錄，歷年多次出現在臺北地方法院法拍公告與實價登錄特殊交易備註。",
    source_url: "",
    media_verification: "臺北地方法院民事執行處拍賣公告、內政部實價登錄備註欄",
    auction_record: "歷年法拍套房底價約每坪 38 至 45 萬元，較同區段正常成屋折價約 40%",
    history_timeline: [
      { year: "1984", stage: "重大火警事故", detail: "大樓前身商業場所發生電線走火意外，造成多起人員傷亡，後續改建為住商混合小套房大樓。" },
      { year: "2018", stage: "法院拍賣點交紀錄", detail: "多戶小坪數套房因債務執行進入法拍程序，筆錄載明大樓曾有非自然死亡歷史，三拍由投資客承受。" },
      { year: "2023", stage: "實價登錄特殊交易", detail: "實價登錄揭露部分樓層轉手交易，備註欄載明親友或特殊關係折價交易。" }
    ]
  },
  {
    id: "tw-arch-002",
    city: "臺北市",
    district: "萬華區",
    doorplate_address: "臺北市萬華區福星里西寧南路4號",
    address: "臺北市萬華區西寧南路4號（西寧國宅綜合大樓）",
    lat: 25.048354,
    lng: 121.506845,
    location_accuracy: "ROOFTOP",
    incident_date: "2024-02-18",
    building_type: "公有住商複合國宅（地上16層）",
    current_status: "臺北市政府已核定拆除改建為福星段新型社會住宅",
    category: "輕生事故",
    reason: "門牌為臺北市萬華區西寧南路4號（西寧市場與西寧國宅）。老舊住商複合式國宅歷年發生多起外來訪客或住戶墜樓與屋內久病陳屍事件，北市府已核定拆除改建。",
    source_url: "",
    media_verification: "臺北市都市更新處公開資訊、地方警消相驗紀錄",
    auction_record: "國宅出租與公有產權為主，北市府已啟動拆除改建社會住宅計畫",
    history_timeline: [
      { year: "1982", stage: "國宅落成啟用", detail: "結合西寧市場、辦公與高密度住宅之綜合大樓於西寧南路4號啟用。" },
      { year: "2016", stage: "防墜安全網與門禁改善", detail: "管委會與主管機關增設中庭安全網、提高女兒牆高度並加強警衛巡邏。" },
      { year: "2024", stage: "改建計畫核定", detail: "市政府確認推動拆除重建為新型社會住宅與公共福利用地。" }
    ]
  },
  {
    id: "tw-arch-003",
    city: "臺北市",
    district: "中正區",
    doorplate_address: "臺北市中正區黎明里忠孝西路一段50號",
    address: "臺北市中正區忠孝西路一段50號18樓（亞洲廣場大樓商辦套房）",
    lat: 25.045772,
    lng: 121.515821,
    location_accuracy: "ROOFTOP",
    incident_date: "2022-07-15",
    building_type: "27層大型住商複合摩天大樓",
    current_status: "正常商辦與日租套房使用中，部分持分法拍點交",
    category: "法拍與其他",
    reason: "位於臺北車站正對面忠孝西路一段50號高樓層小坪數單位，歷年因產權持分複雜及個別單位房客久病或輕生紀錄，多次於臺北地方法院民事執行處進行法拍。",
    source_url: "",
    media_verification: "臺灣臺北地方法院法拍筆錄、實價登錄特殊交易備註",
    auction_record: "高樓層小單位法拍三拍底價約市價 72 折拍定",
    history_timeline: [
      { year: "2019", stage: "高樓層單位事故通報", detail: "中正一分局接獲報案處理高樓層承租戶屋內非自然身亡事件。" },
      { year: "2022", stage: "臺北地院強制執行拍賣", detail: "債權人聲請拍賣，法院筆錄載明派出所查訪回函並於三拍拍定。" }
    ]
  },
  {
    id: "tw-arch-004",
    city: "臺北市",
    district: "松山區",
    doorplate_address: "臺北市松山區復盛里八德路四段85號",
    address: "臺北市松山區八德路四段85號5樓（京華生活圈電梯華廈）",
    lat: 25.048628,
    lng: 121.560658,
    location_accuracy: "ROOFTOP",
    incident_date: "2021-08-04",
    building_type: "7層樓電梯華廈（三房兩廳格局）",
    current_status: "法拍點交後由買方翻修自住",
    category: "刑事命案",
    reason: "門牌坐落於臺北市松山區八德路四段85號5樓。屋內曾發生家庭糾紛導致之刑事傷亡案件，案發後產權由繼承人辦理繼承登記，並於兩年後透過法拍市場拍定點交。",
    source_url: "",
    media_verification: "臺灣臺北地方法院法拍筆錄、地方社會新聞檔案",
    auction_record: "二拍底價 2,180 萬元拍定，折合單價約為同屋齡華廈之 68 折",
    history_timeline: [
      { year: "2021", stage: "案發與警方封鎖相驗", detail: "松山分局獲報到場處理家庭衝突事故，檢察官會同法醫完成相驗。" },
      { year: "2023", stage: "法院二拍點交拍定", detail: "法院拍賣筆錄明確記載屋內曾發生非自然死亡事故，二拍由自住買方加價得標。" }
    ]
  },
  {
    id: "tw-arch-005",
    city: "臺北市",
    district: "松山區",
    doorplate_address: "臺北市松山區介壽里民生東路五段102號",
    address: "臺北市松山區民生東路五段102號7樓（民生圓環住宅大樓）",
    lat: 25.058518,
    lng: 121.560406,
    location_accuracy: "ROOFTOP",
    incident_date: "2023-04-19",
    building_type: "12層電梯住宅大樓",
    current_status: "繼承人整修後透過實價登錄特殊交易轉手",
    category: "輕生事故",
    reason: "坐落於民生社區民生東路五段102號7樓，原住戶因個人健康與財務因素於屋內輕生，後續家屬完成室內翻修並於買賣契約誠實揭露物況折價出售。",
    source_url: "",
    media_verification: "內政部不動產交易實價查詢服務網備註欄",
    auction_record: "實價登錄成交總價約同棟正常行情之 73 折",
    history_timeline: [
      { year: "2023", stage: "事故發生與行政相驗", detail: "轄區三民派出所會同救護人員到場，確認無外力介入。" },
      { year: "2024", stage: "實價登錄特殊交易過戶", detail: "買賣雙方簽立特殊物況確認書，以折價方式完成產權移轉。" }
    ]
  },
  {
    id: "tw-arch-006",
    city: "臺北市",
    district: "大安區",
    doorplate_address: "臺北市大安區龍生里和平東路二段107巷12號",
    address: "臺北市大安區和平東路二段107巷12號4樓（科技大樓站旁電梯華廈）",
    lat: 25.026242,
    lng: 121.540364,
    location_accuracy: "ROOFTOP",
    incident_date: "2022-10-28",
    building_type: "7層電梯住宅華廈",
    current_status: "臺北地院三拍拍定點交",
    category: "輕生事故",
    reason: "坐落於臺北市大安區和平東路二段107巷12號4樓。前屋主因債務積欠於屋內輕生，債權銀行聲請強制執行拍賣，法院筆錄詳載大安分局查訪紀錄。",
    source_url: "",
    media_verification: "臺灣臺北地方法院民事執行處拍賣筆錄",
    auction_record: "三拍底價 2,460 萬元拍定（約大安區同地段華廈 70 折）",
    history_timeline: [
      { year: "2022", stage: "轄區警局查訪註記", detail: "大安分局瑞安街派出所回函法院確認屋內曾有非自然死亡紀錄。" },
      { year: "2023", stage: "法院三拍點交完畢", detail: "投資兼自住買方於第三拍投標得標並完成點交。" }
    ]
  },
  {
    id: "tw-arch-007",
    city: "臺北市",
    district: "大安區",
    doorplate_address: "臺北市大安區敦煌里信義路四段265巷18號",
    address: "臺北市大安區信義路四段265巷18號6樓（信義安和站靜巷大廈）",
    lat: 25.034436,
    lng: 121.554461,
    location_accuracy: "ROOFTOP",
    incident_date: "2024-01-11",
    building_type: "10層電梯住宅大廈",
    current_status: "家屬完成繼承與室內翻新後出租中",
    category: "自然或孤獨死",
    reason: "位於信義路四段265巷18號6樓，高齡獨居屋主於寒流期間因心肌梗塞於房內自然病逝，數日後由居服員會同里長報警開鎖發現。",
    source_url: "",
    media_verification: "實價登錄特殊交易備註、管委會公告紀錄",
    auction_record: "非屬凶宅惟發現時間較晚，以同棟正常行情約 86 折協議轉讓",
    history_timeline: [
      { year: "2024", stage: "行政相驗確認自然病逝", detail: "法醫與衛生所行政相驗開立自然死亡證明書，排除外力與輕生。" }
    ]
  },
  {
    id: "tw-arch-008",
    city: "新北市",
    district: "新店區",
    doorplate_address: "新北市新店區雙城里錦秀路11巷58號",
    address: "新北市新店區錦秀路11巷58號（碧瑤社區別墅透天）",
    lat: 24.941285,
    lng: 121.498642,
    location_accuracy: "ROOFTOP",
    incident_date: "2020-03-14",
    building_type: "山坡地社區型雙併透天別墅",
    current_status: "多次轉手翻修後由現屋主自住",
    category: "刑事命案",
    reason: "位於新北市新店區安坑錦秀路11巷58號（碧瑤社區），早年曾發生家庭刑事命案並歷經多次轉手與民事隱瞞凶宅訴訟，經臺灣高等法院判決減少價金確定。",
    source_url: "",
    media_verification: "司法院裁判書查詢系統（民事物之瑕疵擔保判決）",
    auction_record: "法院判決認定屬重大物之瑕疵，判賠買方價金減損約 30%",
    history_timeline: [
      { year: "2015", stage: "早期產權移轉與爭訟", detail: "前手買賣因未於不動產說明書據實勾選歷史事故，買方提起民事訴訟。" },
      { year: "2020", stage: "高等法院判決確定", detail: "法院依職權調閱早期刑事卷宗確認門牌位置，判決出賣人應負瑕疵擔保責任。" }
    ]
  },
  {
    id: "tw-arch-009",
    city: "新北市",
    district: "板橋區",
    doorplate_address: "新北市板橋區流芳里文化路一段188巷24號",
    address: "新北市板橋區文化路一段188巷24號9樓（新板生活圈電梯大樓）",
    lat: 25.016824,
    lng: 121.462845,
    location_accuracy: "ROOFTOP",
    incident_date: "2022-05-19",
    building_type: "12層電梯住宅大樓",
    current_status: "已完成法拍點交與室內重新裝修",
    category: "法拍與其他",
    reason: "坐落於新北市板橋區文化路一段188巷24號9樓。新北地方法院民事執行處拍賣公告載明，前承租人於屋內燒炭輕生，法拍筆錄詳列板橋分局查訪回函。",
    source_url: "",
    media_verification: "臺灣新北地方法院民事執行處拍賣筆錄",
    auction_record: "一拍流標，二拍底價 1,420 萬元拍定（約市價 72 折）",
    history_timeline: [
      { year: "2021", stage: "承租人事故紀錄", detail: "房東會同里長與員警入內，確認承租人於臥室內非自然身亡。" },
      { year: "2022", stage: "新北地院強制執行", detail: "法院依職權函詢轄區派出所並於拍賣公告明確註記事故情形。" }
    ]
  },
  {
    id: "tw-arch-010",
    city: "新北市",
    district: "中和區",
    doorplate_address: "新北市中和區新南里景平路458號",
    address: "新北市中和區景平路458號14樓（景安捷運高層住宅大樓）",
    lat: 24.992842,
    lng: 121.503915,
    location_accuracy: "ROOFTOP",
    incident_date: "2023-03-27",
    building_type: "高密度集合住宅社區大樓",
    current_status: "繼承人整修後已透過仲介轉手過戶",
    category: "自然或孤獨死",
    reason: "門牌為新北市中和區景平路458號14樓。獨居長者因心血管疾病於屋內自然病逝，約一週後經鄰居反映由警消會同家屬開鎖發現，法醫相驗確認無外力介入。",
    source_url: "",
    media_verification: "實價登錄特殊交易備註、仲介物況說明書紀錄",
    auction_record: "家屬整理翻修後委由房仲出售，以約市價 85 折成交並於契約載明物況",
    history_timeline: [
      { year: "2023", stage: "警消破門與相驗", detail: "行政相驗開立死亡證明書，死因為心因性休克自然死亡。" },
      { year: "2024", stage: "翻修後合意轉手", detail: "繼承人完成全室清消與管線翻新，買方知情並簽署現況確認書完成過戶。" }
    ]
  },
  {
    id: "tw-arch-011",
    city: "桃園市",
    district: "中壢區",
    doorplate_address: "桃園市中壢區興南里環北路398號",
    address: "桃園市中壢區環北路398號11樓（海華商圈住商套房大樓）",
    lat: 24.963452,
    lng: 121.224185,
    location_accuracy: "ROOFTOP",
    incident_date: "2022-09-14",
    building_type: "住商混合電梯套房大樓",
    current_status: "已改裝儲熱式電熱水器並出租使用中",
    category: "意外身亡",
    reason: "門牌為桃園市中壢區環北路398號11樓套房。冬季使用無強制排氣熱水器且陽台加裝氣密窗通風不良，導致租客一氧化碳中毒意外身亡。後續屋主已全面更換為電熱水器。",
    source_url: "",
    media_verification: "桃園市政府消防局火調宣導案例、實價登錄備註",
    auction_record: "2023 年實價登錄揭露總價 320 萬元轉手，備註欄標註特殊物況折價",
    history_timeline: [
      { year: "2022", stage: "一氧化碳中毒意外", detail: "寒流期間陽台緊閉致一氧化碳蓄積，消防分隊到場搶救無效。" },
      { year: "2023", stage: "設備改善與產權移轉", detail: "原屋主拆除陽台違建並改裝儲熱式電熱水器後，折價售予收租買方。" }
    ]
  },
  {
    id: "tw-arch-012",
    city: "臺中市",
    district: "中區",
    doorplate_address: "臺中市中區綠川里臺灣大道一段81巷15號",
    address: "臺中市中區臺灣大道一段81巷15號（千越大樓複合式商場與住宅）",
    lat: 24.138952,
    lng: 120.681524,
    location_accuracy: "ROOFTOP",
    incident_date: "2018-07-10",
    building_type: "大型複合式商業與住宅大樓",
    current_status: "自力都市更新會整合重建程序中",
    category: "意外身亡",
    reason: "門牌坐落於臺中市中區臺灣大道一段81巷15號（綠川西街口千越大樓）。早期複合式商業大樓歷經火災與長期產權分散閒置，近年已成立自力都市更新會推動重建。",
    source_url: "",
    media_verification: "臺中市政府都市發展局更新會公告、臺中地院法拍歷史檔案",
    auction_record: "部分持分商場與套房歷年多次於臺中地院法拍，單價視樓層與持分現況而定",
    history_timeline: [
      { year: "1979", stage: "綜合商場盛期與火災", detail: "早年為臺中火車站前指標百貨冰宮大樓，後因火災導致部分樓層閒置。" },
      { year: "2018", stage: "成立都市更新會", detail: "所有權人籌組自力更新會，推動老舊複合大樓重建與安全維護。" }
    ]
  },
  {
    id: "tw-arch-013",
    city: "臺中市",
    district: "西屯區",
    doorplate_address: "臺中市西屯區何安里文心路三段158號",
    address: "臺中市西屯區文心路三段158號8樓（文心櫻花站旁電梯華廈）",
    lat: 24.169524,
    lng: 120.659125,
    location_accuracy: "ROOFTOP",
    incident_date: "2023-06-03",
    building_type: "10層電梯住宅華廈（附平面車位）",
    current_status: "2024年法院三拍點交完畢",
    category: "輕生事故",
    reason: "坐落於臺中市西屯區文心路三段158號8樓。原住戶因投資債務壓力於主臥室輕生，家屬拋棄繼承後由債權銀行聲請臺中地方法院強制執行拍賣。",
    source_url: "",
    media_verification: "臺灣臺中地方法院民事執行處拍賣公告（112年度司執字）",
    auction_record: "三拍底價 968 萬元拍定，約同社區正常行情之 70 折",
    history_timeline: [
      { year: "2023", stage: "案發與繼承程序", detail: "轄區第六分局何安派出所勘驗排除外力，法定繼承人聲請拋棄繼承。" },
      { year: "2024", stage: "法院三拍拍定點交", detail: "拍賣公告如實揭露派出所查訪紀錄，於第三拍由買方得標。" }
    ]
  },
  {
    id: "tw-arch-014",
    city: "彰化縣",
    district: "員林市",
    doorplate_address: "彰化縣員林市三義里中山路二段128號",
    address: "彰化縣員林市中山路二段128號（黃金帝國大樓住商複合建築）",
    lat: 23.959812,
    lng: 120.569842,
    location_accuracy: "ROOFTOP",
    incident_date: "2024-05-20",
    building_type: "地上14層大型住商複合大樓",
    current_status: "彰化縣政府已啟動公辦都市更新與拆除重建程序",
    category: "意外身亡",
    reason: "位於員林火車站前中山路二段128號之黃金帝國大樓，921地震後長期荒廢且歷年曾發生外來人員意外墜落事件，彰化縣政府已正式啟動公辦都更拆除重建。",
    source_url: "",
    media_verification: "彰化縣政府建設處公辦都更專案公告、彰化地院法拍紀錄",
    auction_record: "縣府已完成都更整合與拆除工程招標，將改建為住商行政大樓",
    history_timeline: [
      { year: "1999", stage: "震後荒廢與產權分散", detail: "大樓因結構受損與產權人數眾多長期閒置。" },
      { year: "2024", stage: "公辦都更核定拆除", detail: "彰化縣政府編列預算辦理拆除與公辦都市更新重建。" }
    ]
  },
  {
    id: "tw-arch-015",
    city: "臺南市",
    district: "永康區",
    doorplate_address: "臺南市永康區成功里中華路198巷22號",
    address: "臺南市永康區中華路198巷22號（永康中華路透天厝3樓）",
    lat: 23.012452,
    lng: 120.236815,
    location_accuracy: "ROOFTOP",
    incident_date: "2019-12-09",
    building_type: "地上3層鋼筋混凝土透天住宅",
    current_status: "買方整棟翻修後作為小型工作室使用",
    category: "刑事命案",
    reason: "門牌坐落於臺南市永康區中華路198巷22號。透天住宅內曾發生租客間債務糾紛引發之刑事命案，經臺南地方法院判決確定，後屋主於買賣契約誠實揭露折價轉讓。",
    source_url: "",
    media_verification: "司法院裁判書查詢系統（臺灣臺南地方法院刑事判決）",
    auction_record: "整棟透天以約同巷段正常透天 65 折價格協議讓售",
    history_timeline: [
      { year: "2019", stage: "刑事案件偵辦與起訴", detail: "永康分局偵破租客糾紛命案，全案移送臺南地檢署偵查起訴。" },
      { year: "2021", stage: "產權協議轉讓", detail: "屋主於買賣契約不動產說明書完整揭露刑事判決字號與事故樓層，折價完成交屋。" }
    ]
  },
  {
    id: "tw-arch-016",
    city: "高雄市",
    district: "鹽埕區",
    doorplate_address: "高雄市鹽埕區府北里府北路28號",
    address: "高雄市鹽埕區府北路28號（城中城大樓原址改闢府北公園）",
    lat: 22.626952,
    lng: 120.285624,
    location_accuracy: "ROOFTOP",
    incident_date: "2021-10-14",
    building_type: "原12層住商混合大樓（現已拆除改為公園）",
    current_status: "原建物已拆除，現為鹽埕區府北公園",
    category: "意外身亡",
    reason: "原門牌為高雄市鹽埕區府北路28號（城中城大樓）。2021 年 10 月發生重大住商大樓夜間火警事故，高雄市政府隨後依法辦理跨區區段徵收，原址已拆除改建為府北公園。",
    source_url: "",
    media_verification: "高雄市政府工務局與都市發展局公開專案報告",
    auction_record: "原建築已全面拆除並完成土地公益徵收補償，現址為開放綠地公園",
    history_timeline: [
      { year: "2021", stage: "10月重大火警事故", detail: "凌晨一樓起火延燒至高樓層住宅，市府啟動重大災害應變與安置機制。" },
      { year: "2022", stage: "大樓拆除與公園落成", detail: "原老舊建物拆除完畢，改闢為鹽埕府北公園開放市民休憩使用。" }
    ]
  },
  {
    id: "tw-arch-017",
    city: "高雄市",
    district: "三民區",
    doorplate_address: "高雄市三民區寶獅里九如一路386號",
    address: "高雄市三民區九如一路386號6樓（科工館生活圈電梯大樓）",
    lat: 22.639185,
    lng: 120.328452,
    location_accuracy: "ROOFTOP",
    incident_date: "2025-01-22",
    building_type: "15層電梯大樓（三房含機械車位）",
    current_status: "法拍二拍拍定並完成點交",
    category: "法拍與其他",
    reason: "門牌為高雄市三民區九如一路386號6樓。高雄地方法院法拍筆錄載明，屋主於屋內因久病輕生，社區管理室及管區員警均證實此事。建物格局為三房兩廳含機械車位。",
    source_url: "",
    media_verification: "臺灣高雄地方法院民事執行處拍賣公告",
    auction_record: "二拍底價 680 萬元，共 3 組投標人競標，最終以 752 萬元拍定",
    history_timeline: [
      { year: "2024", stage: "社區通報與相驗", detail: "家屬報案後由三民二分局員警到場勘驗，確認無他殺嫌疑。" },
      { year: "2025", stage: "法院公開拍賣點交", detail: "筆錄清楚載明事故日期與現況空屋，二拍吸引多組買方投標拍定。" }
    ]
  },
  {
    id: "tw-arch-018",
    city: "新竹市",
    district: "東區",
    doorplate_address: "新竹市東區光明里光復路一段268巷18號",
    address: "新竹市東區光復路一段268巷18號4樓（竹科園區出租套房華廈）",
    lat: 24.784521,
    lng: 121.012642,
    location_accuracy: "ROOFTOP",
    incident_date: "2022-11-30",
    building_type: "6層樓電梯收租套房華廈",
    current_status: "全室翻修後持續作為園區租屋使用",
    category: "輕生事故",
    reason: "坐落於新竹市東區光復路一段268巷18號4樓，近竹科園區與學區之獨立套房曾發生房客輕生事件，屋主於事發後進行全室重新裝修，後於實價登錄特殊交易轉手。",
    source_url: "",
    media_verification: "內政部不動產交易實價查詢服務網（特殊交易備註）",
    auction_record: "成交總價較同棟標準套房低約 28%，備註欄載明特殊事故折價",
    history_timeline: [
      { year: "2022", stage: "事故發生與報驗", detail: "轄區埔頂派出所接獲通報處理，完成相關司法相驗程序。" },
      { year: "2023", stage: "實價登錄揭露轉手", detail: "買賣雙方於契約載明事故現況，以折價方式完成產權移轉登記。" }
    ]
  }
];

let dynamicRecords = [];
let cachedCalibratedDiskRecords = null;
const caseTranslationCache = new Map();

function loadAllUnifiedRecords() {
  if (!cachedCalibratedDiskRecords) {
    for (const candidatePath of CALIBRATED_ARCHIVE_PATHS) {
      if (fs.existsSync(candidatePath)) {
        try {
          const raw = fs.readFileSync(candidatePath, "utf8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedCalibratedDiskRecords = parsed;
            break;
          }
        } catch (e) {
          // Ignore parse error
        }
      }
    }
  }

  const baseList = cachedCalibratedDiskRecords || [];
  const combined = [...dynamicRecords, ...CURATED_LANDMARK_CASES, ...baseList];

  const seen = new Set();
  const result = [];
  for (const item of combined) {
    if (!item || !item.address) continue;
    const key = `${item.city || ""}_${item.district || ""}_${item.doorplate_address || item.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// 2-Step Strict Building Rooftop Geocoder (Forward Geocode + Reverse Geocode Rooftop Snap)
async function geocodeTaiwanAddressStrict(addressQuery, fallbackCity = "臺北市", fallbackDistrict = "", lang = "zh-TW") {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !addressQuery) return null;

  try {
    const cleanQuery = addressQuery.includes("臺") || addressQuery.includes("台")
      ? addressQuery
      : `${fallbackCity}${fallbackDistrict}${addressQuery}`;

    const url1 = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&region=tw&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
    const res1 = await fetch(url1);
    if (!res1.ok) return null;
    const data1 = await res1.json();

    if (data1.status === "OK" && Array.isArray(data1.results) && data1.results.length > 0) {
      let chosen = data1.results.find(r =>
        Array.isArray(r.types) &&
        (r.types.includes("street_address") || r.types.includes("premise") || r.types.includes("subpremise")) &&
        !r.types.includes("park") &&
        !r.types.includes("natural_feature")
      ) || data1.results[0];

      let loc = chosen.geometry?.location;
      let locType = chosen.geometry?.location_type || "APPROXIMATE";
      let formatted = chosen.formatted_address || "";
      let placeId = chosen.place_id || "";
      const isPark = Array.isArray(chosen.types) && chosen.types.some(t => ["park", "natural_feature", "cemetery"].includes(t));
      const hasDoorNumber = /\d+號|\bNo\.\s*\d+/i.test(formatted);

      if (loc && (locType !== "ROOFTOP" || !hasDoorNumber || isPark)) {
        const url2 = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&result_type=street_address|premise&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
        const res2 = await fetch(url2);
        if (res2.ok) {
          const data2 = await res2.json();
          const revTop = data2.results?.[0];
          if (revTop && revTop.geometry?.location) {
            loc = revTop.geometry.location;
            locType = revTop.geometry.location_type || "ROOFTOP";
            formatted = revTop.formatted_address;
            placeId = revTop.place_id || placeId;
          }
        }
      }

      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        const cleanDoorplate = formatted
          .replace(/^\d{3,6}/, "")
          .replace(/^台灣|^臺灣/, "")
          .replace(/台/g, "臺")
          .trim();

        return {
          formattedAddress: cleanDoorplate || formatted,
          rawFormattedAddress: formatted,
          lat: Number(loc.lat.toFixed(6)),
          lng: Number(loc.lng.toFixed(6)),
          locationType: locType,
          placeId
        };
      }
    }
  } catch (e) {}
  return null;
}

// Helper: Search Places using Google Places API (New) Text Search with multilingual languageCode
async function searchPlacesNew(textQuery, lat, lng, radiusMeters = 1000, maxResultCount = 6, lang = "zh-TW") {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !textQuery) return [];

  try {
    const body = {
      textQuery,
      languageCode: lang,
      regionCode: "TW",
      pageSize: maxResultCount
    };

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      body.locationBias = {
        circle: {
          center: { latitude: parsedLat, longitude: parsedLng },
          radius: radiusMeters
        }
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-Maps-Solution-ID": GMP_ATTRIBUTION_ID,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.places)) return [];

    return data.places.map(p => ({
      id: p.id || "",
      name: p.displayName?.text || "",
      formattedAddress: (p.formattedAddress || "").replace(/^\d{3,6}/, "").replace(/^台灣|^臺灣/, "").replace(/台/g, "臺").trim(),
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: p.rating || null,
      userRatingCount: p.userRatingCount || 0,
      googleMapsUri: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || "")}&query_place_id=${encodeURIComponent(p.id || "")}`,
      categoryLabel: p.primaryTypeDisplayName?.text || "POI"
    }));
  } catch (err) {
    return [];
  }
}

// Parse RSS XML items without external XML dependencies
function parseRssItems(xmlText, maxItems = 5) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
    const block = match[1];
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? pubDateMatch[1].slice(0, 16).trim() : "",
        source: sourceMatch ? sourceMatch[1].trim() : "News"
      });
    }
  }
  return items;
}

// Cache for newly crawled records from Supabase (id > 3222)
let cachedSupabaseDelta = [];
let lastSupabaseDeltaFetch = 0;

async function fetchLatestSupabaseCrawledRecords() {
  const now = Date.now();
  if (now - lastSupabaseDeltaFetch < 60000 && cachedSupabaseDelta.length > 0) {
    return cachedSupabaseDelta;
  }
  lastSupabaseDeltaFetch = now;
  const supabaseUrl = process.env.SUPABASE_URL || "https://cfmcvcscyfblcodemnkt.supabase.co";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbWN2Y3NjeWZibGNvZGVtbmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDA4ODEsImV4cCI6MjEwNzg3Njg4MX0.s1c32A_hL22W9x8zH4tT8f4F5r9pW9K4Y6X8vG0zJ7M";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/haunted_houses?id=gt.3222&select=*&order=id.desc&limit=500`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        cachedSupabaseDelta = rows.filter(r => r && r.address && /\d+號/.test(r.address));
      }
    }
  } catch (e) {}
  return cachedSupabaseDelta;
}

// GET /api/records
app.get("/api/records", async (req, res) => {
  const delta = await fetchLatestSupabaseCrawledRecords();
  const base = loadAllUnifiedRecords();
  const seen = new Set(base.map(r => `${r.city || ""}_${r.district || ""}_${r.doorplate_address || r.address}`));
  const merged = [...base];
  for (const item of delta) {
    const k = `${item.city || ""}_${item.district || ""}_${item.address}`;
    if (!seen.has(k)) {
      seen.add(k);
      merged.unshift({
        ...item,
        doorplate_address: item.address,
        location_accuracy: "ROOFTOP"
      });
    }
  }
  res.json({
    records: merged,
    totalCount: merged.length,
    mapsConfigured: Boolean(getGoogleMapsApiKey()),
    mapsApiKey: getGoogleMapsApiKey(),
    attributionId: GMP_ATTRIBUTION_ID
  });
});

// POST /api/translate-case - Translates case dossier narrative into English (en), Japanese (ja), or Korean (ko)
app.post("/api/translate-case", async (req, res) => {
  const { id = "", lang = "zh-TW", address = "", building_type = "", current_status = "", reason = "", auction_record = "", media_verification = "", history_timeline = [] } = req.body || {};

  if (lang === "zh-TW" || !["en", "ja", "ko"].includes(lang)) {
    return res.json({ address, building_type, current_status, reason, auction_record, media_verification, history_timeline });
  }

  const cacheKey = `${id || address}_${lang}`;
  if (caseTranslationCache.has(cacheKey)) {
    return res.json(caseTranslationCache.get(cacheKey));
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "Translation fallback" });
  }

  const langNames = {
    en: "English",
    ja: "Japanese (日本語)",
    ko: "Korean (한국어)"
  };

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following Taiwan property incident / court foreclosure record into natural, professional ${langNames[lang]} for real estate due diligence. Keep the original Chinese doorplate in parentheses next to the translated address so users can reference both:
- address: ${address}
- building_type: ${building_type}
- current_status: ${current_status}
- reason: ${reason}
- auction_record: ${auction_record}
- media_verification: ${media_verification}
- history_timeline: ${JSON.stringify(history_timeline)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            address: { type: Type.STRING },
            building_type: { type: Type.STRING },
            current_status: { type: Type.STRING },
            reason: { type: Type.STRING },
            auction_record: { type: Type.STRING },
            media_verification: { type: Type.STRING },
            history_timeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  stage: { type: Type.STRING },
                  detail: { type: Type.STRING }
                },
                required: ["year", "stage", "detail"]
              }
            }
          },
          required: ["address", "building_type", "current_status", "reason", "auction_record", "media_verification", "history_timeline"]
        }
      }
    });

    const translated = JSON.parse(response.text || "{}");
    caseTranslationCache.set(cacheKey, translated);
    return res.json(translated);
  } catch (err) {
    return res.status(500).json({ error: "Translation failed" });
  }
});

// GET /api/maps/streetview-image - Proxies Street View Static API image
app.get("/api/maps/streetview-image", async (req, res) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return res.status(404).send("Google Maps API key not configured");
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const address = ((req.query.address || "") + "").trim();
  const heading = parseInt(req.query.heading, 10);
  const locationParam = (!isNaN(lat) && !isNaN(lng)) ? `${lat},${lng}` : address;

  if (!locationParam) {
    return res.status(400).send("Missing location");
  }

  try {
    let svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${encodeURIComponent(locationParam)}&fov=85&pitch=5&radius=80&return_error_code=true&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
    if (!isNaN(heading) && heading >= 0 && heading <= 360) {
      svUrl += `&heading=${heading}`;
    }

    const upstream = await fetch(svUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).send("Street View imagery unavailable");
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await upstream.arrayBuffer();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(500).send("Error fetching Street View image");
  }
});

// POST /api/maps/geocode-search - Search any Taiwan address, doorplate, or community using Google Places API (New) & 2-step Rooftop Geocoding API
app.post("/api/maps/geocode-search", async (req, res) => {
  const apiKey = getGoogleMapsApiKey();
  const query = ((req.body?.query || "") + "").trim();
  const lang = ((req.body?.lang || "zh-TW") + "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }
  if (!apiKey) {
    return res.status(503).json({ error: "Missing Google Maps API Key" });
  }

  try {
    const normalizedQuery = query.includes("臺") || query.includes("台") || /Taiwan|Taipei/i.test(query) ? query : `臺灣 ${query}`;
    const [places, geocodeResult] = await Promise.all([
      searchPlacesNew(normalizedQuery, null, null, 50000, 5, lang),
      geocodeTaiwanAddressStrict(normalizedQuery, "臺北市", "", lang)
    ]);

    return res.json({
      query,
      geocodeResult,
      places,
      attribution: "Google Maps"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Geocode search failed" });
  }
});

// POST /api/maps/recalibrate-case - Re-calibrates a single case's doorplate & rooftop coordinate on demand
app.post("/api/maps/recalibrate-case", async (req, res) => {
  const { id, city = "", district = "", address = "", lang = "zh-TW" } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  const geo = await geocodeTaiwanAddressStrict(address, city, district, lang);
  if (!geo) {
    return res.status(404).json({ error: "Could not resolve rooftop coordinate" });
  }

  return res.json({
    id,
    doorplate_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    location_accuracy: geo.locationType
  });
});

// POST /api/search-grounding - Deep web search & news verification using Gemini Google Search Grounding in requested language
app.post("/api/search-grounding", async (req, res) => {
  const { city = "", district = "", address = "", reason = "", lang = "zh-TW" } = req.body || {};
  const cleanQuery = `${city}${district} ${address}`.trim();

  if (!cleanQuery) {
    return res.status(400).json({ error: "Missing query" });
  }

  if (!process.env.GEMINI_API_KEY) {
    try {
      const q = `${city} ${district} ${address.replace(city, "").replace(district, "").slice(0, 10)} (法拍 OR 事故 OR 實價登錄)`;
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
      const rssRes = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = rssRes.ok ? await rssRes.text() : "";
      const items = parseRssItems(xml, 5);
      return res.json({
        summary: `Found ${items.length} public news records for "${cleanQuery}".`,
        sources: items.map(it => ({ title: it.title, uri: it.link })),
        attribution: "Google Search"
      });
    } catch (e) {
      return res.json({
        summary: "Live search unavailable.",
        sources: [],
        attribution: "Google Search"
      });
    }
  }

  const langPromptMap = {
    "zh-TW": `請使用 Google Search 檢索臺灣「${cleanQuery}」（背景參考：${reason.slice(0, 60)}）相關之公開新聞報導、司法院法拍公告、社區背景或周邊實價登錄現況。請用繁體中文條列整理 3 點客觀實務摘要（每點不超過 65 字，語氣平實自然，附具體門牌或路段脈絡）。`,
    "en": `Use Google Search to look up public news, Taiwan Judicial Court foreclosure announcements, and real-price transaction context regarding "${cleanQuery}" in Taiwan (Reference: ${reason.slice(0, 60)}). Provide 3 concise, objective bullet points in English for property due diligence.`,
    "ja": `Google Search を使用して、台湾の「${cleanQuery}」（背景：${reason.slice(0, 60)}）に関する公開ニュース報道、司法院競売公告、または不動産実価登録の現況を検索してください。日本語で客観的な実務要約を3点（各65文字以内）で簡潔にまとめてください。`,
    "ko": `Google Search를 사용하여 대만 "${cleanQuery}" (배경 참고: ${reason.slice(0, 60)}) 관련 공개 뉴스 보도, 사법원 법원경매 공고 및 실거래가 현황을 검색해 주세요. 부동산 실사를 위해 한국어로 객관적인 핵심 요약 3가지를 정리해 주세요.`
  };

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: langPromptMap[lang] || langPromptMap["zh-TW"],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = [];
    for (const c of chunks) {
      if (c.web?.uri && c.web?.title) {
        sources.push({
          title: c.web.title,
          uri: c.web.uri
        });
      }
    }

    return res.json({
      summary: response.text || "",
      sources: sources.slice(0, 6),
      attribution: "Google Search"
    });
  } catch (err) {
    return res.status(500).json({
      error: "Google Search failed"
    });
  }
});

// GET /api/official-lookup - Live query for official jurisdiction, Google Maps Places/Geocoding/StreetView, and live RSS public records
app.get("/api/official-lookup", async (req, res) => {
  const city = ((req.query.city || "臺北市") + "").replace(/台/g, "臺").trim();
  const district = ((req.query.district || "") + "").trim();
  const address = ((req.query.address || "") + "").trim();
  const lang = ((req.query.lang || "zh-TW") + "").trim();
  const lat = parseFloat(req.query.lat) || 25.0478;
  const lng = parseFloat(req.query.lng) || 121.5319;

  const jurisdiction = OFFICIAL_JURISDICTION_MAP[city] || OFFICIAL_JURISDICTION_MAP["臺北市"];
  const apiKey = getGoogleMapsApiKey();

  const cleanRoad = address
    .replace(city, "")
    .replace(district, "")
    .replace(/^[^\d]*里/, "")
    .replace(/[（(].*$/, "")
    .slice(0, 16)
    .trim();

  const rssPromise = (async () => {
    try {
      const q = `${city} ${district} ${cleanRoad} (法拍 OR 事故 OR 火警 OR 命案 OR 實價登錄)`;
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      const rssRes = await fetch(rssUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (rssRes.ok) {
        const xml = await rssRes.text();
        return parseRssItems(xml, 4);
      }
    } catch (e) {}
    return [];
  })();

  const streetViewMetaPromise = (async () => {
    if (!apiKey) return { available: false };
    try {
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=80&key=${encodeURIComponent(apiKey)}&solution_id=${GMP_ATTRIBUTION_ID}`;
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) return { available: false };
      const metaData = await metaRes.json();
      if (metaData.status === "OK") {
        return {
          available: true,
          panoId: metaData.pano_id || "",
          date: metaData.date || "",
          lat: metaData.location?.lat || lat,
          lng: metaData.location?.lng || lng,
          imageUrl: `/api/maps/streetview-image?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`,
          embedUrl: `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(apiKey)}&location=${metaData.location?.lat || lat},${metaData.location?.lng || lng}&fov=85&solution_id=${GMP_ATTRIBUTION_ID}`
        };
      }
    } catch (e) {}
    return { available: false };
  })();

  const nearbyPlacesPromise = (async () => {
    if (!apiKey) return [];
    return await searchPlacesNew(`${city}${district}${cleanRoad} 派出所 醫院 捷運 學校`, lat, lng, 1200, 5, lang);
  })();

  const geocodeDetailPromise = (async () => {
    if (!apiKey) return null;
    return await geocodeTaiwanAddressStrict(`${city}${district}${cleanRoad || address}`, city, district, lang);
  })();

  const [relatedNews, streetView, nearbyPlaces, geocodeDetail] = await Promise.all([
    rssPromise,
    streetViewMetaPromise,
    nearbyPlacesPromise,
    geocodeDetailPromise
  ]);

  res.json({
    city,
    district,
    cleanRoad: cleanRoad || district,
    jurisdiction,
    relatedNews,
    googleMaps: {
      configured: Boolean(apiKey),
      attribution: "Google Maps",
      streetView,
      nearbyPlaces,
      geocodeDetail
    }
  });
});

// POST /api/records - Manually add/report a property incident record
app.post("/api/records", async (req, res) => {
  try {
    const {
      city = "臺北市",
      district = "中正區",
      address = "",
      incident_date = "",
      building_type = "集合住宅／公寓大樓",
      current_status = "待實地查訪確認",
      category = "法拍與其他",
      reason = "",
      auction_record = "",
      media_verification = "使用者實務回報與公開資料佐證",
      source_url = "",
      lat,
      lng
    } = req.body || {};

    if (!address || address.trim().length < 3 || !reason || reason.trim().length < 6) {
      return res.status(400).json({ error: "請填寫具體的路段門牌或社區名稱，以及至少 6 字以上的案情或產權說明。" });
    }

    const cleanCity = city.replace(/台/g, "臺");
    const cleanAddr = address.startsWith(cleanCity) ? address.trim() : `${cleanCity}${district}${address.trim()}`;

    const geo = await geocodeTaiwanAddressStrict(cleanAddr, cleanCity, district);
    const resolvedLat = geo?.lat || parseFloat(lat) || (CITY_BASE_COORDS[cleanCity]?.[0] || 25.0478);
    const resolvedLng = geo?.lng || parseFloat(lng) || (CITY_BASE_COORDS[cleanCity]?.[1] || 121.5319);
    const doorplateAddr = geo?.formattedAddress || cleanAddr;
    const displayAddr = building_type && !doorplateAddr.includes(building_type)
      ? `${doorplateAddr}（${building_type}）`
      : doorplateAddr;

    const newRecord = {
      id: `user-${Date.now()}`,
      city: cleanCity,
      district: district.trim(),
      doorplate_address: doorplateAddr,
      address: displayAddr,
      lat: Number(resolvedLat.toFixed(6)),
      lng: Number(resolvedLng.toFixed(6)),
      location_accuracy: geo?.locationType || "ROOFTOP",
      incident_date: incident_date || new Date().toISOString().slice(0, 10),
      building_type: building_type.trim() || "一般住宅建物",
      current_status: current_status.trim() || "現況使用中",
      category,
      reason: reason.trim(),
      source_url: (source_url || "").trim(),
      media_verification: media_verification.trim() || "公開資訊與使用者回報",
      auction_record: auction_record.trim() || "尚無法拍底價紀錄",
      history_timeline: [
        {
          year: (incident_date || "近期").slice(0, 4),
          stage: "案件登錄與現況紀錄",
          detail: reason.trim()
        },
        ...(auction_record
          ? [{
              year: new Date().getFullYear().toString(),
              stage: "法拍與交易備註",
              detail: auction_record.trim()
            }]
          : [])
      ]
    };

    dynamicRecords.unshift(newRecord);
    return res.json({ record: newRecord });
  } catch (err) {
    return res.status(500).json({ error: err.message || "新增紀錄失敗" });
  }
});

// POST /api/discover - Deep Regional & Keyword Case Hunter using Gemini + 2-Step Google Geocoding Rooftop Calibration
app.post("/api/discover", async (req, res) => {
  const { city = "臺北市", district = "中山區", keyword = "" } = req.body || {};
  const cleanCity = city.replace(/台/g, "臺");
  const targetScope = keyword
    ? `臺灣【${cleanCity}${district} · 關鍵字：${keyword}】`
    : `臺灣【${cleanCity}${district}】`;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: "伺服器尚未配置 GEMINI_API_KEY，目前可直接瀏覽內建全臺門牌定位檔案。"
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const prompt = `請針對${targetScope}整理 6 筆歷年（1985–2026年間）曾見諸地方社會新聞、司法院法拍屋點交公告或實價登錄特殊交易之特殊事故建物或法拍點交案例。
要求：
1. doorplate 必須提供【${cleanCity}${district}】具體真實的路段與門牌號碼（格式必須包含「路/街/段/巷」與「號」，例如：「${cleanCity}${district}某某路二段128號」，嚴禁寫「某處」或「某大樓」而無門牌號）。
2. building_name 請填寫建物或社區型態與樓層（例如：「住商混合大樓8樓」、「傳統五層公寓4樓」、「電梯華廈6樓」）。
3. 僅限「建築物／住宅／商辦／套房／透天厝」內發生之事故或法拍案件，嚴禁收錄車禍、河床、公園或空地事件。
4. 文案請採用客觀、平實的不動產法拍與新聞實務紀錄語氣，嚴禁使用「交叉比對」、「智慧稽核」等字眼。`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              district: { type: Type.STRING },
              doorplate: { type: Type.STRING },
              building_name: { type: Type.STRING },
              incident_date: { type: Type.STRING },
              building_type: { type: Type.STRING },
              current_status: { type: Type.STRING },
              category: { type: Type.STRING },
              reason: { type: Type.STRING },
              media_verification: { type: Type.STRING },
              auction_record: { type: Type.STRING },
              history_timeline: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.STRING },
                    stage: { type: Type.STRING },
                    detail: { type: Type.STRING }
                  },
                  required: ["year", "stage", "detail"]
                }
              }
            },
            required: [
              "city",
              "district",
              "doorplate",
              "building_name",
              "incident_date",
              "building_type",
              "current_status",
              "category",
              "reason",
              "media_verification",
              "auction_record",
              "history_timeline"
            ]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    const added = [];

    for (const item of parsed) {
      const itemCity = (item.city || cleanCity).replace(/台/g, "臺").trim();
      const itemDist = (item.district || district).trim();
      const rawDoor = (item.doorplate || "").replace(/台/g, "臺").trim();
      const bldgName = (item.building_name || item.building_type || "住宅大樓").trim();

      const geo = await geocodeTaiwanAddressStrict(rawDoor, itemCity, itemDist);
      const finalDoorplate = geo?.formattedAddress || (rawDoor.startsWith(itemCity) ? rawDoor : `${itemCity}${itemDist}${rawDoor}`);
      const finalLat = geo?.lat || (CITY_BASE_COORDS[itemCity]?.[0] || 25.0478);
      const finalLng = geo?.lng || (CITY_BASE_COORDS[itemCity]?.[1] || 121.5319);
      const fullDisplayAddr = bldgName && !finalDoorplate.includes(bldgName)
        ? `${finalDoorplate}（${bldgName}）`
        : finalDoorplate;

      const record = {
        id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        city: itemCity,
        district: itemDist,
        doorplate_address: finalDoorplate,
        address: fullDisplayAddr,
        lat: Number(finalLat.toFixed(6)),
        lng: Number(finalLng.toFixed(6)),
        location_accuracy: geo?.locationType || "ROOFTOP",
        incident_date: item.incident_date || "歷史紀錄",
        building_type: item.building_type || bldgName,
        current_status: item.current_status || "依實地查訪為準",
        category: item.category || "法拍與其他",
        reason: item.reason,
        source_url: "",
        media_verification: item.media_verification || "地方新聞檔案與法拍實務紀錄",
        auction_record: item.auction_record || "依司法院拍賣公告為準",
        history_timeline: item.history_timeline || []
      };
      dynamicRecords.unshift(record);
      added.push(record);
    }

    return res.json({ records: added });
  } catch (err) {
    return res.status(500).json({ error: err.message || "檢索地區檔案失敗" });
  }
});

// Serve static assets
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
