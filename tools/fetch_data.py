"""Tải dữ liệu nến ngày (OHLCV) từ endpoint công khai của DNSE -> data/*.json.

Chỉ dùng thư viện chuẩn. Giá DNSE tính theo nghìn đồng.
Chạy: python tools/fetch_data.py [năm_bắt_đầu]
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://services.entrade.com.vn/chart-api/v2/ohlcs"
OUT = Path(__file__).resolve().parent.parent / "data"

# (mã, sàn, loại)  loại: stock | index
SYMBOLS = [
    ("VNINDEX", "INDEX", "index"), ("VN30", "INDEX", "index"),
    ("HNX", "INDEX", "index"), ("UPCOM", "INDEX", "index"),
    # HOSE
    ("VCB", "HOSE", "stock"), ("BID", "HOSE", "stock"), ("CTG", "HOSE", "stock"),
    ("TCB", "HOSE", "stock"), ("MBB", "HOSE", "stock"), ("VPB", "HOSE", "stock"),
    ("HPG", "HOSE", "stock"), ("VIC", "HOSE", "stock"), ("VHM", "HOSE", "stock"),
    ("VNM", "HOSE", "stock"), ("FPT", "HOSE", "stock"), ("MWG", "HOSE", "stock"),
    ("SSI", "HOSE", "stock"), ("VND", "HOSE", "stock"), ("VCI", "HOSE", "stock"),
    ("NVL", "HOSE", "stock"), ("DIG", "HOSE", "stock"), ("GAS", "HOSE", "stock"),
    # HNX
    ("SHS", "HNX", "stock"), ("PVS", "HNX", "stock"), ("CEO", "HNX", "stock"),
    ("IDC", "HNX", "stock"), ("MBS", "HNX", "stock"),
    # UPCOM
    ("BSR", "UPCOM", "stock"), ("ACV", "UPCOM", "stock"), ("QTP", "UPCOM", "stock"),
    ("VGI", "UPCOM", "stock"), ("MCH", "UPCOM", "stock"),
]


def ts(year: int, month: int = 1, day: int = 1) -> int:
    return int(datetime(year, month, day, tzinfo=timezone.utc).timestamp())


def fetch(symbol: str, kind: str, start_year: int):
    url = (f"{BASE}/{kind}?from={ts(start_year)}&to={int(time.time())}"
           f"&symbol={symbol}&resolution=1D")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    return [
        {"d": datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"),
         "o": o, "h": h, "l": l, "c": c, "v": v}
        for t, o, h, l, c, v in zip(d["t"], d["o"], d["h"], d["l"], d["c"], d["v"])
    ]


def main():
    start_year = int(sys.argv[1]) if len(sys.argv) > 1 else 2018
    OUT.mkdir(exist_ok=True)
    index = {}
    for sym, exch, kind in SYMBOLS:
        try:
            rows = fetch(sym, kind, start_year)
        except Exception as e:  # noqa: BLE001
            print(f"{sym:11} {exch:6} FAIL  {e}")
            continue
        if not rows:
            print(f"{sym:11} {exch:6} EMPTY")
            continue
        (OUT / f"{sym}.json").write_text(json.dumps(rows, separators=(",", ":")))
        index[sym] = {"exchange": exch, "type": kind, "from": rows[0]["d"],
                      "to": rows[-1]["d"], "n": len(rows)}
        print(f"{sym:11} {exch:6} OK    {len(rows):5} nến  {rows[0]['d']} -> {rows[-1]['d']}"
              f"  close={rows[-1]['c']}")
        time.sleep(0.4)
    (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    print(f"\nĐã lưu {len(index)}/{len(SYMBOLS)} mã vào {OUT}")


if __name__ == "__main__":
    main()
