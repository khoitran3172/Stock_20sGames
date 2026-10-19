# Sàn Đỏ Sàn Xanh

Game web mô phỏng chứng khoán Việt Nam của studio **20sGames**: điều hành công ty chứng khoán, quỹ đầu tư hoặc nhà đầu tư cá nhân, bám theo thị trường thật. Tông nghiêm túc mô phỏng sát đời thực, pha meme cộng đồng chứng khoán.

> Game giải trí, **không phải tư vấn đầu tư**. Dữ liệu giá lấy từ các endpoint công khai, có thể chậm hoặc sai lệch. Dự án phi thương mại.

## Liên kết

| | |
|---|---|
| 🎮 **Chơi thử (GitHub Pages)** | https://khoitran3172.github.io/Stock_20sGames/ |
| Bản V1 trực tiếp | https://khoitran3172.github.io/Stock_20sGames/web/ |
| Mã nguồn | https://github.com/khoitran3172/Stock_20sGames |
| API (Cloudflare Worker) | https://stock20s.stock20s-worker.workers.dev/api/health |
| Kế hoạch V2 | [docs/PLAN_V2.md](docs/PLAN_V2.md) |

## Trạng thái

- **V1 (đang chạy trên Pages):** prototype chế độ Phiên. Bảng điện, nến, replay một phiên lịch sử thật, khách NPC có margin, call margin, giải chấp, kẹt sàn, vị thế qua đêm.
- **V2 (đang làm, thư mục `app/`):** thành phố isometric pixel art (Vite + TypeScript + Phaser): **30 mã VN30 là 30 tòa nhà** theo ngành, đổi màu/nhãn theo dữ liệu thật; HQ công ty ở giữa, bấm vào để mở tầng và xây phòng theo vốn và quy mô, mỗi phòng mở khóa mô hình đầu tư. Chọn vai (CTCK sẵn sàng; Quỹ, Cá nhân sắp ra mắt), dữ liệu thật VN30 theo khung 20 phút. Xem [docs/BUILDING.md](docs/BUILDING.md) và [docs/PLAN_V2.md](docs/PLAN_V2.md).
- **Backend:** Cloudflare Worker + D1 đã deploy. Cron lấy giá VN30 mỗi 20 phút trong giờ giao dịch, API cho game, lưu tiến trình ẩn danh. Game V2 chưa nối vào backend.

## Cấu trúc thư mục

```
web/        Game V1 (HTML/JS thuần, không cần build)
app/        Game V2 (Vite + TS + Phaser): tòa nhà, phòng ban, mô hình đầu tư
data/       Nến ngày lịch sử 32 mã (2018 → 16/10/2026), sinh bởi tools/fetch_data.py
tools/      fetch_data.py: tải nến ngày từ endpoint công khai của DNSE
worker/     Cloudflare Worker + D1 (cron 20 phút, API thị trường, lưu tiến trình)
docs/       Kế hoạch V2
index.html  Chuyển hướng vào web/
.github/    Workflow deploy GitHub Pages (tự chạy khi push lên main)
```

## Chạy V1 ở máy

Cần Python 3. Phải chạy qua server, không mở file trực tiếp vì trình duyệt chặn `fetch`.

```bash
python -m http.server 8765
```

Mở http://127.0.0.1:8765/web/index.html. Phím cách để chạy hoặc dừng.

Cập nhật dữ liệu lịch sử:

```bash
python tools/fetch_data.py 2018
```

## Chạy V2 ở máy

```bash
cd app
npm install
npm run dev        # http://127.0.0.1:5173  (thêm ?dev=1 để hiện nút cộng tiền thử nghiệm)
```

API mặc định là Worker đã deploy; đổi bằng biến `VITE_API`.

## Gameplay V1 (chế độ Phiên)

- Chọn **chính sách margin** trước phiên: Thận trọng, Cân bằng hoặc Liều. Vay nhiều thì lãi vay cao nhưng dễ cháy.
- Mỗi khách NPC (F0, Lướt sóng, Giá trị, Cá mập, Zalo) giữ một mã có vay margin. Dư nợ từ 62% là **cảnh báo**, từ 70% là **bị xử lý**.
- Hành động (chỉ khi đang chạy): 📞 trấn an, 💵 gọi bổ sung ký quỹ, 🔨 giải chấp ngay.
- Nếu không xử lý khi bị xử lý, hệ thống tự bán sau 25 phút ảo. Mã **nằm sàn thì không bán được**.
- Vị thế cảnh báo hoặc bị xử lý chưa đóng sẽ **mang qua đêm** sang phiên kế tiếp.
- Cuối phiên: phí + lãi vay − nợ xấu, uy tín, khách bỏ đi nếu tâm trạng thấp hoặc cháy tài khoản.
- Đường giá trong phiên của V1 là **mô phỏng** từ nến ngày (cầu Brown chạm đúng cao, thấp, đóng cửa), không phải tick thật.

## Backend (worker/)

Cloudflare Worker + D1, cron `*/20 2-8 * * 1-5` (UTC), tức mỗi 20 phút từ 09:00 đến 15:40 giờ VN, thứ 2 đến thứ 6.

| Endpoint | Mô tả |
|---|---|
| `GET /api/health` | Kiểm tra sống |
| `GET /api/market` | Bảng giá VN30: tham chiếu, trần, sàn, giá khớp, khối ngoại |
| `GET /api/slots?date=YYYY-MM-DD` | Dữ liệu theo 14 khung 20 phút trong ngày |
| `GET /api/candles?sym=HPG&date=YYYY-MM-DD` | Nến 1 phút của một mã |
| `POST /api/player/new` | Tạo người chơi ẩn danh, trả mã khôi phục (hiện một lần) |
| `POST /api/player/recover` | Khôi phục tiến trình sang thiết bị mới bằng mã |
| `GET/PUT /api/save` | Đọc, ghi tiến trình (header `X-Device-Id`) |

- Định danh người chơi bằng Device ID ngẫu nhiên và mã khôi phục. Server chỉ lưu hash, **không lưu IP**.
- CORS chỉ cho phép origin trong `ALLOWED_ORIGINS` (`worker/wrangler.toml`).
- Nguồn dữ liệu: DNSE (nến 1 phút), VPS (bảng giá và danh sách VN30). Đều là endpoint công khai không chính thức, cần kiểm tra điều khoản trước khi phát hành rộng rãi.

Chạy thử ở máy:

```bash
cd worker
npm install
npm run db:local
npm run dev        # http://127.0.0.1:8787, kích hoạt cron: /cdn-cgi/handler/scheduled
```

Deploy (cần `npx wrangler login` bằng tài khoản Cloudflare của bạn, không đưa token vào repo):

```bash
npm run deploy
```

## Deploy web

Mỗi lần push lên `main`, workflow `.github/workflows/pages.yml` tự đưa `index.html`, `web/` và `data/` lên GitHub Pages. Cần bật Settings → Pages → Source: **GitHub Actions**.

## Tài nguyên đồ họa

- Sprite tòa nhà isometric (`app/public/assets/iso/*.png`) do tác giả dự án tạo bằng PixelLab (gói thử); tuân theo [điều khoản PixelLab](https://pixellab.ai/termsofservice).
- Tile nền, đường, xe máy, lô đất vẽ bằng code (`app/src/core/isoart.ts`).
- Font: VT323 (SIL OFL) từ Google Fonts.
- Các gói miễn phí đã khảo sát nhưng không dùng (không đủ 30 tòa tháp isometric đồng bộ): xem `docs/PLAN_V2.md` mục 7.
