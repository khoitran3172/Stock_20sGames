# Tòa nhà CTCK — tầng, phòng ban, mô hình đầu tư

Thiết kế cho role **Công ty chứng khoán**. Toàn bộ nằm trong dữ liệu `app/src/core/building.ts` (cấu hình) và `app/src/core/company.ts` (luật mở khóa). Đơn vị tiền: **triệu đồng (tr)**. Số liệu chỉ là khởi điểm, sẽ cân bằng ở M1.

## 1. Ý tưởng

Công ty bắt đầu bằng **một phòng Môi giới ở tầng trệt**. Càng kiếm được tiền và có nhiều khách, bạn càng:
1. **Xây thêm phòng** trong tầng đã mở (mặt bằng trống → phòng làm việc).
2. **Mở tầng mới** khi đạt quy mô công ty cao hơn.
3. Mỗi phòng **mở khóa mô hình đầu tư** mới (margin, tự doanh, trái phiếu, vàng, BĐS, bảo hiểm, IB...).

Mỗi tầng/phòng cũng làm tăng **chi phí duy trì mỗi ngày**, nên mở rộng quá nhanh có thể làm công ty cạn vốn.

## 2. Quy mô công ty (bậc 1–5)

Bậc = **min(bậc theo vốn, bậc theo số khách)**. Vốn quy đổi = tiền mặt + 80% giá trị đã xây (để xây dựng không làm tụt bậc).

| Bậc | Tên | Vốn quy đổi ≥ | Khách ≥ |
|---|---|---|---|
| 1 | Khởi nghiệp | 0 | 0 |
| 2 | Nhỏ | 2.000 tr | 8 |
| 3 | Vừa | 10.000 tr | 14 |
| 4 | Lớn | 50.000 tr | 24 |
| 5 | Tập đoàn | 200.000 tr | 40 |

## 3. Các tầng và phòng

Điều kiện mở **tầng**: đã mở tầng liền dưới + đủ bậc + đủ tiền. Điều kiện xây **phòng**: tầng đã mở + yêu cầu của phòng (bậc, phòng tiên quyết) + đủ tiền.

| Tầng | Tên | Bậc | Chi phí | Phòng (chi phí tr · duy trì tr/ngày · tiên quyết) |
|---|---|---|---|---|
| 1 | Sảnh giao dịch | 1 | 0 | **Môi giới** (có sẵn) · Chăm sóc KH (300 · 3) · Quầy Margin (600 · 5 · cần Môi giới) |
| 2 | Quản trị & Rủi ro | 2 | 1.500 | Giám đốc (400 · 6) · Rủi ro & Giải chấp (800 · 6 · cần Quầy Margin) · Compliance (600 · 4) |
| 3 | Đầu tư & Nghiên cứu | 3 | 6.000 | Tự doanh (2.000 · 10) · Trái phiếu & Quỹ (2.500 · 8) · Research (1.200 · 6 · cần Giám đốc) |
| 4 | Sản phẩm mở rộng | 4 | 20.000 | Vàng (3.000 · 8 · cần Tự doanh) · Bất động sản (8.000 · 14 · cần Compliance) · Bảo hiểm (4.000 · 7 · cần Chăm sóc KH) |
| 5 | Công nghệ & Tăng trưởng | 5 | 60.000 | IT (5.000 · 12) · Marketing (4.000 · 8) · IB (15.000 · 20 · cần Research + Compliance) |
| 6+ | Chi nhánh & Quốc tế, Fintech & Dữ liệu | — | — | Đã lên kế hoạch, hiển thị mờ ở thẻ “Sắp có” |

Vai trò từng phòng: xem trường `blurb` trong `building.ts`.

## 4. Mô hình đầu tư theo phòng

| Mô hình | Phòng | Loại | Rủi ro (1–5) | Lợi suất | Dữ liệu |
|---|---|---|---|---|---|
| Cho vay margin | Quầy Margin | Cho vay | 4 | 12–14%/năm + phí | Giá thật (VN30) |
| Ứng trước tiền bán | Quầy Margin | Cho vay | 1 | ~0,03%/ngày | Giá thật |
| Tự doanh cổ phiếu | Tự doanh | Cổ phiếu | 4 | Theo giá | Giá thật |
| Phái sinh VN30F | Tự doanh (+bậc 4, Rủi ro) | Phái sinh | 5 | Đòn bẩy | Giá thật |
| Trái phiếu doanh nghiệp | Trái phiếu & Quỹ | Trái phiếu | 3 | 8–11%/năm | Mô phỏng |
| Quỹ mở / ETF | Trái phiếu & Quỹ | Quỹ | 3 | Theo NAV | Giá thật |
| Kinh doanh vàng | Vàng | Vàng | 2 | Chênh lệch mua bán | Mô phỏng (nối nguồn thật sau) |
| Cho vay thế chấp BĐS | Bất động sản | Cho vay | 3 | 9–12%/năm | Mô phỏng |
| Đầu tư dự án BĐS | Bất động sản (+bậc 5) | BĐS | 5 | Lãi lớn, khóa vốn 1–3 năm | Mô phỏng |
| Đại lý bảo hiểm | Bảo hiểm | Bảo hiểm | 1 | Hoa hồng 10–25% phí năm 1 | Mô phỏng |
| Bảo lãnh phát hành | IB | IB | 4 | Phí 1–3% đợt phát hành | Mô phỏng |

“Giá thật” dùng dữ liệu từ Worker (cập nhật mỗi 20 phút); “mô phỏng” dùng mô hình giả lập có sự kiện ngẫu nhiên (nợ xấu BĐS, chậm trả trái phiếu, bồi thường bảo hiểm...). Các mô hình **chưa có logic tính toán** ở bản này: hiện chỉ hiển thị, khóa và mở khóa.

## 5. Cách mở rộng

- **Thêm phòng vào tầng có sẵn:** sửa mảng `rooms` của tầng (mỗi tầng hiện đúng 3 phòng; muốn nhiều hơn cần đổi bố cục `OfficeScene`).
- **Thêm tầng mới:** thêm một `FloorDef` vào `FLOORS` trong `building.ts`. Cảnh tự cao thêm, thẻ tầng và điều kiện mở khóa tự cập nhật. Thêm tầng mở khóa thì thêm bậc tương ứng vào `TIER_EQUITY` / `TIER_CUSTOMERS` nếu cần.
- **Thêm mô hình đầu tư:** thêm một dòng vào `PRODUCTS` (phòng, rủi ro, lợi suất, nguồn dữ liệu, điều kiện phụ).
- **Thêm loại đồ nội thất:** thêm hàm vẽ trong `art.ts`, đăng ký trong `registerArt`, rồi dùng tên trong `props` của phòng.
- Khi có asset pixel thật (CC0), thay các texture cùng key trong `art.ts`; cảnh không cần đổi.

## 6. Việc chưa làm

- Vòng lặp ngày tính thu/chi thật: phí, lãi, duy trì phòng, đóng cửa nếu âm vốn.
- Logic từng mô hình đầu tư và sự kiện của nó.
- Nhân sự theo phòng (thuê môi giới, nâng cấp), tăng khách theo số bàn môi giới.
- Cân bằng số liệu (chi phí, bậc, lợi suất) bằng mô phỏng nhiều ngày.
- Role Quỹ và Cá nhân dùng chung engine nhưng tòa nhà/phòng khác.
