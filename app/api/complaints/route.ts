import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { COMPLAINT_REASONS, type Complaint, type ComplaintReason } from "@/lib/types";

// Dữ liệu đổi liên tục (khiếu nại mới, trạng thái đổi) — không cache.
export const dynamic = "force-dynamic";

const REASONS: ComplaintReason[] = COMPLAINT_REASONS.map((r) => r.value);

/** Khiếu nại của chính khách đang đăng nhập, mới nhất trước. */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ complaints: [] });
  const [byUserId, byEmail] = await Promise.all([
    sb
      .from("complaints")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("complaints")
      .select("*")
      .ilike("customer_email", user.email)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (byUserId.error) {
    return NextResponse.json({ error: "Không tải được khiếu nại" }, { status: 500 });
  }
  if (byEmail.error) {
    return NextResponse.json({ error: "Không tải được khiếu nại" }, { status: 500 });
  }
  const merged = new Map<string, Complaint>();
  for (const row of [...(byUserId.data ?? []), ...(byEmail.data ?? [])] as Complaint[]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  const complaints = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  return NextResponse.json({ complaints });
}

/** Gửi khiếu nại bảo hành cho 1 món đã giao và còn trong hạn. */
export async function POST(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase — không gửi được khiếu nại" }, { status: 503 });
  }
  try {
    const body = (await req.json()) as { order_item_id?: string; reason?: string; content?: string };
    const itemId = String(body.order_item_id ?? "").trim();
    const reason = String(body.reason ?? "").trim() as ComplaintReason;
    const content = String(body.content ?? "").trim();
    if (!itemId) return NextResponse.json({ error: "Thiếu mã sản phẩm trong đơn" }, { status: 400 });
    if (!REASONS.includes(reason)) return NextResponse.json({ error: "Lý do khiếu nại không hợp lệ" }, { status: 400 });
    if (content.length < 10) return NextResponse.json({ error: "Mô tả khiếu nại tối thiểu 10 ký tự để shop hiểu vấn đề." }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: "Mô tả tối đa 2000 ký tự." }, { status: 400 });

    // Món phải thuộc đơn của chính khách này (khớp user_id hoặc email đặt đơn).
    const { data: item, error: itemErr } = await sb.from("order_items").select("*").eq("id", itemId).single();
    if (itemErr || !item) return NextResponse.json({ error: "Không tìm thấy sản phẩm trong đơn" }, { status: 404 });
    const { data: order, error: ordErr } = await sb.from("orders").select("*").eq("id", item.order_id).single();
    if (ordErr || !order) return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    const own = order.user_id === user.id || String(order.customer_email ?? "").toLowerCase() === user.email.toLowerCase();
    if (!own) return NextResponse.json({ error: "Đơn này không thuộc tài khoản của bạn" }, { status: 403 });

    if (item.status !== "delivered") {
      return NextResponse.json({ error: "Chỉ khiếu nại được món đã giao xong." }, { status: 400 });
    }
    if (!item.warranty_ends_at) {
      return NextResponse.json({ error: "Đơn này chưa ghi ngày giao — liên hệ shop để được hỗ trợ." }, { status: 400 });
    }
    if (new Date(item.warranty_ends_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Món này đã hết hạn bảo hành nên không gửi khiếu nại được nữa." }, { status: 400 });
    }
    // Mỗi món chỉ có tối đa 1 khiếu nại đang mở — tránh spam, khách theo
    // dõi khiếu nại cũ thay vì gửi thêm.
    const { data: open } = await sb
      .from("complaints")
      .select("id, status")
      .eq("order_item_id", itemId)
      .in("status", ["pending", "processing"])
      .limit(1);
    if (open && open.length > 0) {
      return NextResponse.json(
        { error: "Món này đã có khiếu nại đang xử lý — theo dõi khiếu nại cũ bên dưới thay vì gửi thêm.", existing_id: open[0].id },
        { status: 400 },
      );
    }

    const { data, error } = await sb
      .from("complaints")
      .insert({
        order_code: order.code,
        order_item_id: item.id,
        user_id: user.id,
        customer_email: user.email,
        product_name: item.product_name,
        reason,
        content,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: `Không gửi được khiếu nại: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, complaint: data as Complaint });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi gửi khiếu nại" }, { status: 500 });
  }
}
