"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Clock, Copy } from "lucide-react";
import { useAuth, useToast } from "@/components/providers";
import { formatDateTime, formatVND } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AccountPage() {
  const auth = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lookup, setLookup] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.notify(`Đã sao chép mã đơn ${code}`);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      toast.notify(`Mã đơn: ${code}`);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "account") router.replace("/tai-khoan/quan-ly");
    try {
      const raw = localStorage.getItem("vdigital-my-orders");
      if (raw) setCodes(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [router]);

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
      <h1 className="text-2xl font-bold">Đơn hàng của tôi</h1>
      <p className="text-sm vd-muted mt-1">
        Quản lý tài khoản, đổi mật khẩu, đăng xuất:{" "}
        <Link href="/tai-khoan/quan-ly" className="font-semibold text-brand-400 hover:underline">Quản lý tài khoản</Link>
      </p>
      {!auth.user && (
        <p className="text-sm text-amber-300 mt-2">
          Bạn chưa đăng nhập — vẫn xem được đơn bằng mã đơn bên dưới. Đăng nhập (nút Tài khoản ở header) để lưu lịch sử đơn theo tài khoản.
        </p>
      )}
      <div className="py-6">
        <label className="field-label" htmlFor="order-lookup">Tra cứu đơn hàng bằng mã đơn</label>
          <div className="flex gap-2 max-w-md">
            <input
              id="order-lookup"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupOrder()}
              placeholder="Nhập mã đơn (vd VD261126-XXXX)"
              className="flex-1 rounded-lg vd-card-flat border vd-border px-3 py-2 text-sm font-mono"
            />
            <button onClick={lookupOrder} className="min-h-11 rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
              Tra đơn
            </button>
          </div>
          {msg && <p role="alert" className="text-sm text-red-400 mt-2">{msg}</p>}
          {loading && <p className="vd-muted mt-4">Đang tải đơn…</p>}
          {orders.length === 0 && !loading && (
            <p className="vd-muted mt-4">Chưa có đơn hàng nào. Mã đơn được lưu tự động sau khi bạn đặt hàng trên trình duyệt này.</p>
          )}
          <div className="space-y-4 mt-4">
            {orders.map((o) => (
              <div key={o.id} className="vd-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <b className="font-mono">{o.code}</b>
                    <button
                      onClick={() => copyCode(o.code)}
                      aria-label={`Sao chép mã đơn ${o.code}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg vd-muted hover:text-white hover:bg-white/5"
                    >
                      {copied === o.code ? <Check size={15} className="text-emerald-400" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    </button>
                  </span>
                  <span className="text-xs rounded-full vd-surface2 px-2.5 py-1 font-semibold">{statusLabel[o.status] ?? o.status}</span>
                  <span className="text-sm vd-muted">{formatDateTime(o.created_at)}</span>
                  <b className="text-brand-400">{formatVND(o.total)}</b>
                </div>
                <div className="mt-3 space-y-2">
                  {o.items.map((item) => (
                    <div key={item.id} className="vd-card-flat p-3 text-sm">
                      <div className="font-semibold">
                        {item.product_name} — {item.variant_name}
                      </div>
                      {item.status === "delivered" && (
                        <div className="mt-1 space-y-0.5">
                          {item.delivered_code && (
                            <p>
                              Tài khoản / Mã: <code className="vd-surface2 px-2 py-0.5 rounded font-mono break-all">{item.delivered_code}</code>
                            </p>
                          )}
                          {item.delivered_serial && <p>Serial: <code className="font-mono">{item.delivered_serial}</code></p>}
                          {item.delivered_pin && <p>Mã nạp: <code className="vd-surface2 px-2 py-0.5 rounded font-mono">{item.delivered_pin}</code></p>}
                          {item.delivered_note && <p className="vd-muted">{item.delivered_note}</p>}
                        </div>
                      )}
                      {item.status === "waiting_manual" && (
                        <p className="flex items-center gap-1.5 text-amber-300 mt-1">
                          <Clock size={14} aria-hidden="true" /> Đang chờ shop xử lý — sẽ gửi mail khi xong.
                        </p>
                      )}
                      {item.status === "failed" && <p className="text-red-400 mt-1">Hết mã trong kho — shop sẽ giao tay, liên hệ kèm mã đơn.</p>}
                      {item.status === "pending" && <p className="vd-muted mt-1">Chưa thanh toán.</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}
