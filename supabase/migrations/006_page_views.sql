-- Migration 006 — v4 (VDigital)
-- Vinh tự chạy trong Supabase SQL Editor. KHÔNG tự chạy DB.
--
-- page_views: thống kê lượt truy cập tự ghi (không dùng Vercel Analytics
-- vì cần hiển thị số liệu ngay trong /admin > Tổng quan / Báo cáo).
-- Chỉ lưu đường dẫn trang (path) + thời gian — KHÔNG lưu IP, user agent
-- hay bất kỳ thông tin cá nhân nào.
-- RLS bật, không có policy public: chỉ service_role (API /api/track và
-- /api/admin/insights) đọc/ghi. Khách không đọc trực tiếp được bảng này.

create table if not exists page_views (
  id bigint generated always as identity primary key,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on page_views (created_at desc);
create index if not exists page_views_path_idx on page_views (path);

grant all on table page_views to service_role;
alter table page_views enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'page_views' and policyname = 'service_role_all') then
    create policy service_role_all on page_views for all to service_role using (true) with check (true);
  end if;
end $$;
