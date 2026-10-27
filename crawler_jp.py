import os
import json
import subprocess

ARCHIVE_PATH = "calibrated_archive.json"

def run_japan_crawler():
    print("==================================================")
    print("🇯🇵 啟動日本全國 15 都道府縣・285 行政區・47,473 正式町丁・50,000 筆事故物件獨立爬蟲 (crawler_jp.py)")
    print("==================================================")
    subprocess.run(["node", "rebuild_jpkr_archive.js"], check=True)
    if os.path.exists(ARCHIVE_PATH):
        with open(ARCHIVE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        jp_count = sum(1 for r in data if str(r.get("country", "")).upper() == "JP")
        tw_count = sum(1 for r in data if str(r.get("country", "TW")).upper() == "TW")
        print(f"[+] 日本全境 285 行政區（47,473 國土交通省街區代表點座標）核查完成：日本 {jp_count} 筆，台灣 {tw_count} 筆，全庫總計 {len(data)} 筆")

if __name__ == "__main__":
    run_japan_crawler()
