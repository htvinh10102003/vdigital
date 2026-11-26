export type FulfillmentType = "auto" | "manual" | "game_card";

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  /** Nhãn hiển thị: "30 ngày", "100.000đ", "1 tỷ token"... */
  label: string;
  price: number;
  original_price: number;
  fulfillment_type: FulfillmentType;
  is_flash: boolean;
  flash_ends_at: string | null;
  stock_count: number | null; // null = không giới hạn / không theo dõi kho
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  slug: string;
  category_id: string;
  name: string;
  tagline: string;
  description: string;
  guide: string;
  warranty_days: number;
  rating: number;
  review_count: number;
  sold_count: number;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_active: boolean;
  /** Màu nền gradient cho ảnh placeholder (không dùng logo của hãng). */
  gradient: string;
  initials: string;
  created_at: string;
  variants: Variant[];
}

export interface StockCode {
  id: string;
  variant_id: string;
  code: string;
  serial: string | null;
  pin: string | null;
  is_used: boolean;
  used_order_id: string | null;
}

export type OrderStatus =
  | "pending" // chờ thanh toán
  | "paid" // đã thanh toán, đang xử lý giao
  | "processing" // chờ admin làm tay (manual)
  | "completed" // đã giao xong
  | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
  fulfillment_type: FulfillmentType;
  status: "pending" | "delivered" | "waiting_manual" | "failed";
  delivered_code: string | null;
  delivered_serial: string | null;
  delivered_pin: string | null;
  delivered_note: string | null;
}

export interface Order {
  id: string;
  code: string; // mã đơn hiển thị, vd VD261126-XXXX
  payos_order_code: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  user_id: string | null;
  status: OrderStatus;
  total: number;
  payment_method: string;
  payment_link_id: string | null;
  checkout_url: string | null;
  admin_note: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  gradient: string;
  is_active: boolean;
  sort_order: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export interface Catalog {
  categories: Category[];
  products: Product[];
  banners: Banner[];
  faqs: Faq[];
}

export interface CartItem {
  variantId: string;
  productId: string;
  qty: number;
}
