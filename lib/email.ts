import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gửi mail tự động bằng Gmail riêng của shop (SMTP Gmail + App Password).
 *
 * Env (xem .env.example):
 *   SMTP_HOST=smtp.gmail.com, SMTP_PORT=587
 *   SMTP_USER=<Gmail riêng của shop>
 *   SMTP_PASS=<App Password 16 ký tự của Gmail đó — KHÔNG phải mật khẩu Gmail thường>
 *   EMAIL_FROM=<địa chỉ gửi hiển thị, vd "VDigital <shop@gmail.com>">
 *
 * Cách tạo App Password (Vinh làm trên Gmail riêng của shop):
 *   1. Bật xác minh 2 bước (2FA) cho tài khoản Google đó.
 *   2. Vào myaccount.google.com > Bảo mật > Mật khẩu ứng dụng (App passwords)
 *      > tạo mới (đặt tên vd "VDigital"), Google cho 16 ký tự.
 *   3. Nhập 16 ký tự đó vào SMTP_PASS qua trang nhập an toàn / Vercel env.
 *      KHÔNG gửi App Password trong chat, KHÔNG ghi vào code hay file.
 *   4. Nên dùng Gmail RIÊNG cho shop, không dùng Gmail cá nhân.
 *
 * QUAN TRỌNG: thiếu SMTP_PASS thì hàm này chỉ log và trả { sent: false } —
 * đơn hàng vẫn hoàn tất bình thường, không bao giờ chặn luồng mua hàng vì mail.
 *
 * MẪU MAIL (v4): admin chỉnh tiêu đề + nội dung theo từng loại giao hàng
 * trong /admin > Mẫu email; mẫu riêng của sản phẩm thắng mẫu chung của loại.
 * Mẫu lưu trong bảng email_templates (migration 005, Vinh chạy SQL Editor);
 * chưa có bảng / chưa lưu mẫu thì dùng mẫu mặc định dưới đây.
 * Biến chèn sẵn: {customer_name} {customer_email} {order_code}
 * {product_name} {variant_name} {code} {serial} {pin} {delivery_link}
 * {note} {shop_name} {delivery_lines} (bảng thông tin giao hàng).
 */

import { DEFAULT_TEMPLATES, EMAIL_TEMPLATE_TYPES, EMAIL_VARIABLES, renderEmailTemplate } from "./email-templates";
import type { EmailTemplateType, EmailVars } from "./email-templates";
export { DEFAULT_TEMPLATES, EMAIL_TEMPLATE_TYPES, EMAIL_VARIABLES, renderEmailTemplate };
export type { EmailTemplate, EmailTemplateType, EmailVars } from "./email-templates";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linesTable(lines: { label: string; value: string }[]): string {
  if (!lines.length) return "";
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">${escapeHtml(l.label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(l.value)}</td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;margin:12px 0;">${rows}</table>`;
}

/**
 * Lấy mẫu mail áp dụng: mẫu riêng của sản phẩm thắng mẫu chung của loại;
 * chưa có mẫu nào trong DB (hoặc chưa chạy migration 005) thì dùng mặc định.
 */
export async function getEmailTemplate(
  sb: SupabaseClient | null,
  type: EmailTemplateType,
  productId?: string | null,
): Promise<{ subject: string; body: string }> {
  const fallback = DEFAULT_TEMPLATES[type];
  if (!sb) return fallback;
  try {
    const { data, error } = await sb
      .from("email_templates")
      .select("type, product_id, subject, body")
      .eq("type", type);
    if (error || !data) return fallback;
    const byProduct = productId ? data.find((t: any) => t.product_id === productId) : null;
    const byType = data.find((t: any) => !t.product_id);
    const chosen = byProduct ?? byType;
    return chosen ? { subject: chosen.subject, body: chosen.body } : fallback;
  } catch {
    return fallback;
  }
}

/** Dựng mail giao hàng hoàn chỉnh từ mẫu (DB hoặc mặc định) + biến thật. */
export async function buildDeliveryEmail(
  sb: SupabaseClient | null,
  opts: {
    type: EmailTemplateType;
    productId?: string | null;
    customerName: string;
    customerEmail: string;
    orderCode: string;
    productName: string;
    variantName: string;
    lines: { label: string; value: string }[];
    code?: string;
    serial?: string;
    pin?: string;
    deliveryLink?: string;
    note?: string;
    guide?: string;
    warrantyDays?: number;
  },
): Promise<{ subject: string; html: string }> {
  const tpl = await getEmailTemplate(sb, opts.type, opts.productId);
  const noteParts = [opts.note?.trim() ?? "", opts.guide?.trim() ?? ""].filter(Boolean);
  const vars: EmailVars = {
    customer_name: opts.customerName,
    customer_email: opts.customerEmail,
    order_code: opts.orderCode,
    product_name: opts.productName,
    variant_name: opts.variantName,
    code: opts.code ?? opts.lines[0]?.value ?? "",
    serial: opts.serial ?? "",
    pin: opts.pin ?? "",
    delivery_link: opts.deliveryLink ?? opts.lines[0]?.value ?? "",
    note: noteParts.join("\n\n"),
    shop_name: "VDigital",
    delivery_lines: linesTable(opts.lines),
  };
  const subject = renderEmailTemplate(tpl.subject, vars);
  const bodyText = renderEmailTemplate(tpl.body, vars);
  // Nội dung mẫu là text thường: xuống dòng → <br>, còn {delivery_lines}
  // đã là HTML bảng nên giữ nguyên.
  const bodyHtml = bodyText
    .split(linesTable(opts.lines))
    .map((part) => escapeHtml(part).replace(/\n/g, "<br/>"))
    .join(linesTable(opts.lines));
  const html = `
  <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
    <h2 style="color:#7c3aed;">VDigital — Đơn hàng ${escapeHtml(opts.orderCode)}</h2>
    ${bodyHtml}
    ${opts.warrantyDays ? `<p>Bảo hành: ${opts.warrantyDays} ngày (1 đổi 1 nếu lỗi do shop).</p>` : ""}
  </div>`;
  return { subject, html };
}

/**
 * Gửi mail tự động bằng Gmail riêng của shop (SMTP Gmail + App Password).
 *
 * Env (xem .env.example):
 *   SMTP_HOST=smtp.gmail.com, SMTP_PORT=587
 *   SMTP_USER=<Gmail riêng của shop>
 *   SMTP_PASS=<App Password 16 ký tự của Gmail đó — KHÔNG phải mật khẩu Gmail thường>
 *   EMAIL_FROM=<địa chỉ gửi hiển thị, vd "VDigital <shop@gmail.com>">
 *
 * Cách tạo App Password (Vinh làm trên Gmail riêng của shop):
 *   1. Bật xác minh 2 bước (2FA) cho tài khoản Google đó.
 *   2. Vào myaccount.google.com > Bảo mật > Mật khẩu ứng dụng (App passwords)
 *      > tạo mới (đặt tên vd "VDigital"), Google cho 16 ký tự.
 *   3. Nhập 16 ký tự đó vào SMTP_PASS qua trang nhập an toàn / Vercel env.
 *      KHÔNG gửi App Password trong chat, KHÔNG ghi vào code hay file.
 *   4. Nên dùng Gmail RIÊNG cho shop, không dùng Gmail cá nhân.
 *
 * QUAN TRỌNG: thiếu SMTP_PASS thì hàm này chỉ log và trả { sent: false } —
 * đơn hàng vẫn hoàn tất bình thường, không bao giờ chặn luồng mua hàng vì mail.
 */

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

export interface MailResult {
  sent: boolean;
  reason?: string;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

export const isMailConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendMail(input: MailInput): Promise<MailResult> {
  const t = getTransporter();
  if (!t) {
    console.log("[mail] Chưa cấu hình SMTP (SMTP_USER/SMTP_PASS) — bỏ qua gửi mail.", {
      to: input.to,
      subject: input.subject,
    });
    return { sent: false, reason: "mail-chua-cau-hinh" };
  }
  try {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER!;
    await t.sendMail({ from, to: input.to, subject: input.subject, html: input.html });
    console.log("[mail] Đã gửi mail tới", input.to, "—", input.subject);
    return { sent: true };
  } catch (err) {
    // Mail lỗi không được làm hỏng đơn hàng — chỉ log.
    console.error("[mail] Gửi mail thất bại (đơn hàng vẫn hoàn tất):", err);
    return { sent: false, reason: "gui-mail-that-bai" };
  }
}

/** Mẫu mail giao hàng — tiếng Việt, dùng chung cho giao tự động, thẻ game và đơn làm tay. */
export function deliveryEmailHtml(opts: {
  customerName: string;
  orderCode: string;
  productName: string;
  variantName: string;
  lines: { label: string; value: string }[];
  denomination?: string;
  guide: string;
  warrantyDays: number;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">${l.label}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;">${l.value}</td></tr>`,
    )
    .join("");
  return `
  <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
    <h2 style="color:#ea580c;">VDigital — Đơn hàng ${opts.orderCode} đã giao</h2>
    <p>Xin chào ${opts.customerName},</p>
    <p>Cảm ơn bạn đã mua <strong>${opts.productName} — ${opts.variantName}</strong> tại VDigital.</p>
    ${opts.denomination ? `<p>Mệnh giá: <strong>${opts.denomination}</strong></p>` : ""}
    <table style="border-collapse:collapse;width:100%;margin:12px 0;">${rows}</table>
    <h3>Hướng dẫn sử dụng</h3>
    <p style="white-space:pre-line;">${opts.guide}</p>
    <p>Bảo hành: ${opts.warrantyDays} ngày (1 đổi 1 nếu lỗi do shop). Khi cần hỗ trợ, hãy gửi kèm mã đơn <strong>${opts.orderCode}</strong>.</p>
    <p>Trân trọng,<br/>VDigital — Tài khoản số giá tốt</p>
  </div>`;
}
