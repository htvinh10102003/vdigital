import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { createNotification } from "@/lib/notifications";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { COMPLAINT_STATUS_LABELS, type Complaint, type ComplaintStatus } from "@/lib/types";

// Dữ liệu đổi liên tục (khiếu nại mới, trạng thái đổi) — không cache.
export const dynamic = "force-dynamic";

const STATUSES: ComplaintStatus[] = ["pending", "processing", "resolved", "rejected"];

/** Danh sách khiếu nại, lọc theo ?status= (mặc định tất cả), mới nhất trước. */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ complaints: [] });
  const status = new URL(req.url).searchParams.get("status") ?? "";
  let q = sb.from("complaints").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && STATUSES.includes(status as ComplaintStatus)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Không tải được khiếu nại" }, { status: 500 });
  return NextResponse.json({ complaints: (data ?? []) as Complaint[] });
}

/** Đổi trạng thái / trả lời khiếu nại. Đổi trạng thái thì báo chuông cho khách. */
export async function PATCH(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase" }, { status: 503 });
  }
  try {
    const body = (await req.json()) as { id?: string; status?: string; admin_reply?: string };
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim() as ComplaintStatus;
    const adminReply = String(body.admin_reply ?? "").trim();
    if (!id) return NextResponse.json({ error: "Thiếu mã khiếu nại" }, { status: 400 });
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    if (adminReply.length > 2000) return NextResponse.json({ error: "Lời nhắn tối đa 2000 ký tự." }, { status: 400 });

    const { data: current, error: curErr } = await sb.from("complaints").select("*").eq("id", id).single();
    if (curErr || !current) return NextResponse.json({ error: "Không tìm thấy khiếu nại" }, { status: 404 });
    const { data, error } = await sb
      .from("complaints")
      .update({ status, admin_reply: adminReply || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: `Không cập nhật được: ${error.message}` }, { status: 500 });

    // Báo chuông cho khách khi trạng thái đổi (best-effort).
    if (current.status !== status) {
      await createNotification({
        userId: current.user_id ?? null,
        email: current.customer_email,
        type: "info",
        title: "Khiếu nại đã được cập nhật",
        body: `Khiếu nại đơn ${current.order_code} đã chuyển sang trạng thái “${COMPLAINT_STATUS_LABELS[status]}”.`,
        orderCode: current.order_code,
      });
    }
    return NextResponse.json({ ok: true, complaint: data as Complaint });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi cập nhật khiếu nại" }, { status: 500 });
  }
}
