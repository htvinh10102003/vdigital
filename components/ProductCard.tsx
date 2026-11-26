"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Zap } from "lucide-react";
import { discountPct, formatVND } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart, useCatalog } from "./providers";
import { Countdown } from "./Countdown";
import { ProductImage } from "./ProductImage";
import { activeVariants, categoryPath, isGameCard, maxDiscount, minPrice } from "@/lib/catalog-utils";

export { categoryPath };

export function ProductCard({ product }: { product: Product }) {
  const { catalog } = useCatalog();
  const cart = useCart();
  const router = useRouter();
  const variants = activeVariants(product);
  const cheapest = variants[0];
  const flash = variants.find((v) => v.is_flash && v.flash_ends_at);
  const pct = cheapest ? discountPct(cheapest.price, cheapest.original_price) : 0;
  const inStock = variants.some((v) => v.stock_count === null || v.stock_count > 0);
  const href = categoryPath(catalog.categories, product);

  return (
    <div className="group vd-card overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link href={href} className="relative block">
        <ProductImage product={product} className="aspect-square w-full" />
        {pct > 0 && (
          <span className="absolute top-2.5 left-2.5 rounded-lg bg-red-600 text-white text-xs font-bold px-2 py-1">
            -{pct}%
          </span>
        )}
        {flash && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg bg-brand-600 text-white text-xs font-bold px-2 py-1">
            <Zap size={12} /> Flash Sale
          </span>
        )}
        {isGameCard(product) && (
          <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/60 text-white text-[11px] font-semibold px-2 py-1">
            Thẻ game · chọn mệnh giá
          </span>
        )}
      </Link>
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <Link href={href} className="font-semibold leading-snug hover:text-brand-400 line-clamp-2 min-h-[2.6em]">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 text-xs vd-muted">
          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
            <Star size={13} fill="currentColor" /> {product.rating}
          </span>
          <span>({product.review_count})</span>
          <span>·</span>
          <span>Đã bán {product.sold_count >= 1000 ? `${(product.sold_count / 1000).toFixed(1)}k` : product.sold_count}</span>
        </div>
        {flash && <Countdown endsAt={flash.flash_ends_at} />}
        <div className="mt-auto pt-1">
          {cheapest && (
            <div className="flex items-baseline gap-2">
              <span className="text-brand-400 font-black text-lg leading-none">{formatVND(cheapest.price)}</span>
              {cheapest.original_price > cheapest.price && (
                <span className="text-xs vd-muted2 line-through">{formatVND(cheapest.original_price)}</span>
              )}
            </div>
          )}
          <div className="text-[11px] vd-muted mt-1">
            {cheapest?.fulfillment_type === "auto" ? "Giao hàng tức thì" : "Kích hoạt nhanh"}
            {variants.length > 1 ? ` · từ ${variants.length} gói` : ""}
          </div>
        </div>
        <button
          disabled={!cheapest || !inStock}
          onClick={() => {
            if (!cheapest) return;
            cart.add(cheapest.id, product.id);
            router.push("/thanh-toan");
          }}
          className="mt-2 w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-2.5 text-sm font-bold text-white transition disabled:opacity-40"
        >
          Mua ngay
        </button>
      </div>
    </div>
  );
}

export { maxDiscount, minPrice };
