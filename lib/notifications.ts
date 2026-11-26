/**
 * Thông báo trong chuông header.
 *
 * NGUỒN DỮ LIỆU (quan trọng): hiện CHƯA có bảng notifications thật trong
 * Supabase, nên danh sách dưới là DỮ LIỆU MẪU lấy từ đơn hàng/khuyến mãi của
 * shop (Flash Sale, ưu đãi 20% đơn đầu, sản phẩm mới...). Khi nối Supabase:
 * tạo bảng `notifications` (id, user_id nullable, type, title, body,
 * link, is_read, created_at) + API route /api/notifications, rồi thay
 * getSampleNotifications() bằng fetch thật ở NotificationsBell. Không bịa
 * thông báo đơn hàng cụ thể của khách — mẫu chỉ là tin chung của shop.
 */

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

export const NOTIFICATIONS_SOURCE_NOTE =
  "Thông báo mẫu của shop — chưa nối Supabase, sẽ thay bằng dữ liệu thật sau.";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

export function getSampleNotifications(): ShopNotification[] {
  return [
    {
      id: "n-flash",
      kind: "promo",
      title: "Flash Sale hôm nay — giảm tới 69%",
      body: "CapCut Pro, Canva Pro, Microsoft 365 và nhiều tài khoản khác đang giảm giá trong hôm nay. Số lượng có hạn, hết giờ là về giá gốc.",
      link: "/khuyen-mai",
      linkLabel: "Xem Flash Sale",
      createdAt: hoursAgo(1),
    },
    {
      id: "n-first-order",
      kind: "promo",
      title: "Ưu đãi đơn đầu tiên: giảm ngay 20%",
      body: "Đơn hàng đầu tiên của bạn được giảm 20%. Áp dụng cho mọi tài khoản bản quyền và thẻ game trên VDigital.",
      link: "/khuyen-mai",
      linkLabel: "Nhận ưu đãi",
      createdAt: hoursAgo(5),
    },
    {
      id: "n-new-products",
      kind: "system",
      title: "Sản phẩm mới: Muse AI và ElevenLabs",
      body: "VDigital vừa thêm gói token Muse AI và ElevenLabs Creator. Thanh toán VietQR tự động, giao hàng ngay sau khi thanh toán.",
      link: "/san-pham",
      linkLabel: "Xem sản phẩm mới",
      createdAt: hoursAgo(26),
    },
    {
      id: "n-delivery",
      kind: "order",
      title: "Giao hàng tức thì sau khi thanh toán",
      body: "Đơn đã thanh toán bằng VietQR sẽ được giao ngay: tài khoản/mã hiện trong chi tiết đơn hàng và gửi về email của bạn. Đơn làm tay (nâng cấp chính chủ, add Family) shop xử lý trong 5–30 phút.",
      link: "/tai-khoan?tab=orders",
      linkLabel: "Xem đơn hàng của tôi",
      createdAt: hoursAgo(50),
    },
  ];
}
