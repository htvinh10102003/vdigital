"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, Headset, ShieldCheck, ShoppingCart, Star, Zap } from "lucide-react";
import { useCart, useCatalog } from "./providers";
import { formatVND } from "@/lib/format";
import { ProductImage } from "./ProductImage";

/** Panel giỏ hàng bên phải hero (theo bố cục ảnh mẫu). */
export function CartPanel() {
  const cart = useCart();
  const { catalog, loading } = useCatalog();
  const lines = cart.items
    .map((i) => {
      const product = catalog.products.find((p) => p.id === i.productId);
      const variant = product?.variants.find((v) => v.id === i.variantId);
      return { item: i, product, variant };
    })
    .filter((l) => l.product && l.variant);
  const total = lines.reduce((s, l) => s + (l.variant?.price ?? 0) * l.item.qty, 0);
  const originalTotal = lines.reduce((s, l) => s + (l.variant?.original_price ?? l.variant?.price ?? 0) * l.item.qty, 0);
  const savings = originalTotal - total;

  return (
    <div className="vd-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <ShoppingCart size={18} className="text-brand-400" /> Giỏ hàng
        </h3>
        <span className="text-sm vd-muted">{cart.count} sản phẩm</span>
      </div>
      {lines.length === 0 ? (
        loading && cart.items.length > 0 ? (
          <div className="py-6 text-center">
            <p className="font-semibold">Đang tải giỏ hàng…</p>
            <p className="text-sm vd-muted mt-1">Chờ một chút nhé.</p>
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/15 text-brand-400">
              <ShoppingCart size={28} />
            </div>
            <p className="mt-3 font-semibold">Giỏ hàng của bạn đang trống</p>
            <p className="text-sm vd-muted mt-1">Hãy khám phá các sản phẩm bên dưới nhé!</p>
            <Link href="/san-pham" className="btn-primary mt-4 w-full !py-2.5 text-sm">
              Mua sắm ngay
            </Link>
          </div>
        )
      ) : (
        <div className="mt-4 space-y-3">
          {lines.slice(0, 3).map(({ item, product, variant }) => (
            <div key={item.variantId} className="flex items-center gap-3">
              <ProductImage product={product!} className="h-12 w-12 rounded-xl shrink-0" textSize="text-base" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {product!.name} — {variant!.label}
                </p>
                <p className="text-xs vd-muted">
                  {formatVND(variant!.price)}
                  {variant!.original_price > variant!.price && (
                    <span className="line-through ml-1.5">{formatVND(variant!.original_price)}</span>
                  )}
                </p>
                <p className="flex items-center gap-1 mt-1">
                  <button onClick={() => cart.setQty(item.variantId, item.qty - 1)} aria-label={`Giảm số lượng ${product!.name}`} className="flex h-6 w-6 items-center justify-center rounded-md vd-surface2 border vd-border text-sm font-bold">−</button>
                  <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
                  <button onClick={() => cart.setQty(item.variantId, item.qty + 1)} aria-label={`Tăng số lượng ${product!.name}`} className="flex h-6 w-6 items-center justify-center rounded-md vd-surface2 border vd-border text-sm font-bold">+</button>
                  <button onClick={() => cart.remove(item.variantId)} aria-label={`Xoá ${product!.name} khỏi giỏ`} className="ml-1 text-xs vd-muted hover:text-red-400 font-bold">✕</button>
                </p>
              </div>
              <span className="text-sm font-bold text-brand-400">{formatVND(variant!.price * item.qty)}</span>
            </div>
          ))}
          {lines.length > 3 && <p className="text-xs vd-muted">+ {lines.length - 3} sản phẩm nữa</p>}
          <div className="border-t vd-border pt-3 space-y-1">
            {savings > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="vd-muted">Tiết kiệm</span>
                <span className="font-bold text-emerald-300">−{formatVND(savings)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm vd-muted">Tổng cộng</span>
              <span className="font-extrabold text-brand-400">{formatVND(total)}</span>
            </div>
          </div>
          <Link href="/gio-hang" className="btn-primary w-full !py-2.5 text-sm">
            Xem giỏ hàng
          </Link>
        </div>
      )}
    </div>
  );
}

const TRUST = [
  { icon: Zap, title: "Giao hàng tức thì", desc: "Nhận tài khoản trong vài phút" },
  { icon: ShieldCheck, title: "Thanh toán an toàn", desc: "VietQR tự động qua PayOS" },
  { icon: Headset, title: "Hỗ trợ nhanh", desc: "Phản hồi khi bạn cần" },
  { icon: Star, title: "Bảo hành rõ ràng", desc: "1 đổi 1 nếu lỗi do shop" },
];

export function TrustCards() {
  return (
    <div className="vd-card divide-y vd-border overflow-hidden">
      {TRUST.map((t) => (
        <div key={t.title} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/15">
            <t.icon size={20} className="text-brand-400" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-snug">{t.title}</span>
            <span className="block truncate text-xs vd-muted">{t.desc}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function FollowCard() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-violet-600 to-indigo-600 p-5 text-white">
      <BellRing size={24} />
      <p className="mt-2 font-extrabold text-lg leading-snug">Theo dõi VDigital</p>
      <p className="text-sm text-white/85 mt-1">Nhận tin khuyến mãi và sản phẩm mới nhất.</p>
      {done ? (
        <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold">Đã đăng ký! Kiểm tra email của bạn nhé.</p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setDone(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email của bạn"
            className="w-full min-w-0 rounded-xl bg-white/15 border border-white/30 px-3 py-2.5 text-sm text-white placeholder:text-white/60 outline-none focus:border-white"
          />
          <button className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300">
            Đăng ký
          </button>
        </form>
      )}
    </div>
  );
}
