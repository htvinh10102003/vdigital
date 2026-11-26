"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, useAuth, useCatalog, saveCatalogOverrides } from "@/components/providers";
import { getSupabase } from "@/lib/supabase";
import { formatDateTime, formatVND, slugify } from "@/lib/format";
import type { Banner, Category, Faq, Order, Product, Variant } from "@/lib/types";
import { ACCOUNT_TYPES, FULFILLMENT_TYPES, OPTION_TYPES, PRODUCT_TYPES } from "@/lib/types";
import { ImageUpload } from "@/components/ImageUpload";

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } else {
    h["x-demo-admin"] = "1";
  }
  return h;
}

type Tab = "overview" | "orders" | "products" | "stock" | "content" | "settings";

function newVariant(productId: string, sortOrder: number): Variant {
  return {
    id: `v-${Date.now()}`,
    product_id: productId,
    name: "Gói mới",
    label: "Gói mới",
    price: 0,
    original_price: 0,
    fulfillment_type: "auto",
    option_type: "duration",
    option_label: null,
    delivery_template: null,
    delivery_note: null,
    is_flash: false,
    flash_ends_at: null,
    stock_count: null,
    is_active: true,
    sort_order: sortOrder,
  };
}

function newProduct(): Product {
  const id = `p-${Date.now()}`;
  return {
    id,
    slug: `san-pham-${Date.now()}`,
    category_id: "cat-license",
    name: "Sản phẩm mới",
    tagline: "",
    description: "",
    guide: "",
    warranty_days: 30,
    rating: 5,
    review_count: 0,
    sold_count: 0,
    is_featured: false,
    is_new: true,
    is_best_seller: false,
    is_active: true,
    product_type: "account",
    account_type: "shared",
    image_url: null,
    images: [],
    gradient: "from-indigo-600 to-violet-600",
    initials: "VD",
    created_at: new Date().toISOString(),
    variants: [newVariant(id, 1)],
  };
}

export default function AdminPage() {
  const auth = useAuth();
  const { catalog, refresh } = useCatalog();
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [gameForm, setGameForm] = useState<Record<string, { serial: string; pin: string; denomination: string; note: string }>>({});
  const [manualNote, setManualNote] = useState<Record<string, string>>({});

  const [editId, setEditId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockVariant, setStockVariant] = useState("");
  const [stockCodes, setStockCodes] = useState("");

  // Nội dung: danh mục / banner / FAQ
  const [editCats, setEditCats] = useState<Category[] | null>(null);
  const [editBanners, setEditBanners] = useState<Banner[] | null>(null);
  const [editFaqs, setEditFaqs] = useState<Faq[] | null>(null);


  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders", { headers: await adminHeaders() });
      const data = await res.json();
      if (res.ok) setOrders(data.orders);
      else setMsg(data.error || "Không tải được đơn");
    } catch {
      setMsg("Lỗi tải đơn");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const res = await fetch("/api/admin/settings", { headers: await adminHeaders() });
    if (res.ok) setSettings(await res.json());
  }

  useEffect(() => {
    if (auth.isAdmin) {
      loadOrders();
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status !== "pending" && o.status !== "cancelled");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const waiting = orders.flatMap((o) => o.items).filter((i) => i.status === "waiting_manual").length;
    return { revenue, totalOrders: orders.length, waiting };
  }, [orders]);

  async function adminAction(action: string, orderCode: string, itemId: string, extra: Record<string, string> = {}) {
    setMsg("");
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ action, orderCode, itemId, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Thao tác thất bại");
      return;
    }
    setMsg("Đã cập nhật đơn.");
    await loadOrders();
  }

  async function saveProduct() {
    if (!editProduct) return;
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ products: [editProduct] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Lưu thất bại");
      return;
    }
    if (data.mode === "demo") {
      saveCatalogOverrides({
        products: catalog.products.map((p) => (p.id === editProduct.id ? editProduct : p)).concat(
          catalog.products.some((p) => p.id === editProduct.id) ? [] : [editProduct],
        ),
      });
      await refresh();
    } else {
      await refresh();
    }
    setMsg(`Đã lưu ${editProduct.name} (${data.mode}).`);
    setEditId(null);
    setEditProduct(null);
  }

  async function saveContent() {
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({
        categories: editCats ?? catalog.categories,
        banners: editBanners ?? catalog.banners,
        faqs: editFaqs ?? catalog.faqs,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Lưu thất bại");
      return;
    }
    if (data.mode === "demo") {
      saveCatalogOverrides({
        categories: editCats ?? undefined,
        banners: editBanners ?? undefined,
        faqs: editFaqs ?? undefined,
      });
      await refresh();
    } else {
      await refresh();
    }
    setMsg(`Đã lưu nội dung (${data.mode}).`);
  }

  async function addStock() {
    setMsg("");
    const codes = stockCodes.split("\n").map((c) => c.trim()).filter(Boolean);
    if (!stockVariant || !codes.length) {
      setMsg("Chọn gói và nhập ít nhất 1 mã (mỗi dòng 1 mã).");
      return;
    }
    const res = await fetch("/api/admin/stock", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ variantId: stockVariant, codes }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Đã thêm ${data.added} mã (${data.mode}). ${data.note ?? ""}` : data.error || "Lỗi thêm mã");
    if (res.ok) setStockCodes("");
  }

  if (auth.loading) return <p className="mt-10 vd-muted">Đang kiểm tra quyền…</p>;
  if (!auth.user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-black">Quản trị VDigital</h1>
        <p className="vd-muted mt-2">Khu vực này chỉ dành cho admin. Đăng nhập bằng email admin để tiếp tục.</p>
        {!isSupabaseConfigured && (
          <button
            onClick={() => auth.demoSignIn("admin@vdigital.vn")}
            className="btn-primary mt-6"
          >
            Vào admin demo
          </button>
        )}
        <p className="text-xs vd-muted2 mt-3">
          Chế độ demo (chưa cấu hình Supabase). Khi có Supabase, admin đăng nhập bằng email trong ADMIN_EMAILS
          (mặc định contact.hotavinh@gmail.com).
        </p>
      </div>
    );
  }
  if (!auth.isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-black">Không có quyền</h1>
        <p className="vd-muted mt-2">
          Email {auth.user.email} không nằm trong danh sách admin. Thêm email này vào biến môi trường ADMIN_EMAILS.
        </p>
      </div>
    );
  }

  const autoVariants = catalog.products.flatMap((p) =>
    p.variants.filter((v) => v.fulfillment_type === "auto" || v.fulfillment_type === "link").map((v) => ({ product: p, variant: v })),
  );
  const cats = editCats ?? catalog.categories;
  const banners = editBanners ?? catalog.banners;
  const faqs = editFaqs ?? catalog.faqs;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-black tracking-tight">Quản trị VDigital</h1>
        <span className="text-xs rounded-full vd-card-flat px-3 py-1">
          {isSupabaseConfigured ? "Supabase: đã cấu hình" : "Chế độ demo — chưa cấu hình Supabase"}
        </span>
      </div>
      {msg && <p className="mt-3 text-sm rounded-lg vd-card-flat px-3 py-2">{msg}</p>}

      <div className="flex gap-1 border-b vd-border mt-4 overflow-x-auto">
        {(
          [
            { key: "overview", label: "Tổng quan" },
            { key: "orders", label: `Đơn hàng (${orders.length})` },
            { key: "products", label: "Sản phẩm" },
            { key: "stock", label: "Kho mã" },
            { key: "content", label: "Danh mục · Banner · FAQ" },
            { key: "settings", label: "Cài đặt" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-btn ${tab === t.key ? "!border-brand-500 text-brand-400" : "!border-transparent vd-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          <div className="vd-card p-5">
            <div className="text-sm vd-muted">Doanh thu (đơn đã thanh toán)</div>
            <div className="text-2xl font-black text-brand-400 mt-1">{formatVND(stats.revenue)}</div>
          </div>
          <div className="vd-card p-5">
            <div className="text-sm vd-muted">Tổng đơn</div>
            <div className="text-2xl font-black mt-1">{stats.totalOrders}</div>
          </div>
          <div className="vd-card p-5">
            <div className="text-sm vd-muted">Mục chờ xử lý tay</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{stats.waiting}</div>
          </div>
          <p className="sm:col-span-3 text-sm vd-muted">
            Đơn chờ xử lý gồm: gói làm tay (add Family / nâng cấp chính chủ) và thẻ game chưa giao mã. Xử lý trong tab Đơn hàng.
          </p>
        </div>
      )}

      {tab === "orders" && (
        <div className="mt-5 space-y-3">
          <button onClick={loadOrders} className="btn-outline !py-2 text-sm">
            {loading ? "Đang tải…" : "Tải lại đơn"}
          </button>
          {orders.length === 0 && <p className="vd-muted">Chưa có đơn hàng nào.</p>}
          {orders.map((o) => (
            <div key={o.id} className="vd-card p-4">
              <button className="w-full flex flex-wrap justify-between gap-2 text-left" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <span className="font-mono font-bold">{o.code}</span>
                <span className="text-sm vd-muted">{o.customer_name} — {o.customer_email}</span>
                <span className="text-sm">{formatDateTime(o.created_at)}</span>
                <b className="text-brand-400">{formatVND(o.total)}</b>
                <span className="text-xs rounded-full vd-surface2 px-2 py-1">{o.status}</span>
              </button>
              {expanded === o.id && (
                <div className="mt-3 space-y-3 border-t vd-border pt-3">
                  {o.items.map((item) => {
                    const gf = gameForm[item.id] ?? { serial: "", pin: "", denomination: item.variant_name, note: "" };
                    return (
                      <div key={item.id} className="vd-card-flat p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <b>{item.product_name} — {item.variant_name}</b>
                          <span>{formatVND(item.price)} × {item.quantity}</span>
                          <span className="vd-muted">{item.fulfillment_type} · {item.status}</span>
                        </div>
                        {item.delivered_code && <p className="mt-1">Mã đã giao: <code className="font-mono vd-surface2 px-2 py-0.5 rounded">{item.delivered_code}</code></p>}
                        {item.delivered_serial && <p className="mt-1">Serial: <code className="font-mono">{item.delivered_serial}</code> · Mã: <code className="font-mono">{item.delivered_pin}</code></p>}
                        {item.delivered_note && <p className="mt-1 vd-muted">{item.delivered_note}</p>}

                        {item.status === "waiting_manual" && item.fulfillment_type === "game_card" && (
                          <div className="mt-3 grid sm:grid-cols-2 gap-2">
                            <input value={gf.serial} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, serial: e.target.value } })} placeholder="Serial thẻ *" className="field" />
                            <input value={gf.pin} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, pin: e.target.value } })} placeholder="Mã nạp (code/pin) *" className="field" />
                            <input value={gf.denomination} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, denomination: e.target.value } })} placeholder="Mệnh giá (tự theo gói, sửa được)" className="field" />
                            <input value={gf.note} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, note: e.target.value } })} placeholder="Ghi chú cho khách (tuỳ chọn)" className="field" />
                            <button onClick={() => adminAction("deliver-game-card", o.code, item.id, gf)} className="btn-primary sm:col-span-2 !py-2.5 text-sm">
                              Giao + gửi mail cho khách
                            </button>
                            <p className="sm:col-span-2 text-xs vd-muted2">Mệnh giá tự điền theo gói đã mua — sửa lại nếu thẻ thực tế khác mệnh giá gói.</p>
                          </div>
                        )}

                        {item.status === "waiting_manual" && item.fulfillment_type === "manual" && (
                          <div className="mt-3 flex gap-2">
                            <input value={manualNote[item.id] ?? ""} onChange={(e) => setManualNote({ ...manualNote, [item.id]: e.target.value })} placeholder="Ghi chú hoàn thành (vd: đã thêm vào Family xong)" className="field flex-1" />
                            <button onClick={() => adminAction("complete-manual", o.code, item.id, { note: manualNote[item.id] ?? "" })} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold text-white">
                              Hoàn thành
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div className="mt-5 grid lg:grid-cols-[280px_1fr] gap-5 items-start">
          <div className="space-y-2">
            <button
              onClick={() => {
                const p = newProduct();
                setEditId(p.id);
                setEditProduct(p);
              }}
              className="btn-primary w-full !py-2.5 text-sm"
            >
              + Thêm sản phẩm mới
            </button>
            {catalog.products.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setEditId(p.id);
                  setEditProduct(JSON.parse(JSON.stringify(p)));
                }}
                className={`block w-full text-left rounded-xl border px-3 py-2.5 text-sm ${editId === p.id ? "border-brand-500 bg-brand-500/10" : "vd-border vd-card-flat"}`}
              >
                <b>{p.name}</b>
                <span className="block text-xs vd-muted">{p.variants.length} gói · đã bán {p.sold_count} · {p.is_active ? "đang bán" : "đã ẩn"}</span>
              </button>
            ))}
          </div>
          <div>
            {!editProduct ? (
              <p className="vd-muted">Chọn sản phẩm bên trái để sửa — hoặc bấm “Thêm sản phẩm mới” để tạo sản phẩm không cần sửa code.</p>
            ) : (
              <div className="vd-card p-4 space-y-4">
                <h3 className="font-bold text-lg">Sửa: {editProduct.name}</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="field-label">Tên sản phẩm *</span>
                    <input value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} className="field" />
                  </label>
                  <label className="block">
                    <span className="field-label">Slug (đường dẫn)</span>
                    <input value={editProduct.slug} onChange={(e) => setEditProduct({ ...editProduct, slug: slugify(e.target.value) })} className="field" />
                  </label>
                  <label className="block">
                    <span className="field-label">Danh mục</span>
                    <select value={editProduct.category_id} onChange={(e) => setEditProduct({ ...editProduct, category_id: e.target.value })} className="field">
                      {catalog.categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Loại sản phẩm</span>
                    <select value={editProduct.product_type} onChange={(e) => setEditProduct({ ...editProduct, product_type: e.target.value as never })} className="field">
                      {PRODUCT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Loại tài khoản</span>
                    <select value={editProduct.account_type} onChange={(e) => setEditProduct({ ...editProduct, account_type: e.target.value as never })} className="field">
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Bảo hành (ngày)</span>
                    <input type="number" value={editProduct.warranty_days} onChange={(e) => setEditProduct({ ...editProduct, warranty_days: Number(e.target.value) })} className="field" />
                  </label>
                </div>
                <label className="block">
                  <span className="field-label">Mô tả ngắn</span>
                  <input value={editProduct.tagline} onChange={(e) => setEditProduct({ ...editProduct, tagline: e.target.value })} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Mô tả chi tiết</span>
                  <textarea rows={3} value={editProduct.description} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Hướng dẫn sử dụng</span>
                  <textarea rows={3} value={editProduct.guide} onChange={(e) => setEditProduct({ ...editProduct, guide: e.target.value })} className="field" />
                </label>
                <ImageUpload
                  kind="products"
                  label="Ảnh bìa sản phẩm"
                  value={editProduct.image_url}
                  onChange={(url) => setEditProduct({ ...editProduct, image_url: url })}
                />
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_featured} onChange={(e) => setEditProduct({ ...editProduct, is_featured: e.target.checked })} className="accent-violet-600" /> Nổi bật</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_new} onChange={(e) => setEditProduct({ ...editProduct, is_new: e.target.checked })} className="accent-violet-600" /> Mới</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_best_seller} onChange={(e) => setEditProduct({ ...editProduct, is_best_seller: e.target.checked })} className="accent-violet-600" /> Bán chạy</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_active} onChange={(e) => setEditProduct({ ...editProduct, is_active: e.target.checked })} className="accent-violet-600" /> Đang bán</label>
                </div>

                <h4 className="font-bold pt-2">Các gói (biến thể) — mỗi gói có cách giao riêng</h4>
                <div className="space-y-3">
                  {editProduct.variants.map((v, i) => {
                    const setV = (patch: Partial<Variant>) => {
                      const vs = [...editProduct.variants];
                      vs[i] = { ...v, ...patch };
                      setEditProduct({ ...editProduct, variants: vs });
                    };
                    return (
                      <div key={v.id} className="vd-card-flat p-3 space-y-2">
                        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-2">
                          <label className="block">
                            <span className="field-label">Nhãn gói *</span>
                            <input value={v.label} onChange={(e) => setV({ label: e.target.value, name: e.target.value })} className="field" />
                          </label>
                          <label className="block">
                            <span className="field-label">Giá bán (đ)</span>
                            <input type="number" value={v.price} onChange={(e) => setV({ price: Number(e.target.value) })} className="field" />
                          </label>
                          <label className="block">
                            <span className="field-label">Giá gốc (đ)</span>
                            <input type="number" value={v.original_price} onChange={(e) => setV({ original_price: Number(e.target.value) })} className="field" />
                          </label>
                          <label className="block">
                            <span className="field-label">Tồn kho (trống = không giới hạn)</span>
                            <input type="number" value={v.stock_count ?? ""} onChange={(e) => setV({ stock_count: e.target.value === "" ? null : Number(e.target.value) })} className="field" placeholder="Không giới hạn" />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-2">
                          <label className="block">
                            <span className="field-label">Loại lựa chọn</span>
                            <select value={v.option_type} onChange={(e) => setV({ option_type: e.target.value as never })} className="field">
                              {OPTION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="field-label">Nhãn nhóm lựa chọn (tuỳ chọn)</span>
                            <input value={v.option_label ?? ""} onChange={(e) => setV({ option_label: e.target.value || null })} className="field" placeholder="vd: Chọn mệnh giá" />
                          </label>
                          <label className="block">
                            <span className="field-label">Cách giao hàng</span>
                            <select value={v.fulfillment_type} onChange={(e) => setV({ fulfillment_type: e.target.value as never })} className="field">
                              {FULFILLMENT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="field-label">Hết Flash lúc (để trống = không)</span>
                            <input
                              type="datetime-local"
                              value={v.flash_ends_at ? v.flash_ends_at.slice(0, 16) : ""}
                              onChange={(e) => setV({ is_flash: !!e.target.value, flash_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                              className="field"
                            />
                          </label>
                        </div>
                        {(v.fulfillment_type === "link" || v.fulfillment_type === "auto") && (
                          <label className="block">
                            <span className="field-label">Mẫu giao hàng (chỉ cho loại “Link / key” — có thể chứa {"{code}"})</span>
                            <input value={v.delivery_template ?? ""} onChange={(e) => setV({ delivery_template: e.target.value || null })} className="field" placeholder="vd: https://example.com/activate?key={code}" />
                          </label>
                        )}
                        <label className="block">
                          <span className="field-label">Ghi chú giao hàng cho gói này</span>
                          <input value={v.delivery_note ?? ""} onChange={(e) => setV({ delivery_note: e.target.value || null })} className="field" placeholder="vd: Dùng email của bạn để nhận lời mời Family" />
                        </label>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={v.is_flash} onChange={(e) => setV({ is_flash: e.target.checked })} className="accent-violet-600" /> Flash Sale</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ is_active: e.target.checked })} className="accent-violet-600" /> Đang bán</label>
                          <button
                            type="button"
                            onClick={() => setEditProduct({ ...editProduct, variants: editProduct.variants.filter((x) => x.id !== v.id) })}
                            className="ml-auto text-sm text-red-400 hover:underline"
                          >
                            Xoá gói
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setEditProduct({ ...editProduct, variants: [...editProduct.variants, newVariant(editProduct.id, editProduct.variants.length + 1)] })}
                  className="btn-outline !py-2 text-sm"
                >
                  + Thêm gói
                </button>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveProduct} className="btn-primary !py-2.5 text-sm">Lưu sản phẩm</button>
                  <button onClick={() => { setEditId(null); setEditProduct(null); }} className="btn-outline !py-2.5 text-sm">Huỷ</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="mt-5 max-w-2xl space-y-3">
          <p className="text-sm vd-muted">
            Kho mã dùng cho các gói giao tự động (auto). Khi khách thanh toán, hệ thống lấy mã cũ nhất chưa dùng để giao.
            Mã demo trong seed có tiền tố VD-DEMO — thay bằng mã thật trước khi bán.
          </p>
          <label className="block">
            <span className="field-label">Chọn gói giao tự động / link</span>
            <select value={stockVariant} onChange={(e) => setStockVariant(e.target.value)} className="field">
              <option value="">— Chọn gói —</option>
              {autoVariants.map(({ product, variant }) => (
                <option key={variant.id} value={variant.id}>{product.name} — {variant.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Danh sách mã (mỗi dòng 1 mã)</span>
            <textarea rows={8} value={stockCodes} onChange={(e) => setStockCodes(e.target.value)} placeholder={"VD-XXXX-0001\nVD-XXXX-0002"} className="field font-mono" />
          </label>
          <button onClick={addStock} className="btn-primary !py-2.5 text-sm">Thêm vào kho</button>
        </div>
      )}

      {tab === "content" && (
        <div className="mt-5 space-y-6">
          <div className="vd-card p-4">
            <h3 className="font-bold">Danh mục</h3>
            <p className="text-xs vd-muted mt-1">Icon: nhập tên icon Lucide (vd: KeyRound, Gamepad2) hoặc để trống. Ảnh: up ảnh đại diện cho danh mục.</p>
            <div className="space-y-3 mt-3">
              {cats.map((c, i) => (
                <div key={c.id} className="vd-card-flat p-3 grid sm:grid-cols-4 gap-2">
                  <input value={c.name} onChange={(e) => { const n = [...cats]; n[i] = { ...c, name: e.target.value, slug: slugify(e.target.value) }; setEditCats(n); }} className="field" aria-label="Tên danh mục" />
                  <input value={c.slug} onChange={(e) => { const n = [...cats]; n[i] = { ...c, slug: slugify(e.target.value) }; setEditCats(n); }} className="field" aria-label="Slug" />
                  <input value={c.icon ?? ""} onChange={(e) => { const n = [...cats]; n[i] = { ...c, icon: e.target.value || null }; setEditCats(n); }} className="field" placeholder="Icon (vd: Gamepad2)" aria-label="Icon" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!c.parent_id} disabled className="accent-violet-600" />
                    {c.parent_id ? "Danh mục con" : "Danh mục chính"}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-card p-4">
            <h3 className="font-bold">Banner trang chủ</h3>
            <div className="space-y-3 mt-3">
              {banners.map((b, i) => (
                <div key={b.id} className="vd-card-flat p-3 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input value={b.title} onChange={(e) => { const n = [...banners]; n[i] = { ...b, title: e.target.value }; setEditBanners(n); }} className="field" aria-label="Tiêu đề banner" />
                    <input value={b.cta_link} onChange={(e) => { const n = [...banners]; n[i] = { ...b, cta_link: e.target.value }; setEditBanners(n); }} className="field" aria-label="Link nút" />
                    <input value={b.subtitle} onChange={(e) => { const n = [...banners]; n[i] = { ...b, subtitle: e.target.value }; setEditBanners(n); }} className="field" aria-label="Phụ đề" />
                    <input value={b.cta_text} onChange={(e) => { const n = [...banners]; n[i] = { ...b, cta_text: e.target.value }; setEditBanners(n); }} className="field" aria-label="Chữ nút" />
                  </div>
                  <ImageUpload kind="banners" label="Ảnh banner" ratio="aspect-[2/1]" value={b.image_url ?? null} onChange={(url) => { const n = [...banners]; n[i] = { ...b, image_url: url }; setEditBanners(n); }} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.is_active} onChange={(e) => { const n = [...banners]; n[i] = { ...b, is_active: e.target.checked }; setEditBanners(n); }} className="accent-violet-600" /> Đang hiển thị</label>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-card p-4">
            <h3 className="font-bold">Câu hỏi thường gặp (FAQ)</h3>
            <div className="space-y-3 mt-3">
              {faqs.map((f, i) => (
                <div key={f.id} className="vd-card-flat p-3 space-y-2">
                  <input value={f.question} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, question: e.target.value }; setEditFaqs(n); }} className="field" aria-label="Câu hỏi" />
                  <textarea rows={2} value={f.answer} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, answer: e.target.value }; setEditFaqs(n); }} className="field" aria-label="Câu trả lời" />
                </div>
              ))}
            </div>
          </div>
          <button onClick={saveContent} className="btn-primary !py-2.5 text-sm">Lưu danh mục / banner / FAQ</button>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-5 max-w-2xl space-y-4 text-sm">
          {!settings ? (
            <p className="vd-muted">Đang tải cài đặt…</p>
          ) : (
            <>
              {/* Cảnh báo nổi bật: thiếu service_role thì đơn không lưu được
                  (lỗi "permission denied for table orders") — xem README mục 7. */}
              {settings.supabase &&
                settings.env?.find((e: { name: string }) => e.name.includes("SERVICE_ROLE"))?.configured === false && (
                  <div role="alert" className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
                    <p className="font-bold text-red-400">Thiếu SUPABASE_SERVICE_ROLE_KEY — đơn hàng sẽ không lưu được</p>
                    <p className="mt-1 text-sm">
                      Server đang dùng anon key nên Supabase chặn ghi đơn (“permission denied for table orders”).
                      Lấy key service_role ở Supabase → Settings → API, thêm vào Vercel → Settings → Environment
                      Variables (dạng Secret) rồi Redeploy. Không thêm policy INSERT cho anon.
                    </p>
                  </div>
                )}
              <div className="vd-card p-5">
                <h3 className="font-bold">Trạng thái cấu hình</h3>
                <p className="text-xs vd-muted mt-1">
                  {settings.supabase
                    ? `Supabase đã cấu hình (URL từ ${settings.supabaseSources?.urlFrom ?? "?"}, key từ ${settings.supabaseSources?.keyFrom ?? "?"}).`
                    : "Supabase chưa cấu hình — kiểm tra lại tên biến trong Vercel (xem README mục “Biến môi trường”)."}
                </p>
                <table className="mt-3 w-full text-left">
                  <tbody>
                    {settings.env.map((e: { name: string; configured: boolean; required: boolean }) => (
                      <tr key={e.name} className="border-t vd-border">
                        <td className="py-2 pr-2 font-mono text-xs">{e.name}{e.required ? " *" : ""}</td>
                        <td className={`py-2 text-right font-semibold ${e.configured ? "text-emerald-400" : e.required ? "text-red-400" : "text-amber-400"}`}>
                          {e.configured ? "Đã có" : e.required ? "Thiếu" : "Chưa có"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs vd-muted2 mt-2">* Bắt buộc. PayOS / Mail / MB Bank chưa có thì shop vẫn chạy ở chế độ demo tương ứng.</p>
              </div>
              <div className="vd-card p-5 space-y-2">
                <p><b>PayOS:</b> {settings.payos.configured ? `Đã cấu hình (client ${settings.payos.clientId})` : "Chưa cấu hình — đang dùng chế độ demo"}</p>
                <p><b>Mail (Gmail SMTP):</b> {settings.mail.configured ? `Đã cấu hình — ${settings.mail.smtpUser}` : "Chưa cấu hình — đơn vẫn hoàn tất, chỉ log mail chưa gửi"}</p>
                <p><b>Ngân hàng nhận tiền:</b> {settings.bank.name} — STK {settings.bank.account} ({settings.bank.accountName})</p>
                <p><b>Site URL:</b> {settings.siteUrl}</p>
                <p className="vd-muted pt-2">
                  Key và App Password chỉ sửa qua biến môi trường (file .env.local hoặc Vercel &gt; Settings &gt; Environment Variables),
                  không sửa trong trang này và không bao giờ gửi trong chat.
                </p>
              </div>
              <div className="vd-card p-5">
                <h3 className="font-bold">Quản lý tài khoản admin</h3>
                <p className="text-xs vd-muted mt-1">
                  Đổi mật khẩu, sửa tên hiển thị, phương thức đăng nhập và đăng xuất — tất cả nằm ở trang Quản lý tài khoản riêng (không còn trong tab Cài đặt này).
                  Mật khẩu tạm lần đầu rất yếu — đổi ngay sang mật khẩu mạnh (ít nhất 8 ký tự, có chữ + số) sau khi đăng nhập.
                </p>
                <Link href="/tai-khoan/quan-ly" className="btn-primary mt-3 inline-flex !py-2.5 text-sm">
                  Mở Quản lý tài khoản
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
