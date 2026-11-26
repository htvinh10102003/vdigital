import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { DEFAULT_TEMPLATES, type EmailTemplateType } from "@/lib/email";
import { getSupabaseServer, isSupabaseConfigured, requireServiceRoleForWrite } from "@/lib/supabase";

/**
 * GET /api/admin/email-templates — danh sách mẫu đã lưu (theo loại + theo
 * sản phẩm). Chưa lưu gì thì trả mẫu mặc định để admin xem/sửa.
 * POST { type, product_id, subject, body } — lưu/ghi đè 1 mẫu.
 * POST { action: "reset", type, product_id } — xóa mẫu đã lưu → về mặc định.
 */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const defaults = (Object.keys(DEFAULT_TEMPLATES) as EmailTemplateType[]).map((type) => ({
    type,
    product_id: null as string | null,
    subject: DEFAULT_TEMPLATES[type].subject,
    body: DEFAULT_TEMPLATES[type].body,
    is_default: true,
  }));
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ templates: defaults });
  try {
    const { data, error } = await sb.from("email_templates").select("*").order("type");
    if (error) return NextResponse.json({ templates: defaults });
    const saved = (data ?? []).map((t: any) => ({ ...t, is_default: false }));
    return NextResponse.json({ templates: [...saved, ...defaults] });
  } catch {
    return NextResponse.json({ templates: defaults });
  }
}

export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase — mẫu chưa lưu được" }, { status: 503 });
  }
  requireServiceRoleForWrite();
  try {
    const body = await req.json();
    const type = String(body.type ?? "") as EmailTemplateType;
    if (!DEFAULT_TEMPLATES[type]) return NextResponse.json({ error: "Loại mẫu không hợp lệ" }, { status: 400 });
    const productId = body.product_id ? String(body.product_id) : null;

    if (body.action === "reset") {
      const q = sb.from("email_templates").delete().eq("type", type);
      const { error } = productId ? await q.eq("product_id", productId) : await q.is("product_id", null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, reset: true });
    }

    const subject = String(body.subject ?? "").trim();
    const tplBody = String(body.body ?? "").trim();
    if (!subject || !tplBody) return NextResponse.json({ error: "Nhập đủ tiêu đề và nội dung" }, { status: 400 });
    const row = { type, product_id: productId, subject, body: tplBody, updated_at: new Date().toISOString() };
    // Ghi đè mẫu cùng (type, product_id) nếu đã có.
    const q = sb.from("email_templates").select("id").eq("type", type);
    const found = productId
      ? await q.eq("product_id", productId).maybeSingle()
      : await q.is("product_id", null).maybeSingle();
    const existingId = (found.data as { id: string } | null)?.id ?? null;
    const { error } = existingId
      ? await sb.from("email_templates").update(row).eq("id", existingId)
      : await sb.from("email_templates").insert(row);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi lưu mẫu mail" }, { status: 500 });
  }
}
