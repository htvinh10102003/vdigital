"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, useAuth, useCatalog, saveCatalogOverrides } from "@/components/providers";
import { getSupabase } from "@/lib/supabase";
import { formatDateTime, formatVND } from "@/lib/format";
import type { Order, Product } from "@/lib/types";

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

type Tab = "overview" | "orders" | "products" | "stock" | "settings";

export default function AdminPage() {
  const auth = useAuth();
  const { catalog, refresh } = useCatalog();
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form giao thẻ game theo item id
  const [gameForm, setGameForm] = useState<Record<string, { serial: string; pin: string; denomination: string; note: string }>>({});
  const [manualNote, setManualNote] = useState<Record<string, string>>({});

  // Form sửa sản phẩm
  const [editId, setEditId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Form kho mã
  const [stockVariant, setStockVariant] = useState("");
  const [stockCodes, setStockCodes] = useState("");

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
      const next = catalog.products.map((p) => (p.id === editProduct.id ? editProduct : p));
      saveCatalogOverrides(next);
      await refresh();
    } else {
      await refresh();
    }
    setMsg(`Đã lưu ${editProduct.name} (${data.mode}).`);
    setEditId(null);
    setEditProduct(null);
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

  // ---- Gate ----
  if (auth.loading) return <p className="max-w-5xl mx-auto px-4 mt-10 text-slate-400">Đang kiểm tra quyền…</p>;
  if (!auth.user) {
    return (
      <div className="max-w-md mx-auto px-4 mt-16 text-center">
        <h1 className="text-2xl font-bold">Quản trị VDigital</h1>
        <p className="text-slate-400 mt-2">Khu vực này chỉ dành cho admin. Đăng nhập bằng email admin để tiếp tục.</p>
        {!isSupabaseConfigured && (
          <button
            onClick={() => auth.demoSignIn("admin@vdigital.vn")}
            className="mt-6 rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 font-bold text-white"
          >
            Vào admin demo
          </button>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Chế độ demo (chưa cấu hình Supabase). Khi có Supabase, admin đăng nhập bằng email trong ADMIN_EMAILS.
        </p>
      </div>
    );
  }
  if (!auth.isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 mt-16 text-center">
        <h1 className="text-2xl font-bold">Không có quyền</h1>
        <p className="text-slate-400 mt-2">
          Email {auth.user.email} không nằm trong danh sách admin. Thêm email này vào biến môi trường ADMIN_EMAILS.
        </p>
      </div>
    );
  }

  const autoVariants = catalog.products.flatMap((p) =>
    p.variants.filter((v) => v.fulfillment_type === "auto").map((v) => ({ product: p, variant: v })),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Quản trị VDigital</h1>
        <span className="text-xs rounded-full bg-navy-800 border border-navy-600 px-3 py-1">
          {isSupabaseConfigured ? "Supabase: đã cấu hình" : "Chế độ demo — chưa cấu hình Supabase"}
        </span>
      </div>
      {msg && <p className="mt-3 text-sm rounded-lg bg-navy-800 border border-navy-600 px-3 py-2">{msg}</p>}

      <div className="flex gap-1 border-b border-navy-700 mt-4 overflow-x-auto">
        {(
          [
            { key: "overview", label: "Tổng quan" },
            { key: "orders", label: `Đơn hàng (${orders.length})` },
            { key: "products", label: "Sản phẩm" },
            { key: "stock", label: "Kho mã" },
            { key: "settings", label: "Cài đặt" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? "border-brand-500 text-brand-400" : "border-transparent text-slate-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          <div className="rounded-2xl bg-navy-800 border border-navy-700 p-5">
            <div className="text-sm text-slate-400">Doanh thu (đơn đã thanh toán)</div>
            <div className="text-2xl font-black text-brand-400 mt-1">{formatVND(stats.revenue)}</div>
          </div>
          <div className="rounded-2xl bg-navy-800 border border-navy-700 p-5">
            <div className="text-sm text-slate-400">Tổng đơn</div>
            <div className="text-2xl font-black mt-1">{stats.totalOrders}</div>
          </div>
          <div className="rounded-2xl bg-navy-800 border border-navy-700 p-5">
            <div className="text-sm text-slate-400">Mục chờ xử lý tay</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{stats.waiting}</div>
          </div>
          <p className="sm:col-span-3 text-sm text-slate-400">
            Đơn chờ xử lý gồm: gói làm tay (add Family / nâng cấp chính chủ) và thẻ game chưa giao mã. Xử lý trong tab Đơn hàng.
          </p>
        </div>
      )}

      {tab === "orders" && (
        <div className="mt-5 space-y-3">
          <button onClick={loadOrders} className="rounded-lg border border-navy-600 px-4 py-2 text-sm">
            {loading ? "Đang tải…" : "Tải lại đơn"}
          </button>
          {orders.length === 0 && <p className="text-slate-400">Chưa có đơn hàng nào.</p>}
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl bg-navy-800 border border-navy-700 p-4">
              <button className="w-full flex flex-wrap justify-between gap-2 text-left" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <span className="font-mono font-bold">{o.code}</span>
                <span className="text-sm text-slate-400">{o.customer_name} — {o.customer_email}</span>
                <span className="text-sm">{formatDateTime(o.created_at)}</span>
                <b className="text-brand-400">{formatVND(o.total)}</b>
                <span className="text-xs rounded-full bg-navy-700 px-2 py-1">{o.status}</span>
              </button>
              {expanded === o.id && (
                <div className="mt-3 space-y-3 border-t border-navy-700 pt-3">
                  {o.items.map((item) => {
                    const gf = gameForm[item.id] ?? { serial: "", pin: "", denomination: item.variant_name, note: "" };
                    return (
                      <div key={item.id} className="rounded-xl bg-navy-900 border border-navy-700 p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <b>{item.product_name} — {item.variant_name}</b>
                          <span>{formatVND(item.price)} × {item.quantity}</span>
                          <span className="text-slate-400">{item.fulfillment_type} · {item.status}</span>
                        </div>
                        {item.delivered_code && <p className="mt-1">Mã đã giao: <code className="font-mono bg-navy-700 px-2 py-0.5 rounded">{item.delivered_code}</code></p>}
                        {item.delivered_serial && <p className="mt-1">Serial: <code className="font-mono">{item.delivered_serial}</code> · Mã: <code className="font-mono">{item.delivered_pin}</code></p>}
                        {item.delivered_note && <p className="mt-1 text-slate-400">{item.delivered_note}</p>}

                        {item.status === "waiting_manual" && item.fulfillment_type === "game_card" && (
                          <div className="mt-3 grid sm:grid-cols-2 gap-2">
                            <input
                              value={gf.serial}
                              onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, serial: e.target.value } })}
                              placeholder="Serial thẻ *"
                              className="rounded-lg bg-navy-800 border border-navy-600 px-3 py-2"
                            />
                            <input
                              value={gf.pin}
                              onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, pin: e.target.value } })}
                              placeholder="Mã nạp (code/pin) *"
                              className="rounded-lg bg-navy-800 border border-navy-600 px-3 py-2"
                            />
                            <input
                              value={gf.denomination}
                              onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, denomination: e.target.value } })}
                              placeholder="Mệnh giá (tự theo gói, sửa được)"
                              className="rounded-lg bg-navy-800 border border-navy-600 px-3 py-2"
                            />
                            <input
                              value={gf.note}
                              onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, note: e.target.value } })}
                              placeholder="Ghi chú cho khách (tuỳ chọn)"
                              className="rounded-lg bg-navy-800 border border-navy-600 px-3 py-2"
                            />
                            <button
                              onClick={() => adminAction("deliver-game-card", o.code, item.id, gf)}
                              className="sm:col-span-2 rounded-lg bg-brand-500 hover:bg-brand-600 py-2.5 font-semibold text-white"
                            >
                              Giao + gửi mail cho khách
                            </button>
                            <p className="sm:col-span-2 text-xs text-slate-500">
                              Mệnh giá tự điền theo gói đã mua — sửa lại nếu thẻ thực tế khác mệnh giá gói.
                            </p>
                          </div>
                        )}

                        {item.status === "waiting_manual" && item.fulfillment_type === "manual" && (
                          <div className="mt-3 flex gap-2">
                            <input
                              value={manualNote[item.id] ?? ""}
                              onChange={(e) => setManualNote({ ...manualNote, [item.id]: e.target.value })}
                              placeholder="Ghi chú hoàn thành (vd: đã thêm vào Family xong)"
                              className="flex-1 rounded-lg bg-navy-800 border border-navy-600 px-3 py-2"
                            />
                            <button
                              onClick={() => adminAction("complete-manual", o.code, item.id, { note: manualNote[item.id] ?? "" })}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold text-white"
                            >
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
            {catalog.products.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setEditId(p.id);
                  setEditProduct(JSON.parse(JSON.stringify(p)));
                }}
                className={`block w-full text-left rounded-xl border px-3 py-2.5 text-sm ${editId === p.id ? "border-brand-500 bg-brand-500/10" : "border-navy-700 bg-navy-800"}`}
              >
                <b>{p.name}</b>
                <span className="block text-xs text-slate-400">{p.variants.length} gói · đã bán {p.sold_count}</span>
              </button>
            ))}
          </div>
          <div>
            {!editProduct ? (
              <p className="text-slate-400">Chọn sản phẩm bên trái để sửa tên, mô tả, giá gói, trạng thái Flash Sale…</p>
            ) : (
              <div className="rounded-2xl bg-navy-800 border border-navy-700 p-4 space-y-3">
                <h3 className="font-bold">Sửa: {editProduct.name}</h3>
                <label className="block text-sm">Tên sản phẩm
                  <input value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} className="mt-1 w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2" />
                </label>
                <label className="block text-sm">Mô tả ngắn
                  <input value={editProduct.tagline} onChange={(e) => setEditProduct({ ...editProduct, tagline: e.target.value })} className="mt-1 w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2" />
                </label>
                <label className="block text-sm">Mô tả chi tiết
                  <textarea rows={3} value={editProduct.description} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} className="mt-1 w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2" />
                </label>
                <label className="block text-sm">Hướng dẫn sử dụng
                  <textarea rows={3} value={editProduct.guide} onChange={(e) => setEditProduct({ ...editProduct, guide: e.target.value })} className="mt-1 w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2" />
                </label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_featured} onChange={(e) => setEditProduct({ ...editProduct, is_featured: e.target.checked })} /> Nổi bật</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_new} onChange={(e) => setEditProduct({ ...editProduct, is_new: e.target.checked })} /> Mới</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_best_seller} onChange={(e) => setEditProduct({ ...editProduct, is_best_seller: e.target.checked })} /> Bán chạy</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_active} onChange={(e) => setEditProduct({ ...editProduct, is_active: e.target.checked })} /> Đang bán</label>
                </div>
                <h4 className="font-bold pt-2">Các gói (biến thể)</h4>
                <div className="space-y-2">
                  {editProduct.variants.map((v, i) => (
                    <div key={v.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center rounded-xl bg-navy-900 border border-navy-700 p-2 text-sm">
                      <input value={v.label} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, label: e.target.value, name: e.target.value }; setEditProduct({ ...editProduct, variants: vs }); }} className="rounded-lg bg-navy-800 border border-navy-600 px-2 py-1.5" />
                      <input type="number" value={v.price} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, price: Number(e.target.value) }; setEditProduct({ ...editProduct, variants: vs }); }} className="rounded-lg bg-navy-800 border border-navy-600 px-2 py-1.5" aria-label="Giá bán" />
                      <input type="number" value={v.original_price} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, original_price: Number(e.target.value) }; setEditProduct({ ...editProduct, variants: vs }); }} className="rounded-lg bg-navy-800 border border-navy-600 px-2 py-1.5" aria-label="Giá gốc" />
                      <select value={v.fulfillment_type} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, fulfillment_type: e.target.value as never }; setEditProduct({ ...editProduct, variants: vs }); }} className="rounded-lg bg-navy-800 border border-navy-600 px-2 py-1.5">
                        <option value="auto">auto</option>
                        <option value="manual">manual</option>
                        <option value="game_card">game_card</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={v.is_flash} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, is_flash: e.target.checked }; setEditProduct({ ...editProduct, variants: vs }); }} /> Flash</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={v.is_active} onChange={(e) => { const vs = [...editProduct.variants]; vs[i] = { ...v, is_active: e.target.checked }; setEditProduct({ ...editProduct, variants: vs }); }} /> Bán</label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveProduct} className="rounded-lg bg-brand-500 hover:bg-brand-600 px-5 py-2.5 font-semibold text-white">Lưu sản phẩm</button>
                  <button onClick={() => { setEditId(null); setEditProduct(null); }} className="rounded-lg border border-navy-600 px-5 py-2.5">Huỷ</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="mt-5 max-w-2xl space-y-3">
          <p className="text-sm text-slate-400">
            Kho mã dùng cho các gói giao tự động (auto). Khi khách thanh toán, hệ thống lấy mã cũ nhất chưa dùng để giao.
            Mã demo trong seed có tiền tố VD-DEMO — thay bằng mã thật trước khi bán.
          </p>
          <label className="block text-sm">Chọn gói giao tự động
            <select value={stockVariant} onChange={(e) => setStockVariant(e.target.value)} className="mt-1 w-full rounded-lg bg-navy-800 border border-navy-600 px-3 py-2">
              <option value="">— Chọn gói —</option>
              {autoVariants.map(({ product, variant }) => (
                <option key={variant.id} value={variant.id}>{product.name} — {variant.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">Danh sách mã (mỗi dòng 1 mã)
            <textarea rows={8} value={stockCodes} onChange={(e) => setStockCodes(e.target.value)} placeholder={"VD-XXXX-0001\nVD-XXXX-0002"} className="mt-1 w-full rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 font-mono text-sm" />
          </label>
          <button onClick={addStock} className="rounded-lg bg-brand-500 hover:bg-brand-600 px-5 py-2.5 font-semibold text-white">Thêm vào kho</button>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-5 max-w-2xl space-y-3 text-sm">
          {!settings ? (
            <p className="text-slate-400">Đang tải cài đặt…</p>
          ) : (
            <div className="rounded-2xl bg-navy-800 border border-navy-700 p-5 space-y-2">
              <p><b>Supabase:</b> {settings.supabase ? "Đã cấu hình" : "Chưa cấu hình (đang chạy demo)"}</p>
              <p><b>PayOS:</b> {settings.payos.configured ? `Đã cấu hình (client ${settings.payos.clientId})` : "Chưa cấu hình — đang dùng chế độ demo"}</p>
              <p><b>Mail (Gmail SMTP):</b> {settings.mail.configured ? `Đã cấu hình — ${settings.mail.smtpUser}` : "Chưa cấu hình — đơn vẫn hoàn tất, chỉ log mail chưa gửi"}</p>
              <p><b>Ngân hàng nhận tiền:</b> {settings.bank.name} — STK {settings.bank.account} ({settings.bank.accountName})</p>
              <p><b>Site URL:</b> {settings.siteUrl}</p>
              <p className="text-slate-400 pt-2">
                Key và App Password chỉ sửa qua biến môi trường (file .env.local hoặc Vercel &gt; Settings &gt; Environment Variables),
                không sửa trong trang này và không bao giờ gửi trong chat.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
