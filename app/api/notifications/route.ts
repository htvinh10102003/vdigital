import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import type { OrderNotificationRow } from "@/lib/notifications";
import { getSupabaseServer } from "@/lib/supabase";

// Dữ liệu đổi liên tục (thông báo mới sau mỗi lần thanh toán) — không cache.
export const dynamic = "force-dynamic";

/** Lấy thông báo đơn hàng của chính khách đang đăng nhập, mới nhất trước. */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb) return unauthorized();

  // Khách khớp bằng user_id (đơn đặt khi đã đăng nhập) HOẶC customer_email
  // (đơn đặt trước khi đăng nhập / đặt không cần tài khoản). Gộp 2 truy
  // vấn rồi khử trùng theo id — tránh cú pháp or() dễ sai khi email có
  // ký tự đặc biệt.
  const [byUserId, byEmail] = await Promise.all([
    sb
      .from("notifications")
      .select("id, type, title, body, order_code, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("notifications")
      .select("id, type, title, body, order_code, is_read, created_at")
      .ilike("customer_email", user.email)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (byUserId.error) {
    return NextResponse.json({ error: "Không tải được thông báo" }, { status: 500 });
  }
  if (byEmail.error) {
    return NextResponse.json({ error: "Không tải được thông báo" }, { status: 500 });
  }
  const merged = new Map<string, OrderNotificationRow>();
  for (const row of [...(byUserId.data ?? []), ...(byEmail.data ?? [])] as OrderNotificationRow[]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  const notifications = [...merged.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
  const unread_count = [...merged.values()].filter((n) => !n.is_read).length;
  return NextResponse.json({ notifications, unread_count });
}
