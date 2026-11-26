"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Bell, CheckCheck, ChevronDown, Info, PackageCheck, X, XCircle } from "lucide-react";
import { getShopNotifications, type OrderNotificationRow, type ShopNotification } from "@/lib/notifications";
import { getSupabase } from "@/lib/supabase";
import { useAuth, useCatalog } from "./providers";

const READ_KEY = "vdigital-notifications-read-v1";

function loadRead(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "Vừa xong";
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

const KIND_DOT: Record<ShopNotification["kind"], string> = {
  promo: "bg-amber-400",
  order: "bg-brand-500",
  system: "bg-emerald-400",
};

const ORDER_ICON: Record<OrderNotificationRow["type"], { Icon: typeof BadgeCheck; cls: string }> = {
  paid: { Icon: BadgeCheck, cls: "text-emerald-400" },
  delivered: { Icon: PackageCheck, cls: "text-brand-400" },
  cancelled: { Icon: XCircle, cls: "text-red-400" },
  info: { Icon: Info, cls: "text-slate-400" },
};

/**
 * Chuông thông báo dạng POPUP (không chuyển trang).
 * - Khách đã đăng nhập: thông báo ĐƠN HÀNG thật từ /api/notifications
 *   (trả tiền xong, giao hàng xong, huỷ đơn) lên trước, badge = số đơn
 *   chưa đọc; bấm 1 cái thì đánh dấu đã đọc rồi sang "Đơn hàng của tôi".
 * - Khuyến mãi / sản phẩm mới (suy ra từ catalog, như trước) nằm dưới,
 *   sau dòng phân cách. Trạng thái đã đọc của nhóm này lưu localStorage.
 * - Khách vãng lai / tài khoản demo: chỉ nhóm khuyến mãi, không badge đơn.
 * Đóng khi bấm ra ngoài, bấm X hoặc bấm Esc.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<OrderNotificationRow[]>([]);
  const [orderUnread, setOrderUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { catalog } = useCatalog();
  const { user } = useAuth();
  // Chỉ tài khoản thật mới có chuông đơn hàng; tài khoản demo / chưa đăng
  // nhập không gọi API (sẽ 401) mà chỉ hiện khuyến mãi như trước.
  const hasRealSession = Boolean(user && !user.isDemo);

  // Thông báo khuyến mãi thật suy ra từ catalog (flash sale đang chạy,
  // sản phẩm mới). Không có gì thì rỗng — không bịa khuyến mãi.
  const promoItems = useMemo(() => getShopNotifications(catalog), [catalog]);
  const promoUnread = promoItems.filter((i) => !read.has(i.id)).length;
  const unread = orderUnread;

  const fetchOrderNotes = useCallback(async () => {
    try {
      const sb = getSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setOrderNotes((json.notifications ?? []) as OrderNotificationRow[]);
      setOrderUnread(Number(json.unread_count ?? 0));
    } catch {
      /* mạng lỗi thì giữ danh sách cũ, chuông không vỡ */
    }
  }, []);

  useEffect(() => {
    setRead(loadRead());
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...read]));
    } catch {
      /* ignore */
    }
  }, [read]);

  // Khách thật: tải lúc mở trang + mỗi 30s để đơn vừa trả tiền / vừa giao
  // hiện lên không cần tải lại trang.
  useEffect(() => {
    if (!hasRealSession) {
      setOrderNotes([]);
      setOrderUnread(0);
      return;
    }
    fetchOrderNotes();
    const t = setInterval(fetchOrderNotes, 30_000);
    return () => clearInterval(t);
  }, [hasRealSession, fetchOrderNotes]);

  // Mở chuông ra thì tải lại ngay để số chưa đọc luôn mới.
  useEffect(() => {
    if (open && hasRealSession) fetchOrderNotes();
  }, [open, hasRealSession, fetchOrderNotes]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  async function markOrderRead(id: string) {
    setOrderNotes((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setOrderUnread((prev) => Math.max(0, prev - 1));
    try {
      const sb = getSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) return;
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* lỗi mạng: lần tải sau sẽ đồng bộ lại */
    }
  }

  async function markAllRead() {
    setRead(new Set(promoItems.map((i) => i.id)));
    if (orderUnread > 0) {
      setOrderNotes((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setOrderUnread(0);
      try {
        const sb = getSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        if (token) {
          await fetch("/api/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ all: true }),
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  function toggleItem(n: ShopNotification) {
    setExpandedId((cur) => (cur === n.id ? null : n.id));
    setRead((prev) => new Set(prev).add(n.id));
  }

  const showMarkAll = unread > 0 || promoUnread > 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border vd-border vd-muted hover:text-white"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span
            key={unread}
            className="cart-bump absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          // Trên mobile: fixed theo viewport (left/right 12px) để panel không
          // bị tràn khỏi màn hình khi chuông ở sát mép phải. Từ sm trở lên:
          // dropdown tuyệt đối gắn dưới chuông như thường.
          className="vd-card fixed left-3 right-3 top-16 z-50 overflow-hidden shadow-lift sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-2 border-b vd-border px-4 py-3">
            <h2 className="font-bold">Thông báo</h2>
            <div className="flex items-center gap-1">
              {showMarkAll && (
                <button
                  onClick={markAllRead}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-400 hover:bg-white/5"
                >
                  <CheckCheck size={15} aria-hidden="true" /> Đánh dấu đã đọc
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Đóng thông báo"
                className="flex h-9 w-9 items-center justify-center rounded-lg vd-muted hover:text-white hover:bg-white/5"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto">
            {orderNotes.length === 0 && promoItems.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm vd-muted">Chưa có thông báo</li>
            ) : (
              <>
                {orderNotes.map((n) => {
                  const { Icon, cls } = ORDER_ICON[n.type] ?? ORDER_ICON.info;
                  return (
                    <li key={n.id} className="border-b vd-border last:border-b-0">
                      <Link
                        href="/tai-khoan"
                        onClick={() => {
                          if (!n.is_read) void markOrderRead(n.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <Icon size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${cls}`} />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${n.is_read ? "font-medium vd-muted" : "font-bold"}`}>
                            {n.title}
                            {n.order_code && (
                              <span className="ml-1.5 font-mono text-xs font-semibold text-brand-400">{n.order_code}</span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed vd-muted">{n.body}</span>
                          <span suppressHydrationWarning className="mt-0.5 block text-[11px] vd-muted2">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.is_read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                      </Link>
                    </li>
                  );
                })}
                {orderNotes.length > 0 && promoItems.length > 0 && (
                  <li className="border-b vd-border bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-wide vd-muted2">
                    Khuyến mãi &amp; tin mới
                  </li>
                )}
                {promoItems.map((n) => {
                  const isRead = read.has(n.id);
                  const expanded = expandedId === n.id;
                  return (
                    <li key={n.id} className="border-b vd-border last:border-b-0">
                      <button
                        onClick={() => toggleItem(n)}
                        aria-expanded={expanded}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${isRead ? "bg-slate-600" : KIND_DOT[n.kind]}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${isRead ? "font-medium vd-muted" : "font-bold"}`}>
                            {n.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs vd-muted">{n.body}</span>
                          <span suppressHydrationWarning className="mt-0.5 block text-[11px] vd-muted2">{timeAgo(n.createdAt)}</span>
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`mt-1 shrink-0 vd-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3.5 pl-9 text-sm leading-relaxed vd-muted">
                          <p>{n.body}</p>
                          {n.link && (
                            <Link
                              href={n.link}
                              onClick={() => setOpen(false)}
                              className="btn-primary mt-3 w-full !py-2.5 text-sm"
                            >
                              {n.linkLabel ?? "Xem chi tiết"}
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
