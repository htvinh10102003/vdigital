import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { PAID_ORDER_STATUSES } from "@/lib/stats";

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/insights?from=YYYY-MM-DD&to=YYYY-MM-DD — Báo cáo doanh thu
 * + lượt xem. Mọi số tính thật từ orders/order_items/page_views.
 * Doanh thu chỉ tính đơn đã trả tiền trở đi (paid/processing/completed).
 * Mặc định 30 ngày gần nhất. Lượt xem: hôm nay / 7 ngày / 30 ngày tính
 * từ bảng page_views (migration 006); chưa có bảng thì trả 0.
 */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const from =
    url.searchParams.get("from") ??
    new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const fromIso = `${from}T00:00:00+07:00`;
  const toIso = `${to}T23:59:59+07:00`;

  const empty = {
    summary: { revenue: 0, orders: 0, avgOrder: 0, paidOrders: 0, cancelledOrders: 0 },
    byDay: [] as { date: string; revenue: number; orders: number }[],
    topProducts: [] as { product_name: string; qty: number; revenue: number }[],
    byCategory: [] as { category: string; revenue: number }[],
    byPayment: [] as { method: string; count: number; revenue: number }[],
    pageViews: { today: 0, last7: 0, last30: 0, topPages: [] as { path: string; views: number }[] },
  };
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return NextResponse.json(empty);

  // Đơn trong khoảng (mọi trạng thái) + items của đơn đã trả tiền.
  const [{ data: orders }, { data: paidOrders }] = await Promise.all([
    sb.from("orders").select("id, code, status, total, payment_method, created_at").gte("created_at", fromIso).lte("created_at", toIso).limit(5000),
    sb.from("orders").select("id").in("status", [...PAID_ORDER_STATUSES]).gte("created_at", fromIso).lte("created_at", toIso).limit(5000),
  ]);
  const paidIds = new Set((paidOrders ?? []).map((o: { id: string }) => o.id));
  const all = orders ?? [];
  const paid = all.filter((o: any) => paidIds.has(o.id));
  const revenue = paid.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const byDayMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of paid) {
    const d = String(o.created_at).slice(0, 10);
    const cur = byDayMap.get(d) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.total ?? 0);
    cur.orders += 1;
    byDayMap.set(d, cur);
  }
  // Lấp ngày trống trong khoảng để biểu đồ không bị đứt.
  const days: { date: string; revenue: number; orders: number }[] = [];
  for (let t = new Date(fromIso).getTime(); t <= new Date(toIso).getTime(); t += 86400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const cur = byDayMap.get(d) ?? { revenue: 0, orders: 0 };
    days.push({ date: d, ...cur });
  }
  // Items của đơn đã trả tiền — top sản phẩm + doanh thu theo danh mục.
  const prodMap = new Map<string, { qty: number; revenue: number }>();
  const catMap = new Map<string, number>();
  const { data: cats } = await sb.from("categories").select("id, name");
  const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
  const { data: prods } = await sb.from("products").select("id, category_id");
  const prodCat = new Map((prods ?? []).map((p: any) => [p.id, p.category_id]));
  const paidIdList = [...paidIds];
  for (let i = 0; i < paidIdList.length; i += 200) {
    const chunk = paidIdList.slice(i, i + 200);
    const { data: items } = await sb
      .from("order_items")
      .select("product_id, product_name, price, quantity")
      .in("order_id", chunk)
      .limit(5000);
    for (const it of items ?? []) {
      const cur = prodMap.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity ?? 0);
      cur.revenue += Number(it.price ?? 0) * Number(it.quantity ?? 0);
      prodMap.set(it.product_name, cur);
      const cat = catName.get(prodCat.get(it.product_id) ?? "") ?? "Khác";
      catMap.set(cat, (catMap.get(cat) ?? 0) + Number(it.price ?? 0) * Number(it.quantity ?? 0));
    }
  }
  const topProducts = [...prodMap.entries()]
    .map(([product_name, v]) => ({ product_name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const byCategory = [...catMap.entries()]
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const payMap = new Map<string, { count: number; revenue: number }>();
  for (const o of paid) {
    const m = o.payment_method === "manual-bank" ? "Chuyển khoản ngân hàng" : "VietQR (PayOS)";
    const cur = payMap.get(m) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(o.total ?? 0);
    payMap.set(m, cur);
  }
  const byPayment = [...payMap.entries()].map(([method, v]) => ({ method, ...v }));

  // Lượt xem từ bảng page_views (nếu chưa chạy migration 006 thì 0).
  const pageViews = { today: 0, last7: 0, last30: 0, topPages: [] as { path: string; views: number }[] };
  try {
    const now = new Date();
    const todayIso = `${now.toISOString().slice(0, 10)}T00:00:00+07:00`;
    const d7Iso = new Date(now.getTime() - 6 * 86400_000).toISOString().slice(0, 10) + "T00:00:00+07:00";
    const d30Iso = new Date(now.getTime() - 29 * 86400_000).toISOString().slice(0, 10) + "T00:00:00+07:00";
    const [t, w, m, top] = await Promise.all([
      sb.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      sb.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", d7Iso),
      sb.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", d30Iso),
      sb.from("page_views").select("path").gte("created_at", d30Iso).limit(5000),
    ]);
    if (!t.error && !w.error && !m.error) {
      pageViews.today = t.count ?? 0;
      pageViews.last7 = w.count ?? 0;
      pageViews.last30 = m.count ?? 0;
      const counts = new Map<string, number>();
      for (const r of top.data ?? []) counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
      pageViews.topPages = [...counts.entries()]
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
    }
  } catch {
    /* bảng page_views chưa có — giữ 0 */
  }

  return NextResponse.json({
    summary: {
      revenue,
      orders: all.length,
      paidOrders: paid.length,
      cancelledOrders: all.filter((o: any) => o.status === "cancelled").length,
      avgOrder: paid.length ? Math.round(revenue / paid.length) : 0,
    },
    byDay: days,
    topProducts,
    byCategory,
    byPayment,
    pageViews,
  });
}
