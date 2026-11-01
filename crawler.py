#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
臺灣特殊事故建物與產權紀錄查詢平台 — 台灣（TW）與日本（JP）雙國實證爬蟲總調度器 (crawler.py)
==================================================================================================
支援指令：
- 定期增量更新（預設）：`python crawler.py --country ALL --mode incremental`
- 歷年資料回溯：`python crawler.py --country ALL --mode backfill --year-from 2000 --year-to 2026`
- 單獨執行台灣：`python crawler.py --country TW`
- 單獨執行日本：`python crawler.py --country JP`
"""

import sys
import argparse
import subprocess


def main():
    parser = argparse.ArgumentParser(description="Taiwan & Japan Verified Property Incident Orchestrator")
    parser.add_argument("--country", choices=["ALL", "TW", "JP"], default="ALL")
    parser.add_argument("--mode", choices=["incremental", "backfill"], default="incremental")
    parser.add_argument("--year-from", type=int, default=2000)
    parser.add_argument("--year-to", type=int, default=2026)
    args, _ = parser.parse_known_args()

    common_flags = ["--mode", args.mode, "--year-from", str(args.year_from), "--year-to", str(args.year_to)]

    if args.country in ("ALL", "TW"):
        print("🚀 [1/2] 啟動台灣 (Taiwan) 實證案件爬蟲 (crawler_tw.py)...", flush=True)
        subprocess.run([sys.executable, "crawler_tw.py", *common_flags], check=False)

    if args.country in ("ALL", "JP"):
        print("🚀 [2/2] 啟動日本 (Japan) 原生日本語實證案件爬蟲 (crawler_jp.py)...", flush=True)
        subprocess.run([sys.executable, "crawler_jp.py", *common_flags], check=False)


if __name__ == "__main__":
    main()
