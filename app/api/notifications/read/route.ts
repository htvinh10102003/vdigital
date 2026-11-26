import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { getSupabaseServer } from "@/lib/supabase";

// Dữ liệu đổi liên tục — không cache.
export const dynamic = "force-dynamic";

/**
 * Đánh dấu đã đọc thông báo đơn hàng của chính khách đang đăng nhập.
 * Body: { id?: string, all?: boolean } — id để đọc 1 cái, all để đọc hết.
 * Chỉ được đọc hàng thuộc về mình (user_id hoặc customer_email trùng).
 */
export async function POST(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb) return unauthorized();

  let body: { id?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  }

  if (body.all) {
    // Đọc hết: hàng gắn user_id của mình + hàng gắn email của mình mà
    // chưa gắn user_id (đơn đặt trước khi đăng nhập).
    const [r1, r2] = await Promise.all([
      sb.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false),
      sb
        .from("notifications")
        .update({ is_read: true })
        .ilike("customer_email", user.email)
        .is("user_id", null)
        .eq("is_read", false),
    ]);
    if (r1.error || r2.error) {
      return NextResponse.json({ error: "Không cập nhật được" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    // Đọc 1 cái: kiểm tra quyền sở hữu trước rồi mới cập nhật.
    const { data, error } = await sb
      .from("notifications")
      .select("id, user_id, customer_email")
      .eq("id", body.id)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
    const own =
      data.user_id === user.id ||
      data.customer_email.toLowerCase() === user.email.toLowerCase();
    if (!own) return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
    const { error: updateError } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.id);
    if (updateError) return NextResponse.json({ error: "Không cập nhật được" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Thiếu id hoặc all" }, { status: 400 });
}
