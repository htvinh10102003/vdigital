import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { getProductReviews } from "@/lib/stats";
import type { Review } from "@/lib/types";

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

  // 1 tài khoản / 1 sản phẩm: ghi đè đánh giá cũ nếu đã có.
  // (Migration 005 thêm unique index (product_id, user_id) để chặn trùng
  // ở DB; ở đây vẫn kiểm tra bằng tay để chạy được cả khi chưa chạy 005.)
  const { data: existing } = await sb
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();
  const row = { product_id: productId, user_id: user.id, name, stars, content };
  const { error: upErr } = existing
    ? await sb.from("reviews").update(row).eq("id", existing.id)
    : await sb.from("reviews").insert(row);
  if (upErr) return NextResponse.json({ error: `Không gửi được đánh giá: ${upErr.message}` }, { status: 500 });

  const reviews = await getProductReviews(sb, productId);
  const mine = reviews.find((r) => r.user_id === user.id) ?? null;
  return NextResponse.json({ review: mine, ...aggregate(reviews) });
}
