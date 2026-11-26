-- Migration 005 — v4 (VDigital)
-- Vinh tự chạy trong Supabase SQL Editor. KHÔNG tự chạy DB.
--
-- 1. variants.manual_fields (jsonb): danh sách "Thông tin khách cần cung
--    cấp" cho từng gói làm tay — mỗi mục {id, label, type, required,
--    placeholder}. Admin cấu hình trong /admin > Sản phẩm; checkout hiện
--    đúng các ô đó và validate bắt buộc.
-- 2. order_items.customer_info (jsonb): thông tin khách đã điền theo
--    manual_fields — admin xem trong chi tiết đơn để xử lý tay, gửi kèm
--    mail hoàn thành đơn làm tay.
-- 3. email_templates: mẫu mail giao hàng admin chỉnh trong /admin > Mẫu
--    email. 1 dòng cho mẫu chung của loại (product_id null), 1 dòng cho
--    mẫu riêng của sản phẩm (product_id = id sản phẩm). Mẫu sản phẩm
--    thắng mẫu chung.
-- 4. reviews: 1 tài khoản chỉ 1 đánh giá / sản phẩm (unique index).
-- 5. order_items.fulfillment_type: cho phép thêm 'link' (trước đây check
--    constraint chỉ có auto/manual/game_card, trong khi code đã dùng link).
-- 6. Backfill manual_fields cho các gói làm tay đã có trong seed.

alter table variants add column if not exists manual_fields jsonb not null default '[]'::jsonb;
alter table order_items add column if not exists customer_info jsonb not null default '{}'::jsonb;

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('auto', 'game_card', 'link', 'manual')),
  product_id text references products(id) on delete cascade,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (type, product_id)
);

create unique index if not exists reviews_product_user_unique
  on reviews (product_id, user_id);

do $$
begin
  alter table order_items drop constraint if exists order_items_fulfillment_type_check;
  alter table order_items add constraint order_items_fulfillment_type_check
    check (fulfillment_type in ('auto', 'manual', 'game_card', 'link'));
exception when others then
  raise notice 'Không cập nhật được check fulfillment_type: %', sqlerrm;
end $$;

-- Quyền: service_role đọc/ghi hết (API server dùng service_role).
grant all on table email_templates to service_role;
grant select on table email_templates to anon, authenticated;
alter table email_templates enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'email_templates' and policyname = 'service_role_all') then
    create policy service_role_all on email_templates for all to service_role using (true) with check (true);
  end if;
end $$;

-- Backfill manual_fields cho gói làm tay (email cần cung cấp).
-- Canva: email mời vào team; Microsoft 365: email Microsoft;
-- ChatGPT: email tài khoản ChatGPT; Gemini/YouTube: email Google;
-- Spotify: email tài khoản Spotify.
update variants v
set manual_fields = '[{"id":"mf-email","label":"Email cần mời vào team Canva Pro","type":"email","required":true,"placeholder":"ban@gmail.com"}]'::jsonb
where v.product_id = 'p-canva' and v.fulfillment_type = 'manual';

update variants v
set manual_fields = '[{"id":"mf-email","label":"Email Microsoft cần nâng cấp","type":"email","required":true,"placeholder":"ban@outlook.com"}]'::jsonb
where v.product_id = 'p-m365' and v.fulfillment_type = 'manual';

update variants v
set manual_fields = '[{"id":"mf-email","label":"Email tài khoản ChatGPT cần nâng cấp","type":"email","required":true,"placeholder":"ban@gmail.com"}]'::jsonb
where v.product_id = 'p-chatgpt' and v.fulfillment_type = 'manual';

update variants v
set manual_fields = '[{"id":"mf-email","label":"Email Google nhận nâng cấp","type":"email","required":true,"placeholder":"ban@gmail.com"}]'::jsonb
where v.product_id = 'p-gemini' and v.fulfillment_type = 'manual';

update variants v
set manual_fields = '[{"id":"mf-email","label":"Email Google nhận lời mời Family","type":"email","required":true,"placeholder":"ban@gmail.com"}]'::jsonb
where v.product_id = 'p-youtube' and v.fulfillment_type = 'manual';

update variants v
set manual_fields = '[{"id":"mf-email","label":"Email tài khoản Spotify","type":"email","required":true,"placeholder":"ban@gmail.com"}]'::jsonb
where v.product_id = 'p-spotify' and v.fulfillment_type = 'manual';
