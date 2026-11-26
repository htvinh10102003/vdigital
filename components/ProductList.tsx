"use client";

import { useMemo, useState } from "react";
import { useCatalog } from "@/components/providers";
import { ProductCard } from "@/components/ProductCard";
import { formatVND } from "@/lib/format";
import type { Product } from "@/lib/types";

export type SortKey = "newest" | "best" | "price-asc" | "price-desc" | "discount" | "rating";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Mới nhất" },
  { key: "best", label: "Bán chạy nhất" },
  { key: "price-asc", label: "Giá: Thấp đến cao" },
  { key: "price-desc", label: "Giá: Cao đến thấp" },
  { key: "discount", label: "Giảm giá nhiều nhất" },
  { key: "rating", label: "Đánh giá cao nhất" },
];

const PAGE_SIZE = 12;

function minPrice(p: Product): number {
  const vs = p.variants.filter((v) => v.is_active);
  return vs.length ? Math.min(...vs.map((v) => v.price)) : 0;
}
function maxDiscount(p: Product): number {
  return Math.max(
    0,
    ...p.variants.map((v) => (v.original_price > v.price ? 1 - v.price / v.original_price : 0)),
  );
}

export function ProductList({
  title,
  description,
  initialQuery = "",
  initialCategory = "",
  initialSort = "newest",
  onlyFlash = false,
  onlyBestSeller = false,
}: {
  title: string;
  description?: string;
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: SortKey;
  onlyFlash?: boolean;
  onlyBestSeller?: boolean;
}) {
  const { catalog } = useCatalog();
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(initialCategory);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [page, setPage] = useState(1);

  const topCats = catalog.categories.filter((c) => !c.parent_id);

  function countFor(catId: string): number {
    const childIds = catalog.categories.filter((c) => c.parent_id === catId).map((c) => c.id);
    const ids = [catId, ...childIds];
    return catalog.products.filter((p) => ids.includes(p.category_id)).length;
  }

  const filtered = useMemo(() => {
    let list = catalog.products.filter((p) => p.is_active);
    if (onlyFlash) list = list.filter((p) => p.variants.some((v) => v.is_flash));
    if (onlyBestSeller) list = list.filter((p) => p.is_best_seller);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((p) => `${p.name} ${p.tagline}`.toLowerCase().includes(needle));
    }
    if (cat) {
      const c = catalog.categories.find((x) => x.slug === cat);
      if (c) {
        const childIds = catalog.categories.filter((x) => x.parent_id === c.id).map((x) => x.id);
        list = list.filter((p) => p.category_id === c.id || childIds.includes(p.category_id));
      }
    }
    if (inStockOnly) {
      list = list.filter((p) => p.variants.some((v) => v.stock_count === null || v.stock_count > 0));
    }
    const lo = min ? Number(min) : 0;
    const hi = max ? Number(max) : Infinity;
    if (min || max) list = list.filter((p) => minPrice(p) >= lo && minPrice(p) <= hi);
    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.sold_count - a.sold_count);
        break;
      case "best":
        sorted.sort((a, b) => b.sold_count - a.sold_count);
        break;
      case "price-asc":
        sorted.sort((a, b) => minPrice(a) - minPrice(b));
        break;
      case "price-desc":
        sorted.sort((a, b) => minPrice(b) - minPrice(a));
        break;
      case "discount":
        sorted.sort((a, b) => maxDiscount(b) - maxDiscount(a));
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
    }
    return sorted;
  }, [catalog, q, cat, sort, inStockOnly, min, max, onlyFlash, onlyBestSeller]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      <p className="text-sm text-slate-400 mt-2">{filtered.length} sản phẩm</p>

      <div className="mt-4 grid lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Sidebar lọc */}
        <aside className="rounded-2xl bg-navy-800 border border-navy-700 p-4 space-y-5 lg:sticky lg:top-32">
          <div>
            <h3 className="font-bold mb-2">Tìm kiếm</h3>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm kiếm…"
              className="w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <h3 className="font-bold mb-2">Danh mục</h3>
            <button
              onClick={() => {
                setCat("");
                setPage(1);
              }}
              className={`block w-full text-left px-2 py-1.5 rounded-lg text-sm ${cat === "" ? "bg-brand-500 text-white font-semibold" : "hover:bg-navy-700"}`}
            >
              Tất cả ({catalog.products.length})
            </button>
            {topCats.map((c) => (
              <div key={c.id}>
                <button
                  onClick={() => {
                    setCat(c.slug);
                    setPage(1);
                  }}
                  className={`block w-full text-left px-2 py-1.5 rounded-lg text-sm ${cat === c.slug ? "bg-brand-500 text-white font-semibold" : "hover:bg-navy-700"}`}
                >
                  {c.name} ({countFor(c.id)})
                </button>
                {catalog.categories
                  .filter((s) => s.parent_id === c.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setCat(s.slug);
                        setPage(1);
                      }}
                      className={`block w-full text-left pl-6 pr-2 py-1.5 rounded-lg text-sm ${cat === s.slug ? "bg-brand-500 text-white font-semibold" : "hover:bg-navy-700"}`}
                    >
                      {s.name} ({countFor(s.id)})
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-bold mb-2">Tình trạng</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              Chỉ hiện còn hàng
            </label>
          </div>
          <div>
            <h3 className="font-bold mb-2">Khoảng giá</h3>
            <div className="flex gap-2">
              <input
                value={min}
                onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
                placeholder="Thấp nhất"
                inputMode="numeric"
                className="w-full rounded-lg bg-navy-900 border border-navy-600 px-2 py-2 text-sm"
              />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
                placeholder="Cao nhất"
                inputMode="numeric"
                className="w-full rounded-lg bg-navy-900 border border-navy-600 px-2 py-2 text-sm"
              />
            </div>
            {(min || max) && (
              <p className="text-xs text-slate-400 mt-1">
                Từ {min ? formatVND(Number(min)) : "0đ"} đến {max ? formatVND(Number(max)) : "không giới hạn"}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setQ("");
              setCat("");
              setInStockOnly(false);
              setMin("");
              setMax("");
              setPage(1);
            }}
            className="w-full rounded-lg border border-navy-600 py-2 text-sm hover:border-brand-500"
          >
            Đặt lại bộ lọc
          </button>
        </aside>

        {/* Lưới sản phẩm */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm text-slate-400">
              Trang {safePage}/{pages}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-sm"
              aria-label="Sắp xếp"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {pageItems.length === 0 ? (
            <p className="text-slate-400 py-10 text-center">Không tìm thấy sản phẩm nào phù hợp.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {pageItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold ${n === safePage ? "bg-brand-500 text-white" : "bg-navy-800 border border-navy-600"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
