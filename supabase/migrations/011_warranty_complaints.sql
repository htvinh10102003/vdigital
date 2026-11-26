-- VDigital v4.8: bảo hành gắn với đơn + khiếu nại.
-- Chạy 1 lần qua Management API. An toàn chạy lại (IF NOT EXISTS).

-- 1. Bảo hành gắn từng món trong đơn (snapshot lúc mua, hạn tính từ ngày giao).
alter table order_items add column if not exists warranty_days integer;
alter table order_items add column if not exists delivered_at timestamptz;
alter table order_items add column if not exists warranty_ends_at timestamptz;

-- Backfill: món đã giao thì hạn tính tạm từ ngày tạo đơn (không có ngày giao
-- thật lưu lại trước bản này); món chưa giao chỉ snapshot số ngày bảo hành
-- hiện tại của sản phẩm, hạn để NULL cho tới khi giao thật.
update order_items oi
set warranty_days = coalesce((select p.warranty_days from products p where p.id = oi.product_id), 30),
    delivered_at = case when oi.status = 'delivered' then o.created_at else null end,
    warranty_ends_at = case
      when oi.status = 'delivered'
      then o.created_at + make_interval(days => coalesce((select p.warranty_days from products p where p.id = oi.product_id), 30))
      else null end
from orders o
where oi.order_id = o.id
  and oi.warranty_days is null;

-- 2. Khiếu nại bảo hành của khách.
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  order_item_id uuid,
  user_id uuid,
  customer_email text not null,
  product_name text,
  reason text not null check (reason in ('code_error', 'account_locked', 'wrong_product', 'other')),
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'resolved', 'rejected')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_complaints_email on complaints (customer_email, created_at desc);
create index if not exists idx_complaints_item on complaints (order_item_id, created_at desc);
create index if not exists idx_complaints_status on complaints (status, created_at desc);

-- 3. RLS + quyền.
alter table complaints enable row level security;
grant all on complaints to service_role;
grant select, insert on complaints to authenticated;

drop policy if exists complaints_select_own on complaints;
create policy complaints_select_own on complaints for select to authenticated
  using (user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email'));

drop policy if exists complaints_insert_own on complaints;
create policy complaints_insert_own on complaints for insert to authenticated
  with check (user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email'));
