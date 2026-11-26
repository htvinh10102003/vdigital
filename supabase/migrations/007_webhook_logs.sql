-- 007: log mọi lần PayOS gọi webhook — để biết webhook có tới không,
-- chữ ký đúng/sai, tìm thấy đơn không, giao hàng lỗi gì.
-- Chỉ service_role ghi/đọc (RLS bật, không policy cho anon/authenticated).
create table if not exists webhook_logs (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  payos_code bigint,
  amount int,
  code text,
  signature_ok boolean,
  outcome text,
  error text,
  raw jsonb
);

alter table webhook_logs enable row level security;
grant all on table webhook_logs to service_role;
