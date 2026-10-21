# Deploy & bảo mật — checklist

Làm lần lượt từ trên xuống. Tick `[x]` khi xong.

---

## A. Bảo mật — làm TRƯỚC khi deploy

### Tài khoản admin
- [ ] Đăng nhập web bằng tài khoản `admin`.
- [ ] Vào **Tài khoản → Đổi mật khẩu**, đặt mật khẩu riêng của bạn (dài, không dùng lại ở chỗ khác).
- [x] File mật khẩu tạm `.admin-login.txt` đã được xóa. Quên mật khẩu admin thì nhờ Claude đặt lại (dùng key Supabase trong `.env.local`).

### Google Cloud (project WebSheetTab)
- [ ] **Tạo key mới cho service account**, vì key cũ từng bị gửi qua khung chat:
  1. IAM & Admin → Service Accounts → **OliuTab** → tab **Keys**.
  2. **Add key → Create new key → JSON**, tải file mới về.
  3. **Xóa key cũ** (`be2a7e74…`) bằng biểu tượng thùng rác.
  4. Nhờ Claude nạp key mới vào `.env.local`, chỉ gửi **đường dẫn file**. Đừng dùng ký hiệu `@` vì nó sẽ đính kèm luôn nội dung file.
- [ ] **Gỡ role Owner** của service account: IAM → dòng `oliutab@websheettab.iam.gserviceaccount.com` → ✏️ → xóa **Owner** → Save. Tài khoản robot chỉ cần quyền xem thư mục Drive.
- [ ] **Bật lại lệnh cấm tạo key** sau khi đã có key mới: Organization Policies → *Disable service account key creation* → Manage policy → **Inherit parent's policy** → Set policy.

### Google Drive
- [ ] Thư mục gốc: **Quyền truy cập chung = Hạn chế**. Chỉ chia sẻ cho service account (Người xem) và những người bạn cho upload (Người chỉnh sửa).

### Supabase
- [ ] Chạy file [`supabase/migrations/003_file_views.sql`](supabase/migrations/003_file_views.sql) trong **SQL Editor** (Ctrl+A → Run). File này tạo bảng ghi lượt xem, dùng để giới hạn mỗi tài khoản mở 60 file/giờ và hiện bảng "Xem nhiều nhất" trong `/admin`.
- [x] **Allow new users to sign up = tắt** (đã kiểm tra).
- [ ] Không bao giờ gửi **Secret key** (`sb_secret_…`) cho ai. Nếu lỡ lộ: Project Settings → API Keys → tạo key mới, xóa key cũ, cập nhật lại trên Netlify.

### GitHub
- [ ] Để repo ở chế độ **Private**: repo → Settings → General → Danger Zone → Change visibility. Code không chứa mật khẩu, nhưng để private thì người ngoài không xem được cách web hoạt động.

### Bật xác thực 2 lớp (2FA) cho mọi tài khoản quản lý web
- [ ] Google (tài khoản chứa Drive và Google Cloud)
- [ ] GitHub
- [ ] Supabase
- [ ] Netlify
- [ ] SePay

---

## B. Deploy lên Netlify

### 1. Chuẩn bị biến môi trường
Trong `.env.local`, điền thêm (nếu chưa có):
- `NEXT_PUBLIC_ZALO=` (không bắt buộc) số Zalo hỗ trợ khách. Mặc định đã là `0908928517`, chỉ điền khi muốn đổi số khác.

Rồi chạy:
```bash
npm run netlify-env
```
Lệnh này tạo file **`netlify.env`** (đã được gitignore, không đẩy lên GitHub) chứa đúng các biến Netlify cần. Key Google được rút gọn để vừa giới hạn khoảng 4KB của Netlify.

### 2. Tạo site
1. Vào <https://app.netlify.com>, đăng nhập bằng GitHub.
2. **Add new site → Import an existing project → GitHub**, chọn repo **WebSheet-Tab**.
3. Phần build để mặc định. Netlify tự nhận ra đây là Next.js, đã có sẵn `netlify.toml`.
4. Bấm **Deploy**. Lần đầu có thể build lỗi vì chưa có biến môi trường, không sao.

### 3. Nhập biến môi trường
1. **Site configuration → Environment variables → Add a variable → Import from a .env file**.
2. Mở file `netlify.env` bằng Notepad, copy toàn bộ, dán vào rồi **Import variables**.
3. Với `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` và `SEPAY_API_KEY` (hoặc các key payOS): bấm vào từng biến, tick **Contains secret values**.
4. **Xóa file `netlify.env`** trên máy sau khi import xong. Cần thì chạy lại lệnh để tạo lại.

### 4. Địa chỉ web
1. Đổi tên site cho dễ nhớ: **Site configuration → Change site name**, ví dụ `khotab` thành `https://khotab.netlify.app`.
2. Thêm biến `NEXT_PUBLIC_SITE_URL` = địa chỉ đó (không có `/` ở cuối).
3. **Deploys → Trigger deploy → Deploy site** để build lại với địa chỉ mới.

### 5. Kiểm tra sau khi deploy
- [ ] Trang chủ hiện đủ bài từ Drive.
- [ ] Mở một bài khi chưa đăng nhập: thấy 1/3 đầu, phần dưới mờ.
- [ ] Đăng nhập `admin`: thấy nút **Quản trị**, xem được bài đầy đủ, có chữ in mờ.
- [ ] Mở `/admin` được.
- [ ] Tạo thử một tài khoản khách bằng số điện thoại khác. Xem trước được nhưng chưa xem đầy đủ được.
- [ ] Trên điện thoại: nhấn giữ vào sheet không hiện menu lưu ảnh.

Nếu build hoặc trang bị lỗi: Netlify → **Deploys** → bấm vào lần deploy lỗi → copy log gửi Claude.

---

## C. Thu tiền vào VietinBank

Tiền vào thẳng tài khoản VietinBank. Trang thanh toán hiện mã VietQR **có sẵn số tiền và nội dung chuyển khoản**, khách chỉ cần quét rồi bấm chuyển.
(payOS không liên kết được VietinBank. Nếu sau này đổi sang ngân hàng payOS hỗ trợ, xem README mục 3.)

### Cách 1: chuyển khoản tay (mặc định, 0đ)

Tiền vào tài khoản **VietinBank 0908928517 — HUYNH NHAT ANH** (đã cài sẵn trong code, muốn đổi tài khoản thì đặt `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`). Nội dung chuyển khoản cố định là **số điện thoại tài khoản của khách** (ví dụ `0901234567`).

1. Trên Netlify: đặt `PAYMENT_PROVIDER=manual` (hoặc xóa biến này đi, mặc định đã là `manual`) Trigger deploy lại. (Nút nhắn Zalo dùng số hỗ trợ `0908928517` có sẵn.)
2. Khi khách nhắn đã chuyển: mở app VietinBank, xem khoản **20.000đ**, nội dung là số điện thoại nào, chuyển lúc mấy giờ → vào `/admin`, gõ số điện thoại đó vào ô tìm kiếm (lọc luôn cả bảng đơn) → **Đơn gần đây**, đối chiếu cột **Thời gian** (giờ tạo đơn phải trước giờ tiền về) → bấm **Đã nhận tiền**. Gói được cộng 30 ngày ngay, trang thanh toán của khách tự báo thành công, doanh thu được tính.
3. **Mua thử gói 20.000đ** bằng một tài khoản khách:
   - [ ] Mã QR hiện đúng VietinBank, số tài khoản, 20.000đ, nội dung là số điện thoại của tài khoản khách.
   - [ ] Bấm **Đã nhận tiền** trong `/admin`, trang thanh toán của khách tự chuyển sang "Thanh toán thành công".
   - [ ] Trang Tài khoản hiện hạn dùng thêm 30 ngày, `/admin` thấy doanh thu tăng.

### Cách 2: SePay tự kích hoạt (khi đơn nhiều, không muốn bấm tay)

SePay theo dõi tài khoản VietinBank và báo về web khi có khoản chuyển đúng nội dung. Gói FREE có 50 giao dịch/tháng, vượt thì tính phí theo giao dịch (xem <https://sepay.vn/bang-gia.html>).

1. Đăng ký <https://my.sepay.vn> → **Ngân hàng → Kết nối tài khoản → tab Cá nhân → VietinBank**. Nhập số tài khoản, tên chủ tài khoản, CCCD và số điện thoại đăng ký với ngân hàng.
2. **Webhooks → Thêm webhook**:
   - URL: `https://<site của bạn>/api/payments/sepay`
   - Sự kiện: **Tiền vào**
   - Kiểu xác thực: **API Key**, tự đặt một chuỗi dài ngẫu nhiên và ghi lại.
3. Giữ các biến `BANK_*` ở cách 1, đổi `PAYMENT_PROVIDER=sepay` (nội dung chuyển khoản sẽ đổi thành `TAB<mã đơn>` để SePay tự nhận ra đơn) và thêm `SEPAY_API_KEY=<chuỗi ở bước 2>` (tick **Contains secret values**). Trigger deploy lại.
4. Mua thử: trả xong, web tự báo "Thanh toán thành công" mà không cần bấm gì trong `/admin`.

---

## C2. CI/CD — tự kiểm tra & tự deploy

Đã cài sẵn, không cần làm gì thêm ngoài 2 mục tick bên dưới:

- **CI (GitHub Actions — `.github/workflows/ci.yml`)**: mỗi lần đẩy code lên `main` hoặc mở Pull Request, GitHub tự **kiểm tra lỗi TypeScript** và **build thử**. Xem kết quả ở tab **Actions** của repo (✅ / ❌).
- **CD (Netlify)**: mỗi lần `main` có code mới, Netlify tự build và deploy. Netlify cũng chạy kiểm tra TypeScript trước khi build (`netlify.toml`); **build lỗi thì web vẫn giữ bản cũ đang chạy**, khách không bị ảnh hưởng.
- **Quay về bản trước** nếu bản mới có vấn đề: Netlify → **Deploys** → chọn bản cũ → **Publish deploy**.

Nên bật thêm:
- [ ] **Deploy Preview** cho Pull Request: Netlify → Site configuration → Build & deploy → Branches and deploy contexts → **Deploy Previews: Any pull request**. Mỗi PR có link xem thử riêng trước khi gộp vào `main`.
- [ ] (Tuỳ chọn) **Bắt buộc CI xanh mới được gộp PR**: GitHub repo → Settings → Branches → Add rule cho `main` → tick **Require status checks to pass** → chọn **check**.

---

## D. Vận hành hằng ngày

- **Thêm bài:** tạo thư mục bài trong `Solo/` hoặc `Melody/` trên Drive, bỏ PDF / `.gp` / ảnh vào. Khoảng 5 phút sau bài lên web, ở trang **Oliu Solo** (`/solo`) hoặc **Oliu Melody** (`/melody`). Mỗi thư mục cấp 1 trên Drive là một mục như vậy trên trang chủ.
- **Khách quên mật khẩu:** khách nhắn Zalo → `/admin` → tìm khách → nhập mật khẩu mới → **Đặt lại MK** → gửi mật khẩu cho khách và nhắc họ đổi lại.
- **Khách chuyển khoản tay hoặc bạn muốn tặng ngày:** `/admin` → **+30 ngày**.
- **File quá lớn (trên khoảng 6MB):** nén PDF hoặc ảnh trước khi up, vì Netlify không trả được file quá lớn.
