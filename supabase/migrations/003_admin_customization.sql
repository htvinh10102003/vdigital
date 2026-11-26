-- VDigital — migration 003: admin tùy biến + ảnh sản phẩm (Supabase Storage)
-- Chạy trong Supabase SQL Editor sau 001 + 002. Idempotent: chạy lại cũng an toàn.
-- Bao gồm: cột loại tài khoản / loại lựa chọn / mẫu giao hàng, ảnh sản phẩm,
-- và bucket Storage "vdigital-media" (public read) để admin up ảnh.

-- ---------- 1. Cột mới cho products ----------
alter table products
  add column if not exists product_type text not null default 'account'
    check (product_type in ('account','game_card','tool','other')),
  add column if not exists account_type text not null default 'shared'
    check (account_type in ('shared','own_email','add_family','license_key','activation_link','game_card','other')),
  add column if not exists image_url text,
  add column if not exists images jsonb not null default '[]'::jsonb;

-- ---------- 2. Cột mới cho variants ----------
alter table variants
  add column if not exists option_type text not null default 'duration'
    check (option_type in ('duration','denomination','token_pack','seats','custom')),
  add column if not exists option_label text,
  add column if not exists delivery_template text not null default '',
  add column if not exists delivery_note text not null default '';

-- Mở rộng fulfillment_type: thêm 'link' (giao link/key theo mẫu)
do $$
begin
  alter table variants drop constraint if exists variants_fulfillment_type_check;
  alter table variants add constraint variants_fulfillment_type_check
    check (fulfillment_type in ('auto','manual','game_card','link'));
exception when others then null;
end $$;

do $$
begin
  alter table order_items drop constraint if exists order_items_fulfillment_type_check;
  alter table order_items add constraint order_items_fulfillment_type_check
    check (fulfillment_type in ('auto','manual','game_card','link'));
exception when others then null;
end $$;

-- ---------- 3. Cột mới cho categories + banners ----------
alter table categories
  add column if not exists icon text,
  add column if not exists image_url text;

alter table banners
  add column if not exists image_url text;

-- ---------- 4. Backfill từ dữ liệu hiện có ----------
update products set product_type = 'game_card', account_type = 'game_card'
  where category_id = 'cat-game';

update variants set option_type = 'denomination', option_label = 'Chọn mệnh giá'
  where product_id in (select id from products where category_id = 'cat-game')
    and option_type = 'duration';

update variants set option_type = 'token_pack', option_label = 'Chọn gói token'
  where product_id = 'p-claude' and option_type = 'duration';

update products set account_type = 'add_family' where id in ('p-canva','p-m365','p-youtube','p-spotify');
update products set account_type = 'own_email' where id in ('p-chatgpt','p-gemini');
update products set account_type = 'license_key' where id = 'p-claude';

-- ---------- 5. Supabase Storage: bucket ảnh VDigital ----------
-- Bucket public: ai cũng đọc được ảnh (cần cho trang bán hàng), chỉ
-- service_role (server) mới ghi/xóa được — client không up trực tiếp.
insert into storage.buckets (id, name, public)
values ('vdigital-media', 'vdigital-media', true)
on conflict (id) do nothing;

-- Policy đọc công khai
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'vdigital-media public read'
  ) then
    create policy "vdigital-media public read"
      on storage.objects for select
      using (bucket_id = 'vdigital-media');
  end if;
end $$;

-- Ghi/xóa: chỉ service_role (bypass RLS mặc định của storage khi dùng
-- service key ở server). Không tạo policy insert cho anon/authenticated.
