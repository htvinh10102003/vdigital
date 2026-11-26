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
import { discountPct } from "./format";

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
