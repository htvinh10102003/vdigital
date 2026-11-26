import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Xoá hẳn từ /admin. Body: { kind: "product" | "category" | "banner" | "faq", id }.
 * - Xoá sản phẩm: chặn khi đã có đơn hàng dùng gói của nó (lịch sử đơn phải giữ
 *   nguyên); còn không thì xoá mã kho chưa dùng, gói, đánh giá rồi mới xoá sản phẩm.
 *   Mẫu email riêng của sản phẩm tự xoá theo (FK on delete cascade).
 * - Xoá danh mục: chặn khi còn sản phẩm trong danh mục đó.
 * - Chưa có Supabase thì trả mode "demo" để client tự xoá khỏi localStorage.
 */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const { kind, id } = (await req.json()) as { kind?: string; id?: string };
    if (!kind || !id) {
      return NextResponse.json({ error: "Thiếu loại hoặc id cần xoá." }, { status: 400 });
    }
    const sb = getSupabaseServer();
    if (!sb || !isSupabaseConfigured) {
      return NextResponse.json({ ok: true, mode: "demo" });
    }

    if (kind === "product") {
      const { data: variants } = await sb.from("variants").select("id").eq("product_id", id);
      const variantIds = (variants ?? []).map((v: { id: string }) => v.id);
      if (variantIds.length > 0) {
        const { count } = await sb
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .in("variant_id", variantIds);
        if (count && count > 0) {
          return NextResponse.json(
            { error: "Sản phẩm này đã có đơn hàng, không xoá được — chỉ ẩn được (bỏ tick Đang bán)." },
            { status: 409 },
          );
        }
        await sb.from("stock_codes").delete().in("variant_id", variantIds);
      }
      await sb.from("variants").delete().eq("product_id", id);
      await sb.from("reviews").delete().eq("product_id", id);
      const { error } = await sb.from("products").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else if (kind === "category") {
      const { count } = await sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);
      if (count && count > 0) {
        return NextResponse.json(
          { error: "Danh mục này còn sản phẩm, không xoá được — chuyển hết sản phẩm sang danh mục khác trước." },
          { status: 409 },
        );
      }
      const { error } = await sb.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else if (kind === "banner") {
      const { error } = await sb.from("banners").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else if (kind === "faq") {
      const { error } = await sb.from("faqs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      return NextResponse.json({ error: "Loại không hợp lệ." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mode: "supabase" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xoá thất bại." },
      { status: 500 },
    );
  }
}
