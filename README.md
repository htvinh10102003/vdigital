# VDigital — Shop bán tài khoản bản quyền số, thẻ game & công cụ

Shop của Vinh: bán tài khoản bản quyền số (Microsoft 365, ChatGPT, Canva, CapCut,
YouTube Premium, Gemini Pro, Muse AI…), thẻ game (Garena, Zing) và nhiều sản phẩm số khác.
Giao diện là bản sắc riêng của VDigital — nền tối hiện đại, sidebar trái, hero + giỏ hàng
cạnh nhau, danh mục icon tròn, card sản phẩm nút “Mua ngay” tím. **Không copy bố cục,
màu sắc, header, hero hay card của MaKHive hay bất kỳ shop nào khác** — chỉ học ý tưởng
tính năng chung. Toàn bộ thương hiệu trong repo này là VDigital, ảnh sản phẩm do admin
tự up lên (hoặc ô màu + chữ viết tắt), không dùng logo/ảnh của hãng khác.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase + PayOS VietQR**,
deploy trên Vercel. Project riêng, không dùng chung Supabase của Our Days hay AWSAMELIE.

## Tính năng

- **Trang khách:** trang chủ **render phía server** (sản phẩm có sẵn trong HTML đầu tiên,
  không còn “Đang tải sản phẩm…” 10–15s): hero + panel giỏ hàng, danh mục phổ biến dạng
  icon tròn, Flash Sale đếm ngược, sản phẩm nổi bật / thẻ game / bán chạy / mới (mỗi sản
  phẩm chỉ xuất hiện đúng 1 lần trên trang), 3 bước mua hàng, FAQ, phương thức thanh toán.
  Danh sách `/san-pham` (lọc danh mục phân cấp + tình trạng + khoảng giá, 6 kiểu sắp xếp,
  tìm kiếm, phân trang), chi tiết `/{danh-muc}/{slug}` (chọn gói bằng **pill selector**:
  mệnh giá thẻ game 20K/50K/100K/200K/500K, thời hạn, gói token… — giá và tồn kho đổi theo
  gói đã chọn), giỏ hàng (localStorage), tài khoản (đăng nhập/đăng ký modal, Google OAuth,
  Đơn hàng của tôi + tra đơn bằng mã đơn, đổi mật khẩu).
- **Thẻ game — 1 sản phẩm / 1 hãng:** “Thẻ Garena” và “Thẻ Zing” mỗi loại chỉ có đúng 1
  card ở mọi nơi (trang chủ, `/san-pham`, tìm kiếm, bán chạy, flash sale). Mệnh giá chọn
  ở trang chi tiết, không tách thành nhiều card.
- **Thanh toán tự động PayOS VietQR:** tạo đơn có mã riêng → mã VietQR động đúng số tiền →
  webhook verify chữ ký HMAC-SHA256 bằng `PAYOS_CHECKSUM_KEY` **trước** khi đánh dấu đã
  thanh toán → giao hàng. PayOS **miễn phí, 0% / giao dịch**, tiền về thẳng tài khoản ngân
  hàng đã liên kết (ở đây là **MB Bank**), không qua trung gian giữ tiền.
- **Giao hàng theo loại gói (`fulfillment_type` — đặt riêng từng gói trong admin):**
  - `auto` — mã/tài khoản có sẵn trong kho (`stock_codes`): giao ngay sau khi tiền về,
    hiện trong đơn hàng + gửi mail.
  - `manual` — add Family / nâng cấp chính chủ: đơn chuyển sang **Chờ xử lý**, admin làm
    tay rồi bấm **Hoàn thành** trong `/admin` (gửi mail báo hoàn thành).
  - `game_card` — thẻ game: admin mở đơn, điền **serial + mã**, mệnh giá tự điền theo gói
    (sửa được), bấm **Giao + gửi mail** — mail mẫu tiếng Việt gửi cho khách.
  - `link` — giao link/key theo **mẫu giao hàng** admin đặt (có thể chứa `{code}`), giao
    ngay sau khi thanh toán.
- **Mail tự động:** Gmail riêng của shop qua SMTP + App Password (Nodemailer). Xem mục
  "Cấu hình mail" bên dưới. **Chưa có mail thì đơn vẫn hoàn tất** — chỉ ghi log là mail
  chưa gửi được, không bao giờ chặn luồng mua hàng vì thiếu mail.
- **Admin `/admin` (tùy biến sau này, không cần sửa code):** không có link công khai.
  Chỉ email trong `ADMIN_EMAILS` (đăng nhập qua Supabase Auth) mới vào được. Có dashboard
  doanh thu/đơn chờ xử lý, quản lý đơn (giao thẻ game, hoàn thành đơn tay), **editor sản
  phẩm đầy đủ**: loại sản phẩm (tài khoản / thẻ game / công cụ / khác), loại tài khoản
  (dùng chung / nâng cấp chính chủ / add Family / key bản quyền / link kích hoạt / thẻ
  game / khác), từng gói có loại lựa chọn (thời hạn / mệnh giá / gói token / số ghế /
  tự đặt tên + nhãn riêng), cách giao hàng riêng từng gói, giá/gốc, tồn kho, Flash Sale +
  giờ kết thúc, bảo hành, mô tả, hướng dẫn, mẫu + ghi chú giao hàng riêng từng gói, danh
  mục, cờ nổi bật/mới/bán chạy/đang bán, **upload ảnh bìa**, thêm/xoá gói, tạo sản phẩm
  mới. Ngoài ra quản lý **danh mục, banner, FAQ** (kèm upload ảnh banner/danh mục) và
  **kho mã** (dán danh sách), tab **Cài đặt** hiện rõ từng biến môi trường nào đã cấu hình
  (chỉ tên + có/không, không hiện giá trị) + đổi mật khẩu admin.

## Ảnh sản phẩm — admin tự up (Supabase Storage)

1. **Bucket:** `vdigital-media` — tạo bằng migration `003_admin_customization.sql`
   (chạy trong Supabase SQL Editor sau 001 + 002). Bucket **public read** (ai cũng xem
   được ảnh trên trang bán hàng), chỉ server (service_role) mới ghi/xóa được.
   Nếu chưa chạy migration 003, up ảnh sẽ lỗi — chạy migration trước rồi up lại.
2. **Up ảnh trong admin:** vào `/admin` → tab **Sản phẩm** → chọn sản phẩm → mục
   **“Ảnh bìa sản phẩm”** → bấm vào ô (hoặc kéo-thả file) → chọn ảnh → ảnh tự nén/resize
   về WebP rồi up lên Storage, URL lưu vào DB (`image_url`). Banner và danh mục up tương
   tự ở tab **Danh mục · Banner · FAQ**.
3. **Kích thước khuyến nghị:** sản phẩm **800×800**, banner **1200×600**, danh mục
   **400×400** — admin up ảnh gốc lớn hơn cũng được, trình duyệt tự nén về cỡ này trước
   khi up. Hiển thị bằng `next/image` (đúng kích thước, lazy loading).
4. **Chưa có ảnh:** sản phẩm hiện ô màu gradient + chữ viết tắt (như cũ) — không dùng
   logo/ảnh của hãng khác. Ảnh **không** lưu base64 vào DB và **không** commit vào repo.

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
2. Vào **SQL Editor** → chạy lần lượt 3 file (copy toàn bộ nội dung rồi Run):
   - `supabase/migrations/001_schema.sql` — bảng + RLS
   - `supabase/migrations/002_seed.sql` — danh mục, 13 sản phẩm, gói, banner, FAQ, mã kho demo
   - `supabase/migrations/003_admin_customization.sql` — cột tùy biến admin (loại tài khoản,
     loại lựa chọn, mẫu giao hàng, ảnh sản phẩm) + bucket Storage `vdigital-media` (public read)
3. Vào **Authentication → Providers → Google** → bật Google (lấy Client ID/Secret từ
   Google Cloud Console) nếu muốn đăng nhập bằng Google. Email/password đã bật mặc định.
4. Vào **Settings → API** → copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (chỉ nhập vào Vercel env, **không**
     commit, không gửi trong chat)
5. **Tài khoản admin — đăng nhập lần đầu:**
   - Email admin mặc định: **contact.hotavinh@gmail.com** (đã đặt trong `ADMIN_EMAILS` /
     `NEXT_PUBLIC_ADMIN_EMAILS` và làm mặc định trong code khi env chưa có).
   - Đăng ký tài khoản admin bằng email đó trên web (trang đăng nhập → Đăng ký), đặt mật
     khẩu tạm ban đầu, rồi đăng nhập vào `/admin`.
   - ⚠️ **Mật khẩu tạm ban đầu rất yếu, chỉ dùng để vào lần đầu — phải đổi ngay** trong
     `/admin` → tab **Cài đặt** → “Đổi mật khẩu admin” (hoặc trang Tài khoản → Quản lý tài
     khoản → Đổi mật khẩu), sang mật khẩu mạnh (ít nhất 8 ký tự, có chữ + số). Không ghi
     mật khẩu vào code, file hay chat.

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

## 4. Biến môi trường (Vercel) — chẩn đoán lỗi demo-mode

**Vấn đề đã gặp (26/11):** live `/admin` báo “Chế độ demo (chưa cấu hình Supabase)” dù đã
link Supabase trong Vercel. Nguyên nhân: code cũ chỉ đọc đúng 2 tên
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, trong khi Vercel Supabase
integration có thể tạo biến với tên **không có tiền tố `NEXT_PUBLIC_`** (`SUPABASE_URL` /
`SUPABASE_ANON_KEY`) hoặc dùng **key publishable mới** (`sb_publishable_...`) thay cho anon
JWT cũ — khi đó code cũ vẫn coi như “chưa cấu hình” và rơi về demo.

**Đã sửa:** `lib/supabase.ts` chấp nhận **cả hai kiểu tên** (ưu tiên `NEXT_PUBLIC_*`, rồi
`SUPABASE_*`, rồi key publishable), và tab **Cài đặt** trong `/admin` hiện rõ từng biến
nào đã có (tên + Đã có/Thiếu) cùng nguồn URL/key đang dùng, nên lỗi này sẽ thấy ngay
thay vì im lặng rơi về demo.

Copy `.env.example` → `.env.local` (local) và nhập vào Vercel → Project → Settings →
Environment Variables (Secret = mật khẩu/key/token; Config = giá trị thường như host/port/email):

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` (hoặc `SUPABASE_URL`) | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (hoặc `SUPABASE_ANON_KEY` / key publishable) | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` (hoặc `SUPABASE_SECRET_KEY`) | **Server-only**, không lộ ra client — cần cho upload ảnh + ghi kho/đơn |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | Từ my.payos.vn |
| `NEXT_PUBLIC_SITE_URL` | vd `https://vdigital.vercel.app` |
| `MB_BANK_NAME` / `MB_BANK_ACCOUNT` / `MB_BANK_ACCOUNT_NAME` | MB Bank nhận tiền |
| `ADMIN_EMAILS` | Email admin, mặc định `contact.hotavinh@gmail.com` |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Cùng danh sách (chỉ để ẩn/hiện UI) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Gmail shop + App Password (mục 3) |

## 5. Deploy Vercel

```bash
# Cách 1: push repo lên GitHub rồi import vào https://vercel.com (khuyên dùng)
# Cách 2: Vercel CLI
npx vercel
```

Nhập đủ env ở mục 4 rồi deploy. Sau deploy: đăng ký tài khoản admin (mục 1.5), vào `/admin`
kiểm tra tab Cài đặt (Supabase/PayOS/mail đã cấu hình chưa), chạy migration 003 nếu chưa,
thay mã kho demo bằng mã thật, up ảnh sản phẩm — rồi mới mở bán.

## 6. Domain (sau này)

Domain chưa mua. Khi Vinh chốt tên miền thì mua và gắn vào Vercel → Settings → Domains,
sau đó sửa `NEXT_PUBLIC_SITE_URL` thành domain thật và cập nhật lại Webhook URL trong
PayOS dashboard + Return URL (tự lấy theo `NEXT_PUBLIC_SITE_URL`).

## 7. Khắc phục sự cố

### Lỗi: "Lưu đơn vào Supabase thất bại: permission denied for table orders"

**Nguyên nhân (đã xác minh 26/11):** `SUPABASE_SERVICE_ROLE_KEY` chưa có trên Vercel nên
server rơi về dùng anon key. Bảng `orders` chỉ có policy SELECT cho chủ đơn
("owner read orders"), **không có policy INSERT cho anon** — theo đúng thiết kế
(đã kiểm tra live toàn bộ policy: products/variants/categories/banners/faqs đọc
công khai, reviews auth insert, stock_codes không có policy công khai).

**Cách sửa đúng:** lấy key `service_role` ở Supabase → Settings → API, thêm vào
Vercel → Project → Settings → Environment Variables với tên
`SUPABASE_SERVICE_ROLE_KEY` (dạng **Secret**), rồi **Redeploy**. Xong kiểm tra tab
Cài đặt trong `/admin` — dòng service_role phải hiện "Đã có", nếu thiếu sẽ có
cảnh báo đỏ ở đầu tab.

**Không làm thế này:** đừng thêm policy INSERT cho anon/authenticated trên bảng
`orders` — ai cũng ghi được đơn giả vào DB. Code đã được sửa để khi thiếu key
thì báo rõ "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên Vercel — đơn chưa được
lưu..." thay vì báo RLS khó hiểu (xem `lib/supabase.ts` →
`requireServiceRoleForWrite()`).

### Live /admin báo "Chế độ demo" dù đã link Supabase

Xem mục 4 — Vercel integration có thể tạo biến tên không có `NEXT_PUBLIC_`
hoặc key publishable; code đã chấp nhận cả hai kiểu tên.

## Cấu trúc code

```
app/
  layout.tsx                  Server layout: lấy catalog, sidebar + header 1 tầng
  page.tsx                    Trang chủ (server): hero + giỏ hàng, danh mục icon tròn, các section không trùng sản phẩm
  san-pham/                   Danh sách + lọc/sắp xếp/tìm kiếm
  [category]/[slug]/          Chi tiết sản phẩm (pill selector đổi giá)
  gio-hang/  thanh-toan/      Giỏ hàng, checkout VietQR PayOS
  tai-khoan/                  Đơn hàng của tôi / quản lý tài khoản / đổi mật khẩu
  admin/                      Quản trị (không link công khai): đơn, sản phẩm, kho mã, danh mục/banner/FAQ, cài đặt + đổi mật khẩu
  api/
    catalog/                  GET catalog (Supabase hoặc seed)
    payos/create-payment/     Tạo đơn + link PayOS
    payos/webhook/            Verify chữ ký rồi giao hàng
    orders/[code]/            Tra đơn theo mã
    admin/orders|stock|settings|upload/  API admin (kiểm tra quyền; upload lên Storage)
components/                   AppShell (sidebar + header), ProductCard, ProductDetail,
                              ProductImage (next/image + fallback), ImageUpload (nén WebP),
                              RightRail (giỏ hàng/trust/follow), FaqAccordion, AuthModal,
                              providers (auth/cart/catalog, theme sáng/tối)
lib/
  seed.ts                     Dữ liệu seed (dùng khi chưa có Supabase)
  store.ts                    Tầng dữ liệu: Supabase hoặc demo (bộ nhớ server)
  catalog-utils.ts            Chia section không trùng, pill label, đường dẫn chi tiết
  payos.ts                    Chữ ký HMAC-SHA256 + tạo link PayOS
  fulfill.ts                  Giao hàng auto / manual / game_card / link
  email.ts                    Nodemailer Gmail SMTP + mẫu mail
  storage.ts                  Upload Supabase Storage bucket vdigital-media
  supabase.ts / admin-auth.ts
supabase/migrations/          001_schema.sql, 002_seed.sql, 003_admin_customization.sql
scripts/test-flows.mjs        Kiểm tra nhanh các luồng chính
```

## Kiểm tra nhanh (sau khi chạy server)

```bash
npm run test:flows   # mặc định http://localhost:3000, hoặc BASE_URL=https://... npm run test:flows
```

Script kiểm tra: trang chủ **render sản phẩm trong HTML đầu tiên** (không chờ client),
Garena/Zing mỗi loại đúng 1 card ở trang chủ và `/san-pham`, chi tiết CapCut Pro,
`/api/catalog`, tạo đơn demo, webhook từ chối body sai, webhook demo giao hàng tự động
(mã `auto` hiện trong đơn), `/admin` render, API admin không có quyền trả 403.

## Lưu ý

- Không commit `.env.local` hay bất kỳ key/mật khẩu/App Password nào.
- Mã kho demo (`VD-DEMO-…`) chỉ để thử luồng — thay bằng mã thật trước khi bán.
- Webhook PayOS **bắt buộc verify chữ ký** — code đã làm, đừng bỏ bước này.
- Trang `/admin` không có link công khai; chỉ người biết URL + đúng email admin mới vào được.
- Mật khẩu admin tạm lần đầu rất yếu — đổi ngay sau khi đăng nhập lần đầu (mục 1.5).
