-- 008: thông báo đơn hàng cho khách (chuông header).
-- Ghi khi: trả tiền xong (paid), giao hàng xong (delivered), đơn bị huỷ
-- (cancelled). Chỉ khách thấy thông báo của mình; admin không có chuông.
-- Ghi bởi service_role (server); khách chỉ được SELECT hàng của mình.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  customer_email text not null,
  type text not null check (type in ('paid', 'delivered', 'cancelled', 'info')),
  title text not null,
  body text not null default '',
  order_code text null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
grant all on table notifications to service_role;
grant select on table notifications to authenticated;

create policy "notifications_select_own" on notifications
  for select to authenticated
  using (user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email'));
