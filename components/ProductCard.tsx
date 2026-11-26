"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShoppingCart, Zap } from "lucide-react";
import { discountPct, formatRating, formatSold, formatVND } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart, useCatalog, useToast } from "./providers";
import { Countdown } from "./Countdown";
import { ProductImage } from "./ProductImage";
import { Stars } from "./Stars";
import { activeVariants, categoryPath, isGameCard, maxDiscount, minPrice } from "@/lib/catalog-utils";

/** Flash Sale chỉ hiện khi còn hạn thật (flash_ends_at trong tương lai). */
export function activeFlash(product: Product) {
  return product.variants.find(
    (v) => v.is_flash && v.flash_ends_at && new Date(v.flash_ends_at).getTime() > Date.now(),
  );
}

export { categoryPath };

export function ProductCard({ product }: { product: Product }) {
  const { catalog } = useCatalog();
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"buy" | "add" | null>(null);
  const variants = activeVariants(product);
  const cheapest = variants[0];
  const flash = activeFlash(product);
  const pct = cheapest ? discountPct(cheapest.price, cheapest.original_price) : 0;
  const inStock = variants.some((v) => v.stock_count === null || v.stock_count > 0);
  const href = categoryPath(catalog.categories, product);
  const ratingText = formatRating(product.rating, product.review_count);

  function buyNow() {
    if (!cheapest || !inStock || busy) return;
    setBusy("buy");
    cart.add(cheapest.id, product.id);
    router.push("/thanh-toan");
  }

  function addToCart() {
    if (!cheapest || !inStock || busy) return;
    setBusy("add");
    cart.add(cheapest.id, product.id);
    toast.notify(`Đã thêm ${product.name} vào giỏ hàng`);
    // Chống bấm trùng 2 lần (bấm đúp sẽ cộng 2 món vào giỏ).
    setTimeout(() => setBusy(null), 700);
  }

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
        {!inStock && (
          <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-red-600 text-white text-[11px] font-bold px-2 py-1">
            Hết hàng
          </span>
        )}
        {inStock && isGameCard(product) && (
          <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/60 text-white text-[11px] font-semibold px-2 py-1">
            Thẻ game · chọn mệnh giá
          </span>
        )}
      </Link>
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <Link href={href} className="font-display font-semibold leading-snug hover:text-brand-400 line-clamp-2 min-h-[2.6em]">
          {product.name}
        </Link>
        {/* Số liệu thật: sao trung bình + số lượt đánh giá từ bảng reviews,
            lượt mua đếm từ đơn đã thanh toán. Chưa có thì hiện trạng thái thật,
            không hiện số giả. */}
        <div className="flex items-center gap-2 text-xs vd-muted">
          {product.review_count > 0 ? (
            <>
              <Stars value={product.rating} size={13} />
              <span className="text-amber-400 font-semibold">{ratingText}</span>
              <span>({product.review_count})</span>
            </>
          ) : (
            <span>Chưa có đánh giá</span>
          )}
          <span>·</span>
          {product.sold_count > 0 ? (
            <span>Đã bán {formatSold(product.sold_count)}</span>
          ) : (
            <span className="font-semibold text-emerald-400">Mới mở bán</span>
          )}
        </div>
        {flash && <Countdown endsAt={flash.flash_ends_at} />}
        <div className="mt-auto pt-1">
          {cheapest && (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-brand-400 font-black text-lg leading-none">{formatVND(cheapest.price)}</span>
              {cheapest.original_price > cheapest.price && (
                <span className="text-xs vd-muted2 line-through">{formatVND(cheapest.original_price)}</span>
              )}
            </div>
          )}
          <div className="text-[11px] vd-muted mt-1">
            {inStock ? (
              <>
                {cheapest?.fulfillment_type === "auto" ? "Giao hàng tức thì" : "Kích hoạt nhanh"}
                {variants.length > 1 ? ` · từ ${variants.length} gói` : ""}
              </>
            ) : (
              "Hết hàng — shop đang bổ sung"
            )}
          </div>
        </div>
        {/* Mua ngay + Thêm vào giỏ: xếp dọc trên mobile (card 2 cột hẹp),
            cạnh nhau từ sm trở lên; mỗi nút cao tối thiểu 44px, cách nhau 8px.
            Nhãn không xuống dòng (whitespace-nowrap) để không bị vỡ chữ
            "Mua / ngay" hay "Thêm / vào / giỏ" trên card hẹp. */}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            disabled={!cheapest || !inStock || busy !== null}
            onClick={buyNow}
            aria-label={`Mua ngay ${product.name}`}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 hover:bg-brand-700 px-2 py-2.5 text-[13px] font-bold leading-tight text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy === "buy" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
            {busy === "buy" ? "Đang chuyển…" : "Mua ngay"}
          </button>
          <button
            disabled={!cheapest || !inStock || busy !== null}
            onClick={addToCart}
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-brand-500/60 bg-transparent px-2 py-2.5 text-[13px] font-bold leading-tight text-brand-400 transition hover:border-brand-500 hover:bg-brand-600/10 active:scale-[0.98] disabled:opacity-40"
          >
            {busy === "add" ? (
              <Loader2 size={15} aria-hidden="true" className="animate-spin" />
            ) : (
              <ShoppingCart size={15} aria-hidden="true" className="shrink-0" />
            )}
            {busy === "add" ? "Đã thêm ✓" : "Thêm vào giỏ"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { maxDiscount, minPrice };
