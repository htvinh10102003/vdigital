/**
 * Mẫu mail giao hàng — hằng số + hàm render thuần (KHÔNG dùng nodemailer),
 * để cả server (lib/email.ts) lẫn trang admin (client component) đều
 * import được. Mẫu mặc định ở đây; mẫu admin lưu đè trong bảng
 * email_templates (migration 005).
 */

export type EmailTemplateType = "auto" | "game_card" | "link" | "manual";

export const EMAIL_TEMPLATE_TYPES: { type: EmailTemplateType; label: string }[] = [
  { type: "auto", label: "Giao mã tự động" },
  { type: "game_card", label: "Giao thẻ game" },
  { type: "link", label: "Giao link / key" },
  { type: "manual", label: "Hoàn thành làm tay" },
];

export interface EmailTemplate {
  type: EmailTemplateType;
  product_id: string | null;
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<EmailTemplateType, { subject: string; body: string }> = {
  auto: {
    subject: "[VDigital] Đơn {order_code} — thông tin tài khoản của bạn",
    body: `Xin chào {customer_name},

Cảm ơn bạn đã mua {product_name} — {variant_name} tại {shop_name}.

{delivery_lines}

{note}

Bảo hành: 30 ngày (1 đổi 1 nếu lỗi do shop). Khi cần hỗ trợ, hãy gửi kèm mã đơn {order_code}.

Trân trọng,
{shop_name} — Tài khoản số giá tốt`,
  },
  game_card: {
    subject: "[VDigital] Đơn {order_code} — mã thẻ {product_name} của bạn",
    body: `Xin chào {customer_name},

Cảm ơn bạn đã mua {product_name} — {variant_name} tại {shop_name}.

{delivery_lines}

{note}

Bảo hành: 7 ngày (1 đổi 1 nếu lỗi do shop). Khi cần hỗ trợ, hãy gửi kèm mã đơn {order_code}.

Trân trọng,
{shop_name} — Tài khoản số giá tốt`,
  },
  link: {
    subject: "[VDigital] Đơn {order_code} — link/key {product_name} của bạn",
    body: `Xin chào {customer_name},

Cảm ơn bạn đã mua {product_name} — {variant_name} tại {shop_name}.

{delivery_lines}

{note}

Bảo hành: 30 ngày (1 đổi 1 nếu lỗi do shop). Khi cần hỗ trợ, hãy gửi kèm mã đơn {order_code}.

Trân trọng,
{shop_name} — Tài khoản số giá tốt`,
  },
  manual: {
    subject: "[VDigital] Đơn {order_code} — {product_name} đã hoàn thành",
    body: `Xin chào {customer_name},

{product_name} — {variant_name} trong đơn {order_code} của bạn đã hoàn thành.

{delivery_lines}

{note}

Bảo hành: 30 ngày (1 đổi 1 nếu lỗi do shop). Khi cần hỗ trợ, hãy gửi kèm mã đơn {order_code}.

Trân trọng,
{shop_name} — Tài khoản số giá tốt`,
  },
};

export const EMAIL_VARIABLES = [
  "{customer_name}",
  "{customer_email}",
  "{order_code}",
  "{product_name}",
  "{variant_name}",
  "{code}",
  "{serial}",
  "{pin}",
  "{delivery_link}",
  "{note}",
  "{shop_name}",
  "{delivery_lines}",
] as const;

export type EmailVars = Record<string, string>;

/** Thay biến {ten} bằng giá trị thật; biến không có giá trị thì thành "". */
export function renderEmailTemplate(text: string, vars: EmailVars): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  // Biến còn sót (không có trong vars) thì xóa, tránh lộ "{code}" ra mail khách.
  return out.replace(/\{[a-z_]+\}/g, "");
}

/** Dữ liệu mẫu để xem trước mail trong admin. */
export const SAMPLE_EMAIL_VARS: EmailVars = {
  customer_name: "Nguyễn Văn A",
  customer_email: "ban@gmail.com",
  order_code: "VD261126-WHPZ",
  product_name: "CapCut Pro",
  variant_name: "7 ngày",
  code: "VD-DEMO-V-CC-7D-001",
  serial: "1234-5678-9012",
  pin: "9876-5432",
  delivery_link: "https://example.com/activate?key=VD-DEMO-V-CC-7D-001",
  note: "Đã thêm vào Family xong. Bạn kiểm tra email nhé.",
  shop_name: "VDigital",
  delivery_lines: "Tài khoản / Mã: VD-DEMO-V-CC-7D-001",
};
