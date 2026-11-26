import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { getProductReviews } from "@/lib/stats";
import { adjustBalance } from "@/lib/wallet";
import type { Review } from "@/lib/types";

/** Thưởng Xu cho đánh giá theo đơn (v4.10): 5 sao 200 Xu, dưới 5 sao 100 Xu. */
const REVIEW_REWARD_5_STARS = 200;
const REVIEW_REWARD_DEFAULT = 100;

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

function aggregate(reviews: Review[]) {
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let total = 0;
  for (const r of reviews) {
    const s = Math.max(1, Math.min(5, r.stars));
    dist[5 - s] += 1;
    total += s;
  }
  const count = reviews.length;
  return { avg: count ? Math.round((total / count) * 10) / 10 : 0, count, dist };
}

/** GET /api/reviews?productId=... → đánh giá thật + trung bình + phân bổ sao. */
export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  if (!productId) return NextResponse.json({ error: "Thiếu productId" }, { status: 400 });
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ reviews: [], avg: 0, count: 0, dist: [0, 0, 0, 0, 0] });
  const reviews = await getProductReviews(sb, productId);
  return NextResponse.json({ reviews, ...aggregate(reviews) });
}

/**
 * POST /api/reviews — khách đã đăng nhập gửi đánh giá (cần Bearer token).
 * Ghi vào bảng reviews; 1 tài khoản chỉ được 1 đánh giá / sản phẩm
 * (ghi đè đánh giá cũ nếu đã có).
 *
 * Đánh giá theo đơn (v4.10): body thêm orderId — chỉ đánh giá được món
 * ĐÃ GIAO trong đơn của chính mình. Đánh giá đầu tiên của 1 sản phẩm được
 * thưởng Xu (5 sao 200 Xu, dưới 5 sao 100 Xu); sửa lại đánh giá cũ thì
 * không thưởng nữa.
 */
export async function POST(req: Request) {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json({ error: "Chưa cấu hình Supabase" }, { status: 503 });
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Bạn cần đăng nhập để viết đánh giá" }, { status: 401 });
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId ?? "");
  const stars = Math.round(Number(body.stars) || 0);
  const content = String(body.content ?? "").trim();
  const orderId = String(body.orderId ?? "") || null;
  if (!productId) return NextResponse.json({ error: "Thiếu sản phẩm" }, { status: 400 });
  if (stars < 1 || stars > 5) return NextResponse.json({ error: "Đánh giá phải từ 1 đến 5 sao" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "Hãy viết nội dung đánh giá" }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: "Đánh giá tối đa 1000 ký tự" }, { status: 400 });

  const user = userData.user;
  const name =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "Khách hàng";

  // Đánh giá theo đơn: đơn phải của mình và món phải đã giao.
  let orderCode: string | null = null;
  if (orderId) {
    const { data: order } = await sb
      .from("orders")
      .select("id, code, user_id, customer_email")
      .eq("id", orderId)
      .maybeSingle();
    const mine =
      order &&
      (order.user_id === user.id ||
        String(order.customer_email ?? "").toLowerCase() === (user.email ?? "").toLowerCase());
    if (!mine) return NextResponse.json({ error: "Không tìm thấy đơn hàng này" }, { status: 403 });
    const { data: item } = await sb
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", productId)
      .eq("status", "delivered")
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Chỉ đánh giá được món đã giao trong đơn của bạn" }, { status: 400 });
    orderCode = order.code;
  }

  // 1 tài khoản / 1 sản phẩm: ghi đè đánh giá cũ nếu đã có.
  // (Migration 005 thêm unique index (product_id, user_id) để chặn trùng
  // ở DB; ở đây vẫn kiểm tra bằng tay để chạy được cả khi chưa chạy 005.)
  const { data: existing } = await sb
    .from("reviews")
    .select("id, reward_xu")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();
  const row = { product_id: productId, user_id: user.id, name, stars, content };
  let reward = 0;
  if (existing) {
    const { error: upErr } = await sb.from("reviews").update(row).eq("id", existing.id);
    if (upErr) return NextResponse.json({ error: `Không gửi được đánh giá: ${upErr.message}` }, { status: 500 });
  } else {
    const isFirstWithOrder = Boolean(orderId);
    reward = isFirstWithOrder ? (stars === 5 ? REVIEW_REWARD_5_STARS : REVIEW_REWARD_DEFAULT) : 0;
    const { error: insErr } = await sb.from("reviews").insert({
      ...row,
      order_id: orderId,
      reward_xu: reward,
    });
    if (insErr) return NextResponse.json({ error: `Không gửi được đánh giá: ${insErr.message}` }, { status: 500 });
  }

  // Cộng thưởng (chỉ đánh giá mới theo đơn). Cộng hỏng thì hoàn thưởng về
  // 0 để lần sau không cộng trùng — đánh giá vẫn được giữ.
  let balance: number | null = null;
  if (reward > 0) {
    try {
      balance = await adjustBalance({
        userId: user.id,
        email: user.email ?? "",
        amount: reward,
        type: "review",
        refCode: `REVIEW-${orderCode ?? orderId}`,
        note: `Thưởng đánh giá ${stars} sao`,
      });
    } catch (e) {
      console.error("[reviews] cộng thưởng thất bại:", e);
      reward = 0;
      await sb
        .from("reviews")
        .update({ reward_xu: 0 })
        .eq("product_id", productId)
        .eq("user_id", user.id);
    }
  }

  const { data: mineRow } = await sb
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();
  const reviews = await getProductReviews(sb, productId);
  return NextResponse.json({
    review: (mineRow ?? reviews.find((r) => r.user_id === user.id) ?? null) as Review | null,
    reward,
    balance,
    ...aggregate(reviews),
  });
}
