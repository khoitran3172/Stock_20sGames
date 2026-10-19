# KẾ HOẠCH V2 — "Sàn Đỏ Sàn Xanh" (20sGames)

> Tài liệu lập kế hoạch, chưa có code. Ngày lập: 2026-10-19. Mọi kết quả thử API ghi bên dưới là kết quả chạy thật lúc ~15:30 ICT ngày 2026-10-19 (sau phiên). Chỗ nào chưa kiểm chứng được ghi rõ **[CHƯA XÁC MINH]**.

---

## 1. Tầm nhìn

Một game quản lý pixel art trên web, chạy theo **lịch thị trường chứng khoán Việt Nam thật**: mỗi ngày giao dịch thật là một ngày trong game, giá, khối lượng, khối ngoại là số liệu thật của hôm đó. Người chơi chọn 1 trong 3 vai (Công ty chứng khoán, Quỹ đầu tư, Nhà đầu tư cá nhân), điều hành văn phòng pixel nhìn từ trên xuống, trong đó nhân viên ngồi gõ phím, chạy hành lang khi thị trường sập, "IT sập app" lúc thanh khoản kỷ lục. Luật chơi bám sát thực tế (biên độ, bước giá, margin, call, giải chấp, kẹt sàn, T+), giọng văn lấy meme cộng đồng CK Việt ("đu đỉnh", "múc", "về bờ", "sàn đỏ lửa"). Có hai nhịp chơi: **quản lý chậm** (lên kế hoạch trước phiên, xem báo cáo cuối ngày) và **phản xạ trong phiên** (phát lại phiên hôm nay bằng nến phút thật, rút gọn còn 45 giây đến 3 phút). Đây là game giải trí, không phải công cụ tư vấn đầu tư.

---

## 2. V1 hiện có và phần tái sử dụng

| Thành phần V1 (`web/app.js`, 534 dòng) | Dùng lại ở V2 thế nào |
|---|---|
| Luật sàn: `LIMIT` HOSE/HNX/UPCOM ±7/10/15%, `tickSize`, `snap`, tính trần/sàn | Chuyển sang `core/rules.ts`, dùng nguyên |
| `genPath` (cầu Brown chạm đúng O/H/L/C) + `genVolume` | **Chỉ làm dự phòng** khi không có nến 1 phút thật (mã thiếu dữ liệu, ngày cũ) |
| Đồng hồ phiên 255 bước, ATO/nghỉ trưa/ATC | Giữ, nhưng ánh xạ vào nến 1 phút thật (DNSE trả 226 nến 09:15→14:45, không có nghỉ trưa) |
| Khách NPC (F0, Lướt sóng, Giá trị, Cá mập, Zalo), tâm trạng, cớ thoái thác, câu trấn an | Lõi của vai CTCK; tái dùng làm "nhà đầu tư góp vốn" của Quỹ và "người thân/hội nhóm" của Cá nhân |
| Margin: cảnh báo 62%, xử lý 70%, chờ 25 phút, tự động xử lý, nợ xấu, mang qua đêm | `core/margin.ts`, dùng cho cả 3 vai (Cá nhân là người **bị** call) |
| Bảng điện (bảng giá màu trần/sàn/TC), biểu đồ nến canvas | Chuyển sang panel HTML/CSS pixel; bảng điện hiện trên "màn hình" khi bấm vào bàn làm việc |
| `tools/fetch_data.py` (DNSE nến ngày, stdlib) | Mở rộng thành `tools/fetch_daily.py` chạy trong GitHub Actions |
| `data/*.json` 32 mã 2018→2026-10-16 | Giữ làm lịch sử (vẽ nến ngày, tính chỉ báo, khởi tạo save mới) |

---

## 3. Dữ liệu thị trường thật "theo mỗi ngày"

### 3.1 Các cách diễn giải yêu cầu

| # | Cách hiểu | Ưu | Nhược |
|---|---|---|---|
| A | **Lượt theo ngày (EOD)**: mỗi ngày giao dịch thật = 1 lượt. Người chơi đặt kế hoạch trước 9:00, kết quả tính theo nến ngày thật sau 15:00 | Rất đơn giản, web tĩnh, không gian lận (quyết định trước khi có dữ liệu) | Chậm (1 lượt/ngày), mất lối chơi phản xạ, phải chờ |
| B | **Realtime trong giờ** 9:00–14:45, giá cập nhật vài giây/lần | Hồi hộp nhất, "chơi cùng thị trường" | Chỉ chơi được giờ hành chính; cần proxy; rủi ro điều khoản/giấy phép dữ liệu cao nhất; ngoài giờ không có gì để chơi |
| C | **Phát lại phiên hôm nay** bằng nến 1 phút thật, mở sau 15:00 | Đường giá thật (không nội suy), chơi lúc nào cũng được, giữ phản xạ, web tĩnh | Người chơi có thể đã biết kết quả ngoài đời (chấp nhận được với game single-player) |
| D | Snapshot cuối ngày + nội suy (như V1) | Đã có code | Đường giá trong phiên là giả, mất ý nghĩa "thật" |

### 3.2 Khuyến nghị: **Lai A + C ("Ngày thật, phiên phát lại")**

- **Đồng hồ thế giới** = lịch giao dịch thật. Ngày game D chỉ mở khi dữ liệu ngày D đã về (~15:30 ICT).
- **Pha sáng (chậm)**: dùng dữ liệu đến D-1 để đặt chính sách (tỷ lệ margin, hạn mức, nhân sự, danh mục mục tiêu). Có thể khóa kế hoạch trước 9:00 để nhận thưởng "dự báo" (tùy chọn, không bắt buộc).
- **Pha phiên (nhanh)**: phát lại phiên D bằng nến 1 phút thật, tốc độ chọn được (45s/90s/3 phút). Bật "Tự động xử lý" thì bỏ qua pha này, engine tự chạy.
- **Pha tối**: quyết toán theo giá đóng cửa thật, báo cáo, sự kiện.
- **Bù ngày vắng mặt**: nếu người chơi nghỉ 5 ngày, khi quay lại có 5 ngày tồn; mỗi ngày được chơi lại phiên hoặc "tự xử lý hàng loạt" theo chính sách đang đặt.
- **Chế độ Live (realtime) để sau** (mốc M5), chỉ khi đã có proxy có cache và chấp nhận rủi ro điều khoản.

### 3.3 Kết quả thử endpoint thật (2026-10-19, ~15:30 ICT)

Thử bằng `curl` với header `Origin: https://khoitran3172.github.io` để xem CORS.

| Nguồn | URL mẫu | HTTP | Dữ liệu | CORS cho github.io | Ghi chú |
|---|---|---|---|---|---|
| DNSE chart-api nến ngày | `services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=..&to=..&symbol=HPG&resolution=1D` | 200 | OHLCV ngày, đã có ngày 19/10 | **Không** (không trả `Access-Control-Allow-Origin`) | Nguồn V1 đang dùng |
| DNSE chart-api nến 1 phút | cùng URL, `resolution=1` (cũng có `/index` cho VNINDEX) | 200 | 226 nến 09:15→14:45 hôm nay, tổng KL khớp nến ngày (13.224.600 HPG) | Không | Hỏi khoảng ~1 năm trước trả `null` → **lịch sử 1 phút có hạn, phải tự lưu hằng ngày**; độ dài lưu trữ chính xác **[CHƯA XÁC MINH]** |
| DNSE danh mục mã | `services.entrade.com.vn/dnse-financial-product/securities` | 200 | 10.399 mã, giá TC/trần/sàn, room… (4 MB) | Không | Nặng, dùng 1 lần/ngày |
| VNDirect dchart | `dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=HPG&from=..&to=..` (cũng `resolution=1`) | 200 | OHLCV ngày và 1 phút | **Có** (`*`) | Dự phòng cho DNSE |
| VNDirect finfo (host mới) | `api-finfo.vndirect.com.vn/v4/stock_prices?sort=date&q=code:HPG&size=2` | 200 | TC/trần/sàn, OHLC, giá TB, giá điều chỉnh | Có (`*`) | Host cũ `finfo-api.vndirect.com.vn` không phân giải DNS (HTTP 000) |
| VNDirect khối ngoại | `api-finfo.vndirect.com.vn/v4/foreigns?q=code:HPG&sort=tradingDate&size=2` | 200 | Mua/bán/ròng KL+GT, room | Có | HPG 19/10: ròng −1,52 triệu cp |
| VNDirect chỉ số | `api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&q=code:VNINDEX&size=1` | 200 | VNINDEX 19/10: 1689,84 (−0,94%), GTGD ~13.355 tỷ | Có | |
| VPS bảng giá | `bgapidatafeed.vps.com.vn/getliststockdata/HPG,FPT,...` (28 mã/1 lệnh, 27 KB, 0,16 s) | 200 | Giá khớp, 3 giá mua/bán + KL, trần/sàn/TC, khối ngoại mua/bán, room | **Có** (`*`) | Nguồn duy nhất thử được có sổ lệnh 3 bước giá; phù hợp chế độ Live |
| VPS danh sách mã | `bgapidatafeed.vps.com.vn/getlistckindex/hose`, `/getlistallstock` | 200 | Danh sách mã theo sàn | Có | |
| VPS lịch sử | `histdatafeed.vps.com.vn/tradingview/history?symbol=HPG&resolution=D&from=..&to=..` | 200 | OHLCV | Có | |
| KBS | `kbbuddywts.kbsec.com.vn/iis-server/investment/stocks/HPG/data_day?sdate=10-10-2026&edate=19-10-2026` | 200 | OHLCV + giá trị (đồng) | Có | |
| SSI iBoard chart | `iboard-api.ssi.com.vn/statistics/charts/history?resolution=1D&symbol=HPG&...` | 200 | OHLCV | Chỉ `iboard.ssi.com.vn` | Gọi từ server được, trình duyệt thì không |
| SSI iBoard query | `iboard-query.ssi.com.vn/stock/HPG`, `/exchange-index/VNINDEX` | 200 | Thông tin mã; chỉ số + số mã tăng/giảm | Chỉ iboard | `/v2/stock/exchange/hose` trả 404 |
| SSI FastConnect Data | `fc-data.ssi.com.vn/v2.0/Market` | không thử | EOD + realtime chính thức | – | **API chính thức nhưng cần tài khoản SSI, đăng ký tại quầy/môi giới, ConsumerID/Secret** (theo guide.ssi.com.vn). Phương án hợp lệ nhất nếu cần realtime lâu dài |
| TCBS | `apipubaws.tcbs.com.vn/stock-insight/...` | 403 | – | – | Cloudflare challenge |
| Vietcap (VCI) | `trading.vietcap.com.vn/api/chart/OHLCChart/gap` | 404 | – | – | Đổi endpoint; không tìm tiếp |
| Fireant | `restv2.fireant.vn/symbols/HPG/historical-quotes?...` | 401 | – | – | Cần token |
| Vietstock | `api.vietstock.vn/tvnew/history?...` | 200 nhưng body `null` | – | – | Không dùng được |
| CafeF lịch sử giá | `s.cafef.vn/Ajax/PageNew/DataHistory/PriceHistory.ashx?...` | 200 | "symbol is null" | Có | Tham số sai; không đào thêm |
| CafeF RSS tin | `cafef.vn/thi-truong-chung-khoan.rss` | 200 | RSS tin chứng khoán | Có | Dùng tiêu đề + link ra ngoài, không chép nội dung |
| VnExpress RSS | `vnexpress.net/rss/kinh-doanh/chung-khoan.rss` | 200 nhưng trả HTML | – | – | Sai URL hoặc bị chuyển hướng; không dùng |

Kết luận: dữ liệu cần cho mô hình đề xuất (nến ngày, nến 1 phút, TC/trần/sàn, khối ngoại, chỉ số, độ rộng thị trường) **đều lấy được** từ endpoint công khai, không cần đăng nhập. Tất cả là **endpoint nội bộ không có tài liệu**, có thể đổi hoặc chặn bất cứ lúc nào → phải có ít nhất 2 nguồn cho mỗi loại (DNSE + VNDirect cho nến; VNDirect + VPS cho khối ngoại).

### 3.4 Kiến trúc dữ liệu đề xuất

```
GitHub Actions (cron, thứ 2-6)
  08:40 UTC (15:40 ICT) chạy chính, 10:30 UTC chạy lại, 23:30 UTC sửa số liệu muộn
  └─ tools/fetch_daily.py (Python stdlib)
       ├─ DNSE 1D + 1m (dự phòng VNDirect dchart)
       ├─ VNDirect finfo: TC/trần/sàn, khối ngoại, chỉ số
       ├─ VPS: độ rộng/room (tùy chọn)
       ├─ CafeF RSS: 10 tiêu đề + link
       ├─ kiểm tra: ngày mới có thật không (nghỉ lễ → không commit), tổng KL 1m ≈ KL ngày
       └─ ghi data/ rồi commit → workflow deploy build lại Pages
Trình duyệt (GitHub Pages, tĩnh) chỉ đọc JSON cùng origin → không dính CORS
```

File dữ liệu:
- `data/calendar.json`: danh sách ngày giao dịch đã có + `latest`.
- `data/eod/YYYY-MM-DD.json`: mỗi mã `{o,h,l,c,v,ref,ceil,floor,fb,fs}` + chỉ số + số mã tăng/giảm + tiêu đề tin.
- `data/intraday/YYYY-MM-DD.json`: nến 1 phút toàn rổ, nén kiểu số nguyên chênh lệch (~4–6 KB/mã/ngày, ước tính; 60 mã ≈ 300 KB/ngày).
- `data/history/{SYM}.json`: nến ngày dài hạn (file V1, nối thêm mỗi ngày).
- Giữ intraday 30–60 ngày gần nhất trong repo; cũ hơn gom theo tháng đẩy lên GitHub Release (tránh repo phình ~75 MB/năm).

Đánh giá phương án so sánh:
| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **Actions cron + commit JSON** | Miễn phí, tĩnh, lượng gọi tới nguồn cố định (vài chục request/ngày bất kể bao nhiêu người chơi), có lưu trữ riêng | Cron GitHub có thể trễ 5–30+ phút; workflow lịch có thể bị tắt nếu repo không hoạt động 60 ngày (commit tự động có tính là hoạt động không: **[CHƯA XÁC MINH]**) | **Chọn cho M0–M4** |
| Cloudflare Worker proxy + cache 15–30 s | Có realtime; cache ở edge nên nguồn chỉ bị gọi ~2–4 lần/phút; khóa CORS về đúng origin | Thêm hạ tầng/tài khoản; gói free 100k request/ngày; rủi ro điều khoản lớn hơn vì phân phối lại dữ liệu trực tiếp | Dành cho Live mode (M5) |
| Gọi thẳng VPS/VNDirect từ trình duyệt (họ trả `ACAO: *`) | Không cần hạ tầng | Mỗi người chơi là một client lạ chọc vào API nội bộ của CTCK; họ chỉ cần đổi CORS là game chết; khó biện minh về điều khoản | Không khuyến nghị |
| SSI FastConnect qua Worker | Hợp lệ, có tài liệu | Cần tài khoản SSI + đăng ký; key không được để ở client | Phương án "chính quy" nếu sau này thương mại hóa |

### 3.5 Pháp lý, điều khoản, disclaimer

- Dữ liệu giá thuộc Sở GDCK (HOSE/HNX/VNX); phân phối lại dữ liệu realtime cho mục đích thương mại thông thường cần giấy phép. Phạm vi cụ thể cho game phi thương mại: **[CHƯA XÁC MINH]**, nên hỏi luật sư trước khi gắn quảng cáo/thu tiền.
- Điều khoản sử dụng của DNSE/VNDirect/VPS cho các endpoint nội bộ: **chưa đọc được văn bản nào cho phép**. Coi như rủi ro: dùng tần suất thấp, có User-Agent nhận diện, ghi nguồn, sẵn sàng gỡ khi bị yêu cầu.
- Ưu tiên dữ liệu **cuối ngày/trễ** thay vì realtime để giảm rủi ro.
- Disclaimer hiển thị ở màn hình đầu và footer: *"Game giải trí. Số liệu thị trường lấy từ nguồn công khai, có thể trễ hoặc sai, không phải khuyến nghị đầu tư. Tiền trong game là tiền ảo, không quy đổi ra tiền thật. Tên công ty/nhân vật trong game là hư cấu."*
- Không dùng tên/logo CTCK, quỹ thật cho công ty trong game; mã cổ phiếu thật thì được hiển thị như dữ liệu.
- Tin tức: chỉ hiện tiêu đề ngắn + link nguồn, không chép thân bài.

---

## 4. Ngôn ngữ thiết kế pixel (theo ảnh tham chiếu "JX1M AI Corp")

Phân tích ảnh (1920×911):
- **Sidebar trái ~360 px**: logo pixel 2 dòng, đồng hồ + chấm xanh "online"; panel "FLOW" (dropdown + mô tả + nút vàng "Chạy flow"/"Dừng"); panel "NHẬT KÝ CÔNG VIỆC" có tab lọc theo team; checkbox + nút "Xoá log" dưới đáy.
- **Thanh trên 6 thẻ team**, mỗi thẻ viền trên một màu: vàng `#e6b151` (Leader), đỏ `#d46053` (PRD), tím `#a977e5` (GD), xanh lá `#5ac177` (QC), xanh dương `#56a3dd` (Data), cam `#e48d4d` (MKT); dòng trạng thái "Rảnh".
- **Nền**: tím than `#292443` (panel), gần đen `#13111d` (vùng chính).
- **Giữa**: mặt cắt văn phòng top-down 3×2 phòng + hành lang ngang ở giữa (thảm đỏ `#9b504e`, sàn xám `#9b8f8f`); mỗi phòng một sàn riêng (gỗ xương cá cam `#c97f6a`, gạch vàng nhạt `#eae8ad`, thảm xám `#94888a`, gạch bông xanh ngọc `#bbeeed`, xám `#a9adb0`, gạch đỏ `#7e3f3b`), tường có tranh/cửa sổ, nhãn phòng góc trái trên, thảm cửa màu team. Nhân vật ngồi quay lưng trước màn hình; vài nhân vật đi trên hành lang; cây cảnh ở góc.
- Phong cách nhân vật/nội thất rất giống bộ **LimeZu Modern Interiors/Modern Office** (16 px, phóng ×3).

Áp vào game:
- Thẻ team trên cùng = **phòng ban của vai đang chơi**, hiện trạng thái thật ("Rảnh", "Đang gọi call 3 khách", "Hoảng loạn", "Sập app").
- Sidebar FLOW = **điều khiển ngày**: chọn ngày tồn, tốc độ phiên, chính sách, nút "Mở phiên"/"Dừng"/"Tự xử lý".
- Nhật ký công việc = **feed sự kiện** (V1 "Tin nóng") có lọc theo phòng.
- Bấm vào một bàn/phòng → mở panel HTML pixel (bảng điện, nến, danh sách khách, danh mục).
- Nhân viên có trạng thái hình ảnh: gõ phím (bình thường), đứng dậy chạy hành lang (call margin), biểu tượng mồ hôi/lửa khi VNINDEX −3%, nhảy múa khi trần.
- Font: xem bảng asset. Chú ý ảnh tham chiếu bị lỗi dấu tiếng Việt ("NHẬT KÝ" vỡ chữ) → **bắt buộc chọn font có subset tiếng Việt**.

---

## 5. Ba vai chơi

### 5.0 Phần chung
- Cùng **một thị trường** (dữ liệu ngày + 1 phút thật), cùng `core/rules`, cùng `core/account` (tiền, cổ phiếu chờ về T+, vay margin, tỷ lệ ký quỹ), cùng `core/events`, cùng engine văn phòng (phòng, nhân viên, trạng thái animation). Mỗi vai chỉ là **cấu hình + lớp kinh tế + bộ phòng + bộ sự kiện riêng**.
- Hai nhịp chơi đều có ở cả 3 vai: **Quản lý** (đặt chính sách, nhân sự, tự xử lý) và **Vào phiên** (phát lại 1 phút thật, bấm hành động).
- Chu kỳ thanh toán trong game: hàng về T+2 theo quy định hiện hành (chi tiết giờ hàng về **[CHƯA XÁC MINH]** trước khi code).
- Nhân viên có "tật" hài: *Môi giới hệ tâm linh* (xem ngày đẹp mới múc), *Analyst vẽ sóng Elliott* (dự báo đúng 50%), *IT "tắt đi bật lại"*, *Trader FOMO*.

### 5.1 Công ty chứng khoán (vai đầu tiên, tái dùng V1 nhiều nhất)
- **Fantasy**: CEO một công ty chứng khoán nhỏ hư cấu ("Chứng khoán Hai Mươi Ếch"), từ 1 phòng môi giới lên top thị phần.
- **Thắng**: đạt mốc thị phần môi giới/vốn chủ (vd top 10 trong bảng xếp hạng ảo), hoặc sống sót N năm game. **Thua**: vốn chủ âm; hoặc tỷ lệ vốn khả dụng dưới ngưỡng (mô phỏng quy định 180%, **[CHƯA XÁC MINH]** chi tiết); hoặc bị UBCK ảo đình chỉ vì điểm vi phạm compliance.
- **Thu**: phí giao dịch (≈0,15%), lãi margin (≈12–14%/năm), lãi/lỗ tự doanh, phí lưu ký (nhỏ). **Chi**: lương, máy chủ IT, marketing (KOL, hội nhóm Zalo), phạt, nợ xấu do giải chấp không kịp.
- **Phòng ban trong văn phòng**:
  | Phòng | Màu thẻ | Vai trò gameplay |
  |---|---|---|
  | Ban Giám đốc | vàng | Chính sách margin, hạn mức theo mã, duyệt tuyển dụng |
  | Môi giới | đỏ | Số khách mới/ngày, tâm trạng khách, trấn an (V1) |
  | Margin & Quản trị rủi ro | tím | Danh sách tài khoản cảnh báo/xử lý, call, giải chấp (V1) |
  | Tự doanh | xanh lá | Danh mục của công ty, vào phiên tự đặt lệnh |
  | IT | xanh dương | Độ ổn định hệ thống; thanh khoản thật càng cao càng dễ sập → khách không đặt được lệnh, bị chửi |
  | Pháp chế / Compliance | cam | Điểm vi phạm (margin mã cấm, room vượt), thanh tra ngẫu nhiên |
- **Vòng lặp ngày**: sáng chỉnh chính sách/nhân sự → phiên (call margin, xử lý sập IT, tự doanh) → tối quyết toán (phí, lãi, nợ xấu, uy tín → số khách mới).
- **Sự kiện**: VNINDEX giảm sâu thật → làn sóng call; thanh khoản kỷ lục thật → IT quá tải; khối ngoại bán ròng mạnh → khách "Tây bán ta mua"; mã trong danh mục margin nằm sàn nhiều phiên → kẹt hàng.
- **Tiến trình**: mở phòng (Tự doanh, IT riêng, Phân tích), tầng mới, nâng cấp máy chủ, mở rổ mã margin (VN30 → midcap → HNX/UPCOM), bảng xếp hạng thị phần ảo với các đối thủ NPC.

### 5.2 Quỹ đầu tư
- **Fantasy**: Giám đốc đầu tư một quỹ mở hư cấu, đánh bại VN-Index và hút vốn.
- **Thắng**: NAV/ccq vượt VNINDEX N quý liên tiếp; AUM đạt mốc. **Thua**: AUM dưới ngưỡng tối thiểu (bị rút hết) hoặc vi phạm hạn mức tỷ trọng quá nhiều lần (mô phỏng giới hạn tỷ trọng một tổ chức phát hành, mức 20% cho quỹ mở **[CHƯA XÁC MINH]**).
- **Thu**: phí quản lý 1–2%/năm trên NAV (tính theo ngày), phí thưởng hiệu suất trên mức vượt chuẩn. **Chi**: lương analyst/trader, dữ liệu, phí giao dịch, trượt giá.
- **Phòng ban**:
  | Phòng | Vai trò |
  |---|---|
  | Ban điều hành / PM | Chọn tỷ trọng mục tiêu, chiến lược (giá trị/tăng trưởng/lướt sóng) |
  | Research | Báo cáo mã: độ chính xác phụ thuộc trình analyst; có "tín hiệu" được tính từ dữ liệu thật quá khứ (không nhìn tương lai) |
  | Giao dịch (Trading desk) | Thực thi: không mua/bán quá ~10–20% khối lượng thật của mã trong ngày; vào phiên để tự chia lệnh, tránh trượt giá |
  | Quản trị rủi ro | Cảnh báo vượt hạn mức, drawdown, mức tiền mặt |
  | IR / Bán hàng | Dòng tiền vào/ra theo hiệu suất và tâm lý thị trường; NĐT NPC (tái dùng NPC V1) đòi rút khi lỗ → buộc bán đúng lúc sàn |
  | Pháp chế | Báo cáo định kỳ, hạn mức |
- **Vòng lặp**: sáng đặt tỷ trọng mục tiêu → phiên (trading desk thực thi, tự chia lệnh ở chế độ nhanh) → tối tính NAV, so chuẩn, dòng tiền vào/ra, báo cáo quý cho NĐT.
- **Sự kiện**: rút vốn ồ ạt khi thị trường rơi thật; đợt review ETF/đáo hạn phái sinh (lịch thật) gây biến động; "báo cáo khuyến nghị MUA đúng đỉnh" (meme).
- **Tiến trình**: quỹ con mới (quỹ trái phiếu, ETF), tuyển analyst giỏi, phòng họp IR to hơn.

### 5.3 Nhà đầu tư cá nhân
- **Fantasy**: F0 đi làm công ăn lương, trade trong căn phòng trọ, mơ "về bờ" rồi lên "cá mập".
- **Văn phòng pixel** = căn nhà: góc trading (1 → 3 → 6 màn hình), phòng khách (gia đình), bếp (mì gói khi lỗ, lẩu khi lãi), phòng ngủ (hồi tâm lý), góc điện thoại (hội nhóm Zalo/Telegram tung tin). Nâng cấp: phòng trọ → chung cư → nhà phố → văn phòng riêng.
- **Chỉ số**: tiền mặt, danh mục, nợ margin (vay từ CTCK NPC, dùng chính `core/margin` nhưng người chơi ở phía bị call), tâm lý (Tham ↔ Sợ, Stress), quan hệ gia đình, sức khỏe, lương chính cuối tháng.
- **Thắng**: tài sản ròng đạt mục tiêu chọn đầu game (vd 10 tỷ ảo) hoặc "tự do tài chính" (thu nhập thụ động > chi tiêu). **Thua**: cháy tài khoản và nợ vượt ngưỡng; hoặc gia đình "ra đi" (kết thúc hài).
- **Thu/chi**: lương, cổ tức, lãi/lỗ giao dịch; tiền nhà, sinh hoạt, lãi vay margin, phí, "tiền học con".
- **Vòng lặp**: sáng đọc tin hội nhóm (một số là tin đồn sai) → phiên (đặt lệnh thủ công, tâm lý cao thì nút bán bị "run tay") → tối gia đình hỏi chuyện, ngủ hồi stress.
- **Sự kiện**: "đại ca" trong nhóm hô múc; vợ/chồng phát hiện tài khoản margin; Tết nghỉ dài (lịch thật); bị call lúc đang họp công ty.
- **Tiến trình**: mở thêm màn hình (xem nhiều mã cùng lúc), khóa học "phân tích kỹ thuật" (mở chỉ báo), mở margin, mở phái sinh (sau).

---

## 6. Asset miễn phí đã tìm được

Trạng thái: **"Đã xem trang"** = đã WebFetch trang chính thức và đọc license trên trang (itch.io và kenney.nl **không chặn** fetch trong phiên này). **"Chỉ qua search"** = chỉ thấy qua kết quả tìm kiếm. Chưa tải file/đọc LICENSE.txt trong zip của bất kỳ gói nào.

| Asset | Tác giả | URL | License (trên trang) | Thương mại / sửa / ghi công | Kích thước | Vì sao hợp | Trạng thái |
|---|---|---|---|---|---|---|---|
| Pixel Office | 2dPig | https://2dpig.itch.io/pixel-office | CC0 | Có / Có / Không bắt buộc | Không phải tileset (sprite rời) | Bàn, máy tính, cây, đồ trang trí văn phòng + 5 nhân vật; top-down | Đã xem trang |
| Ninja Adventure Asset Pack | Pixel-Boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack | CC0 | Có / Có / Không bắt buộc | 16×16 | 50+ nhân vật có animation + faceset, tileset nội thất, UI, 100+ SFX, 37 bản nhạc, 2 font. Phong cách kiếm hiệp nên nội thất/nhân vật chỉ hợp một phần; SFX/nhạc/UI dùng tốt | Đã xem trang |
| RPG Urban Pack | Kenney | https://kenney.nl/assets/rpg-urban-pack | CC0 | Có / Có / Không | 16×16, 480 file | Nhân vật trang phục hiện đại, đô thị (nội dung chi tiết trang không ghi) | Đã xem trang |
| Roguelike Indoors | Kenney | https://kenney.nl/assets/roguelike-indoors | CC0 | Có / Có / Không | Trang không ghi, 480 file | Nội thất trong nhà (trang không liệt kê có máy tính) | Đã xem trang |
| UI Pack – Pixel Adventure | Kenney | https://kenney.nl/assets/ui-pack-pixel-adventure | CC0 | Có / Có / Không | 500 file | Nút, panel, slider pixel cho UI HTML | Đã xem trang |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds | CC0 | Có / Có / Không | 100 file âm thanh | Click, thông báo, lỗi | Đã xem trang |
| 1-Bit Pack | Kenney | https://kenney.nl/assets/1-bit-pack | Kenney thường CC0 | – | – | Icon nhỏ | Chỉ kiểm tra trang tồn tại (HTTP 200), **chưa đọc license** |
| Little Bits: Office | AdricCustoms | https://adriccustoms.itch.io/little-bits-office | **Không có license chính thức**; tác giả bình luận "use it for whatever you like" | Không rõ (chỉ là bình luận) | 16×16 | Ô làm việc, bàn, đồ văn phòng, top-down; đang phát triển | Đã xem trang — **license không rõ** |
| Office interior assets pack | Kami Amiga | https://kami-amiga.itch.io/office-interior-assets-pack | **Trang không ghi license** | Không rõ | Lưới 40×40 (lệch chuẩn 16/32) | Văn phòng top-down; cần mở zip xem license | Đã xem trang — **license không rõ** |
| Free office pixel art | Arlan_TR | https://arlantr.itch.io/free-office-pixel-art | "Free to use in personal and professional projects" | Thương mại có; sửa/ghi công không nói | Không ghi | Đồ văn phòng + 1 nhân vật animation (27 KB, nhỏ) | Đã xem trang — license sơ sài |
| 16x16 Home Interior | AbsuredMrSteel | https://absuredmrsteel.itch.io/16x16-home-interior-pixel-art | "free to use for anything"; thương mại thì xin tip | Có (tác giả xin ủng hộ) / không nói / không nói | 16×16 | Nội thất nhà cho vai Cá nhân | Đã xem trang |
| Office Characters [16X16] | LaMangoustii | https://lamangoustii.itch.io/office-characters-16x16 | **Không có**, có người hỏi chưa được trả lời | Không rõ | 16×16 | 12 nhân viên văn phòng có animation đi | Đã xem trang — **không dùng tới khi có license** |
| Cubicle mini tile set | Clint Bellanger | https://opengameart.org/content/cubicle-mini-tile-set | CC-BY 3.0 | Có / Có / **Bắt buộc ghi "Clint Bellanger"** | Trang không ghi | Vách ngăn cubicle, thảm, 1 nhân vật 8 hướng, có map Tiled mẫu | Đã xem trang |
| Modern Office (Revamped) | LimeZu | https://limezu.itch.io/modernoffice | **Trả phí $2,50** (giảm 50%) | Thương mại có; **cấm phân phối lại/bán lại**; **bắt buộc ghi công** + link | 16×16 (sprite 16/32/48) | Giống ảnh tham chiếu nhất; 300+ sprite văn phòng | Đã xem trang |
| Modern Interiors | LimeZu | https://limezu.itch.io/moderninteriors | Bản free ~1% nội dung; license bản free trang không ghi (theo devlog 2021 là **phi thương mại** — chỉ qua search). Bản đầy đủ từ $1,50 (có comment nói $3): thương mại, sửa được, cấm phân phối lại, bắt buộc ghi công | xem cột trái | 16/32/48 | Nhân vật + Character Generator; cùng phong cách ảnh tham chiếu | Đã xem trang (bản free: chỉ qua search) |
| VT323 (font) | Peter Hull / Google Fonts | https://fonts.google.com/specimen/VT323 | SIL OFL 1.1 (Google Fonts) | Có / Có / Giữ file license | Font terminal | **Đã xác minh có subset `vietnamese`** qua Google Fonts CSS API | Đã kiểm tra API |
| Handjet (font) | Google Fonts | https://fonts.google.com/specimen/Handjet | OFL | Có / Có / Giữ license | Font dạng ma trận điểm, có trục độ đậm | **Có subset `vietnamese`** | Đã kiểm tra API |
| Pixelify Sans, Press Start 2P, Silkscreen, Tiny5, Jersey 10, DotGothic16 | Google Fonts | fonts.google.com | OFL | – | – | **Không có subset vietnamese** → chỉ dùng cho số/chữ Latin không dấu (logo, giá) | Đã kiểm tra API |
| Pixeloid | GGBotNet | https://ggbot.itch.io/pixeloid-font | OFL | Có / Có | – | Có người báo dấu tiếng Việt chật, hỗ trợ một phần | Chỉ qua search |
| Silver | Poppy Works | https://poppyworks.itch.io/silver | CC BY 4.0 (dự án >100k USD phải xin license) | Có / – / Bắt buộc ghi công | – | Đa ngôn ngữ, nhưng có thread "Missing Vietnamese diacritics" | Đã xem trang — **tiếng Việt chưa chắc** |
| FatPix (bản VN) | ngndang | https://ngndang.itch.io/fat-pix-font | Không phải OFL, "đừng bán lại font" | Dùng miễn phí, cấm bán lại | 16×16, rất đậm | Có bản tiếng Việt, hợp tiêu đề lớn | Chỉ qua search |

Nhận xét:
- **Không có gói CC0 nào khớp hẳn phong cách ảnh tham chiếu**. Gói khớp nhất là LimeZu (rẻ nhưng trả phí, bắt buộc ghi công, **cấm phân phối lại**). GitHub Pages miễn phí yêu cầu repo public → để file sprite gốc LimeZu trong repo public có thể bị coi là phân phối lại. Cách xử lý khả dĩ: chỉ commit atlas đã đóng gói/cắt dùng trong game (vẫn là vùng xám, **[CHƯA XÁC MINH]** — nên hỏi tác giả), hoặc repo nguồn private + deploy build sang repo/host khác.
- Phương án an toàn: M0 dùng CC0 (2dPig + Kenney + Ninja Adventure cho SFX/nhạc) + tự vẽ sàn/tường đơn sắc theo bảng màu ảnh; thiếu gì thì tạo bằng **PixelLab MCP** (có trong môi trường chính; tôi không dùng thử trong phiên này; cần kiểm tra điều khoản quyền sở hữu output theo https://pixellab.ai/termsofservice).
- Font: **VT323 cho chữ tiếng Việt thân bài**, Handjet hoặc tự vẽ cho tiêu đề; Press Start 2P chỉ cho số/chữ không dấu.
- Khi đưa vào repo: tạo `public/assets/CREDITS.txt` liệt kê tác giả + license từng gói (bắt buộc với CC-BY/LimeZu, nên có cả với CC0).

---

## 7. Kiến trúc kỹ thuật

### 7.1 Lựa chọn: **Vite + TypeScript + Phaser 4 (cho cảnh văn phòng) + HTML/CSS (cho toàn bộ UI)**

- **Phaser** (npm `phaser` bản mới nhất 4.2.1, 2026-07-09) vì có sẵn: nạp map Tiled JSON, spritesheet/animation, tween, camera, input, âm thanh, chế độ `pixelArt`. PixiJS (8.22.0) chỉ là renderer, phải tự viết tilemap/animation/âm thanh. Canvas thuần (như V1) tốn công nhất cho map + nhiều nhân vật. Nếu gặp thiếu tài liệu ở Phaser 4 thì hạ về nhánh Phaser 3 (tài liệu/ví dụ nhiều hơn); quyết định khi spike M0.
- **UI bằng HTML/CSS** (sidebar, thẻ team, bảng điện, nến, modal) đặt chồng lên canvas: chữ tiếng Việt sắc nét, dễ responsive, tái dùng bảng điện/nến V1. Viền pixel bằng `border-image` từ Kenney UI Pack, `image-rendering: pixelated`.
- **TypeScript**: 3 vai dùng chung engine, kiểu dữ liệu rõ giúp nhiều session làm song song không vỡ nhau.
- **Tiled** cho map văn phòng (`.tmj`), mỗi phòng 1 layer/object group; object `desk` có thuộc tính `dept`, `seat`.
- **Vẽ**: độ phân giải logic 640×360 (tile 16 px), phóng nguyên lần (×2/×3), camera cố định toàn văn phòng; vai Cá nhân dùng map nhỏ hơn.
- **Nhân vật đi lại**: đồ thị waypoint trên hành lang + cửa phòng (không cần A* ở M0); state machine `seated/typing → walking → panic/celebrate`; trạng thái lấy từ `GameState` (vd tài khoản bị xử lý → nhân viên Margin chạy sang phòng Môi giới).
- **Engine thuần logic** (`src/core`) không phụ thuộc Phaser/DOM → chạy được trong Node để test và để "tự xử lý hàng loạt" ngày tồn.
- **Lưu game**: `localStorage` (bọc try/catch) + nút xuất/nhập file JSON. Không có tài khoản/bảng xếp hạng thật ở V2 (cần backend).
- **Deploy**: đổi GitHub Pages sang nguồn "GitHub Actions"; workflow `deploy.yml` build Vite (`base: '/Stock_20sGames/'`) rồi upload `dist/` + `data/`. V1 chuyển vào `v1/` và vẫn chạy ở `/Stock_20sGames/v1/`.

### 7.2 Cấu trúc thư mục

```
HOSE_20sGames/
  .github/workflows/
    data-daily.yml        # cron lấy dữ liệu, commit data/
    deploy.yml            # build Vite → Pages
  tools/
    fetch_data.py         # V1 (lịch sử dài)
    fetch_daily.py        # V2: EOD + 1m + khối ngoại + tin
  data/
    calendar.json
    eod/YYYY-MM-DD.json
    intraday/YYYY-MM-DD.json
    history/{SYM}.json
  v1/                     # prototype cũ (web/ hiện tại)
  public/
    assets/{tiles,chars,props,ui,fonts,sfx,music}/  + CREDITS.txt
    maps/{broker,fund,retail}.tmj
  src/
    main.ts
    core/                 # thuần logic, không DOM
      rules.ts  calendar.ts  market.ts (nạp ngày, phát lại 1m, fallback genPath)
      account.ts  margin.ts  orders.ts  npc/  events/  rng.ts  save.ts
    roles/
      broker/  fund/  retail/     # config, economy, rooms, events, staff traits
    office/
      OfficeScene.ts  Staff.ts  waypoints.ts  roomBinding.ts
    ui/
      shell/ (sidebar, team cards, log)  board/  chart/  modals/  styles/pixel.css
    data/ types.ts  loader.ts
  docs/PLAN_V2.md
```

---

## 8. Lộ trình

| Mốc | Nội dung | Tiêu chí xong |
|---|---|---|
| **M0 — Lát cắt mỏng** | (a) `fetch_daily.py` + `data-daily.yml` lấy EOD + 1m cho 32 mã hiện có. (b) Khung Vite+TS+Phaser + `deploy.yml`, V1 dời vào `/v1/`. (c) Vai **CTCK**, 1 văn phòng 3 phòng (Giám đốc, Môi giới, Margin) bằng asset CC0 tạm + sàn màu theo ảnh tham chiếu, 3–5 nhân viên ngồi/đi. (d) Phát lại **phiên giao dịch mới nhất** bằng nến 1m thật, engine margin/NPC V1 đã chuyển sang TS. (e) Disclaimer + CREDITS. | URL Pages chạy được; header hiện đúng ngày giao dịch thật mới nhất; workflow cron đã tự chạy thành công ít nhất 1 ngày giao dịch thật và bỏ qua đúng ngày nghỉ; chơi trọn 1 phiên CTCK; tải lại trang không mất save |
| M1 — Vòng lặp ngày CTCK | Lịch thật, ngày tồn + tự xử lý hàng loạt, đủ 6 phòng, tuyển/sa thải, báo cáo cuối ngày, sự kiện từ dữ liệu thật (VNINDEX, thanh khoản, khối ngoại), IT sập, compliance | Chơi liên tục 5 ngày thật; nghỉ 3 ngày rồi quay lại vẫn bù đúng; có thua/thắng |
| M2 — Vai Nhà đầu tư cá nhân | Map căn hộ, tâm lý/gia đình, bị call bởi CTCK NPC (dùng lại `margin.ts`), đặt lệnh thủ công | Chơi 1 tuần game với 2 kết thúc khác nhau |
| M3 — Vai Quỹ | NAV, chuẩn so sánh, dòng tiền vào/ra, hạn mức tỷ trọng, giới hạn % khối lượng thật, research | NAV khớp tính tay trên 3 ngày mẫu; rút vốn ép bán chạy đúng |
| M4 — Hoàn thiện | Chốt asset (mua LimeZu hoặc vẽ/PixelLab), âm thanh, gói meme, hướng dẫn, mở rộng rổ ~50–60 mã, layout mobile | Không còn asset tạm; mọi asset có trong CREDITS; chạy được trên điện thoại ngang |
| M5 — Tùy chọn | Live mode qua Cloudflare Worker (cache 15–30 s), có thể SSI FastConnect; bảng xếp hạng cần backend | Chỉ làm khi người dùng chốt và rà điều khoản dữ liệu |

**Giao song song** (sau khi chốt `src/data/types.ts` và hình dạng `GameState` ở đầu M0):
- Session A: pipeline dữ liệu (`tools/`, workflows, schema JSON).
- Session B: cảnh văn phòng Phaser + map Tiled + chọn/cắt asset.
- Session C: chuyển engine V1 sang `src/core` + test Node.
- Session D: khung UI HTML/CSS pixel (sidebar, thẻ team, nhật ký, bảng điện, nến).
- Từ M2: mỗi vai một session riêng, chỉ sửa `src/roles/<role>` + map của mình.

---

## 9. Rủi ro và điểm chưa chắc chắn

1. **Endpoint không chính thức**: DNSE/VNDirect/VPS có thể đổi, chặn, thêm CORS/Cloudflare bất cứ lúc nào (TCBS, Vietcap, Fireant đã không dùng được). Giảm thiểu: 2 nguồn/loại dữ liệu, cron báo lỗi qua issue tự động, game vẫn chạy được trên dữ liệu cũ + `genPath`.
2. **Lịch sử nến 1 phút ngắn**: DNSE trả `null` cho khoảng ~1 năm trước; thời gian lưu chính xác chưa đo. Phải bắt đầu tự lưu càng sớm càng tốt.
3. **Điều khoản/giấy phép dữ liệu**: chưa có văn bản nào cho phép dùng; nếu thương mại hóa cần tư vấn pháp lý và có thể cần nguồn có license (SSI FastConnect hoặc mua từ Sở GDCK).
4. **GitHub Actions cron**: trễ không đảm bảo giờ; quy tắc tắt workflow lịch sau 60 ngày không hoạt động — commit tự động có giữ workflow sống không chưa kiểm chứng.
5. **Dung lượng repo**: intraday ~300 KB/ngày (ước tính, chưa đo bằng file nén thật) → phải xoay vòng sang Release.
6. **Giá điều chỉnh**: chưa kiểm tra DNSE trả giá đã điều chỉnh cổ tức/chia tách hay chưa; VNDirect finfo có trường `adOpen/adHigh…` → cần đối chiếu trước khi tính lãi/lỗ qua ngày có sự kiện quyền.
7. **Phiên ATO**: nến 1m DNSE bắt đầu 09:15; hành vi 09:00–09:15 phải tự mô phỏng.
8. **Asset**: không có bộ CC0 đồng bộ phong cách; LimeZu cấm phân phối lại mâu thuẫn với repo public; nhiều gói itch không có license rõ (đã đánh dấu). Chưa mở file zip nào.
9. **Font tiếng Việt pixel**: chỉ VT323 và Handjet được xác minh có subset tiếng Việt; chất lượng hiển thị ở cỡ nhỏ chưa thử.
10. **Quy định mô phỏng** (T+2 giờ hàng về, vốn khả dụng 180%, hạn mức 20% quỹ mở, tỷ lệ margin) lấy từ hiểu biết chung, **chưa đối chiếu văn bản hiện hành**.
11. **Phaser 4** mới hơn, ví dụ cộng đồng chủ yếu còn ở Phaser 3 → spike 1–2 ngày ở M0 rồi chốt.
12. Gian lận/"nhìn trước": game single-player phát lại phiên sau khi đóng cửa nên người chơi có thể đã biết kết quả; chấp nhận vì không có bảng xếp hạng.

---

## 10. Câu hỏi cần người dùng chốt

1. **Diễn giải "dữ liệu thật mỗi ngày"**: chọn lai A+C (mỗi ngày thật = 1 ngày game; phiên được phát lại bằng nến 1 phút thật sau 15:30; có bù ngày vắng mặt)? *Khuyến nghị: Có.*
2. **Realtime trong giờ giao dịch (Live mode)** có cần không, và cần từ khi nào? *Khuyến nghị: Chưa; để M5 qua Cloudflare Worker có cache.*
3. **Vai làm đầu tiên**: CTCK? *Khuyến nghị: CTCK (dùng lại V1 nhiều nhất); thứ tự sau đó Cá nhân → Quỹ.*
4. **Asset**: chấp nhận trả ~$2,5–5 cho LimeZu (giống ảnh nhất, bắt buộc ghi công, cấm phân phối lại → ảnh hưởng repo public) hay chỉ dùng CC0 + PixelLab? *Khuyến nghị: M0 dùng CC0 + PixelLab; chốt mua ở M4 sau khi hỏi LimeZu về việc để atlas trong repo public.*
5. **Thương mại hóa** (quảng cáo, thu phí) có trong kế hoạch không? Quyết định này đổi toàn bộ yêu cầu về license dữ liệu và asset. *Khuyến nghị: Phi thương mại trong V2.*
6. **Rổ mã**: giữ 32 mã hay mở rộng? *Khuyến nghị: M0 giữ 32; M4 mở lên ~50–60 (VN30 + midcap hay được nhắc + vài mã HNX/UPCOM).*
7. **Chuyển sang Vite + TypeScript + Phaser** (có bước build, deploy qua GitHub Actions; V1 giữ ở `/v1/`)? *Khuyến nghị: Có.*
8. **Lưu tiến trình chỉ trên trình duyệt** (localStorage + xuất/nhập file), không tài khoản, không bảng xếp hạng ở V2? *Khuyến nghị: Có.*

---

### Nguồn tham khảo đã dùng
- SSI FastConnect: https://guide.ssi.com.vn/ssi-products/tieng-viet/dang-ky-dich-vu , https://guide.ssi.com.vn/ssi-products/tieng-viet/fastconnect-data
- LimeZu bản free (devlog): https://limezu.itch.io/moderninteriors/devlog/244045/free-version-overview-18042021-update
- Các trang asset liệt kê trong bảng mục 6; Google Fonts CSS API (`fonts.googleapis.com/css2?family=...`) để kiểm tra subset tiếng Việt; npm registry để lấy phiên bản Phaser/PixiJS/Vite.

---

## 11. QUYẾT ĐỊNH ĐÃ CHỐT (người dùng, 2026-10-19) — ghi đè các mặc định ở trên

| # | Quyết định |
|---|---|
| 1 | Dữ liệu thật theo ngày: **A + C** (ngày thật, chiếu lại phiên bằng nến 1 phút thật, có chơi bù). |
| 2 | **Realtime cập nhật mỗi 20 phút** từ API; lệnh của người chơi + NPC bị giới hạn bởi một phần **khối lượng thật** của mã trong mỗi khung 20 phút (mã thanh khoản thấp dễ kẹt hàng). Không còn để "Live" ở M5. |
| 3 | Thứ tự role: **CTCK → Quỹ → Cá nhân**. |
| 4 | Chỉ dùng **asset free** (CC0/CC-BY), **không mua** (bỏ LimeZu). Asset thiếu: PixelLab. |
| 5 | **Phi thương mại**. |
| 6 | Rổ mã: **chỉ VN30**. |
| 7 | Vite + TypeScript + Phaser (V1 chuyển vào `/v1/`). |
| 8 | **DB thật** trên **Cloudflare Workers + D1** (cron 20 phút gọi API giá → lưu D1; API tiến trình người chơi). Định danh: **Device ID ngẫu nhiên + mã khôi phục** (KHÔNG dùng/ lưu IP). Không bảng xếp hạng ở giai đoạn đầu. |

### Hệ quả cần làm
- Backend tách khỏi GitHub Pages: Worker + D1 + Cron Trigger (*/20 trong giờ giao dịch 9:00–14:45 giờ VN, T2–T6). Cần tài khoản Cloudflare + `wrangler login`/API token do chủ dự án cấp (không đưa token vào repo).
- Bỏ phụ thuộc GitHub Actions cron cho dữ liệu intraday (cron Actions trễ/không ổn định ở tần suất 20 phút); Actions chỉ còn deploy web.
- Dữ liệu 1 phút cuối ngày vẫn phải lưu lại (D1 hoặc R2) vì DNSE không truy lại quá khứ xa.
- Nguồn giá cho Worker: ưu tiên VPS/VNDirect/KBS (đã thử gọi được theo báo cáo, chưa tự xác minh lại); kiểm tra điều khoản và giới hạn tốc độ trước khi chạy cron.
- Cần mô hình "khung 20 phút" (slot) thay cho phiên 255 phút của V1: mỗi ngày ~14 slot; engine margin/NPC của V1 chạy theo slot.
- Mã khôi phục: sinh ngẫu nhiên đủ dài, chỉ lưu hash trong D1.
