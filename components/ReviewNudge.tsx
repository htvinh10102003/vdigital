"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { useAuth } from "./providers";
import { getAccessToken } from "@/lib/wallet-client";

interface PendingItem {
  itemId: string;
  orderId: string;
  orderCode: string;
  productId: string;
  productName: string;
  variantName: string;
}

const HIDE_KEY = "vdigital-review-nudge-hide";

/**
 * Popup nhắc đánh giá góc màn hình kiểu Shopee (v4.10): khi khách có món
 * đã giao mà chưa đánh giá thì hiện 1 thẻ nhỏ góc dưới phải — "Đánh giá
 * 5 sao nhận 200 Xu". Bấm "Để sau" thì hôm đó không hiện lại; bấm vào thì
 * sang trang Đơn hàng. Chỉ hiện tối đa 1 lần / ngày / khách.
 */
export function ReviewNudge() {
  const auth = useAuth();
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!auth.user || auth.user.isDemo) return;
    try {
      if (localStorage.getItem(HIDE_KEY) === new Date().toDateString()) return;
    } catch {
      /* ignore */
    }
    let alive = true;
    (async () => {
      const token = await getAccessToken();
      if (!token || !alive) return;
      try {
        const res = await fetch("/api/reviews/pending", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { items?: PendingItem[] };
        if ((data.items ?? []).length > 0) {
          setItems(data.items ?? []);
          setHidden(false);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth.user]);

  function dismiss() {
    try {
      localStorage.setItem(HIDE_KEY, new Date().toDateString());
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  if (hidden || !items?.length) return null;
  const first = items[0];
  return (
    <div
      className="fixed bottom-24 right-4 z-40 w-[calc(100%-2rem)] max-w-xs vd-card p-4 shadow-2xl"
      role="status"
      aria-label="Nhắc đánh giá sản phẩm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold flex items-center gap-1.5">
          <Star size={16} className="text-amber-400" fill="currentColor" aria-hidden="true" />
          Đánh giá nhận Xu
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Để sau"
          className="rounded-lg p-1 vd-muted hover:bg-white/10"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 text-sm">
        Bạn đã nhận <b>{first.productName}</b> ({first.variantName}) — đánh giá 5 sao nhận <b className="text-amber-300">200 Xu</b>.
      </p>
      {items.length > 1 && <p className="text-xs vd-muted mt-1">Còn {items.length - 1} món khác chưa đánh giá.</p>}
      <div className="mt-3 flex gap-2">
        <Link
          href="/tai-khoan?tab=orders"
          onClick={dismiss}
          className="btn-primary flex-1 !py-2 text-center text-sm"
        >
          Đánh giá ngay
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border vd-border px-3 py-2 text-sm font-semibold hover:bg-white/5"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
