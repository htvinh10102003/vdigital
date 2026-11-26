import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductStats, Review } from "./types";

/**
 * Số liệu THẬT của sản phẩm — tính từ đơn hàng + đánh giá trong Supabase.
 *
 * - Lượt mua: tổng số lượng trong order_items của các đơn đã trả tiền trở đi
 *   (paid = đã thanh toán, processing = đang xử lý tay, completed = đã giao
 *   xong). KHÔNG đếm đơn pending (chờ thanh toán) hay cancelled (đã hủy).
 * - Đánh giá: trung bình + số lượt + phân bổ sao từ bảng reviews.
 * - Chưa có dữ liệu thì trả 0 — KHÔNG bịa số, KHÔNG dùng cột
 *   rating/review_count/sold_count trong bảng products (đó là số seed cũ).
 */

export const PAID_ORDER_STATUSES = ["paid", "processing", "completed"] as const;

export const EMPTY_STATS: ProductStats = {
  sold: 0,
  rating: 0,
  reviewCount: 0,
  starDist: [0, 0, 0, 0, 0],
};

// Cache số liệu trong bộ nhớ server 60 giây: lượt mua/sao không cần chính
// xác từng giây, nhưng mỗi lần tính lại tốn 2-3 lần gọi DB nối tiếp (đọc
// orders đã trả + reviews) — đây là phần làm /api/catalog + trang chủ chậm.
// Mỗi instance serverless cache riêng, vẫn đúng sau tối đa 60s.
const STATS_TTL_MS = 60_000;
let statsCache: { at: number; data: Record<string, ProductStats> } | null = null;

function emptyStatsMap(): Record<string, ProductStats> {
  return {};
}

export async function getProductStats(
  sb: SupabaseClient,
): Promise<Record<string, ProductStats>> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.data;
  const out: Record<string, ProductStats> = emptyStatsMap();
  const ensure = (id: string): ProductStats => {
    if (!out[id]) out[id] = { sold: 0, rating: 0, reviewCount: 0, starDist: [0, 0, 0, 0, 0] };
    return out[id];
  };
  try {
    // 1. Lượt mua thật: đơn đã trả tiền trở đi.
    const { data: paidOrders, error: ordErr } = await sb
      .from("orders")
      .select("id")
      .in("status", [...PAID_ORDER_STATUSES])
      .limit(5000);
    if (ordErr) throw ordErr;
    const ids = (paidOrders ?? []).map((o: { id: string }) => o.id);
    // PostgREST giới hạn số phần tử trong .in() — chia nhỏ theo 200 id.
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: items, error: itemErr } = await sb
        .from("order_items")
        .select("product_id, quantity")
        .in("order_id", chunk)
        .limit(5000);
      if (itemErr) throw itemErr;
      for (const it of items ?? []) {
        if (!it.product_id) continue;
        ensure(it.product_id).sold += Number(it.quantity ?? 0);
      }
    }
    // 2. Đánh giá thật từ bảng reviews.
    const { data: revs, error: revErr } = await sb
      .from("reviews")
      .select("product_id, stars")
      .limit(5000);
    if (revErr) throw revErr;
    const sums: Record<string, { total: number; count: number }> = {};
    for (const r of revs ?? []) {
      if (!r.product_id) continue;
      const s = ensure(r.product_id);
      const stars = Math.max(1, Math.min(5, Number(r.stars) || 0));
      if (stars < 1) continue;
      s.reviewCount += 1;
      s.starDist[5 - stars] += 1;
      sums[r.product_id] = sums[r.product_id] ?? { total: 0, count: 0 };
      sums[r.product_id].total += stars;
      sums[r.product_id].count += 1;
    }
    for (const [id, s] of Object.entries(sums)) {
      out[id].rating = Math.round((s.total / s.count) * 10) / 10;
    }
  } catch (err) {
    console.error("[stats] Không tính được số liệu thật:", err);
  }
  statsCache = { at: Date.now(), data: out };
  return out;
}

/** Danh sách đánh giá thật của 1 sản phẩm (mới nhất trước). */
export async function getProductReviews(
  sb: SupabaseClient,
  productId: string,
): Promise<Review[]> {
  try {
    const { data, error } = await sb
      .from("reviews")
      .select("id, product_id, user_id, name, stars, content, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as Review[];
  } catch (err) {
    console.error("[stats] Không đọc được đánh giá:", err);
    return [];
  }
}
