import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured, requireServiceRoleForWrite } from "@/lib/supabase";
import { addDemoStockCodes, getCatalog, readDemoStockFile } from "@/lib/store";
import { DEMO_STOCK } from "@/lib/seed";

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stock — bảng kho mã đầy đủ: theo từng gói, tổng/đã dùng/
 * còn lại, trạng thái từng mã. Mã đã giao KHÔNG hiện nguyên mã (chỉ hiện
 * "Đã giao" + mã đơn) để tránh lộ mã.
 * DELETE /api/admin/stock?id=... — xóa mã CHƯA dùng. Mã đã giao không xóa được.
 */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const sb = getSupabaseServer();
  const catalog = await getCatalog();
  const variantName = new Map<string, { product: string; variant: string }>();
  for (const p of catalog.products) {
    for (const v of p.variants) variantName.set(v.id, { product: p.name, variant: v.label });
  }
  if (sb && isSupabaseConfigured) {
    const [{ data: codes }, { data: orders }] = await Promise.all([
      sb.from("stock_codes").select("*").order("created_at", { ascending: false }).limit(2000),
      sb.from("orders").select("id, code").limit(5000),
    ]);
    const orderCode = new Map((orders ?? []).map((o: { id: string; code: string }) => [o.id, o.code]));
    const rows = (codes ?? []).map((c: any) => {
      const names = variantName.get(c.variant_id) ?? { product: "—", variant: c.variant_id };
      const used = Boolean(c.is_used);
      return {
        id: c.id,
        variant_id: c.variant_id,
        product_name: names.product,
        variant_name: names.variant,
        // Mã chưa dùng: hiện nguyên mã để admin đối chiếu. Mã đã giao: che.
        code: used ? maskCode(String(c.code)) : String(c.code),
        is_used: used,
        order_code: used ? orderCode.get(c.used_order_id) ?? c.used_order_id ?? null : null,
        is_demo: String(c.code).startsWith("VD-DEMO-"),
        created_at: c.created_at,
      };
    });
    return NextResponse.json({ rows });
  }
  // Demo: gộp DEMO_STOCK + file demo-stock.json (chưa dùng = tất cả).
  const fileCodes = await readDemoStockFile();
  const rows: any[] = [];
  for (const p of catalog.products) {
    for (const v of p.variants) {
      if (v.fulfillment_type !== "auto") continue;
      const codes = [...(DEMO_STOCK[v.id] ?? []), ...(fileCodes[v.id] ?? [])];
      for (const code of codes) {
        rows.push({
          id: `demo-${v.id}-${code}`,
          variant_id: v.id,
          product_name: p.name,
          variant_name: v.label,
          code,
          is_used: false,
          order_code: null,
          is_demo: code.startsWith("VD-DEMO-"),
          created_at: null,
        });
      }
    }
  }
  return NextResponse.json({ rows });
}

export async function DELETE(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Thiếu id mã" }, { status: 400 });
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    requireServiceRoleForWrite();
    const { data: row, error: readErr } = await sb.from("stock_codes").select("id, is_used").eq("id", id).maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Không tìm thấy mã" }, { status: 404 });
    if (row.is_used) return NextResponse.json({ error: "Mã đã giao cho khách, không được xóa" }, { status: 400 });
    const { error } = await sb.from("stock_codes").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Chế độ demo không hỗ trợ xóa mã — hãy cấu hình Supabase" }, { status: 400 });
}

function maskCode(code: string): string {
  if (code.length <= 6) return "••••••";
  return `${code.slice(0, 2)}••••••${code.slice(-2)}`;
}

/** Thêm mã vào kho (gói giao tự động). Body: { variantId, codes: string[] } */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = await req.json();
    const { variantId, codes } = body as { variantId: string; codes: string[] };
    const clean = (codes ?? []).map((c) => String(c).trim()).filter(Boolean);
    if (!variantId || !clean.length) {
      return NextResponse.json({ error: "Nhập ít nhất 1 mã" }, { status: 400 });
    }
    const sb = getSupabaseServer();
    if (sb && isSupabaseConfigured) {
      requireServiceRoleForWrite();
      const { error } = await sb.from("stock_codes").insert(
        clean.map((code) => ({ variant_id: variantId, code, is_used: false })),
      );
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, added: clean.length, mode: "supabase" });
    }
    await addDemoStockCodes(variantId, clean);
    return NextResponse.json({
      ok: true,
      added: clean.length,
      mode: "demo",
      note: "Đã lưu vào data/demo-stock.json (chỉ khi chạy local). Trên Vercel, mã demo không lưu lâu dài — hãy cấu hình Supabase.",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi thêm mã" }, { status: 500 });
  }
}
