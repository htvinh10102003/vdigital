import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/** GET /api/reviews/mine — đánh giá của chính khách (để trang Đơn hàng biết món nào đã đánh giá). */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ reviews: [] });
  const { data } = await sb
    .from("reviews")
    .select("id, product_id, user_id, name, stars, content, created_at, order_id, reward_xu")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ reviews: data ?? [] });
}
