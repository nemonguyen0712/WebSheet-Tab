# Kho Tab Guitar

Web bán quyền xem sheet/tab guitar theo tháng. Sheet/tab lấy từ một thư mục Google Drive **riêng tư**. Bạn upload lên Drive, khoảng 5 phút sau web có bài mới.

- **Người chưa trả phí:** thấy danh sách bài, vào bài thì thấy 1/3 đầu của sheet, phần còn lại bị làm mờ ngay trên server.
- **Người đã trả phí:** xem toàn bộ PDF, ảnh và tab Guitar Pro (chỉ xem, không phát tiếng). Sheet có in mờ email người xem, không có nút tải về, mỗi tài khoản tối đa 2 thiết bị.
- **Thanh toán:** VietQR qua payOS (hoặc SePay), tự kích hoạt khi tiền về. Gói 1 tháng 20k, 3 tháng 49k, 12 tháng 159k (sửa trong `src/lib/plans.ts`).
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

### 2. Supabase: đăng nhập + lưu gói đã mua

1. Tạo project ở <https://supabase.com> (gói Free).
2. Vào **SQL Editor → New query**, dán toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) rồi bấm **Run**.
3. Vào **Project Settings → API**, lấy:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon / publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role / secret key, **không được để lộ**)

### 3. Đăng nhập bằng Google

1. Trong Google Cloud (cùng project ở bước 1):
   - Vào **APIs & Services → OAuth consent screen**, điền tên web và email, chọn External, rồi **Publish**.
   - Vào **Credentials → Create credentials → OAuth client ID → Web application**.
   - Mục **Authorized redirect URIs** thêm: `https://<mã-project>.supabase.co/auth/v1/callback`
2. Trong Supabase:
   - Vào **Authentication → Providers → Google**, bật lên, dán Client ID và Client Secret.
   - Vào **Authentication → URL Configuration**:
     - **Site URL**: địa chỉ web của bạn, ví dụ `https://khotab.netlify.app`
     - **Redirect URLs**: thêm `https://khotab.netlify.app/auth/callback` và `http://localhost:3000/auth/callback`

### 4. payOS: nhận tiền

1. Đăng ký ở <https://payos.vn> rồi liên kết tài khoản ngân hàng. Gói miễn phí không giới hạn hiện áp dụng với Kiên Long Bank và MSB.
2. Tạo **kênh thanh toán**, lấy `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
3. Sau khi web đã có địa chỉ thật (bước 5), đặt **Webhook URL** của kênh thanh toán là `https://<web của bạn>/api/payments/payos`.

**Nếu muốn dùng SePay thay cho payOS:**
- Đặt `PAYMENT_PROVIDER=sepay`, cùng `SEPAY_BANK` (mã ngân hàng, ví dụ `MBBank`), `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`.
- Trong SePay, tạo webhook trỏ về `https://<web>/api/payments/sepay`, kiểu xác thực **API Key**, và đặt cùng giá trị vào `SEPAY_API_KEY`.

### 5. Đưa web lên mạng

Vercel bản miễn phí **không cho dùng thương mại**. Hai lựa chọn:
- **Netlify:** bản miễn phí cho phép dùng thương mại.
- **Vercel Pro:** khoảng 20 USD/tháng.

Cách làm:
1. Đẩy code lên GitHub.
2. Import repo vào Netlify (hoặc Vercel).
3. Thêm toàn bộ biến môi trường (xem [`.env.example`](.env.example)), gồm cả:
   - `NEXT_PUBLIC_SITE_URL`: địa chỉ web
   - `ADMIN_EMAILS`: email Google của bạn, để vào được `/admin`
4. Deploy. Sau đó quay lại bước 3 và 4 để điền địa chỉ web thật.

---

## Chạy trên máy

```bash
npm install
npm run dev
```

Nếu chưa cấu hình Drive, web dùng tab mẫu trong `content/tabs/`. Nếu chưa cấu hình Supabase, có thể giả lập người xem bằng biến `DEV_VIEWER=free|paid|admin` trong `.env.local` (chỉ có tác dụng khi chạy `npm run dev`).

## Ghi chú

- **Gia hạn:** không tự động. Mua thêm thì thời hạn được cộng dồn.
- **Khi webhook bị trễ:** trang thanh toán tự hỏi lại payOS, nên người dùng vẫn được kích hoạt.
- **Bảo vệ nội dung:**
  - Người chưa trả phí không bao giờ nhận được file gốc.
  - Người đã trả phí thì trình duyệt phải tải file về mới hiển thị được, nên không chặn được 100% việc lưu lại hay chụp màn hình. Email in mờ trên sheet giúp truy ra người phát tán.
