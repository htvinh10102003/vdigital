-- VDigital v4.7: ví Xu, voucher, điểm danh.
-- Chạy 1 lần qua Management API. An toàn chạy lại (IF NOT EXISTS / OR REPLACE).

-- 1. Số dư Xu trên profiles (1 Xu = 1đ).
alter table profiles add column if not exists xu_balance integer not null default 0;

-- 2. Sổ giao dịch ví — mọi thay đổi số dư đều ghi 1 dòng kèm số dư sau đó.
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_email text not null,
  type text not null check (type in ('topup', 'spend', 'checkin', 'admin_adjust', 'refund')),
  amount integer not null,
  balance_after integer not null,
  ref_code text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_tx_email on wallet_transactions (customer_email, created_at desc);
create index if not exists idx_wallet_tx_user on wallet_transactions (user_id, created_at desc);

-- 3. Yêu cầu nạp tiền (chờ PayOS xác nhận qua webhook).
create table if not exists wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_email text not null,
  amount integer not null check (amount > 0),
  payos_order_code bigint unique not null,
  payment_link_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

-- 4. Voucher + lịch sử dùng (1 tài khoản dùng 1 lần / voucher).
create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null check (value > 0),
  min_order integer not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  target_emails jsonb,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists voucher_usages (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references vouchers (id) on delete cascade,
  user_id uuid,
  customer_email text not null,
  order_code text,
  used_at timestamptz not null default now(),
  unique (voucher_id, customer_email)
);

-- 5. Điểm danh hằng ngày (1 dòng / tài khoản / ngày).
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_email text,
  checkin_date date not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

-- 6. Cài đặt shop (key-value) — số Xu điểm danh chỉnh được trong admin.
create table if not exists shop_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into shop_settings (key, value) values
  ('checkin_daily_amount', '50'::jsonb),
  ('checkin_sunday_amount', '200'::jsonb)
on conflict (key) do nothing;

-- 7. Đơn hàng: lưu voucher đã dùng + số tiền đã giảm.
alter table orders add column if not exists voucher_code text;
alter table orders add column if not exists discount_amount integer not null default 0;

-- 8. Cộng/trừ số dư NGUYÊN TỬ + ghi sổ trong 1 transaction.
-- Số dư không bao giờ âm. Lỗi: PROFILE_NOT_FOUND / INSUFFICIENT_BALANCE.
create or replace function wallet_adjust(
  p_user_id uuid,
  p_email text,
  p_amount integer,
  p_type text,
  p_ref_code text,
  p_note text
) returns integer
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_profile_id uuid;
begin
  select id, xu_balance into v_profile_id, v_balance from profiles where id = p_user_id;
  if v_profile_id is null then
    select id, xu_balance into v_profile_id, v_balance from profiles where email = p_email;
  end if;
  if v_profile_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_balance + p_amount < 0 then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;
  update profiles set xu_balance = xu_balance + p_amount where id = v_profile_id
  returning xu_balance into v_balance;
  insert into wallet_transactions (user_id, customer_email, type, amount, balance_after, ref_code, note)
  values (v_profile_id, p_email, p_type, p_amount, v_balance, p_ref_code, p_note);
  return v_balance;
end;
$$;

-- 9. RLS + quyền.
alter table wallet_transactions enable row level security;
alter table wallet_topups enable row level security;
alter table vouchers enable row level security;
alter table voucher_usages enable row level security;
alter table checkins enable row level security;
alter table shop_settings enable row level security;

grant all on wallet_transactions, wallet_topups, vouchers, voucher_usages, checkins, shop_settings to service_role;
grant select on wallet_transactions, checkins to authenticated;

drop policy if exists wallet_tx_select_own on wallet_transactions;
create policy wallet_tx_select_own on wallet_transactions for select to authenticated
  using (user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email'));

drop policy if exists checkins_select_own on checkins;
create policy checkins_select_own on checkins for select to authenticated
  using (user_id = auth.uid());
