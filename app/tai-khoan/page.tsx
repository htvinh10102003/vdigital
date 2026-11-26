"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { formatDateTime, formatVND } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AccountPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<"orders" | "account">("orders");
  const [codes, setCodes] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lookup, setLookup] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "account") setTab("account");
    try {
      const raw = localStorage.getItem("vdigital-my-orders");
      if (raw) setCodes(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (codes.length === 0) return;
    setLoading(true);
    Promise.all(
      codes.map(async (c) => {
        const res = await fetch(`/api/orders/${c}`);
        return res.ok ? ((await res.json()) as Order) : null;
      }),
    )
      .then((list) => setOrders(list.filter(Boolean) as Order[]))
      .finally(() => setLoading(false));
  }, [codes]);

  async function lookupOrder() {
    const code = lookup.trim().toUpperCase();
    if (!code) return;
    setMsg("");
    const res = await fetch(`/api/orders/${code}`);
    if (!res.ok) {
      setMsg("Không tìm thấy đơn với mã này.");
      return;
    }
    const o = (await res.json()) as Order;
    setOrders((prev) => (prev.some((x) => x.code === o.code) ? prev : [o, ...prev]));
    setCodes((prev) => {
      const next = prev.includes(o.code) ? prev : [...prev, o.code];
      try {
        localStorage.setItem("vdigital-my-orders", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const statusLabel: Record<string, string> = {
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    processing: "Chờ xử lý",
    completed: "Đã giao xong",
    cancelled: "Đã huỷ",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">Tài khoản của tôi</h1>
      {!auth.user && (
        <p className="text-sm text-amber-300 mt-2">
          Bạn chưa đăng nhập — vẫn xem được đơn bằng mã đơn bên dưới. Đăng nhập (nút Tài khoản ở header) để lưu lịch sử đơn theo tài khoản.
        </p>
      )}
      <div className="flex gap-1 border-b border-navy-700 mt-4">
        {(["orders", "account"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-brand-500 text-brand-400" : "border-transparent text-slate-400"}`}
          >
            {t === "orders" ? "Đơn hàng của tôi" : "Quản lý tài khoản"}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <div className="py-6 max-w-md space-y-3">
          {auth.user ? (
            <>
              <p><b>Họ tên:</b> {auth.user.name}</p>
              <p><b>Email:</b> {auth.user.email}</p>
              {auth.user.isDemo && <p className="text-sm text-amber-300">Tài khoản demo (chưa cấu hình Supabase).</p>}
              <button onClick={() => auth.signOut()} className="rounded-lg border border-red-500/60 text-red-400 px-4 py-2 text-sm font-semibold">
                Đăng xuất
              </button>
            </>
          ) : (
            <p className="text-slate-400">Chưa đăng nhập. Bấm nút Tài khoản ở header để đăng nhập / đăng ký.</p>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="py-6">
          <div className="flex gap-2 max-w-md">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Nhập mã đơn (vd VD261126-XXXX)"
              className="flex-1 rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-sm font-mono"
            />
            <button onClick={lookupOrder} className="rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
              Tra đơn
            </button>
          </div>
          {msg && <p className="text-sm text-red-400 mt-2">{msg}</p>}
          {loading && <p className="text-slate-400 mt-4">Đang tải đơn…</p>}
          {orders.length === 0 && !loading && (
            <p className="text-slate-400 mt-4">Chưa có đơn hàng nào. Mã đơn được lưu tự động sau khi bạn đặt hàng trên trình duyệt này.</p>
          )}
          <div className="space-y-4 mt-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl bg-navy-800 border border-navy-700 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="font-mono">{o.code}</b>
                  <span className="text-xs rounded-full bg-navy-700 px-2.5 py-1 font-semibold">{statusLabel[o.status] ?? o.status}</span>
                  <span className="text-sm text-slate-400">{formatDateTime(o.created_at)}</span>
                  <b className="text-brand-400">{formatVND(o.total)}</b>
                </div>
                <div className="mt-3 space-y-2">
                  {o.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-navy-900 border border-navy-700 p-3 text-sm">
                      <div className="font-semibold">
                        {item.product_name} — {item.variant_name}
                      </div>
                      {item.status === "delivered" && (
                        <div className="mt-1 space-y-0.5">
                          {item.delivered_code && (
                            <p>
                              Tài khoản / Mã: <code className="bg-navy-700 px-2 py-0.5 rounded font-mono break-all">{item.delivered_code}</code>
                            </p>
                          )}
                          {item.delivered_serial && <p>Serial: <code className="font-mono">{item.delivered_serial}</code></p>}
                          {item.delivered_pin && <p>Mã nạp: <code className="bg-navy-700 px-2 py-0.5 rounded font-mono">{item.delivered_pin}</code></p>}
                          {item.delivered_note && <p className="text-slate-400">{item.delivered_note}</p>}
                        </div>
                      )}
                      {item.status === "waiting_manual" && <p className="text-amber-300 mt-1">⏳ Đang chờ shop xử lý — sẽ gửi mail khi xong.</p>}
                      {item.status === "failed" && <p className="text-red-400 mt-1">Hết mã trong kho — shop sẽ giao tay, liên hệ kèm mã đơn.</p>}
                      {item.status === "pending" && <p className="text-slate-400 mt-1">Chưa thanh toán.</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
