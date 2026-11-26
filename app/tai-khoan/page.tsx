"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Check, Clock, Coins, Copy, Loader2, MessageSquareWarning, Wallet } from "lucide-react";
import { isSupabaseConfigured, useAuth, useToast } from "@/components/providers";
import { formatDate, formatDateTime, formatVND, isWithinWarranty } from "@/lib/format";
import { getAccessToken, WALLET_TX_LABELS, type WalletTransaction } from "@/lib/wallet-client";
import { COMPLAINT_REASONS, COMPLAINT_REASON_LABELS, COMPLAINT_STATUS_LABELS, type Complaint, type ComplaintReason, type Order } from "@/lib/types";

const TOPUP_QUICK = [50_000, 100_000, 200_000, 500_000];

interface CheckinStatus {
  checked_in_today: boolean;
  streak: number;
  daily_amount: number;
  sunday_amount: number;
}

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

  // --- Ví Xu + điểm danh (v4.7) — chỉ tài khoản thật ---
  const hasRealSession = Boolean(auth.user && !auth.user.isDemo && isSupabaseConfigured);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupInfo, setTopupInfo] = useState<{ checkout_url: string; qrImage: string; topup_code: string; amount: number } | null>(null);
  const [topupMsg, setTopupMsg] = useState("");
  const topupBaseRef = useRef<number | null>(null);
  const topupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState("");

  // --- Khiếu nại bảo hành (v4.8) — chỉ tài khoản thật ---
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintItemId, setComplaintItemId] = useState<string | null>(null);
  const [complaintReason, setComplaintReason] = useState<ComplaintReason>("code_error");
  const [complaintContent, setComplaintContent] = useState("");
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintMsg, setComplaintMsg] = useState("");

  const loadComplaints = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setComplaintsLoading(true);
    try {
      const res = await fetch("/api/complaints", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setComplaints(((await res.json()).complaints ?? []) as Complaint[]);
    } catch {
      /* khiếu nại chưa sẵn sàng: chỉ ẩn phần này */
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setWalletLoading(true);
    try {
      const res = await fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setWalletBalance(Number(json.balance ?? 0));
        setTransactions(((json.transactions ?? []) as WalletTransaction[]).slice(0, 20));
      }
    } catch {
      /* ví chưa sẵn sàng: chỉ ẩn phần ví */
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const loadCheckin = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/checkin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCheckin((await res.json()) as CheckinStatus);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hasRealSession) return;
    loadWallet();
    loadCheckin();
    loadComplaints();
  }, [hasRealSession, loadWallet, loadCheckin, loadComplaints]);

  // Dừng poll nạp tiền khi rời trang.
  useEffect(
    () => () => {
      if (topupTimerRef.current) clearInterval(topupTimerRef.current);
    },
    [],
  );

  async function doTopup() {
    const amount = Number(topupAmount);
    if (!amount || amount < 10_000) {
      setTopupMsg("Nạp tối thiểu 10.000đ.");
      return;
    }
    if (amount > 50_000_000) {
      setTopupMsg("Nạp tối đa 50.000.000đ mỗi lần.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setTopupMsg("Chưa đăng nhập — đăng nhập lại rồi nạp tiền.");
      return;
    }
    setTopupBusy(true);
    setTopupMsg("");
    setTopupInfo(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được yêu cầu nạp tiền");
      topupBaseRef.current = walletBalance ?? 0;
      setTopupInfo({
        checkout_url: data.checkout_url,
        qrImage: data.qrImage,
        topup_code: data.topup_code,
        amount: Number(data.amount ?? amount),
      });
      // Poll số dư mỗi 3s, tối đa 5 phút — tiền về thì báo thành công.
      const started = Date.now();
      if (topupTimerRef.current) clearInterval(topupTimerRef.current);
      topupTimerRef.current = setInterval(async () => {
        try {
          const t = await getAccessToken();
          if (!t) return;
          const r = await fetch("/api/wallet/balance", {
            headers: { Authorization: `Bearer ${t}` },
          });
          if (!r.ok) return;
          const j = await r.json();
          const bal = Number(j.balance ?? 0);
          if (topupBaseRef.current !== null && bal > topupBaseRef.current) {
            if (topupTimerRef.current) clearInterval(topupTimerRef.current);
            topupTimerRef.current = null;
            setWalletBalance(bal);
            setTransactions(((j.transactions ?? []) as WalletTransaction[]).slice(0, 20));
            setTopupMsg(`Nạp thành công ${formatVND(bal - topupBaseRef.current)} — số dư mới ${formatVND(bal)}.`);
            setTopupInfo(null);
            try {
              window.dispatchEvent(new Event("vdigital:wallet-updated"));
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* lần poll sau thử lại */
        }
        if (Date.now() - started > 5 * 60_000 && topupTimerRef.current) {
          clearInterval(topupTimerRef.current);
          topupTimerRef.current = null;
          setTopupMsg("Chưa thấy tiền về sau 5 phút — kiểm tra lại giao dịch ngân hàng hoặc liên hệ shop kèm mã nạp.");
        }
      }, 3000);
    } catch (e) {
      setTopupMsg(e instanceof Error ? e.message : "Lỗi nạp tiền");
    } finally {
      setTopupBusy(false);
    }
  }

  async function doCheckin() {
    const token = await getAccessToken();
    if (!token) return;
    setCheckinBusy(true);
    setCheckinMsg("");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Điểm danh thất bại");
      if (data.already) {
        setCheckinMsg("Hôm nay bạn đã điểm danh rồi.");
      } else {
        setCheckinMsg(`Điểm danh thành công — nhận ${formatVND(Number(data.amount ?? 0))} Xu, chuỗi ${data.streak ?? 0} ngày.`);
        if (typeof data.balance === "number") setWalletBalance(data.balance);
      }
      await loadCheckin();
      await loadWallet();
      try {
        window.dispatchEvent(new Event("vdigital:wallet-updated"));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setCheckinMsg(e instanceof Error ? e.message : "Lỗi điểm danh");
    } finally {
      setCheckinBusy(false);
    }
  }

  async function submitComplaint(itemId: string) {
    if (complaintContent.trim().length < 10) {
      setComplaintMsg("Mô tả khiếu nại tối thiểu 10 ký tự để shop hiểu vấn đề.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setComplaintMsg("Chưa đăng nhập — đăng nhập lại rồi gửi khiếu nại.");
      return;
    }
    setComplaintBusy(true);
    setComplaintMsg("");
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_item_id: itemId, reason: complaintReason, content: complaintContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không gửi được khiếu nại");
      setComplaintMsg("Đã gửi khiếu nại — shop sẽ xử lý và cập nhật tiến trình tại đây.");
      setComplaintItemId(null);
      setComplaintContent("");
      await loadComplaints();
    } catch (e) {
      setComplaintMsg(e instanceof Error ? e.message : "Lỗi gửi khiếu nại");
    } finally {
      setComplaintBusy(false);
    }
  }

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

      {hasRealSession && (
        <div className="grid md:grid-cols-2 gap-4 mt-5 items-start">
          {/* Ví Xu */}
          <div className="vd-card p-5">
            <h2 className="font-bold flex items-center gap-2">
              <Wallet size={18} aria-hidden="true" className="text-amber-300" /> Ví Xu
            </h2>
            <p className="mt-2 text-sm vd-muted">
              Số dư:{" "}
              <b className="text-amber-300 text-lg">{walletLoading && walletBalance === null ? "Đang tải…" : formatVND(walletBalance ?? 0)}</b> Xu
              <span className="vd-muted2"> · 1 Xu = 1đ, dùng để thanh toán đơn hàng</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {TOPUP_QUICK.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setTopupAmount(String(a))}
                  className={`chip !py-1.5 !px-3 text-sm font-semibold ${topupAmount === String(a) ? "!border-amber-400 text-amber-300" : ""}`}
                >
                  {formatVND(a)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Số tiền nạp (tối thiểu 10.000đ)"
                className="field flex-1"
                aria-label="Số tiền nạp"
              />
              <button
                onClick={() => void doTopup()}
                disabled={topupBusy}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                {topupBusy ? "Đang tạo…" : "Nạp tiền"}
              </button>
            </div>
            {topupMsg && (
              <p role="status" className={`mt-2 text-sm font-semibold ${topupMsg.startsWith("Nạp thành công") ? "text-emerald-300" : "text-amber-300"}`}>
                {topupMsg}
              </p>
            )}
            {topupInfo && (
              <div className="mt-3 rounded-xl border vd-border p-4 text-center">
                <p className="text-sm font-semibold">
                  Nạp {formatVND(topupInfo.amount)} — mã nạp <b className="font-mono">{topupInfo.topup_code}</b>
                </p>
                {topupInfo.qrImage ? (
                  <div className="mt-3 rounded-2xl bg-white p-3 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={topupInfo.qrImage} alt="VietQR nạp tiền" className="w-56 h-56" />
                  </div>
                ) : (
                  <p className="text-sm vd-muted mt-3">Không tải được mã QR — bấm nút dưới để sang trang thanh toán PayOS.</p>
                )}
                <div>
                  <a href={topupInfo.checkout_url} target="_blank" rel="noreferrer" className="inline-block mt-3 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white">
                    Mở trang thanh toán PayOS
                  </a>
                </div>
                <p className="text-xs vd-muted2 mt-2">Đang chờ tiền về… trang này sẽ tự báo khi số dư tăng.</p>
              </div>
            )}
            <h3 className="font-bold text-sm mt-5">Lịch sử giao dịch</h3>
            {transactions.length === 0 ? (
              <p className="text-sm vd-muted mt-1">Chưa có giao dịch nào.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm max-h-72 overflow-y-auto">
                {transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg vd-card-flat px-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{WALLET_TX_LABELS[t.type] ?? t.type}{t.ref_code ? <span className="font-mono text-xs vd-muted"> · {t.ref_code}</span> : null}</span>
                      <span className="block text-xs vd-muted">{formatDateTime(t.created_at)}{t.note ? ` — ${t.note}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                        {t.amount >= 0 ? "+" : "−"}{formatVND(Math.abs(t.amount))}
                      </span>
                      <span className="block text-xs vd-muted">Còn {formatVND(t.balance_after)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Điểm danh */}
          <div className="vd-card p-5">
            <h2 className="font-bold flex items-center gap-2">
              <CalendarCheck size={18} aria-hidden="true" className="text-emerald-400" /> Điểm danh nhận Xu
            </h2>
            {checkin ? (
              <>
                <p className="mt-2 text-sm vd-muted">
                  Chuỗi <b className="text-white">{checkin.streak} ngày</b>
                  {checkin.checked_in_today ? " — hôm nay đã điểm danh." : " — hôm nay chưa điểm danh."}
                </p>
                <p className="text-sm vd-muted mt-1">
                  Ngày thường +{formatVND(checkin.daily_amount)} Xu · Chủ nhật +{formatVND(checkin.sunday_amount)} Xu
                </p>
                <button
                  onClick={() => void doCheckin()}
                  disabled={checkinBusy || checkin.checked_in_today}
                  className="btn-primary mt-3 w-full disabled:opacity-50"
                >
                  {checkinBusy ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Coins size={18} aria-hidden="true" />
                  )}
                  {checkin.checked_in_today ? "Đã điểm danh hôm nay" : "Điểm danh nhận Xu"}
                </button>
                {checkinMsg && (
                  <p role="status" className="mt-2 text-sm font-semibold text-emerald-300">{checkinMsg}</p>
                )}
              </>
            ) : (
              <p className="text-sm vd-muted mt-2">Đang tải thông tin điểm danh…</p>
            )}
            <p className="text-xs vd-muted2 mt-3">
              Điểm danh mỗi ngày để tích Xu — Xu dùng để thanh toán đơn hàng, 1 Xu = 1đ.
            </p>
          </div>
        </div>
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
                  {o.items.map((item) => {
                    const inWarranty = item.status === "delivered" && isWithinWarranty(item.warranty_ends_at);
                    const openComplaint =
                      complaints.find(
                        (c) => c.order_item_id === item.id && (c.status === "pending" || c.status === "processing"),
                      ) ?? null;
                    return (
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
                      {/* Bảo hành gắn đơn (v4.8) — hạn tính từ ngày giao. */}
                      {item.status === "delivered" && item.warranty_ends_at && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs rounded-full px-2.5 py-1 font-semibold ${
                              inWarranty ? "bg-emerald-500/15 text-emerald-300" : "vd-surface2 vd-muted"
                            }`}
                          >
                            Bảo hành đến {formatDate(item.warranty_ends_at)} · {inWarranty ? "Còn bảo hành" : "Hết bảo hành"}
                          </span>
                          {hasRealSession && inWarranty && !openComplaint && (
                            <button
                              type="button"
                              onClick={() => {
                                setComplaintItemId(complaintItemId === item.id ? null : item.id);
                                setComplaintMsg("");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                            >
                              <MessageSquareWarning size={14} aria-hidden="true" /> Gửi khiếu nại
                            </button>
                          )}
                          {openComplaint && (
                            <span className="text-xs font-semibold text-amber-300">
                              Đã có khiếu nại {COMPLAINT_STATUS_LABELS[openComplaint.status]} — xem tiến trình bên dưới.
                            </span>
                          )}
                        </div>
                      )}
                      {complaintItemId === item.id && (
                        <div className="mt-2 rounded-xl border vd-border p-3 space-y-2">
                          <label className="block">
                            <span className="field-label">Lý do khiếu nại</span>
                            <select value={complaintReason} onChange={(e) => setComplaintReason(e.target.value as ComplaintReason)} className="field">
                              {COMPLAINT_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="field-label">Mô tả vấn đề *</span>
                            <textarea
                              value={complaintContent}
                              onChange={(e) => setComplaintContent(e.target.value)}
                              rows={3}
                              placeholder="vd: Mã báo lỗi khi kích hoạt, đã thử lại 2 lần vẫn không được…"
                              className="field"
                            />
                          </label>
                          {complaintMsg && (
                            <p role="alert" className="text-sm font-semibold text-red-400">{complaintMsg}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => void submitComplaint(item.id)}
                            disabled={complaintBusy}
                            className="btn-primary !py-2 text-sm disabled:opacity-50"
                          >
                            {complaintBusy ? "Đang gửi…" : "Gửi khiếu nại"}
                          </button>
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Khiếu nại của tôi (v4.8) — tiến trình xử lý theo từng khiếu nại. */}
          {hasRealSession && (
            <div className="mt-8">
              <h2 className="font-bold flex items-center gap-2">
                <MessageSquareWarning size={18} aria-hidden="true" className="text-amber-300" /> Khiếu nại của tôi
              </h2>
              {complaintsLoading ? (
                <p className="text-sm vd-muted mt-2">Đang tải khiếu nại…</p>
              ) : complaints.length === 0 ? (
                <p className="text-sm vd-muted mt-2">Chưa có khiếu nại nào. Món còn trong hạn bảo hành sẽ có nút “Gửi khiếu nại” ở trên.</p>
              ) : (
                <div className="space-y-3 mt-3">
                  {complaints.map((c) => {
                    const steps: Complaint["status"][] = ["pending", "processing", "resolved"];
                    const stepIdx = c.status === "rejected" ? -1 : steps.indexOf(c.status);
                    return (
                      <div key={c.id} className="vd-card p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>{c.product_name ?? "Sản phẩm"} <span className="font-mono font-normal vd-muted">· {c.order_code}</span></b>
                          <span
                            className={`text-xs rounded-full px-2.5 py-1 font-semibold ${
                              c.status === "resolved"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : c.status === "rejected"
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {COMPLAINT_STATUS_LABELS[c.status]}
                          </span>
                        </div>
                        <p className="vd-muted mt-1">
                          {COMPLAINT_REASON_LABELS[c.reason]} · gửi {formatDateTime(c.created_at)}
                        </p>
                        <p className="mt-2">{c.content}</p>
                        {/* Tiến trình: Chờ xử lý → Đang xử lý → Đã giải quyết (hoặc Đã từ chối). */}
                        <div className="mt-3 flex items-center gap-1.5" aria-label={`Tiến trình: ${COMPLAINT_STATUS_LABELS[c.status]}`}>
                          {steps.map((s, i) => (
                            <span key={s} className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  stepIdx >= i ? "bg-emerald-500 text-white" : "vd-surface2 vd-muted"
                                }`}
                              >
                                {stepIdx >= i ? <Check size={13} aria-hidden="true" /> : i + 1}
                              </span>
                              <span className={`text-xs font-semibold ${stepIdx >= i ? "text-emerald-300" : "vd-muted"}`}>
                                {COMPLAINT_STATUS_LABELS[s]}
                              </span>
                              {i < steps.length - 1 && <span className="w-5 h-px bg-white/20" aria-hidden="true" />}
                            </span>
                          ))}
                          {c.status === "rejected" && (
                            <span className="ml-2 text-xs font-semibold text-red-300">Đã từ chối</span>
                          )}
                        </div>
                        {c.admin_reply && (
                          <p className="mt-2 rounded-lg vd-surface2 p-3 text-sm">
                            <b>Shop trả lời:</b> {c.admin_reply}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
