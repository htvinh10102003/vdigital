-- VDigital migration 004 — cấp quyền (GRANT) cho các role Supabase.
--
-- Nguyên nhân: migration 001 tạo bảng + policy RLS nhưng KHÔNG grant quyền
-- trên bảng cho bất kỳ role nào ngoài postgres. Postgres kiểm tra GRANT
-- trước RLS, nên cả service_role (dù bypass RLS) cũng bị lỗi 42501
-- "permission denied for table orders" khi insert, và anon/service đều
-- không SELECT được gì — web rơi về dùng dữ liệu seed trong code.
-- Chạy file này 1 lần trong Supabase SQL Editor (vai trò postgres).
-- Hiệu lực ngay, không cần redeploy Vercel. Policy RLS giữ nguyên.

-- 1. Server (service_role): toàn quyền mọi bảng + sequence hiện tại,
--    và mọi bảng/sequence tạo sau này.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 2. Khách đọc công khai (policy RLS vẫn lọc: chỉ hàng is_active = true).
GRANT SELECT ON public.categories, public.products, public.variants,
  public.banners, public.faqs, public.reviews TO anon, authenticated;

-- 3. Chủ đơn đọc đơn của mình (policy RLS auth.uid() = user_id vẫn lọc).
GRANT SELECT ON public.orders, public.order_items TO authenticated;

-- 4. Khách đăng nhập được gửi review (policy with_check auth.uid() = user_id).
GRANT INSERT ON public.reviews TO authenticated;

-- 5. Chủ tài khoản đọc/sửa profile của mình (policy auth.uid() = id).
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- KHÔNG grant gì cho anon/authenticated trên stock_codes (chỉ server đọc),
-- và KHÔNG thêm policy INSERT cho anon trên orders (ai cũng ghi được đơn giả).
