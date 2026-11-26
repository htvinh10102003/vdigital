export type FulfillmentType = "auto" | "manual" | "game_card" | "link";

/** Loại tài khoản / sản phẩm — admin tự chọn trong /admin, không cần sửa code. */
export type AccountType =
  | "shared" // tài khoản dùng chung, giao tài khoản có sẵn
  | "own_email" // nâng cấp trên email chính chủ của khách
  | "add_family" // thêm vào Family bằng email khách
  | "license_key" // key bản quyền / mã kích hoạt
  | "activation_link" // link kích hoạt / link mời
  | "game_card" // thẻ game (serial + mã nạp)
  | "other";

export type ProductType = "account" | "game_card" | "tool" | "other";

/** Loại lựa chọn của gói: thời hạn, mệnh giá, gói token, số ghế, hoặc tự đặt tên. */
export type OptionType = "duration" | "denomination" | "token_pack" | "seats" | "custom";

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  icon?: string | null;
  image_url?: string | null;
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
  option_type: OptionType;
  /** Nhãn nhóm lựa chọn hiển thị ở trang chi tiết, vd "Chọn mệnh giá" / "Chọn gói token". Để trống thì tự suy ra từ option_type. */
  option_label: string | null;
  /** Mẫu giao hàng cho loại link: nội dung/link giao cho khách, có thể chứa {code}. */
  delivery_template: string | null;
  /** Ghi chú giao hàng riêng cho gói này (hiện cho khách sau khi mua). */
  delivery_note: string | null;
  /** Thông tin khách cần cung cấp cho gói làm tay (manual) — admin cấu hình
      trong /admin. Checkout hiện đúng các ô này, validate bắt buộc rồi mới
      cho đặt đơn. Gói auto/game_card/link không dùng. */
  manual_fields?: ManualField[];
  is_flash: boolean;
  flash_ends_at: string | null;
  stock_count: number | null; // null = không giới hạn / không theo dõi kho
  is_active: boolean;
  sort_order: number;
}

/** Một ô thông tin khách cần cung cấp khi mua gói làm tay (manual). */
export interface ManualField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "password";
  required: boolean;
  placeholder: string;
}

/** Số liệu thật của 1 sản phẩm — tính từ đơn hàng + đánh giá trong DB,
    KHÔNG dùng cột rating/review_count/sold_count (số seed cũ) trong bảng
    products nữa. rating = 0 nghĩa là chưa có đánh giá nào. */
export interface ProductStats {
  sold: number;
  rating: number;
  reviewCount: number;
  /** Phân bổ sao [5★, 4★, 3★, 2★, 1★]. */
  starDist: [number, number, number, number, number];
}

/** Một đánh giá thật trong bảng reviews. */
export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  name: string;
  stars: number;
  content: string;
  created_at: string;
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
  product_type: ProductType;
  account_type: AccountType;
  /** Ảnh bìa (URL Supabase Storage). Trống thì dùng ô màu + chữ viết tắt. */
  image_url: string | null;
  /** Ảnh phụ (mảng URL). */
  images: string[];
  /** Màu nền ô ảnh dự phòng (không dùng logo/ảnh của hãng khác). */
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
  /** Thông tin khách đã điền theo manual_fields của gói (key = id của ô,
      value = nội dung khách nhập) — admin xem trong chi tiết đơn để xử lý tay. */
  customer_info?: Record<string, string> | null;
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
  /** Mã voucher đã dùng + số tiền đã giảm (v4.7). */
  voucher_code?: string | null;
  discount_amount?: number;
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
  image_url?: string | null;
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

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "shared", label: "Tài khoản dùng chung (giao tài khoản có sẵn)" },
  { value: "own_email", label: "Nâng cấp chính chủ (trên email khách)" },
  { value: "add_family", label: "Thêm vào Family" },
  { value: "license_key", label: "Key bản quyền / mã kích hoạt" },
  { value: "activation_link", label: "Link kích hoạt / link mời" },
  { value: "game_card", label: "Thẻ game (serial + mã nạp)" },
  { value: "other", label: "Khác" },
];

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "account", label: "Tài khoản bản quyền" },
  { value: "game_card", label: "Thẻ game" },
  { value: "tool", label: "Công cụ" },
  { value: "other", label: "Khác" },
];

export const OPTION_TYPES: { value: OptionType; label: string }[] = [
  { value: "duration", label: "Thời hạn (ngày / tháng / năm)" },
  { value: "denomination", label: "Mệnh giá thẻ" },
  { value: "token_pack", label: "Gói token" },
  { value: "seats", label: "Số ghế / số thiết bị" },
  { value: "custom", label: "Tự đặt tên (nhập nhãn riêng)" },
];

export const FULFILLMENT_TYPES: { value: FulfillmentType; label: string }[] = [
  { value: "auto", label: "Tự động — lấy mã trong kho giao ngay" },
  { value: "manual", label: "Làm tay — admin hoàn thành, đơn chờ xử lý" },
  { value: "game_card", label: "Thẻ game — admin điền serial + mã, gửi mail" },
  { value: "link", label: "Link / key — giao link hoặc key theo mẫu" },
];
