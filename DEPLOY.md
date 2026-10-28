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
- [ ] Không bao giờ gửi **Secret key** (`sb_secret_…`) cho ai. Nếu lỡ lộ: Project Settings → API Keys → tạo key mới, xóa key cũ, cập nhật lại trên Render.

### GitHub
- [ ] Để repo ở chế độ **Private**: repo → Settings → General → Danger Zone → Change visibility. Code không chứa mật khẩu, nhưng để private thì người ngoài không xem được cách web hoạt động.

### Bật xác thực 2 lớp (2FA) cho mọi tài khoản quản lý web
- [ ] Google (tài khoản chứa Drive và Google Cloud)
- [ ] GitHub
- [ ] Supabase
- [ ] Render
- [ ] SePay

---

## B. Deploy lên Cloudflare Workers

Web chạy trên **Cloudflare Workers** qua bộ chuyển **OpenNext** (cấu hình: [`wrangler.jsonc`](wrangler.jsonc), [`open-next.config.ts`](open-next.config.ts)). Không ngủ, không có máy chủ riêng phải lo; mỗi lượt xem chạy ở trung tâm dữ liệu Cloudflare gần khách nhất.

- **Chạy thật nên dùng gói Workers Paid (khoảng 5 USD/tháng).** Gói Free chỉ cho khoảng 10ms CPU mỗi lượt và code tối đa 3MB (nén). In tên vào PDF / ảnh / Guitar Pro cần nhiều CPU hơn thế, nên ở gói Free sẽ có lúc báo lỗi 1102 (vượt giới hạn). Gói Paid đã gồm 10 triệu request/tháng.
- **Thử trước bằng gói Free:** thêm build variable `OLIU_LITE` = `1` ở bước 2. Bản "lite" bỏ phần in tên vào file Guitar Pro (chữ mờ trên màn hình vẫn còn) để code còn khoảng 2,6MB, vừa gói Free. Khi lên gói Paid thì **xoá biến này** rồi deploy lại để có bản đầy đủ (khoảng 3MB).
- **Ảnh sheet** (quét 600 dpi, rất nặng) được dịch vụ **Cloudflare Images** thu nhỏ còn 1600px rồi mới in tên; mỗi ảnh chỉ thu nhỏ 1 lần rồi được lưu lại. Gói miễn phí của Images có 5.000 lượt xử lý/tháng, dư dùng.

### 1. Tạo tài khoản và bật gói
1. Đăng ký <https://dash.cloudflare.com>, **bật 2FA** (My Profile → Authentication).
2. **Workers & Pages → Plans** → chọn **Workers Paid** → thanh toán bằng thẻ Visa/Mastercard (bật thanh toán quốc tế trên thẻ). Chỉ thử thì bỏ qua bước này và dùng bản lite (xem trên).

### 2. Kết nối GitHub để tự deploy
1. **Workers & Pages → Create → Import a repository** → kết nối GitHub → chọn repo **WebSheet-Tab**.
2. Điền:
   - **Project name:** `oliu` (phải trùng `name` trong `wrangler.jsonc`)
   - **Branch:** `main`
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
3. Mở **Advanced settings → Build variables**, thêm (lấy giá trị trong `.env.local`):
   - `NODE_VERSION` = `22`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ZALO`
   - (chỉ khi thử bằng gói Free) `OLIU_LITE` = `1`
4. Bấm **Deploy**. Lần đầu mất vài phút. Xong web có địa chỉ dạng `https://oliu.<tên-tài-khoản>.workers.dev`.

### 3. Nạp biến bí mật (Supabase, Google…)
Trên máy, trong thư mục dự án:
```bash
npm run deploy-env
```
```bash
npx wrangler login
```
```bash
npx wrangler secret bulk cloudflare-secrets.json
```
Lệnh đầu tạo `cloudflare-secrets.json` (đã gitignore) từ `.env.local`; lệnh thứ hai mở trình duyệt để đăng nhập Cloudflare; lệnh cuối nạp toàn bộ biến vào Worker **oliu**. Xong thì **xoá `cloudflare-secrets.json`** và `deploy.env`.
(Hoặc nhập tay: Worker **oliu → Settings → Variables and Secrets → Add**, chọn loại **Secret**.)

### 4. Kiểm tra
Như mục "Kiểm tra sau khi deploy" bên dưới, trên địa chỉ `workers.dev`. Lỗi thì xem Worker **oliu → Logs** (đã bật sẵn), copy gửi Claude.

### 5. Tên miền riêng và chuyển hẳn sang Cloudflare
1. Mua tên miền trên Cloudflare (**Domain Registration → Register Domains**), hoặc chuyển DNS của tên miền đã có về Cloudflare.
2. Worker **oliu → Settings → Domains & Routes → Add → Custom domain** → nhập tên miền.
3. cron-job.org **không cần nữa**: Workers không ngủ, và việc dọn dẹp hằng ngày (`/api/health?db=1`) đã chạy bằng **Cron Trigger** của Cloudflare lúc 3 giờ sáng (xem `worker.ts`, `wrangler.jsonc`). Vào cron-job.org xoá (hoặc tắt) cả 2 cronjob.
4. Nếu dùng SePay: đổi URL webhook sang `https://<tên-miền>/api/payments/sepay`.
5. Báo khách địa chỉ mới, rồi tắt Render (Render → service **oliu** → Settings → **Suspend** hoặc **Delete**).

Chạy thử bản Cloudflare ngay trên máy (giống hệt môi trường Workers): tạo `.dev.vars` (cùng nội dung `.env.local`, đã gitignore) rồi `npm run preview`.

---

## B2. (Cũ) Deploy lên Render

Web chạy trên **Render** (<https://render.com>), cấu hình sẵn trong [`render.yaml`](render.yaml): gói **Free**, máy chủ Singapore, tự deploy mỗi khi `main` có code mới.

- **Gói Free** không giới hạn số lần deploy, nhưng **tự "ngủ" sau khoảng 15 phút không ai vào**. Người vào đầu tiên sau đó phải chờ khoảng 30–60 giây để web thức dậy, các lượt sau nhanh bình thường.
- Gói Free có 512MB RAM. Nếu sau này web hay bị khởi động lại (Render → **Events** báo *Out of memory*), hoặc muốn hết cảnh chờ web thức dậy, đổi sang gói **Starter** (khoảng 7 USD/tháng): service → **Settings → Instance type**.

### 1. Chuẩn bị biến môi trường
Chạy:
```bash
npm run deploy-env
```
Lệnh này tạo file **`deploy.env`** (đã được gitignore, không đẩy lên GitHub) từ `.env.local`, chứa đúng các biến web cần. Key Google được rút gọn còn 2 trường web dùng.

### 2. Tạo web trên Render
1. Vào <https://dashboard.render.com>, đăng nhập bằng GitHub.
2. **New → Blueprint**, chọn repo **WebSheet-Tab**. Render đọc `render.yaml` và tạo service **oliu**.
3. Render hỏi giá trị cho các biến bí mật (`DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PHONES`): mở `deploy.env` bằng Notepad, copy từng giá trị (phần sau dấu `=`, bỏ dấu `'` hai đầu) dán vào.
   - Hoặc: tạo xong thì vào service → **Environment → Add from .env**, dán toàn bộ `deploy.env`.
4. Bấm **Apply**. Lần build đầu mất vài phút. Xong thì web có địa chỉ dạng `https://oliu.onrender.com` (xem ở đầu trang service).
5. **Xóa file `deploy.env`** trên máy. Cần thì chạy lại lệnh để tạo lại.

Không cần đặt `NEXT_PUBLIC_SITE_URL`: web tự nhận địa chỉ từ trình duyệt. Muốn dùng tên miền riêng: service → **Settings → Custom Domains**.

### 3. Kiểm tra sau khi deploy
- [ ] Trang chủ hiện 2 thẻ Oliu Solo / Oliu Melody. Khi chưa đăng nhập, thẻ có nhãn **Chưa đăng ký gói**, bấm vào thì sang trang mua gói kèm thông báo.
- [ ] Đăng nhập `admin`: thấy nút **Quản trị**, bấm thẻ thấy đủ bài từ Drive, xem được bài đầy đủ, có chữ in mờ.
- [ ] Mở `/admin` được.
- [ ] Tạo thử một tài khoản khách bằng số điện thoại khác. Bấm thẻ Solo/Melody thì sang trang mua gói, chưa xem được bài.
- [ ] Trên điện thoại: nhấn giữ vào sheet không hiện menu lưu ảnh.

Nếu build hoặc trang bị lỗi: Render → service **oliu** → **Logs** (hoặc **Events** → bấm vào lần deploy lỗi) → copy log gửi Claude.

### 4. Tắt web cũ trên Netlify
Khi web trên Render chạy ổn: Netlify → site cũ → **Site configuration → Delete this site** (hoặc ít nhất **Build & deploy → Stop builds**), để khách không vào nhầm bản cũ.

---

## C. Thu tiền vào Techcombank

Tiền vào thẳng tài khoản Techcombank. Trang thanh toán hiện mã VietQR **có sẵn số tiền và nội dung chuyển khoản**, khách chỉ cần quét rồi bấm chuyển.
(Muốn dùng payOS thì xem README mục 3.)

### Cách 1: chuyển khoản tay (mặc định, 0đ)

Tiền vào tài khoản **Techcombank 9908928517 — HUYNH NHAT ANH** (đã cài sẵn trong code, muốn đổi tài khoản thì đặt `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`). Nội dung chuyển khoản cố định là **số điện thoại tài khoản của khách** (ví dụ `0901234567`).

1. `PAYMENT_PROVIDER=manual` đã đặt sẵn trong `render.yaml` (mặc định cũng là `manual`), không cần làm gì. (Nút nhắn Zalo dùng số hỗ trợ `0908928517` có sẵn.)
2. Khi khách nhắn đã chuyển: mở app Techcombank, xem khoản **20.000đ**, nội dung là số điện thoại nào, chuyển lúc mấy giờ → vào `/admin`, gõ số điện thoại đó vào ô tìm kiếm (lọc luôn cả bảng đơn) → **Đơn gần đây**, đối chiếu cột **Thời gian** (giờ tạo đơn phải trước giờ tiền về) → bấm **Đã nhận tiền**. Gói được cộng 30 ngày ngay, trang thanh toán của khách tự báo thành công, doanh thu được tính.
   - Mã QR của mỗi đơn chỉ dùng được **10 phút**. Quá 10 phút đơn biến mất với khách (khách bấm tạo đơn mới), còn trong `/admin` đơn hiện nhãn **Hết hạn** nhưng vẫn bấm **Đã nhận tiền** được trong 24 giờ, phòng khi khách chuyển sát giờ. Sau 24 giờ đơn chưa trả tự bị xoá khỏi database.
3. **Mua thử gói 20.000đ** bằng một tài khoản khách:
   - [ ] Mã QR hiện đúng Techcombank, số tài khoản, 20.000đ, nội dung là số điện thoại của tài khoản khách.
   - [ ] Bấm **Đã nhận tiền** trong `/admin`, trang thanh toán của khách tự chuyển sang "Thanh toán thành công".
   - [ ] Trang Tài khoản hiện hạn dùng thêm 30 ngày, `/admin` thấy doanh thu tăng.

### Cách 2: SePay tự kích hoạt (khi đơn nhiều, không muốn bấm tay)

SePay theo dõi tài khoản Techcombank và báo về web khi có khoản chuyển đúng nội dung. Gói FREE có 50 giao dịch/tháng, vượt thì tính phí theo giao dịch (xem <https://sepay.vn/bang-gia.html>).

1. Đăng ký <https://my.sepay.vn> → **Ngân hàng → Kết nối tài khoản → tab Cá nhân → Techcombank**. Nhập số tài khoản, tên chủ tài khoản, CCCD và số điện thoại đăng ký với ngân hàng.
2. **Webhooks → Thêm webhook**:
   - URL: `https://<site của bạn>/api/payments/sepay`
   - Sự kiện: **Tiền vào**
   - Kiểu xác thực: **API Key**, tự đặt một chuỗi dài ngẫu nhiên và ghi lại.
3. Giữ các biến `BANK_*` ở cách 1, đổi `PAYMENT_PROVIDER=sepay` (nội dung chuyển khoản sẽ đổi thành `TAB<mã đơn>` để SePay tự nhận ra đơn) và thêm `SEPAY_API_KEY=<chuỗi ở bước 2>` trong Render → service → **Environment** (lưu xong Render tự deploy lại).
4. Mua thử: trả xong, web tự báo "Thanh toán thành công" mà không cần bấm gì trong `/admin`.

---

## C2. CI/CD — tự kiểm tra & tự deploy

Đã cài sẵn, không cần làm gì thêm ngoài mục tick bên dưới:

- **CI (GitHub Actions — `.github/workflows/ci.yml`)**: mỗi lần đẩy code lên `main` hoặc mở Pull Request, GitHub tự **kiểm tra lỗi TypeScript** và **build thử**. Xem kết quả ở tab **Actions** của repo (✅ / ❌).
- **CD (Render)**: mỗi lần `main` có code mới, Render tự build và deploy (kiểm tra TypeScript trước khi build, xem `render.yaml`); **build lỗi thì web vẫn giữ bản cũ đang chạy**, khách không bị ảnh hưởng.
- **Quay về bản trước** nếu bản mới có vấn đề: Render → service **oliu** → **Events** → chọn lần deploy cũ → **Rollback**.

Nên bật thêm:
- [ ] (Tuỳ chọn) **Bắt buộc CI xanh mới được gộp PR**: GitHub repo → Settings → Branches → Add rule cho `main` → tick **Require status checks to pass** → chọn **check**.

---

## D. Vận hành hằng ngày

- **Thêm bài:** tạo thư mục bài trong `Solo/` hoặc `Melody/` trên Drive, bỏ PDF / `.gp` / ảnh vào. Đặt tên file theo phần (`INTRO …`, `SOLO …`) để nút trên web ghi đúng tên phần. Có video hướng dẫn / backing track trên YouTube thì thêm file `video.txt` / `backing.txt` chứa link (xem README, mục "Cách xếp file trên Drive"). Khoảng 5 phút sau bài lên web, ở trang **Oliu Solo** (`/solo`) hoặc **Oliu Melody** (`/melody`). Mỗi thư mục cấp 1 trên Drive là một mục như vậy trên trang chủ.
- **Yêu cầu bài:** khách có gói gửi ở trang `/yeu-cau` (2 lượt/tháng, đổi bằng biến `SONG_REQUESTS_PER_MONTH`). Trong `/admin` → **Yêu cầu bài**: up bài lên Drive rồi bấm **Đã xong**, hoặc **Từ chối** kèm lý do (khách được trả lại lượt). Cần chạy `supabase/migrations/005_song_requests.sql` một lần.
- **Lưu lượng:** `/admin` → **Lưu lượng** cho biết số tài khoản online, vào web hôm nay, lượt mở sheet 1 giờ qua. Tổng request và lỗi (kể cả khách chưa đăng nhập) xem ở Cloudflare → Workers & Pages → **oliu** → **Metrics**; lỗi "Exceeded CPU" (1102) khi đông người nghĩa là nên lên Workers Paid.
- **Khách quên mật khẩu:** khách nhắn Zalo → `/admin` → tìm khách → nhập mật khẩu mới → **Đặt lại MK** → gửi mật khẩu cho khách và nhắc họ đổi lại.
- **Khách chuyển khoản tay hoặc bạn muốn tặng ngày:** `/admin` → **+30 ngày**.
- **File lớn:** PDF/ảnh vài chục MB vẫn mở được nhưng chậm và tốn RAM của máy chủ (gói Free chỉ 512MB), nên nén bớt trước khi up.
