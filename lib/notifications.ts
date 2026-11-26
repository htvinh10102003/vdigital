/**
 * Thông báo trong chuông header — DỮ LIỆU THẬT, suy ra từ catalog:
 * - Flash Sale đang chạy thật (còn hạn flash_ends_at, mức giảm thật lớn
 *   nhất tính từ giá gốc/giá bán).
 * - Sản phẩm mới (cờ is_new) vừa lên kệ.
 * Không có dữ liệu thì danh sách RỖNG — chuông hiện "Chưa có thông báo",
 * KHÔNG hiện khuyến mãi mẫu/giả. (Chưa có bảng notifications riêng trong
 * Supabase; khi cần thông báo theo từng tài khoản sẽ thêm bảng
 * notifications + API /api/notifications sau.)
 */

import type { Catalog } from "./types";
import { discountPct, formatVND } from "./format";
import { getSupabaseServer, isSupabaseConfigured } from "./supabase";
import type { Order } from "./types";

export type NotificationKind = "promo" | "order" | "system";

export interface ShopNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Link hành động khi bấm "Xem" trong chi tiết (vd đơn hàng / khuyến mãi). */
  link?: string;
  linkLabel?: string;
  createdAt: string;
}

export function getShopNotifications(catalog: Catalog): ShopNotification[] {
  const now = Date.now();
  const out: ShopNotification[] = [];

  // Flash Sale đang chạy thật.
  const flash = catalog.products.filter((p) =>
    p.variants.some((v) => v.is_flash && v.flash_ends_at && new Date(v.flash_ends_at).getTime() > now),
  );
  if (flash.length > 0) {
    const maxPct = Math.max(
      0,
      ...flash.flatMap((p) => p.variants.map((v) => discountPct(v.price, v.original_price))),
    );
    const endsAt = flash
      .flatMap((p) => p.variants)
      .filter((v) => v.is_flash && v.flash_ends_at)
      .map((v) => new Date(v.flash_ends_at!).getTime())
      .sort((a, b) => a - b)[0];
    const endText = endsAt ? ` Kết thúc lúc ${new Date(endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} hôm nay.` : "";
    out.push({
      id: "n-flash",
      kind: "promo",
      title: `Flash Sale — giảm tới ${maxPct}%`,
      body: `${flash.map((p) => p.name).slice(0, 4).join(", ")} đang giảm giá.${endText} Hết giờ là về giá gốc.`,
      link: "/khuyen-mai",
      linkLabel: "Xem Flash Sale",
      createdAt: new Date().toISOString(),
    });
  }

  // Sản phẩm mới vừa lên kệ.
  const fresh = catalog.products.filter((p) => p.is_new);
  if (fresh.length > 0) {
    out.push({
      id: "n-new-products",
      kind: "system",
      title: "Sản phẩm mới vừa lên kệ",
      body: `${fresh.map((p) => p.name).slice(0, 4).join(", ")} đã có mặt trên VDigital. Thanh toán VietQR tự động, giao hàng ngay sau khi thanh toán.`,
      link: "/san-pham?sort=newest",
      linkLabel: "Xem sản phẩm mới",
      createdAt: new Date().toISOString(),
    });
  }

  return out;
}

/* ---------------- Thông báo đơn hàng theo tài khoản (server-only) ----------------
 * Ghi bởi service_role sau các sự kiện: trả tiền xong, giao hàng xong, huỷ
 * đơn. Best-effort tuyệt đối: lỗi ghi thông báo KHÔNG BAO GIỜ được làm hỏng
 * thanh toán / giao hàng nên mọi lỗi đều nuốt sau khi log.
 * Bỏ qua đơn demo (id dạng "ord-..." + Supabase chưa cấu hình) — test luồng
 * chạy demo mode sẽ không ghi gì vào DB. */

export type OrderNotificationType = "paid" | "delivered" | "cancelled" | "info";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createNotification(input: {
  userId: string | null;
  email: string;
  type: OrderNotificationType;
  title: string;
  body: string;
  orderCode?: string | null;
}): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;
    if (!input.email?.trim()) return;
    const sb = getSupabaseServer();
    if (!sb) return;
    const { error } = await sb.from("notifications").insert({
      user_id: input.userId && UUID_RE.test(input.userId) ? input.userId : null,
      customer_email: input.email.trim(),
      type: input.type,
      title: input.title,
      body: input.body,
      order_code: input.orderCode ?? null,
    });
    if (error) console.error("[notifications] insert failed:", error.message);
  } catch (err) {
    console.error("[notifications] insert failed:", err instanceof Error ? err.message : err);
  }
}

/** Đơn thật trong Supabase mới được thông báo (đơn demo id "ord-..." thì không). */
export function isRealOrder(order: Order): boolean {
  return isSupabaseConfigured && Boolean(order.customer_email?.trim()) && UUID_RE.test(order.id);
}

/** Trả tiền xong — luôn ghi, kể cả đơn còn chờ xử lý tay. */
export async function notifyOrderPaid(order: Order): Promise<void> {
  if (!isRealOrder(order)) return;
  await createNotification({
    userId: order.user_id,
    email: order.customer_email,
    type: "paid",
    title: "Thanh toán thành công",
    body: `Đơn ${order.code} (${formatVND(order.total)}) đã được xác nhận thanh toán.`,
    orderCode: order.code,
  });
}

/** Giao hàng xong — mã tài khoản / thẻ đã gửi về email của khách. */
export async function notifyOrderDelivered(order: Order): Promise<void> {
  if (!isRealOrder(order)) return;
  await createNotification({
    userId: order.user_id,
    email: order.customer_email,
    type: "delivered",
    title: "Đơn hàng đã giao",
    body: `Đơn ${order.code} đã được giao — mã tài khoản / thẻ game đã gửi về email ${order.customer_email}.`,
    orderCode: order.code,
  });
}

/** Đơn bị huỷ. */
export async function notifyOrderCancelled(order: Order): Promise<void> {
  if (!isRealOrder(order)) return;
  await createNotification({
    userId: order.user_id,
    email: order.customer_email,
    type: "cancelled",
    title: "Đơn hàng đã huỷ",
    body: `Đơn ${order.code} (${formatVND(order.total)}) đã bị huỷ. Nếu bạn đã thanh toán, vui lòng liên hệ shop để được hỗ trợ.`,
    orderCode: order.code,
  });
}

/** Hàng thông báo đơn hàng trả về cho client (chuông header). */
export interface OrderNotificationRow {
  id: string;
  type: OrderNotificationType;
  title: string;
  body: string;
  order_code: string | null;
  is_read: boolean;
  created_at: string;
}
