"use client";

import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { discountPct, formatVND } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { useCart, useCatalog } from "./providers";
import { Countdown } from "./Countdown";
import { ProductImage } from "./ProductImage";

export function categoryPath(categories: Category[], product: Product): string {
  const cat = categories.find((c) => c.id === product.category_id);
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  // URL chi tiết: /{danh-muc-cha}/{slug} — vd /tai-khoan-ban-quyen/capcut-pro
  const top = parent?.slug ?? cat?.slug ?? "san-pham";
  return `/${top}/${product.slug}`;
}

export function ProductCard({ product }: { product: Product }) {
  const { catalog } = useCatalog();
  const cart = useCart();
  const variants = [...product.variants].filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const cheapest = variants[0];
  const flash = variants.find((v) => v.is_flash && v.flash_ends_at);
  const pct = cheapest ? discountPct(cheapest.price, cheapest.original_price) : 0;
  const inStock = variants.some((v) => v.stock_count === null || v.stock_count > 0);

  return (
    <div className="group rounded-2xl bg-navy-800 border border-navy-700 overflow-hidden shadow-card hover:border-brand-500/60 transition flex flex-col">
      <Link href={categoryPath(catalog.categories, product)} className="relative block">
        <ProductImage product={product} className="aspect-square w-full" />
        {pct > 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-red-600 text-white text-xs font-bold px-2 py-1">
            -{pct}%
          </span>
        )}
        {flash && (
          <span className="absolute top-2 right-2 rounded-md bg-brand-500 text-white text-xs font-bold px-2 py-1">
            Flash Sale
          </span>
        )}
      </Link>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <Link href={categoryPath(catalog.categories, product)} className="font-semibold leading-snug hover:text-brand-400 line-clamp-2">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star size={13} fill="currentColor" /> {product.rating}
          </span>
          <span>({product.review_count} đánh giá)</span>
          <span>·</span>
          <span>Đã bán {product.sold_count >= 1000 ? `${(product.sold_count / 1000).toFixed(1)}k` : product.sold_count}</span>
        </div>
        {flash && <Countdown endsAt={flash.flash_ends_at} />}
        <div className="mt-auto pt-1 flex items-end justify-between gap-2">
          <div>
            {cheapest && (
              <>
                <div className="text-brand-400 font-bold text-lg leading-none">{formatVND(cheapest.price)}</div>
                {cheapest.original_price > cheapest.price && (
                  <div className="text-xs text-slate-500 line-through mt-0.5">{formatVND(cheapest.original_price)}</div>
                )}
              </>
            )}
          </div>
          <span className={`text-xs font-semibold ${inStock ? "text-emerald-400" : "text-red-400"}`}>
            {inStock ? "● Còn hàng" : "● Hết hàng"}
          </span>
        </div>
        <button
          disabled={!cheapest || !inStock}
          onClick={() => cheapest && cart.add(cheapest.id, product.id)}
          className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-navy-700 hover:bg-brand-500 border border-navy-600 hover:border-brand-500 text-sm font-semibold py-2 transition disabled:opacity-40"
        >
          <Plus size={16} /> Thêm
        </button>
      </div>
    </div>
  );
}
