"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Coins, Eye, EyeOff, Loader2, Ticket } from "lucide-react";
import { isSupabaseConfigured, useAuth, useCart, useCatalog } from "@/components/providers";
import { formatVND } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { getAccessToken, type PublicVoucher } from "@/lib/wallet-client";
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
  // Thông báo khi khách bấm "Tôi đã chuyển khoản" mà tiền chưa về.
  const [checkMsg, setCheckMsg] = useState("");
  // Thông tin khách điền theo manual_fields của từng gói làm tay —
  // key: variantId → fieldId → giá trị.
  const [customerInfo, setCustomerInfo] = useState<Record<string, Record<string, string>>>({});
  // Hiện/ẩn ô mật khẩu trong manual_fields: key `${variantId}:${fieldId}`.
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});

  // --- Ví Xu + voucher (v4.7) ---
  // Chỉ tài khoản thật (đã đăng nhập Supabase, không phải demo) mới dùng Xu.
  const hasRealSession = Boolean(auth.user && !auth.user.isDemo && isSupabaseConfigured);
  const [paymentMethod, setPaymentMethod] = useState<"vietqr" | "xu">("vietqr");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [publicVouchers, setPublicVouchers] = useState<PublicVoucher[]>([]);

  useEffect(() => {
    if (!hasRealSession) {
      setWalletBalance(null);
      return;
    }
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/wallet/balance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setWalletBalance(Number((await res.json()).balance ?? 0));
      } catch {
        /* ví chưa sẵn sàng: checkout vẫn chạy bằng VietQR */
      }
    })();
  }, [hasRealSession]);

  // Voucher công khai: ai cũng xem được, bấm để điền mã.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vouchers/public");
        if (res.ok) setPublicVouchers(((await res.json()).vouchers ?? []) as PublicVoucher[]);
      } catch {
        /* không có voucher công khai thì ẩn mục này */
      }
    })();
  }, []);

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
  const voucherDiscount = appliedVoucher?.discount ?? 0;
  const payable = Math.max(0, total - voucherDiscount);
  const xuEnough = walletBalance !== null && walletBalance >= payable;

  async function applyVoucher(code?: string) {
    const c = (code ?? voucherInput).trim().toUpperCase();
    if (!c) return;
    if (!email.includes("@")) {
      setVoucherMsg("Nhập email hợp lệ trước khi áp mã giảm giá.");
      return;
    }
    setVoucherBusy(true);
    setVoucherMsg("");
    try {
      const res = await fetch("/api/vouchers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, order_total: total, customer_email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAppliedVoucher({ code: c, discount: Number(data.discount ?? 0) });
        setVoucherInput(c);
        setVoucherMsg(`Đã áp mã ${c} — giảm ${formatVND(Number(data.discount ?? 0))}.`);
      } else {
        setAppliedVoucher(null);
        setVoucherMsg(data.error || "Mã không áp dụng được cho đơn này.");
      }
    } catch {
      setVoucherMsg("Không kiểm tra được mã — thử lại sau.");
    } finally {
      setVoucherBusy(false);
    }
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
    if (paymentMethod === "xu" && !xuEnough) {
      setError("Số dư Xu không đủ cho đơn này — nạp thêm Xu rồi thử lại.");
      return;
    }
    setState("paying");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.user && !auth.user.isDemo) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/payos/create-payment", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty, customerInfo: customerInfo[i.variantId] ?? {} })),
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim(), userId: null },
          payment_method: paymentMethod,
          voucher_code: appliedVoucher?.code ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được đơn hàng");
      try {
        const raw = localStorage.getItem("vdigital-my-orders");
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(data.orderCode)) list.push(data.orderCode);
        localStorage.setItem("vdigital-my-orders", JSON.stringify(list));
      } catch {
        /* ignore */
      }
      if (data.xu) {
        // Thanh toán bằng Xu: trừ ví + giao hàng ngay phía server, không có
        // QR và không cần polling — sang màn hình thành công luôn.
        const o = (data.order ?? null) as Order | null;
        if (o) {
          setOrder(o);
          cart.clear();
          setState("done");
          try {
            window.dispatchEvent(new Event("vdigital:wallet-updated"));
          } catch {
            /* ignore */
          }
          return;
        }
        throw new Error("Thanh toán Xu xong nhưng không nhận được đơn hàng.");
      }
      setPayInfo(data);
      if (!data.demo) {
        // PayOS thật: poll trạng thái đơn — webhook sẽ đổi trạng thái khi tiền về.
        // Chỉ chuyển sang màn hình thành công khi đơn thật sự đã trả
        // (paid/processing/completed); huỷ hoặc vẫn chờ thì không báo thành công.
        const t = setInterval(async () => {
          const r = await fetch(`/api/orders/${data.orderCode}`);
          if (r.ok) {
            const o = (await r.json()) as Order;
            if (["paid", "processing", "completed"].includes(o.status)) {
              clearInterval(t);
              setOrder(o);
              cart.clear();
              setState("done");
            } else if (o.status === "cancelled") {
              clearInterval(t);
              setOrder(o);
              setState("done");
            }
          }
        }, 3000);
        setTimeout(() => clearInterval(t), 15 * 60 * 1000);
      } else {
        // PayOS chưa cấu hình: không có mã QR thật — báo rõ để liên hệ shop.
        setError("Thanh toán chưa khả dụng — liên hệ shop để được hỗ trợ.");
        setState("form");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tạo đơn");
      setState("form");
    }
  }

  // Khách bấm "Tôi đã chuyển khoản": kiểm tra trạng thái thật của đơn rồi
  // mới báo thành công — trước đây bấm là báo thành công dù tiền chưa về.
  async function checkPaid() {
    if (!payInfo?.orderCode) return;
    const r = await fetch(`/api/orders/${payInfo.orderCode}`);
    if (!r.ok) return;
    const o = (await r.json()) as Order;
    if (["paid", "processing", "completed"].includes(o.status)) {
      setOrder(o);
      cart.clear();
      setState("done");
    } else if (o.status === "cancelled") {
      setOrder(o);
      setState("done");
    } else {
      setCheckMsg("Hệ thống chưa thấy tiền về — đợi thêm vài giây rồi bấm lại.");
    }
  }

  if (state === "done" && order) {
    // Màn hình kết thúc phải theo trạng thái THẬT của đơn — không báo thành
    // công khi đơn vẫn đang chờ tiền về.
    if (order.status === "cancelled") {
      return (
        <div className="max-w-3xl mx-auto px-4 mt-8">
          <Steps current={3} />
          <div className="vd-card border-red-500/50 p-6 mt-6">
            <h1 className="text-2xl font-bold text-red-400">Đơn đã huỷ</h1>
            <p className="mt-1">
              Mã đơn: <b className="font-mono">{order.code}</b> — Tổng: <b>{formatVND(order.total)}</b>
            </p>
            <p className="text-sm vd-muted mt-2">Đơn này đã bị huỷ, tiền (nếu đã chuyển) sẽ được PayOS hoàn lại theo quy định ngân hàng.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => router.push("/san-pham")} className="rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 font-semibold text-white">
                Tiếp tục mua sắm
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (order.status === "pending") {
      return (
        <div className="max-w-3xl mx-auto px-4 mt-8">
          <Steps current={2} />
          <div className="vd-card border-amber-500/50 p-6 mt-6">
            <h1 className="text-2xl font-bold text-amber-300">Đang chờ xác nhận thanh toán</h1>
            <p className="mt-1">
              Mã đơn: <b className="font-mono">{order.code}</b> — Tổng: <b>{formatVND(order.total)}</b>
            </p>
            <p className="text-sm vd-muted mt-2">Hệ thống chưa thấy tiền về cho đơn này. Nếu bạn đã chuyển khoản, đợi thêm vài giây rồi bấm kiểm tra lại.</p>
            {checkMsg && <p role="alert" className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2.5 text-sm font-semibold text-amber-300 mt-3">{checkMsg}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => void checkPaid()} className="rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 font-semibold text-white">
                Kiểm tra lại
              </button>
              <button onClick={() => router.push("/tai-khoan?tab=orders")} className="rounded-xl border vd-border px-5 py-2.5 font-semibold">
                Xem đơn hàng của tôi
              </button>
            </div>
          </div>
        </div>
      );
    }
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
          <div className="flex flex-wrap gap-3 mt-5">
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
        <button onClick={() => void checkPaid()} className="mt-3 text-sm text-brand-400 underline">
          Tôi đã chuyển khoản — kiểm tra đơn
        </button>
        {checkMsg && <p role="alert" className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2.5 text-sm font-semibold text-amber-300 mt-3">{checkMsg}</p>}
      </div>
    );
  }

  // PayOS chưa cấu hình thì không có mã QR thật — báo rõ, không hiện màn hình demo.
  if (state === "paying" && payInfo?.demo) {
    return (
      <div className="max-w-lg mx-auto px-4 mt-8 text-center">
        <h1 className="text-2xl font-bold">Thanh toán chưa khả dụng</h1>
        <p className="vd-muted mt-2">
          Đơn <b className="font-mono">{payInfo.orderCode}</b> — tổng <b>{formatVND(payInfo.amount)}</b> đã được tạo nhưng hệ thống thanh toán chưa sẵn sàng. Liên hệ shop để được hỗ trợ.
        </p>
        <button onClick={() => router.push("/tai-khoan?tab=orders")} className="mt-5 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 font-semibold text-white">
          Xem đơn hàng của tôi
        </button>
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
          <div className="vd-card p-5 space-y-4 min-w-0">
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
                    const pwKey = `${variant!.id}:${f.id}`;
                    return (
                      <div key={f.id}>
                        <label className="field-label" htmlFor={inputProps.id}>
                          {f.label} {f.required ? "*" : <span className="vd-muted font-normal">(tuỳ chọn)</span>}
                        </label>
                        {f.type === "textarea" ? (
                          <textarea {...inputProps} rows={2} />
                        ) : f.type === "password" ? (
                          <div className="relative">
                            <input
                              {...inputProps}
                              type={showPw[pwKey] ? "text" : "password"}
                              autoComplete="off"
                              className="field !pr-11"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((prev) => ({ ...prev, [pwKey]: !prev[pwKey] }))}
                              aria-label={showPw[pwKey] ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 vd-muted hover:text-white"
                            >
                              {showPw[pwKey] ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                            </button>
                          </div>
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
            {/* Mã giảm giá */}
            <div className="rounded-xl border vd-border p-4 space-y-2">
              <p className="text-sm font-bold flex items-center gap-2">
                <Ticket size={16} aria-hidden="true" className="text-brand-400" /> Mã giảm giá
              </p>
              {appliedVoucher ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-sm">
                  <span>
                    <b className="font-mono">{appliedVoucher.code}</b>
                    <span className="text-emerald-300"> — giảm {formatVND(appliedVoucher.discount)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedVoucher(null);
                      setVoucherMsg("");
                    }}
                    className="text-sm font-semibold text-red-400 hover:underline"
                  >
                    Gỡ mã
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && void applyVoucher()}
                    placeholder="Nhập mã voucher"
                    className="field flex-1 font-mono"
                    aria-label="Mã giảm giá"
                  />
                  <button
                    type="button"
                    onClick={() => void applyVoucher()}
                    disabled={voucherBusy || !voucherInput.trim()}
                    className="rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {voucherBusy ? "Đang kiểm tra…" : "Áp dụng"}
                  </button>
                </div>
              )}
              {voucherMsg && !appliedVoucher && <p role="alert" className="text-xs text-amber-300">{voucherMsg}</p>}
              {publicVouchers.length > 0 && !appliedVoucher && (
                <div className="flex flex-wrap gap-1.5">
                  {publicVouchers.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => void applyVoucher(v.code)}
                      className="chip !py-1 !px-2.5 text-xs font-mono"
                      title={v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${formatVND(v.value)}`}
                    >
                      {v.code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phương thức thanh toán — Xu chỉ hiện với tài khoản thật */}
            {hasRealSession && (
              <div className="space-y-2">
                <p className="field-label">Phương thức thanh toán</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("vietqr")}
                    aria-pressed={paymentMethod === "vietqr"}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${paymentMethod === "vietqr" ? "border-brand-500 bg-brand-500/10 text-white" : "vd-border vd-card-flat vd-muted"}`}
                  >
                    VietQR
                    <span className="block text-xs font-normal vd-muted mt-0.5">Quét mã, tự xác nhận</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => xuEnough && setPaymentMethod("xu")}
                    disabled={!xuEnough}
                    aria-pressed={paymentMethod === "xu"}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${paymentMethod === "xu" ? "border-amber-400 bg-amber-400/10 text-white" : "vd-border vd-card-flat vd-muted"} disabled:opacity-70`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Coins size={15} aria-hidden="true" className="text-amber-300" /> Thanh toán bằng Xu
                    </span>
                    <span className="block text-xs font-normal vd-muted mt-0.5">
                      {walletBalance === null ? "Đang tải số dư…" : `Số dư: ${formatVND(walletBalance)} Xu`}
                    </span>
                  </button>
                </div>
                {walletBalance !== null && walletBalance < payable && (
                  <p className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2.5 text-sm text-amber-300">
                    Số dư Xu ({formatVND(walletBalance)}) chưa đủ {formatVND(payable)} cho đơn này.{" "}
                    <Link href="/tai-khoan" className="font-bold underline">Nạp ngay</Link>
                  </p>
                )}
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400">{error}</p>}
            <button onClick={createPayment} disabled={state === "paying" || (paymentMethod === "xu" && !xuEnough)} className="btn-primary w-full disabled:opacity-60">
              {state === "paying" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {state === "paying"
                ? "Đang tạo đơn…"
                : paymentMethod === "xu"
                  ? `Thanh toán bằng Xu — ${formatVND(payable)}`
                  : `Thanh toán VietQR — ${formatVND(payable)}`}
            </button>
            <p className="text-xs vd-muted2 text-center">PayOS VietQR — miễn phí, 0% phí giao dịch, tự động duyệt đơn sau khi thanh toán.</p>
          </div>
          <div className="vd-card p-5 min-w-0">
            <h2 className="font-bold mb-3">Đơn hàng của bạn</h2>
            <div className="space-y-3">
              {lines.map(({ item, product, variant }) => {
                const onSale = variant!.original_price > variant!.price;
                const salePct = onSale ? Math.round((1 - variant!.price / variant!.original_price) * 100) : 0;
                return (
                  <div key={item.variantId} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <ProductImage product={product!} className="h-12 w-12 rounded-xl shrink-0" textSize="text-base" />
                    <span className="min-w-0 flex-1 basis-36 text-sm">
                      <span className="block truncate font-semibold">{product!.name} — {variant!.label}</span>
                      <span className="vd-muted flex flex-wrap items-center gap-x-2">
                        {formatVND(variant!.price)}
                        {onSale && (
                          <>
                            <span className="line-through">{formatVND(variant!.original_price)}</span>
                            <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-xs font-bold">-{salePct}%</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0 ml-auto">
                      <button onClick={() => cart.setQty(item.variantId, item.qty - 1)} aria-label={`Giảm số lượng ${product!.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg vd-surface2 border vd-border font-bold">−</button>
                      <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                      <button onClick={() => cart.setQty(item.variantId, item.qty + 1)} aria-label={`Tăng số lượng ${product!.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg vd-surface2 border vd-border font-bold">+</button>
                    </span>
                    <b className="shrink-0 text-sm w-20 text-right">{formatVND(variant!.price * item.qty)}</b>
                    <button onClick={() => cart.remove(item.variantId)} aria-label={`Xoá ${product!.name} khỏi đơn`} className="shrink-0 vd-muted hover:text-red-400 text-lg font-bold leading-none">✕</button>
                  </div>
                );
              })}
            </div>
            {(() => {
              const originalTotal = lines.reduce((s, l) => s + (l.variant?.original_price ?? l.variant?.price ?? 0) * l.item.qty, 0);
              const savings = originalTotal - total;
              return (
                <div className="border-t vd-border mt-3 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between vd-muted"><span>Tạm tính</span><span>{formatVND(originalTotal)}</span></div>
                  {savings > 0 && (
                    <div className="flex justify-between text-emerald-300"><span>Giảm giá</span><span>−{formatVND(savings)}</span></div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Giảm giá (voucher {appliedVoucher!.code})</span>
                      <span>−{formatVND(voucherDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Tổng thanh toán</span>
                    <span className="text-brand-400">{formatVND(payable)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
