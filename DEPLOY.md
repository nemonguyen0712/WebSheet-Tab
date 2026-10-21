# Deploy & bảo mật — checklist

Làm lần lượt từ trên xuống. Tick `[x]` khi xong.

---

## A. Bảo mật — làm TRƯỚC khi deploy

### Tài khoản admin
- [ ] Đăng nhập web bằng tài khoản `admin` (mật khẩu trong file `.admin-login.txt`).
- [ ] Vào **Tài khoản → Đổi mật khẩu**, đặt mật khẩu riêng của bạn (dài, không dùng lại ở chỗ khác).
- [ ] **Xóa file `.admin-login.txt`**.

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
- [x] **Allow new users to sign up = tắt** (đã kiểm tra).
- [ ] Không bao giờ gửi **Secret key** (`sb_secret_…`) cho ai. Nếu lỡ lộ: Project Settings → API Keys → tạo key mới, xóa key cũ, cập nhật lại trên Netlify.

### GitHub
- [ ] Để repo ở chế độ **Private**: repo → Settings → General → Danger Zone → Change visibility. Code không chứa mật khẩu, nhưng để private thì người ngoài không xem được cách web hoạt động.

### Bật xác thực 2 lớp (2FA) cho mọi tài khoản quản lý web
- [ ] Google (tài khoản chứa Drive và Google Cloud)
- [ ] GitHub
- [ ] Supabase
- [ ] Netlify
- [ ] payOS

---

## B. Deploy lên Netlify

### 1. Chuẩn bị biến môi trường
Trong `.env.local`, điền thêm (nếu chưa có):
- `NEXT_PUBLIC_ZALO=` số Zalo hỗ trợ khách, ví dụ `0901234567`

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
3. Với `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` và các key payOS: bấm vào từng biến, tick **Contains secret values**.
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

## C. payOS — để bắt đầu thu tiền

1. Đăng ký <https://payos.vn>, liên kết tài khoản ngân hàng. Gói miễn phí hiện áp dụng với **Kiên Long Bank / MSB**.
2. Tạo **kênh thanh toán**, lấy **Client ID, API Key, Checksum Key**.
3. Thêm 3 biến trên Netlify: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (tick *Contains secret values*). Điền luôn vào `.env.local` để chạy thử trên máy. Trigger deploy lại.
4. Trong payOS, đặt **Webhook URL** = `https://<site của bạn>/api/payments/payos`.
5. **Mua thử gói 20.000đ** bằng một tài khoản khách:
   - [ ] Trả xong, web tự báo "Thanh toán thành công".
   - [ ] Trang Tài khoản hiện hạn dùng thêm 30 ngày.
   - [ ] `/admin` thấy đơn ở trạng thái "Đã thanh toán", doanh thu tăng.

---

## D. Vận hành hằng ngày

- **Thêm bài:** tạo thư mục bài trong `Solo/` hoặc `Melody/` trên Drive, bỏ PDF / `.gp` / ảnh vào. Khoảng 5 phút sau bài lên web.
- **Khách quên mật khẩu:** khách nhắn Zalo → `/admin` → tìm khách → nhập mật khẩu mới → **Đặt lại MK** → gửi mật khẩu cho khách và nhắc họ đổi lại.
- **Khách chuyển khoản tay hoặc bạn muốn tặng ngày:** `/admin` → **+30 ngày**.
- **File quá lớn (trên khoảng 6MB):** nén PDF hoặc ảnh trước khi up, vì Netlify không trả được file quá lớn.
