"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCart, useCatalog } from "@/components/providers";
import { formatVND } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

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

  if (lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 mt-16 text-center">
        <div className="text-6xl">🛒</div>
        <h1 className="text-2xl font-bold mt-4">Giỏ hàng của bạn đang trống</h1>
        <p className="text-slate-400 mt-2">0 sản phẩm — chọn tài khoản hoặc thẻ game bạn cần nhé.</p>
        <Link href="/san-pham" className="inline-block mt-6 rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 font-bold text-white">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">Giỏ hàng | VDigital</h1>
      <p className="text-sm text-slate-400 mt-1">{cart.count} sản phẩm</p>
      <div className="mt-4 space-y-3">
        {lines.map(({ item, product, variant }) => (
          <div key={item.variantId} className="flex items-center gap-4 rounded-2xl bg-navy-800 border border-navy-700 p-3">
            <ProductImage product={product!} className="w-16 h-16 rounded-xl shrink-0" textSize="text-xl" />
            <div className="flex-1 min-w-0">
              <Link href={`/san-pham`} className="font-semibold hover:text-brand-400 truncate block">
                {product!.name} — {variant!.label}
              </Link>
              <div className="text-sm text-slate-400">
                {formatVND(variant!.price)}
                {variant!.original_price > variant!.price && (
                  <span className="line-through ml-2">{formatVND(variant!.original_price)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => cart.setQty(item.variantId, item.qty - 1)} className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600">−</button>
              <span className="w-6 text-center font-semibold">{item.qty}</span>
              <button onClick={() => cart.setQty(item.variantId, item.qty + 1)} className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600">+</button>
            </div>
            <div className="font-bold text-brand-400 w-24 text-right hidden sm:block">
              {formatVND(variant!.price * item.qty)}
            </div>
            <button onClick={() => cart.remove(item.variantId)} className="p-2 text-slate-400 hover:text-red-400" aria-label="Xoá">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-navy-800 border border-navy-700 p-4">
        <div>
          <div className="text-sm text-slate-400">Tổng thanh toán</div>
          <div className="text-2xl font-black text-brand-400">{formatVND(total)}</div>
        </div>
        <Link href="/thanh-toan" className="rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 font-bold text-white">
          Thanh toán
        </Link>
      </div>
    </div>
  );
}
