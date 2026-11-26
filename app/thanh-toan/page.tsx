"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useCart, useCatalog } from "@/components/providers";
import { formatVND } from "@/lib/format";
import type { Order } from "@/lib/types";

type PayState = "form" | "paying" | "done";

export default function CheckoutPage() {
  const { catalog } = useCatalog();
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<PayState>("form");
  const [error, setError] = useState("");
  const [payInfo, setPayInfo] = useState<any>(null);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (auth.user) {
      setEmail((e) => e || auth.user!.email);
      setName((n) => n || auth.user!.name);
    }
  }, [auth.user]);

  const lines = cart.items
    .map((i) => {
      const product = catalog.products.find((p) => p.id === i.productId);
      const variant = product?.variants.find((v) => v.id === i.variantId);
      return { item: i, product, variant };
    })
    .filter((l) => l.product && l.variant);
  const total = lines.reduce((s, l) => s + (l.variant?.price ?? 0) * l.item.qty, 0);

  async function fetchOrder(code: string) {
    const res = await fetch(`/api/orders/${code}`);
    if (res.ok) setOrder(await res.json());
  }

  async function createPayment() {
    setError("");
    if (!name.trim() || !email.includes("@")) {
      setError("Nhập họ tên và email hợp lệ để nhận hàng.");
      return;
    }
    if (lines.length === 0) {
      setError("Giỏ hàng trống.");
      return;
    }
    setState("paying");
    try {
      const res = await fetch("/api/payos/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim(), userId: null },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được đơn hàng");
      setPayInfo(data);
      try {
        const raw = localStorage.getItem("vdigital-my-orders");
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(data.orderCode)) list.push(data.orderCode);
        localStorage.setItem("vdigital-my-orders", JSON.stringify(list));
      } catch {
        /* ignore */
      }
      if (!data.demo) {
        // PayOS thật: poll trạng thái đơn — webhook sẽ đổi trạng thái khi tiền về.
        const t = setInterval(async () => {
          const r = await fetch(`/api/orders/${data.orderCode}`);
          if (r.ok) {
            const o = (await r.json()) as Order;
            if (o.status !== "pending") {
              clearInterval(t);
              setOrder(o);
              cart.clear();
              setState("done");
            }
          }
        }, 3000);
        setTimeout(() => clearInterval(t), 15 * 60 * 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tạo đơn");
      setState("form");
    }
  }

  async function simulatePaid() {
    if (!payInfo?.orderCode) return;
    const res = await fetch("/api/payos/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true, orderCode: payInfo.orderCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Mô phỏng thanh toán thất bại");
      return;
    }
    setOrder(data.order);
    cart.clear();
    setState("done");
  }

  if (state === "done" && order) {
    return (
      <div className="max-w-3xl mx-auto px-4 mt-8">
        <div className="vd-card border-emerald-500/50 p-6">
          <h1 className="text-2xl font-bold text-emerald-400">Thanh toán thành công!</h1>
          <p className=" mt-1">
            Mã đơn: <b className="font-mono">{order.code}</b> — Tổng: <b>{formatVND(order.total)}</b>
          </p>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="vd-card-flat p-4">
                <div className="font-semibold">
                  {item.product_name} — {item.variant_name}
                </div>
                {item.status === "delivered" && (
                  <div className="mt-2 text-sm space-y-1">
                    {item.delivered_code && (
                      <p>
                        Tài khoản / Mã:{" "}
                        <code className="vd-surface2 px-2 py-1 rounded font-mono break-all">{item.delivered_code}</code>
                      </p>
                    )}
                    {item.delivered_serial && <p>Serial: <code className="font-mono">{item.delivered_serial}</code></p>}
                    {item.delivered_pin && (
                      <p>
                        Mã nạp: <code className="vd-surface2 px-2 py-1 rounded font-mono">{item.delivered_pin}</code>
                      </p>
                    )}
                    {item.delivered_note && <p className="vd-muted">{item.delivered_note}</p>}
                  </div>
                )}
                {item.status === "waiting_manual" && (
                  <p className="text-sm text-amber-300 mt-2">
                    ⏳ Đang chờ xử lý — shop sẽ hoàn thành và gửi mail cho bạn trong 5–30 phút. Xem lại trong Đơn hàng của tôi.
                  </p>
                )}
                {item.status === "failed" && (
                  <p className="text-sm text-red-400 mt-2">
                    Hết mã trong kho — shop sẽ bổ sung mã và giao tay. Liên hệ shop kèm mã đơn {order.code}.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm vd-muted mt-4">
            Thông tin giao hàng cũng đã gửi về email <b>{order.customer_email}</b> (nếu mail đã cấu hình).
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/tai-khoan?tab=orders")} className="rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 font-semibold text-white">
              Xem đơn hàng của tôi
            </button>
            <button onClick={() => router.push("/san-pham")} className="rounded-xl border vd-border px-5 py-2.5 font-semibold">
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Đang chờ thanh toán PayOS thật
  if (state === "paying" && payInfo && !payInfo.demo) {
    const qrSrc = payInfo.qrCode?.startsWith("data:") ? payInfo.qrCode : `data:image/png;base64,${payInfo.qrCode}`;
    return (
      <div className="max-w-lg mx-auto px-4 mt-8 text-center">
        <h1 className="text-2xl font-bold">Quét VietQR để thanh toán</h1>
        <p className="vd-muted mt-1">
          Đơn <b className="font-mono">{payInfo.orderCode}</b> — {formatVND(payInfo.amount)}
        </p>
        <div className="mt-5 rounded-2xl bg-white p-4 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="VietQR thanh toán" className="w-64 h-64" />
        </div>
        <p className="text-sm vd-muted mt-3">Mở app ngân hàng, quét mã và chuyển khoản đúng số tiền. Hệ thống tự xác nhận trong vài giây.</p>
        <a href={payInfo.checkoutUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 font-semibold text-white">
          Mở trang thanh toán PayOS
        </a>
        <p className="text-xs vd-muted2 mt-3">Đang chờ tiền về… trang này sẽ tự chuyển khi đơn được xác nhận.</p>
        <button onClick={() => fetchOrder(payInfo.orderCode).then(() => setState("done"))} className="mt-3 text-sm text-brand-400 underline">
          Tôi đã chuyển khoản — kiểm tra đơn
        </button>
      </div>
    );
  }

  // Chế độ demo: hiện thông tin chuyển khoản MB Bank + nút mô phỏng
  if (state === "paying" && payInfo?.demo) {
    return (
      <div className="max-w-lg mx-auto px-4 mt-8">
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/40 p-5">
          <h1 className="text-xl font-bold text-amber-300">Chế độ demo — chưa cấu hình PayOS</h1>
          <p className="text-sm  mt-2">
            Đơn <b className="font-mono">{payInfo.orderCode}</b> — tổng <b>{formatVND(payInfo.amount)}</b>. Khi có PayOS thật,
            khách sẽ thấy mã VietQR động ở đây. Hiện tại chuyển khoản tay theo thông tin dưới (demo):
          </p>
          <div className="mt-3 text-sm space-y-1 vd-surface2 rounded-xl p-4">
            <p>Ngân hàng: <b>{payInfo.bank.name}</b></p>
            <p>Số tài khoản: <b className="font-mono">{payInfo.bank.account}</b></p>
            <p>Chủ TK: <b>{payInfo.bank.accountName}</b></p>
            <p>Nội dung: <b className="font-mono">{payInfo.content}</b></p>
          </div>
          <button onClick={simulatePaid} className="mt-4 w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 font-bold text-white">
            Mô phỏng: tôi đã chuyển khoản
          </button>
          <p className="text-xs vd-muted2 mt-2">Nút này gọi webhook demo để thử luồng giao hàng tự động.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">Thanh toán</h1>
      {lines.length === 0 ? (
        <p className="vd-muted mt-4">
          Giỏ hàng trống. <button className="text-brand-400 underline" onClick={() => router.push("/san-pham")}>Tiếp tục mua sắm</button>
        </p>
      ) : (
        <div className="mt-4 grid md:grid-cols-2 gap-6 items-start">
          <div className="vd-card p-5 space-y-3">
            <h2 className="font-bold">Thông tin nhận hàng</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ tên *" className="w-full rounded-lg vd-surface2 border vd-border px-3 py-2.5 text-sm" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email nhận hàng *" className="w-full rounded-lg vd-surface2 border vd-border px-3 py-2.5 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại / Zalo (tuỳ chọn)" className="w-full rounded-lg vd-surface2 border vd-border px-3 py-2.5 text-sm" />
            <p className="text-xs vd-muted">
              Tài khoản / mã thẻ sẽ gửi về email này và hiện trong Đơn hàng của tôi. Với gói nâng cấp chính chủ, shop liên hệ
              qua email này để lấy thông tin.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={createPayment} className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 font-bold text-white">
              Thanh toán VietQR — {formatVND(total)}
            </button>
            <p className="text-xs vd-muted2 text-center">PayOS VietQR — miễn phí, 0% phí giao dịch, tiền về MB Bank, tự động duyệt đơn.</p>
          </div>
          <div className="vd-card p-5">
            <h2 className="font-bold mb-3">Đơn hàng của bạn</h2>
            <div className="space-y-2">
              {lines.map(({ item, product, variant }) => (
                <div key={item.variantId} className="flex justify-between text-sm gap-3">
                  <span>
                    {product!.name} — {variant!.label} × {item.qty}
                  </span>
                  <b>{formatVND(variant!.price * item.qty)}</b>
                </div>
              ))}
            </div>
            <div className="border-t vd-border mt-3 pt-3 flex justify-between font-bold">
              <span>Tổng thanh toán</span>
              <span className="text-brand-400">{formatVND(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
