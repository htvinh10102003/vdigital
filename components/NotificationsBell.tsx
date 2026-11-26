"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronDown, X } from "lucide-react";
import {
  NOTIFICATIONS_SOURCE_NOTE,
  getSampleNotifications,
  type ShopNotification,
} from "@/lib/notifications";

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

/**
 * Chuông thông báo dạng POPUP (không chuyển trang).
 * Bấm chuông mở panel liệt kê thông báo; bấm 1 thông báo mới mở rộng chi
 * tiết của nó (chỉ 1 cái mở tại 1 thời điểm). Đóng khi bấm ra ngoài, bấm X
 * hoặc bấm Esc. Badge = số chưa đọc; mở xem 1 cái hoặc "Đánh dấu đã đọc"
 * sẽ trừ badge. Trạng thái đã đọc lưu localStorage.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const items = getSampleNotifications();
  const unread = items.filter((i) => !read.has(i.id)).length;

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

  function toggleItem(n: ShopNotification) {
    setExpandedId((cur) => (cur === n.id ? null : n.id));
    setRead((prev) => new Set(prev).add(n.id));
  }

  function markAllRead() {
    setRead(new Set(items.map((i) => i.id)));
  }

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
              {unread > 0 && (
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
            {items.map((n) => {
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
          </ul>
          <p className="border-t vd-border px-4 py-2.5 text-[11px] vd-muted2">{NOTIFICATIONS_SOURCE_NOTE}</p>
        </div>
      )}
    </div>
  );
}
