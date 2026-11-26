import fs from "fs/promises";
import path from "path";
import { DEMO_STOCK, SEED_CATALOG, findVariant } from "./seed";
import { getSupabaseServer, isSupabaseConfigured, requireServiceRoleForWrite } from "./supabase";
import { getProductStats } from "./stats";
import type { Catalog, Order, OrderItem, Product, StockCode, Variant } from "./types";

/**
 * Tầng dữ liệu.
 * - Đã cấu hình Supabase: đọc/ghi DB thật (bảng categories/products/variants/
 *   stock_codes/orders/order_items...). Đây là chế độ production.
 * - Chưa cấu hình: dùng dữ liệu seed trong lib/seed.ts và đơn hàng lưu trong
 *   bộ nhớ của server + file data/demo-orders.json (chế độ demo — chạy thử luồng
 *   mua/giao ngay không cần DB). README hướng dẫn tạo Supabase để có dữ liệu thật.
 *
 * SỐ LIỆU HIỂN THỊ (v4): rating/review_count/sold_count KHÔNG lấy từ cột
 * cùng tên trong bảng products (đó là số seed cũ) mà tính thật từ đơn hàng
 * đã thanh toán + bảng reviews (xem lib/stats.ts). Chưa có dữ liệu thì 0.
 */

// ---------------- Catalog ----------------

export async function getCatalog(): Promise<Catalog> {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return zeroStatsCatalog(SEED_CATALOG);
  try {
    const [cats, prods, vars, banners, faqs] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      sb.from("variants").select("*").eq("is_active", true).order("sort_order"),
      sb.from("banners").select("*").eq("is_active", true).order("sort_order"),
      sb.from("faqs").select("*").order("sort_order"),
    ]);
    if (cats.error || prods.error || vars.error) throw cats.error || prods.error || vars.error;
    const stats = await getProductStats(sb);
    const products = (prods.data ?? []).map((p: any) => ({
      product_type: "account",
      account_type: "shared",
      image_url: null,
      images: [],
      ...p,
      // Số liệu thật từ đơn hàng + reviews — ghi đè số seed cũ trong DB.
      rating: stats[p.id]?.rating ?? 0,
      review_count: stats[p.id]?.reviewCount ?? 0,
      sold_count: stats[p.id]?.sold ?? 0,
      variants: (vars.data ?? [])
        .filter((v: any) => v.product_id === p.id)
        .map((v: any) => ({
          option_type: "duration",
          option_label: null,
          delivery_template: null,
          delivery_note: null,
          manual_fields: [],
          ...v,
        })),
    }));
    return {
      categories: cats.data ?? SEED_CATALOG.categories,
      products,
      banners: banners.data ?? SEED_CATALOG.banners,
      faqs: faqs.data ?? SEED_CATALOG.faqs,
    };
  } catch (err) {
    console.error("[store] Lỗi đọc Supabase, dùng seed:", err);
    return zeroStatsCatalog(SEED_CATALOG);
  }
}

/** Demo / chưa có Supabase: số liệu về 0, KHÔNG hiện số seed giả. */
function zeroStatsCatalog(base: Catalog): Catalog {
  return {
    ...base,
    products: base.products.map((p) => ({ ...p, rating: 0, review_count: 0, sold_count: 0 })),
  };
}

export function findVariantInCatalog(
  catalog: Catalog,
  variantId: string,
): { product: Product; variant: Variant } | null {
  for (const p of catalog.products) {
    const variant = p.variants.find((x) => x.id === variantId);
    if (variant) return { product: p, variant };
  }
  return null;
}

// ---------------- Demo orders (chỉ khi chưa có Supabase) ----------------
// Đơn demo lưu cả trong bộ nhớ lẫn file data/demo-orders.json — vì ở dev mode
// mỗi API route có thể được bundle riêng (mỗi bundle một bản sao module),
// đơn chỉ lưu trong Map của route tạo đơn sẽ không thấy ở route webhook.
// File chung này khắc phục điều đó, và đơn demo cũng không mất khi restart.
// (Production dùng Supabase, không dùng đường này.)
const DEMO_ORDERS_FILE = path.join(process.cwd(), "data", "demo-orders.json");

const demoOrders = new Map<string, Order>();
const demoUsedStock = new Set<string>();

async function readDemoOrdersFile(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(DEMO_ORDERS_FILE, "utf8");
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

async function writeDemoOrdersFile(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DEMO_ORDERS_FILE), { recursive: true });
    await fs.writeFile(DEMO_ORDERS_FILE, JSON.stringify([...demoOrders.values()], null, 2), "utf8");
  } catch {
    /* bỏ qua khi chạy trên Vercel (filesystem chỉ đọc) */
  }
}

export async function getDemoOrder(code: string): Promise<Order | undefined> {
  const hit = demoOrders.get(code);
  if (hit) return hit;
  const all = await readDemoOrdersFile();
  const found = all.find((o) => o.code === code);
  if (found) demoOrders.set(found.code, found);
  return found;
}
export async function listDemoOrders(): Promise<Order[]> {
  const all = await readDemoOrdersFile();
  for (const o of all) demoOrders.set(o.code, o);
  return [...demoOrders.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function saveDemoOrder(order: Order): void {
  demoOrders.set(order.code, order);
  void writeDemoOrdersFile();
}

// ---------------- Stock codes ----------------

export async function takeStockCode(variantId: string, orderId: string): Promise<StockCode | null> {
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    // Ghi is_used cần service_role — không có thì báo rõ, đừng để anon
    // đọc kho trống rồi đơn rơi về "Hết mã" một cách khó hiểu.
    requireServiceRoleForWrite();
    const { data, error } = await sb
      .from("stock_codes")
      .select("*")
      .eq("variant_id", variantId)
      .eq("is_used", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (error || !data) return null;
    await sb.from("stock_codes").update({ is_used: true, used_order_id: orderId }).eq("id", data.id);
    return data as StockCode;
  }
  // Demo: lấy mã chưa dùng trong DEMO_STOCK + file data/demo-stock.json
  // (admin thêm mã trong /admin > Kho mã; file chỉ ghi được khi chạy local/dev).
  const fileCodes = await readDemoStockFile();
  const codes = [...(DEMO_STOCK[variantId] ?? []), ...(fileCodes[variantId] ?? [])];
  const code = codes.find((c) => !demoUsedStock.has(`${variantId}:${c}`));
  if (!code) return null;
  demoUsedStock.add(`${variantId}:${code}`);
  return { id: `demo-${variantId}-${code}`, variant_id: variantId, code, serial: null, pin: null, is_used: true, used_order_id: orderId };
}

const DEMO_STOCK_FILE = path.join(process.cwd(), "data", "demo-stock.json");

export async function readDemoStockFile(): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(DEMO_STOCK_FILE, "utf8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

export async function addDemoStockCodes(variantId: string, codes: string[]): Promise<void> {
  const all = await readDemoStockFile();
  const existing = new Set(all[variantId] ?? []);
  for (const c of codes) if (c.trim()) existing.add(c.trim());
  all[variantId] = [...existing];
  await fs.mkdir(path.dirname(DEMO_STOCK_FILE), { recursive: true });
  await fs.writeFile(DEMO_STOCK_FILE, JSON.stringify(all, null, 2), "utf8");
}

// ---------------- Orders (Supabase hoặc demo) ----------------

export function newOrderCode(): string {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VD${stamp}-${rand}`;
}

export async function createOrder(input: {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  user_id: string | null;
  items: { variantId: string; qty: number; customerInfo?: Record<string, string> }[];
}): Promise<Order> {
  const catalog = await getCatalog();
  let total = 0;
  const items: OrderItem[] = [];
  for (const it of input.items) {
    const found = findVariantInCatalog(catalog, it.variantId) ?? findVariant(it.variantId);
    if (!found) throw new Error(`Không tìm thấy gói ${it.variantId}`);
    total += found.variant.price * it.qty;
    items.push({
      id: `item-${Math.random().toString(36).slice(2, 9)}`,
      order_id: "",
      product_id: found.product.id,
      variant_id: found.variant.id,
      product_name: found.product.name,
      variant_name: found.variant.label,
      price: found.variant.price,
      quantity: it.qty,
      fulfillment_type: found.variant.fulfillment_type,
      status: "pending",
      delivered_code: null,
      delivered_serial: null,
      delivered_pin: null,
      delivered_note: null,
      // Thông tin khách điền theo manual_fields của gói (gói làm tay) —
      // admin xem trong chi tiết đơn để xử lý tay.
      customer_info: it.customerInfo ?? null,
    });
  }
  const order: Order = {
    id: `ord-${Math.random().toString(36).slice(2, 10)}`,
    code: newOrderCode(),
    payos_order_code: Math.floor(Date.now() / 1000) % 2147483647,
    customer_name: input.customer_name,
    customer_email: input.customer_email,
    customer_phone: input.customer_phone,
    user_id: input.user_id,
    status: "pending",
    total,
    payment_method: "payos-vietqr",
    payment_link_id: null,
    checkout_url: null,
    admin_note: null,
    created_at: new Date().toISOString(),
    items,
  };
  order.items.forEach((i) => (i.order_id = order.id));

  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    // Chưa có service_role thì dừng ngay với lỗi rõ ràng — đừng để anon
    // client chạm vào bảng orders rồi nhận "permission denied for table orders".
    requireServiceRoleForWrite();
    const { data: ord, error } = await sb
      .from("orders")
      .insert({
        code: order.code,
        payos_order_code: order.payos_order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        user_id: order.user_id,
        status: order.status,
        total: order.total,
        payment_method: order.payment_method,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Lưu đơn vào Supabase thất bại: ${error.message}`);
    let savedItems = null as OrderItem[] | null;
    let itemErr = null as { message: string } | null;
    {
      const res = await sb
        .from("order_items")
        .insert(
          items.map((i) => ({
            order_id: ord.id,
            product_id: i.product_id,
            variant_id: i.variant_id,
            product_name: i.product_name,
            variant_name: i.variant_name,
            price: i.price,
            quantity: i.quantity,
            fulfillment_type: i.fulfillment_type,
            status: i.status,
            customer_info: i.customer_info ?? {},
          })),
        )
        .select("*");
      savedItems = res.data as OrderItem[] | null;
      itemErr = res.error;
      // DB chưa chạy migration 005 (chưa có cột customer_info) thì lưu lại
      // không kèm thông tin khách — đơn vẫn phải lưu được, không được hỏng.
      if (itemErr && itemErr.message.includes("customer_info")) {
        const retry = await sb
          .from("order_items")
          .insert(
            items.map((i) => ({
              order_id: ord.id,
              product_id: i.product_id,
              variant_id: i.variant_id,
              product_name: i.product_name,
              variant_name: i.variant_name,
              price: i.price,
              quantity: i.quantity,
              fulfillment_type: i.fulfillment_type,
              status: i.status,
            })),
          )
          .select("*");
        savedItems = retry.data as OrderItem[] | null;
        itemErr = retry.error;
      }
    }
    if (itemErr) throw new Error(`Lưu chi tiết đơn thất bại: ${itemErr.message}`);
    order.id = ord.id;
    order.items = savedItems as OrderItem[];
    return order;
  }
  saveDemoOrder(order);
  return order;
}

export async function getOrderByCode(code: string): Promise<Order | null> {
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    const { data: ord } = await sb.from("orders").select("*").eq("code", code).single();
    if (!ord) return null;
    const { data: items } = await sb.from("order_items").select("*").eq("order_id", ord.id);
    return { ...ord, items: (items ?? []) as OrderItem[] };
  }
  return (await getDemoOrder(code)) ?? null;
}

export async function getOrderByPayosCode(payosCode: number): Promise<Order | null> {
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    const { data: ord } = await sb.from("orders").select("*").eq("payos_order_code", payosCode).single();
    if (!ord) return null;
    const { data: items } = await sb.from("order_items").select("*").eq("order_id", ord.id);
    return { ...ord, items: (items ?? []) as OrderItem[] };
  }
  for (const o of await listDemoOrders()) if (o.payos_order_code === payosCode) return o;
  return null;
}

export async function listOrders(): Promise<Order[]> {
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    const { data: ords } = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    const orders: Order[] = [];
    for (const o of ords ?? []) {
      const { data: items } = await sb.from("order_items").select("*").eq("order_id", o.id);
      orders.push({ ...o, items: (items ?? []) as OrderItem[] });
    }
    return orders;
  }
  return listDemoOrders();
}

export async function updateOrder(order: Order): Promise<void> {
  const sb = getSupabaseServer();
  if (sb && isSupabaseConfigured) {
    requireServiceRoleForWrite();
    await sb
      .from("orders")
      .update({
        status: order.status,
        payment_link_id: order.payment_link_id,
        checkout_url: order.checkout_url,
        admin_note: order.admin_note,
      })
      .eq("id", order.id);
    for (const item of order.items) {
      await sb
        .from("order_items")
        .update({
          status: item.status,
          delivered_code: item.delivered_code,
          delivered_serial: item.delivered_serial,
          delivered_pin: item.delivered_pin,
          delivered_note: item.delivered_note,
        })
        .eq("id", item.id);
    }
    return;
  }
  saveDemoOrder(order);
}
