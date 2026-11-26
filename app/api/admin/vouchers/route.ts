import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { normalizeVoucherCode } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

/** Chuẩn hoá + kiểm tra target_emails: mảng email hợp lệ hoặc null. */
function parseTargetEmails(v: unknown): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (!Array.isArray(v)) return { ok: false, error: "target_emails phải là danh sách email" };
  const emails = v.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  for (const e of emails) {
    if (!EMAIL_RE.test(e)) return { ok: false, error: `Email không hợp lệ trong target_emails: ${e}` };
  }
  return { ok: true, value: emails.length > 0 ? [...new Set(emails)] : null };
}

/** Kiểm tra expires_at: null hoặc chuỗi ISO hợp lệ. */
function parseExpiresAt(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) {
    return { ok: false, error: "expires_at không đúng định dạng ngày giờ" };
  }
  return { ok: true, value: new Date(v).toISOString() };
}

/**
 * Kiểm tra các trường voucher. Trả { ok:false, error } hoặc
 * { ok:true, patch } với các trường đã chuẩn hoá (chỉ trường có mặt).
 */
function validateVoucherFields(body: Record<string, unknown>, isCreate: boolean) {
  const patch: Record<string, unknown> = {};

  if (isCreate || body.code !== undefined) {
    const code = typeof body.code === "string" ? normalizeVoucherCode(body.code) : "";
    if (!code) return { ok: false as const, error: "Thiếu mã voucher" };
    patch.code = code;
  }
  if (isCreate || body.type !== undefined) {
    if (body.type !== "percent" && body.type !== "fixed") {
      return { ok: false as const, error: "Loại voucher phải là percent hoặc fixed" };
    }
    patch.type = body.type;
  }
  if (isCreate || body.value !== undefined) {
    if (!isInt(body.value) || body.value <= 0) {
      return { ok: false as const, error: "Giá trị giảm phải là số nguyên lớn hơn 0" };
    }
    const type = (patch.type ?? body.type) as string | undefined;
    if (type === "percent" && body.value > 100) {
      return { ok: false as const, error: "Voucher % tối đa là 100%" };
    }
    patch.value = body.value;
  }
  if (body.min_order !== undefined) {
    if (!isInt(body.min_order) || body.min_order < 0) {
      return { ok: false as const, error: "Đơn tối thiểu phải là số nguyên từ 0 trở lên" };
    }
    patch.min_order = body.min_order;
  }
  if (body.max_uses !== undefined) {
    if (body.max_uses !== null && (!isInt(body.max_uses) || body.max_uses <= 0)) {
      return { ok: false as const, error: "Số lượt dùng tối đa phải là số nguyên lớn hơn 0 hoặc để trống" };
    }
    patch.max_uses = body.max_uses;
  }
  if (body.target_emails !== undefined) {
    const parsed = parseTargetEmails(body.target_emails);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    patch.target_emails = parsed.value;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return { ok: false as const, error: "is_active phải là true hoặc false" };
    }
    patch.is_active = body.is_active;
  }
  if (body.expires_at !== undefined) {
    const parsed = parseExpiresAt(body.expires_at);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    patch.expires_at = parsed.value;
  }
  return { ok: true as const, patch };
}

function requireDb() {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return null;
  return sb;
}

/** Danh sách toàn bộ voucher, mới nhất trước. */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const sb = requireDb();
  if (!sb) return err("Supabase chưa cấu hình", 500);
  const { data, error } = await sb.from("vouchers").select("*").order("created_at", { ascending: false });
  if (error) return err(`Không tải được voucher: ${error.message}`, 500);
  return NextResponse.json({ vouchers: data ?? [] });
}

/** Tạo voucher mới. */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return err("Thiếu dữ liệu voucher");
    const validated = validateVoucherFields(body, true);
    if (!validated.ok) return err(validated.error);
    const sb = requireDb();
    if (!sb) return err("Supabase chưa cấu hình", 500);
    const { data: dup } = await sb
      .from("vouchers")
      .select("id")
      .eq("code", validated.patch.code as string)
      .single();
    if (dup) return err("Mã voucher này đã tồn tại", 409);
    const { data, error } = await sb
      .from("vouchers")
      .insert({
        code: validated.patch.code,
        type: validated.patch.type,
        value: validated.patch.value,
        min_order: validated.patch.min_order ?? 0,
        max_uses: validated.patch.max_uses ?? null,
        target_emails: validated.patch.target_emails ?? null,
        is_active: validated.patch.is_active ?? true,
        expires_at: validated.patch.expires_at ?? null,
      })
      .select()
      .single();
    if (error) return err(`Không tạo được voucher: ${error.message}`, 500);
    return NextResponse.json({ ok: true, voucher: data });
  } catch (e) {
    console.error("[admin/vouchers POST]", e);
    return err(e instanceof Error ? e.message : "Lỗi tạo voucher", 500);
  }
}

/** Sửa voucher: { id, ...các trường muốn đổi }. */
export async function PATCH(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return err("Thiếu id voucher");
    const validated = validateVoucherFields(body ?? {}, false);
    if (!validated.ok) return err(validated.error);
    if (Object.keys(validated.patch).length === 0) return err("Không có trường nào để cập nhật");
    const sb = requireDb();
    if (!sb) return err("Supabase chưa cấu hình", 500);
    const { data: cur, error: curErr } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (curErr || !cur) return err("Không tìm thấy voucher", 404);
    // Đổi sang percent: value (mới hoặc cũ) không được vượt 100.
    const nextType = (validated.patch.type ?? cur.type) as string;
    const nextValue = (validated.patch.value ?? cur.value) as number;
    if (nextType === "percent" && nextValue > 100) {
      return err("Voucher % tối đa là 100%");
    }
    // Đổi mã: mã mới chưa được dùng bởi voucher khác.
    if (typeof validated.patch.code === "string" && validated.patch.code !== cur.code) {
      const { data: dup } = await sb
        .from("vouchers")
        .select("id")
        .eq("code", validated.patch.code)
        .neq("id", id)
        .single();
      if (dup) return err("Mã voucher này đã tồn tại", 409);
    }
    const { data, error } = await sb
      .from("vouchers")
      .update(validated.patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return err(`Không cập nhật được voucher: ${error.message}`, 500);
    return NextResponse.json({ ok: true, voucher: data });
  } catch (e) {
    console.error("[admin/vouchers PATCH]", e);
    return err(e instanceof Error ? e.message : "Lỗi cập nhật voucher", 500);
  }
}

/** Xoá voucher: { id } trong body hoặc ?id=. */
export async function DELETE(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    let id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) {
      const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
      id = typeof body?.id === "string" ? body.id : "";
    }
    if (!id) return err("Thiếu id voucher");
    const sb = requireDb();
    if (!sb) return err("Supabase chưa cấu hình", 500);
    const { error } = await sb.from("vouchers").delete().eq("id", id);
    if (error) return err(`Không xoá được voucher: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/vouchers DELETE]", e);
    return err(e instanceof Error ? e.message : "Lỗi xoá voucher", 500);
  }
}
