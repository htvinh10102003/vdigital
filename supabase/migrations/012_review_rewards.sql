-- Đánh giá theo đơn (v4.10): review gắn với đơn đã giao + thưởng Xu.
-- 1 tài khoản vẫn chỉ 1 đánh giá / sản phẩm (unique index ở 005 giữ
-- nguyên) — thưởng chỉ 1 lần cho đánh giá đầu tiên của sản phẩm đó.
alter table reviews add column if not exists order_id uuid references orders(id) on delete set null;
alter table reviews add column if not exists reward_xu int not null default 0;
create index if not exists reviews_order_idx on reviews(order_id);
create index if not exists reviews_user_idx on reviews(user_id);

-- Loại giao dịch ví mới "review" (CHECK ở 009 chỉ liệt kê 5 loại cũ).
alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions add constraint wallet_transactions_type_check
  check (type in ('topup', 'spend', 'checkin', 'admin_adjust', 'refund', 'review'));
