-- VDigital — schema (chạy trong Supabase SQL Editor, theo thứ tự 001 rồi 002)
-- Lưu ý: service_role key (dùng phía server) bypass RLS nên API/webhook vẫn đọc/ghi được.

create extension if not exists "pgcrypto";

-- Danh mục (hỗ trợ 2 cấp: cha -> con qua parent_id)
create table if not exists categories (
  id text primary key,
  slug text unique not null,
  name text not null,
  parent_id text references categories(id) on delete set null,
  sort_order int not null default 0
);

create table if not exists products (
  id text primary key,
  slug text unique not null,
  category_id text references categories(id) on delete set null,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  guide text not null default '',
  warranty_days int not null default 30,
  rating numeric not null default 5,
  review_count int not null default 0,
  sold_count int not null default 0,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  is_active boolean not null default true,
  gradient text not null default 'from-blue-600 to-indigo-600',
  initials text not null default 'VD',
  created_at timestamptz not null default now()
);

create table if not exists variants (
  id text primary key,
  product_id text references products(id) on delete cascade,
  name text not null,
  label text not null,
  price int not null,
  original_price int not null,
  fulfillment_type text not null check (fulfillment_type in ('auto','manual','game_card')),
  is_flash boolean not null default false,
  flash_ends_at timestamptz,
  stock_count int, -- null = không theo dõi kho
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- Kho mã cho gói giao tự động (chỉ service_role đọc/ghi; không cho anon/authenticated select)
create table if not exists stock_codes (
  id uuid primary key default gen_random_uuid(),
  variant_id text references variants(id) on delete cascade,
  code text not null,
  serial text,
  pin text,
  is_used boolean not null default false,
  used_order_id text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  payos_order_code bigint,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','paid','processing','completed','cancelled')),
  total int not null,
  payment_method text not null default 'payos-vietqr',
  payment_link_id text,
  checkout_url text,
  admin_note text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id text references products(id) on delete set null,
  variant_id text references variants(id) on delete set null,
  product_name text not null,
  variant_name text not null,
  price int not null,
  quantity int not null default 1,
  fulfillment_type text not null check (fulfillment_type in ('auto','manual','game_card')),
  status text not null default 'pending' check (status in ('pending','delivered','waiting_manual','failed')),
  delivered_code text,
  delivered_serial text,
  delivered_pin text,
  delivered_note text
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text references products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  stars int not null check (stars between 1 and 5),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists banners (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  cta_text text not null default '',
  cta_link text not null default '/san-pham',
  gradient text not null default 'from-navy-800 to-navy-900',
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists faqs (
  id text primary key,
  question text not null,
  answer text not null,
  sort_order int not null default 0
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ================= RLS =================
alter table categories enable row level security;
alter table products enable row level security;
alter table variants enable row level security;
alter table stock_codes enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table banners enable row level security;
alter table faqs enable row level security;
alter table profiles enable row level security;

-- Công khai đọc sản phẩm/danh mục/banner/faq đang bán
create policy "public read categories" on categories for select using (true);
create policy "public read products" on products for select using (is_active = true);
create policy "public read variants" on variants for select using (is_active = true);
create policy "public read banners" on banners for select using (is_active = true);
create policy "public read faqs" on faqs for select using (true);
create policy "public read reviews" on reviews for select using (true);

-- Đơn hàng: chỉ chủ đơn (đăng nhập) xem được đơn của mình.
-- API server dùng service_role nên không bị chặn bởi policy này.
create policy "owner read orders" on orders for select using (auth.uid() = user_id);
create policy "owner read order_items" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);

-- Đánh giá: người đăng nhập được viết
create policy "auth insert reviews" on reviews for insert with check (auth.uid() = user_id);

-- Profile: tự xem/sửa của mình
create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- stock_codes: KHÔNG tạo policy select cho anon/authenticated -> chỉ service_role truy cập.
