# Kho Tab Guitar

Web bán quyền xem sheet/tab guitar theo tháng. Sheet/tab lấy từ một thư mục Google Drive **riêng tư**. Bạn upload lên Drive, khoảng 5 phút sau web có bài mới.

- **Người chưa trả phí:** thấy danh sách bài, vào bài thì thấy 1/3 đầu của sheet, phần còn lại bị làm mờ ngay trên server.
- **Người đã trả phí:** xem toàn bộ PDF, ảnh và tab Guitar Pro (chỉ xem, không phát tiếng). Sheet có in mờ số điện thoại người xem, không có nút tải về, mỗi tài khoản chỉ dùng 1 thiết bị (đăng nhập máy khác thì máy cũ bị đăng xuất).
- **Tài khoản:** tạo 2 bước (nhập số điện thoại, rồi chọn tên đăng nhập + mật khẩu), không gửi SMS. Đăng nhập bằng tên đăng nhập hoặc số điện thoại. Khách quên mật khẩu thì liên hệ bạn, bạn đặt lại trong `/admin`.
- **Thanh toán:** 1 gói 20.000đ / 30 ngày, mặc định là chuyển khoản tay: khách quét VietQR có sẵn số tiền, nội dung là số điện thoại tài khoản của họ, bạn bấm xác nhận trong `/admin`. Có thể chuyển sang payOS hoặc SePay để tự kích hoạt khi tiền về. Sửa giá trong `src/lib/plans.ts`.
- **Trang `/admin`:** xem người dùng, doanh thu, gia hạn tay.

## Cách xếp file trên Drive

```
Thư mục gốc/
├── ANH MỚI CHÍNH LÀ NGƯỜI EM YÊU/    ← mỗi bài một thư mục
│   ├── GIANG TẤU ....pdf              ← hiện
│   ├── INTRO ....gp                   ← hiện (tab Guitar Pro, không có tiếng)
│   ├── ĐK ...#1.png                   ← hiện
│   ├── backing track.wav              ← tự ẩn
│   └── clip hướng dẫn.mp4             ← tự ẩn
└── Bolero/                            ← có thể gom bài theo thể loại
    └── Tên bài - Ca sĩ/ ...
```

Web chỉ hiện các file: PDF, ảnh (jpg/png/webp…), Guitar Pro (`.gp` `.gp3-5` `.gpx`), MusicXML, tab chữ (`.txt`, Google Docs). Âm thanh, video và file khác bị bỏ qua.

---

## Cài đặt (làm một lần)

### 1. Google Drive: tài khoản robot đọc thư mục riêng tư

1. Vào <https://console.cloud.google.com>, tạo project mới.
2. Vào **APIs & Services → Library**, tìm **Google Drive API** rồi bấm **Enable**.
3. Vào **IAM & Admin → Service Accounts → Create service account**. Đặt tên tùy ý, bỏ qua bước phân quyền.
4. Bấm vào service account vừa tạo, chọn **Keys → Add key → Create new key → JSON**. Máy sẽ tải về một file `.json`.
5. Mở thư mục Drive, bấm **Chia sẻ**, dán email của service account (dạng `...@....iam.gserviceaccount.com`), quyền **Người xem**.
   - **Quyền truy cập chung** để **Hạn chế** (không để "Bất kỳ ai có đường liên kết").
6. Biến môi trường:
   - `DRIVE_FOLDER_ID`: đoạn ID sau `/folders/` trong URL thư mục.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: toàn bộ nội dung file `.json`, dán thành một dòng.

### 2. Supabase: tài khoản + lưu gói đã mua

1. Tạo project ở <https://supabase.com> (gói Free, region Singapore).
2. Vào **SQL Editor → New query**, dán toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql), chọn hết (Ctrl+A) rồi bấm **Run**.
   - Nếu trước đây đã chạy bản schema cũ (đăng nhập bằng email), chỉ cần chạy thêm [`supabase/migrations/002_phone_login.sql`](supabase/migrations/002_phone_login.sql).
3. Vào **Authentication → Sign In / Providers**:
   - **Email**: để bật (web dùng nó ngầm để đăng nhập).
   - **Allow new users to sign up**: **tắt**. Tài khoản được tạo qua web, nên tắt mục này để không ai tạo tài khoản lách qua web được.
4. Vào **Project Settings → Data API**, lấy **Project URL** (chỉ phần `https://xxxx.supabase.co`, không lấy đuôi `/rest/v1`). Vào **API Keys**, lấy:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Publishable key (`sb_publishable_…`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Secret key (`sb_secret_…`, **không được để lộ**)
5. `ADMIN_PHONES`: số điện thoại của bạn, để vào được `/admin`. Bạn tạo tài khoản trên web bằng đúng số này.

### 3. payOS: nhận tiền (không bắt buộc, mặc định web dùng chuyển khoản tay, xem cuối mục này)

1. Đăng ký ở <https://payos.vn> rồi liên kết tài khoản ngân hàng. Gói miễn phí không giới hạn hiện áp dụng với Kiên Long Bank và MSB.
2. Tạo **kênh thanh toán**, lấy `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
3. Sau khi web đã có địa chỉ thật (bước 5), đặt **Webhook URL** của kênh thanh toán là `https://<web của bạn>/api/payments/payos`.

**Ngân hàng payOS không hỗ trợ (ví dụ VietinBank):** đặt `BANK_NAME` (tên ngắn, ví dụ `VietinBank`, `MBBank`), `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`, rồi chọn một trong hai:
- `PAYMENT_PROVIDER=manual` (mặc định): trang thanh toán hiện VietQR có sẵn số tiền, nội dung là số điện thoại tài khoản của khách. Thấy tiền về thì bạn tìm số điện thoại đó trong `/admin` và bấm **Đã nhận tiền** ở đơn. Không mất phí.
- `PAYMENT_PROVIDER=sepay`: tự kích hoạt. Trong SePay, tạo webhook trỏ về `https://<web>/api/payments/sepay`, kiểu xác thực **API Key**, và đặt cùng giá trị vào `SEPAY_API_KEY`.

### 4. Đưa web lên mạng

Vercel bản miễn phí **không cho dùng thương mại**. Hai lựa chọn:
- **Netlify:** bản miễn phí cho phép dùng thương mại.
- **Vercel Pro:** khoảng 20 USD/tháng.

Cách làm:
1. Đẩy code lên GitHub.
2. Import repo vào Netlify (hoặc Vercel).
3. Thêm toàn bộ biến môi trường (xem [`.env.example`](.env.example)), gồm cả:
   - `NEXT_PUBLIC_SITE_URL`: địa chỉ web
   - `ADMIN_PHONES`: số điện thoại của bạn
4. Deploy. Sau đó quay lại bước 3 để đặt webhook payOS bằng địa chỉ web thật.

---

## Chạy trên máy

```bash
npm install
npm run dev
```

Cần có `.env.local` với cấu hình Drive và Supabase (xem `.env.example`). Khi phát triển, có thể giả lập người xem bằng biến `DEV_VIEWER=free|paid|admin` trong `.env.local` (chỉ có tác dụng khi chạy `npm run dev`).

## Ghi chú

- **Gia hạn:** không tự động. Mua thêm thì thời hạn được cộng dồn.
- **Khi webhook bị trễ:** trang thanh toán tự hỏi lại payOS, nên người dùng vẫn được kích hoạt.
- **Bảo vệ nội dung:**
  - File gửi cho người đã trả phí luôn được **in tên đăng nhập + số điện thoại** vào bên trong: chữ mờ trên từng trang PDF và trên ảnh, dòng "Bản cấp cho…" trong tab Guitar Pro. Lưu file về được thì file vẫn mang tên họ.
  - Link file chỉ dùng được 5 phút, cho đúng tài khoản + thiết bị, và chỉ khi mở từ chính web. Mỗi tài khoản mở tối đa 60 file khác nhau/giờ (`FILE_VIEW_LIMIT_PER_HOUR`). Mọi lượt mở được ghi lại, xem trong `/admin`.
  - Người chưa trả phí không bao giờ nhận được file gốc.
  - Người đã trả phí thì trình duyệt phải tải file về mới hiển thị được, nên không chặn được 100% việc lưu lại hay chụp màn hình. Số điện thoại in mờ trên sheet giúp truy ra người phát tán.
