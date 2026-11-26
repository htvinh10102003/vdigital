import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { addDemoStockCodes } from "@/lib/store";

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
