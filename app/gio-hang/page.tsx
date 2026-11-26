"use client";

import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useCart, useCatalog } from "@/components/providers";
import { formatVND } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { categoryPath } from "@/lib/catalog-utils";

export default function CartPage() {
  const { catalog } = useCatalog();
  const cart = useCart();

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

  if (lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 mt-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600/15 text-brand-400">
          <ShoppingCart size={36} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mt-4">Giỏ hàng của bạn đang trống</h1>
        <p className="vd-muted mt-2">0 sản phẩm — chọn tài khoản hoặc thẻ game bạn cần nhé.</p>
        <Link href="/san-pham" className="inline-block mt-6 rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-3 font-bold text-white">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">Giỏ hàng | VDigital</h1>
      <p className="text-sm vd-muted mt-1">{cart.count} sản phẩm</p>
      <div className="mt-4 space-y-3">
        {lines.map(({ item, product, variant }) => (
          <div key={item.variantId} className="flex items-center gap-3 sm:gap-4 vd-card p-3">
            <ProductImage product={product!} className="w-16 h-16 rounded-xl shrink-0" textSize="text-xl" />
            <div className="flex-1 min-w-0">
              <Link href={categoryPath(catalog.categories, product!)} className="font-semibold hover:text-brand-400 truncate block">
                {product!.name} — {variant!.label}
              </Link>
              <div className="text-sm vd-muted">
                {formatVND(variant!.price)}
                {variant!.original_price > variant!.price && (
                  <>
                    <span className="line-through ml-2">{formatVND(variant!.original_price)}</span>
                    <span className="ml-2 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-xs font-bold">
                      -{Math.round((1 - variant!.price / variant!.original_price) * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => cart.setQty(item.variantId, item.qty - 1)} aria-label={`Giảm số lượng ${product!.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg vd-surface2 border vd-border text-lg font-bold">−</button>
              <span className="w-6 text-center font-semibold" aria-label={`Số lượng: ${item.qty}`}>{item.qty}</span>
              <button onClick={() => cart.setQty(item.variantId, item.qty + 1)} aria-label={`Tăng số lượng ${product!.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg vd-surface2 border vd-border text-lg font-bold">+</button>
            </div>
            <div className="font-bold text-brand-400 w-24 text-right hidden sm:block">
              {formatVND(variant!.price * item.qty)}
            </div>
            <button onClick={() => cart.remove(item.variantId)} className="flex h-11 w-11 shrink-0 items-center justify-center vd-muted hover:text-red-400" aria-label={`Xoá ${product!.name} khỏi giỏ`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between vd-card p-4">
        <div>
          <div className="text-sm vd-muted">Tạm tính: {formatVND(originalTotal)}</div>
          {savings > 0 && <div className="text-sm font-semibold text-emerald-300">Tiết kiệm: −{formatVND(savings)}</div>}
          <div className="text-sm vd-muted mt-1">Tổng thanh toán</div>
          <div className="text-2xl font-black text-brand-400">{formatVND(total)}</div>
        </div>
        <Link href="/thanh-toan" className="rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-3 font-bold text-white">
          Thanh toán
        </Link>
      </div>
    </div>
  );
}
