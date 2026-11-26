import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/pending — món đã giao mà khách chưa đánh giá (để popup
 * nhắc góc màn hình + trang Đơn hàng biết cần nhắc). Tối đa 10 món, mới
 * giao trước.
 */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ items: [] });

  const { data: orders } = await sb
    .from("orders")
    .select("id, code")
    .eq("user_id", user.id)
    .in("status", ["processing", "completed"])
    .order("created_at", { ascending: false })
    .limit(20);
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
  if (orderIds.length === 0) return NextResponse.json({ items: [] });

  const { data: items } = await sb
    .from("order_items")
    .select("id, order_id, product_id, product_name, variant_name")
    .in("order_id", orderIds)
    .eq("status", "delivered")
    .limit(100);
  if (!items?.length) return NextResponse.json({ items: [] });

  const { data: reviewed } = await sb
    .from("reviews")
    .select("product_id")
    .eq("user_id", user.id);
  const reviewedSet = new Set((reviewed ?? []).map((r: { product_id: string }) => r.product_id));
  const orderCode = new Map((orders ?? []).map((o: { id: string; code: string }) => [o.id, o.code]));

  const pending = (items as { id: string; order_id: string; product_id: string; product_name: string; variant_name: string }[])
    .filter((it) => it.product_id && !reviewedSet.has(it.product_id))
    .slice(0, 10)
    .map((it) => ({
      itemId: it.id,
      orderId: it.order_id,
      orderCode: orderCode.get(it.order_id) ?? "",
      productId: it.product_id,
      productName: it.product_name,
      variantName: it.variant_name,
    }));
  return NextResponse.json({ items: pending });
}
