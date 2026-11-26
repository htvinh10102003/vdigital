# VDigital — Shop bán tài khoản bản quyền số, thẻ game & công cụ

Shop của Vinh: bán tài khoản bản quyền số (Microsoft 365, ChatGPT, Canva, CapCut,
YouTube Premium, Gemini Pro, Muse AI…), thẻ game (Garena, Zing) và nhiều sản phẩm số khác.
Bố cục học theo MaKHive (chỉ học bố cục/tính năng — **không copy logo, ảnh, tên thương
hiệu hay nội dung của họ**). Toàn bộ thương hiệu trong repo này là VDigital, ảnh sản phẩm
là gradient + chữ cái đầu, không dùng logo của hãng khác.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase + PayOS VietQR**,
deploy trên Vercel. Project riêng, không dùng chung Supabase của Our Days hay AWSAMELIE.

## Tính năng

- **Trang khách:** trang chủ (hero carousel, Flash Sale đếm ngược từng sản phẩm, nổi bật /
  mới / bán chạy, 3 bước mua hàng, cam kết, FAQ, phương thức thanh toán), danh sách
  `/san-pham` (lọc danh mục phân cấp + tình trạng + khoảng giá, 6 kiểu sắp xếp, tìm kiếm,
  phân trang), chi tiết `/{danh-muc}/{slug}` (chọn gói theo thời hạn/mệnh giá, giá đổi theo
  gói, 3 tab Mô tả / Hướng dẫn / Đánh giá, sản phẩm tương tự), giỏ hàng (localStorage),
  tài khoản (đăng nhập/đăng ký modal, Google OAuth, Đơn hàng của tôi + tra đơn bằng mã đơn).
- **Thanh toán tự động PayOS VietQR:** tạo đơn có mã riêng → mã VietQR động đúng số tiền →
  webhook verify chữ ký HMAC-SHA256 bằng `PAYOS_CHECKSUM_KEY` **trước** khi đánh dấu đã
  thanh toán → giao hàng. PayOS **miễn phí, 0% / giao dịch**, tiền về thẳng tài khoản ngân
  hàng đã liên kết (ở đây là **MB Bank**), không qua trung gian giữ tiền.
- **Giao hàng theo loại gói (`fulfillment_type`):**
  - `auto` — mã/tài khoản có sẵn trong kho (`stock_codes`): giao ngay sau khi tiền về,
    hiện trong đơn hàng + gửi mail.
  - `manual` — add Family / nâng cấp chính chủ: đơn chuyển sang **Chờ xử lý**, admin làm
    tay rồi bấm **Hoàn thành** trong `/admin` (gửi mail báo hoàn thành).
  - `game_card` — thẻ game: admin mở đơn, điền **serial + mã**, mệnh giá tự điền theo gói
    (sửa được), bấm **Giao + gửi mail** — mail mẫu tiếng Việt gửi cho khách.
- **Mail tự động:** Gmail riêng của shop qua SMTP + App Password (Nodemailer). Xem mục
  "Cấu hình mail" bên dưới. **Chưa có mail thì đơn vẫn hoàn tất** — chỉ ghi log là mail
  chưa gửi được, không bao giờ chặn luồng mua hàng vì thiếu mail.
- **Admin `/admin`:** không có link công khai từ header/footer. Chỉ email trong
  `ADMIN_EMAILS` (đăng nhập qua Supabase Auth) mới vào được. Có dashboard doanh thu/đơn
  chờ xử lý, quản lý đơn (giao thẻ game, hoàn thành đơn tay), sửa sản phẩm/giá/gói/Flash
  Sale, thêm mã vào kho (dán danh sách), xem trạng thái PayOS/mail/ngân hàng (key đã che).

## Chạy local (chế độ demo — không cần Supabase/PayOS)

```bash
cd vdigital
npm install
npm run dev        # mở http://localhost:3000
npm run build      # kiểm tra build
npm run test:flows # kiểm tra nhanh các luồng chính (cần server đang chạy ở :3000)
```

Chế độ demo dùng dữ liệu seed trong `lib/seed.ts`, đơn hàng lưu trong bộ nhớ server,
thanh toán hiện thông tin chuyển khoản MB Bank + nút **"Mô phỏng: tôi đã chuyển khoản"**
để thử luồng giao hàng. Đăng nhập demo bằng email bất kỳ; vào `/admin` bằng nút
**"Vào admin demo"**. Mã kho demo có tiền tố `VD-DEMO-` — phải thay bằng mã thật
trong `/admin` → Kho mã trước khi bán thật.

## 1. Tạo Supabase project

1. Vào https://supabase.com → New project (đặt tên vd `vdigital`).
2. Vào **SQL Editor** → chạy lần lượt 2 file (copy toàn bộ nội dung rồi Run):
   - `supabase/migrations/001_schema.sql` — bảng + RLS
   - `supabase/migrations/002_seed.sql` — danh mục, 13 sản phẩm, gói, banner, FAQ, mã kho demo
3. Vào **Authentication → Providers → Google** → bật Google (lấy Client ID/Secret từ
   Google Cloud Console) nếu muốn đăng nhập bằng Google. Email/password đã bật mặc định.
4. Vào **Settings → API** → copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (chỉ nhập vào Vercel env, **không**
     commit, không gửi trong chat)
5. Tạo tài khoản admin: đăng ký 1 tài khoản bằng email của Vinh trên web (sau khi deploy
   hoặc local), rồi đặt email đó vào `ADMIN_EMAILS`.

## 2. Đăng ký PayOS + liên kết MB Bank

1. Vào https://my.payos.vn → đăng ký bằng CCCD (cá nhân được), liên kết **tài khoản MB Bank**
   nhận tiền.
2. Tạo kênh thanh toán → lấy `Client ID`, `API Key`, `Checksum Key`.
3. Trong PayOS dashboard → **Webhook** → đăng ký URL:
   `https://<domain-vercel-cua-ban>/api/payos/webhook`
4. Nhập 3 key vào env (xem mục 4). PayOS không thu phí giao dịch; tiền khách chuyển về
   thẳng tài khoản MB Bank của Vinh.

## 3. Cấu hình mail — Gmail riêng của shop (SMTP + App Password)

**Nên dùng Gmail RIÊNG cho shop, chỉ để gửi mail tự động — không dùng Gmail cá nhân.**

1. Tạo 1 Gmail mới cho shop (vd `vdigital.shop@gmail.com` — địa chỉ cụ thể Vinh sẽ tạo sau).
2. Trên tài khoản Gmail shop đó: bật **xác minh 2 bước (2FA)**:
   myaccount.google.com → Bảo mật → Xác minh 2 bước → bật.
3. Vẫn trong mục Bảo mật → **Mật khẩu ứng dụng (App passwords)** → tạo mới
   (đặt tên vd `VDigital`) → Google cho **16 ký tự**.
4. Nhập vào env:
   - `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`
   - `SMTP_USER=<Gmail riêng của shop>`
   - `SMTP_PASS=<App Password 16 ký tự>` — **chỉ nhập qua trang nhập an toàn / Vercel env,
     KHÔNG gửi trong chat, KHÔNG ghi vào code hay file.**
   - `EMAIL_FROM=VDigital <Gmail-shop>`
5. Mail tự động gửi khi: (1) đơn thanh toán xong + giao tự động, (2) admin giao thẻ game,
   (3) admin hoàn thành đơn làm tay. Mẫu mail tiếng Việt có tên sản phẩm, mã đơn,
   serial/mã, mệnh giá, hướng dẫn dùng, bảo hành.
6. **Chưa có SMTP_PASS thì đơn vẫn hoàn tất** — hệ thống chỉ log "mail chưa gửi được".

## 4. Biến môi trường (Vercel)

Copy `.env.example` → `.env.local` (local) và nhập vào Vercel → Project → Settings →
Environment Variables:

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only**, không lộ ra client |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | Từ my.payos.vn |
| `NEXT_PUBLIC_SITE_URL` | vd `https://vdigital.vercel.app` |
| `MB_BANK_NAME` / `MB_BANK_ACCOUNT` / `MB_BANK_ACCOUNT_NAME` | MB Bank nhận tiền |
| `ADMIN_EMAILS` | Email admin, phân tách bằng dấu phẩy |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Cùng danh sách (chỉ để ẩn/hiện UI) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Gmail shop + App Password (mục 3) |

## 5. Deploy Vercel

```bash
# Cách 1: push repo lên GitHub rồi import vào https://vercel.com (khuyên dùng)
# Cách 2: Vercel CLI
npx vercel
```

Nhập đủ env ở mục 4 rồi deploy. Sau deploy: đăng ký tài khoản admin, vào `/admin`
kiểm tra tab Cài đặt (PayOS/mail/ngân hàng đã cấu hình chưa), thay mã kho demo bằng mã thật,
sửa giá/mô tả sản phẩm nếu cần — rồi mới mở bán.

## 6. Domain (sau này)

Domain chưa mua. Khi Vinh chốt tên miền thì mua và gắn vào Vercel → Settings → Domains,
sau đó sửa `NEXT_PUBLIC_SITE_URL` thành domain thật và cập nhật lại Webhook URL trong
PayOS dashboard + Return URL (tự lấy theo `NEXT_PUBLIC_SITE_URL`).

## Cấu trúc code

```
app/
  page.tsx                    Trang chủ
  san-pham/                   Danh sách + lọc/sắp xếp/tìm kiếm
  [category]/[slug]/          Chi tiết sản phẩm (chọn gói đổi giá)
  gio-hang/  thanh-toan/      Giỏ hàng, checkout VietQR PayOS
  tai-khoan/                  Đơn hàng của tôi / quản lý tài khoản
  admin/                      Quản trị (không link công khai)
  api/
    catalog/                  GET catalog (Supabase hoặc seed)
    payos/create-payment/     Tạo đơn + link PayOS
    payos/webhook/            Verify chữ ký rồi giao hàng
    orders/[code]/            Tra đơn theo mã
    admin/orders|stock|settings/  API admin (kiểm tra quyền)
components/                   Header, Footer, ProductCard, AuthModal, providers (auth/cart/catalog)
lib/
  seed.ts                     Dữ liệu seed (dùng khi chưa có Supabase)
  store.ts                    Tầng dữ liệu: Supabase hoặc demo (bộ nhớ server)
  payos.ts                    Chữ ký HMAC-SHA256 + tạo link PayOS
  fulfill.ts                  Giao hàng auto / manual / game_card
  email.ts                    Nodemailer Gmail SMTP + mẫu mail
  supabase.ts / admin-auth.ts
supabase/migrations/          001_schema.sql, 002_seed.sql
scripts/test-flows.mjs        Kiểm tra nhanh các luồng chính
```

## Kiểm tra nhanh (sau khi chạy server)

```bash
npm run test:flows   # mặc định http://localhost:3000, hoặc BASE_URL=https://... npm run test:flows
```

Script kiểm tra: trang chủ, danh sách, chi tiết CapCut Pro, `/api/catalog`, tạo đơn demo,
webhook từ chối body sai, webhook demo giao hàng tự động (mã `auto` hiện trong đơn),
`/admin` render, API admin không có quyền trả 403.

## Lưu ý

- Không commit `.env.local` hay bất kỳ key/mật khẩu/App Password nào.
- Mã kho demo (`VD-DEMO-…`) chỉ để thử luồng — thay bằng mã thật trước khi bán.
- Webhook PayOS **bắt buộc verify chữ ký** — code đã làm, đừng bỏ bước này.
- Trang `/admin` không có link công khai; chỉ người biết URL + đúng email admin mới vào được.
