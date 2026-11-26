"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2 } from "lucide-react";
import { useAuth, useCart, useCatalog } from "@/components/providers";
import { formatVND } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import type { ManualField, Order } from "@/lib/types";

type PayState = "form" | "paying" | "done";

/** Chỉ báo 3 bước: 1 Thông tin → 2 Thanh toán → 3 Nhận hàng. */
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Thông tin", "Thanh toán", "Nhận hàng"];
  return (
    <ol className="flex items-center gap-0" aria-label="Tiến trình thanh toán">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? "step" : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "vd-surface2 vd-muted"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`hidden text-sm font-semibold sm:block ${active ? "text-white" : "vd-muted"}`}>{label}</span>
            </span>
            {n < 3 && <span className={`mx-2 h-px flex-1 sm:mx-3 ${done ? "bg-emerald-500" : "vd-border bg-current opacity-20"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

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
  const [simulating, setSimulating] = useState(false);
  // Thông tin khách điền theo manual_fields của từng gói làm tay —
  // key: variantId → fieldId → giá trị.
  const [customerInfo, setCustomerInfo] = useState<Record<string, Record<string, string>>>({});

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
    // Validate các ô bắt buộc theo manual_fields của từng gói làm tay.
    for (const { variant } of lines) {
      for (const f of variant?.manual_fields ?? []) {
        const val = (customerInfo[variant!.id]?.[f.id] ?? "").trim();
        if (f.required && !val) {
          setError(`Thiếu thông tin bắt buộc: ${f.label} (${variant!.label})`);
          return;
        }
        if (val && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          setError(`${f.label} không đúng định dạng email.`);
          return;
        }
      }
    }
    setState("paying");
    try {
      const res = await fetch("/api/payos/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty, customerInfo: customerInfo[i.variantId] ?? {} })),
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
    if (!payInfo?.orderCode || simulating) return;
    setSimulating(true);
    setError("");
    try {
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
    } finally {
      setSimulating(false);
    }
  }

  if (state === "done" && order) {
    return (
      <div className="max-w-3xl mx-auto px-4 mt-8">
        <Steps current={3} />
        <div className="vd-card border-emerald-500/50 p-6 mt-6">
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
                  <p className="flex items-center gap-1.5 text-sm text-amber-300 mt-2">
                    <Clock size={15} aria-hidden="true" /> Đang chờ xử lý — shop sẽ hoàn thành và gửi mail cho bạn trong 5–30 phút. Xem lại trong Đơn hàng của tôi.
                  </p>
                )}
                {item.customer_info && Object.entries(item.customer_info).filter(([, v]) => String(v ?? "").trim()).length > 0 && (
                  <div className="mt-2 text-sm vd-muted space-y-0.5">
                    {Object.entries(item.customer_info)
                      .filter(([, v]) => String(v ?? "").trim())
                      .map(([k, v]) => (
                        <p key={k}>
                          {k}: <span className="text-white">{String(v)}</span>
                        </p>
                      ))}
                  </div>
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

  // Đang chờ thanh toán PayOS thật — qrImage là ảnh QR vẽ từ nội dung VietQR
  // PayOS trả về; nếu không vẽ được thì chỉ hiện nút sang trang PayOS.
  if (state === "paying" && payInfo && !payInfo.demo) {
    return (
      <div className="max-w-lg mx-auto px-4 mt-8 text-center">
        <h1 className="text-2xl font-bold">Quét VietQR để thanh toán</h1>
        <p className="vd-muted mt-1">
          Đơn <b className="font-mono">{payInfo.orderCode}</b> — {formatVND(payInfo.amount)}
        </p>
        {payInfo.qrImage ? (
          <div className="mt-5 rounded-2xl bg-white p-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payInfo.qrImage} alt="VietQR thanh toán" className="w-64 h-64" />
          </div>
        ) : (
          <p className="text-sm vd-muted mt-5">Không tải được mã QR — bấm nút dưới để sang trang thanh toán PayOS.</p>
        )}
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
          <button onClick={simulatePaid} disabled={simulating} className="mt-4 w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {simulating && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
            {simulating ? "Đang mô phỏng…" : "Mô phỏng: tôi đã chuyển khoản"}
          </button>
          {error && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 mt-3">{error}</p>}
          <p className="text-xs vd-muted2 mt-2">Nút này gọi webhook demo để thử luồng giao hàng tự động.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">Thanh toán</h1>
      <div className="mt-4 max-w-2xl">
        <Steps current={state === "form" ? 1 : 2} />
      </div>
      {lines.length === 0 ? (
        <p className="vd-muted mt-4">
          Giỏ hàng trống. <button className="text-brand-400 underline" onClick={() => router.push("/san-pham")}>Tiếp tục mua sắm</button>
        </p>
      ) : (
        <div className="mt-6 grid md:grid-cols-2 gap-6 items-start">
          <div className="vd-card p-5 space-y-4">
            <h2 className="font-bold">Thông tin nhận hàng</h2>
            <div>
              <label className="field-label" htmlFor="co-name">Họ tên *</label>
              <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="co-email">Email nhận hàng *</label>
              <input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@gmail.com" autoComplete="email" inputMode="email" className="field" />
              <p className="field-hint">Tài khoản / mã thẻ sẽ gửi về email này và hiện trong Đơn hàng của tôi.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="co-phone">Số điện thoại / Zalo <span className="vd-muted font-normal">(tuỳ chọn)</span></label>
              <input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ""))} placeholder="090..." autoComplete="tel" inputMode="tel" className="field" />
            </div>
            <p className="text-xs vd-muted">
              Với gói nâng cấp chính chủ, shop liên hệ qua email này để lấy thông tin.
            </p>
            {/* Ô "Thông tin khách cần cung cấp" — chỉ hiện với gói làm tay
                có manual_fields do admin cấu hình (vd email cần add Family). */}
            {lines
              .filter((l) => (l.variant?.manual_fields?.length ?? 0) > 0)
              .map(({ variant, product }) => (
                <div key={variant!.id} className="rounded-xl border vd-border p-4 space-y-3">
                  <p className="text-sm font-bold">
                    Thông tin cần cung cấp — {product!.name} · {variant!.label}
                  </p>
                  {(variant!.manual_fields ?? []).map((f: ManualField) => {
                    const val = customerInfo[variant!.id]?.[f.id] ?? "";
                    const setVal = (v: string) =>
                      setCustomerInfo((prev) => ({
                        ...prev,
                        [variant!.id]: { ...(prev[variant!.id] ?? {}), [f.id]: v },
                      }));
                    const inputProps = {
                      id: `co-mf-${variant!.id}-${f.id}`,
                      value: val,
                      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(e.target.value),
                      placeholder: f.placeholder || "",
                      className: "field",
                    };
                    return (
                      <div key={f.id}>
                        <label className="field-label" htmlFor={inputProps.id}>
                          {f.label} {f.required ? "*" : <span className="vd-muted font-normal">(tuỳ chọn)</span>}
                        </label>
                        {f.type === "textarea" ? (
                          <textarea {...inputProps} rows={2} />
                        ) : (
                          <input
                            {...inputProps}
                            type={f.type === "email" ? "email" : f.type === "number" ? "text" : "text"}
                            inputMode={f.type === "email" ? "email" : f.type === "number" ? "numeric" : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                  <p className="field-hint">Shop dùng thông tin này để xử lý đơn làm tay cho bạn.</p>
                </div>
              ))}
            {error && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400">{error}</p>}
            <button onClick={createPayment} disabled={state === "paying"} className="btn-primary w-full disabled:opacity-60">
              {state === "paying" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {state === "paying" ? "Đang tạo đơn…" : `Thanh toán VietQR — ${formatVND(total)}`}
            </button>
            <p className="text-xs vd-muted2 text-center">PayOS VietQR — miễn phí, 0% phí giao dịch, tự động duyệt đơn sau khi thanh toán.</p>
          </div>
          <div className="vd-card p-5">
            <h2 className="font-bold mb-3">Đơn hàng của bạn</h2>
            <div className="space-y-3">
              {lines.map(({ item, product, variant }) => (
                <div key={item.variantId} className="flex items-center gap-3">
                  <ProductImage product={product!} className="h-12 w-12 rounded-xl shrink-0" textSize="text-base" />
                  <span className="min-w-0 flex-1 text-sm">
                    {product!.name} — {variant!.label} × {item.qty}
                  </span>
                  <b className="shrink-0 text-sm">{formatVND(variant!.price * item.qty)}</b>
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
