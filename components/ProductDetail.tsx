"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShoppingCart, Star, Zap } from "lucide-react";
import { discountPct, formatVND } from "@/lib/format";
import { useAuth, useCart, useCatalog } from "@/components/providers";
import { Countdown } from "@/components/Countdown";
import { ProductCard, categoryPath } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";

interface Review {
  name: string;
  stars: number;
  date: string;
  content: string;
}

const REVIEW_KEY = "vdigital-reviews-v1";

function loadReviews(productId: string): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Record<string, Review[]>)[productId] ?? [];
  } catch {
    return [];
  }
}

export function ProductDetail({ slug }: { slug: string }) {
  const { catalog } = useCatalog();
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const product = catalog.products.find((p) => p.slug === slug);
  const variants = useMemo(
    () => (product ? [...product.variants].filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order) : []),
    [product],
  );
  const [variantId, setVariantId] = useState<string | null>(null);
  const [tab, setTab] = useState<"desc" | "guide" | "reviews">("desc");
  const [myReviews, setMyReviews] = useState<Review[]>(() => (product ? loadReviews(product.id) : []));
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const selected = variants.find((v) => v.id === variantId) ?? variants.find((v) => v.stock_count !== 0) ?? variants[0];
  const inStock = selected ? selected.stock_count === null || selected.stock_count > 0 : false;
  const pct = selected ? discountPct(selected.price, selected.original_price) : 0;
  const similar = product
    ? catalog.products.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4)
    : [];

  if (!product) {
    return <p className="max-w-7xl mx-auto px-4 mt-10 text-slate-400">Đang tải sản phẩm…</p>;
  }

  const cat = catalog.categories.find((c) => c.id === product.category_id);
  const five = Math.round(product.review_count * 0.9);
  const four = Math.max(0, product.review_count - five - 1);

  function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) {
      alert("Bạn cần đăng nhập để viết đánh giá.");
      return;
    }
    if (!reviewText.trim()) return;
    const r: Review = {
      name: auth.user.name,
      stars: reviewStars,
      date: new Date().toISOString().slice(0, 10),
      content: reviewText.trim(),
    };
    const next = [...myReviews, r];
    setMyReviews(next);
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[product!.id] = next;
      localStorage.setItem(REVIEW_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
    setReviewText("");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-400">
        <Link href="/" className="hover:text-white">Trang chủ</Link>
        {" › "}
        <Link href="/san-pham" className="hover:text-white">{cat?.name ?? "Sản phẩm"}</Link>
        {" › "}
        <span className="text-slate-200">{product.name}</span>
      </nav>

      <div className="mt-4 grid lg:grid-cols-2 gap-8">
        {/* Cột trái: ảnh + cam kết */}
        <div>
          <ProductImage product={product} className="w-full aspect-square rounded-2xl" textSize="text-7xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { t: "Nhận trong đơn hàng", d: "Hướng dẫn rõ ràng" },
              { t: `Bảo hành theo gói`, d: `${product.warranty_days} ngày` },
              { t: "Phản hồi nhanh", d: "Hỗ trợ khi cần" },
              { t: "Thanh toán an toàn", d: "Xác nhận tự động" },
            ].map((c) => (
              <div key={c.t} className="rounded-xl bg-navy-800 border border-navy-700 p-3 text-center">
                <div className="text-sm font-semibold">{c.t}</div>
                <div className="text-xs text-slate-400 mt-0.5">{c.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải */}
        <div>
          <span className="text-xs font-bold tracking-widest text-brand-400 uppercase">{cat?.name}</span>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{product.name}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
              <Star size={15} fill="currentColor" /> {product.rating}
            </span>
            <span>{product.review_count + myReviews.length} đánh giá</span>
            <span>·</span>
            <span>Đã bán {product.sold_count >= 1000 ? `${(product.sold_count / 1000).toFixed(1)}k` : product.sold_count}</span>
          </div>

          {selected && (
            <div className="mt-4 rounded-2xl bg-navy-800 border border-navy-700 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Giá bán · {selected.label}</span>
                {selected.is_flash && selected.flash_ends_at && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 text-brand-400 text-xs font-bold px-2 py-1">
                    <Zap size={13} /> Flash Sale — Kết thúc sau <Countdown endsAt={selected.flash_ends_at} />
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-black text-brand-400">{formatVND(selected.price)}</span>
                {selected.original_price > selected.price && (
                  <>
                    <span className="text-slate-500 line-through">{formatVND(selected.original_price)}</span>
                    <span className="rounded-md bg-red-600 text-white text-xs font-bold px-2 py-0.5">-{pct}%</span>
                  </>
                )}
              </div>
              <div className={`text-sm font-semibold mt-2 ${inStock ? "text-emerald-400" : "text-red-400"}`}>
                Tình trạng: {inStock ? "● Còn hàng" : "● Hết hàng"}
              </div>
            </div>
          )}

          {/* Chọn gói */}
          <h3 className="font-bold mt-5 mb-2">Chọn gói</h3>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((v) => {
              const out = v.stock_count === 0;
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  disabled={out}
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-xl border p-3 text-left transition disabled:opacity-40 ${
                    active ? "border-brand-500 bg-brand-500/10" : "border-navy-600 bg-navy-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{v.label}</span>
                    {v.is_flash && <span className="text-[10px] font-bold bg-brand-500 text-white rounded px-1.5 py-0.5">FLASH</span>}
                  </div>
                  <div className="text-brand-400 font-bold mt-0.5">{formatVND(v.price)}</div>
                  {v.original_price > v.price && (
                    <div className="text-xs text-slate-500 line-through">{formatVND(v.original_price)}</div>
                  )}
                  {out && <div className="text-xs text-red-400 font-semibold mt-0.5">Hết hàng</div>}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-xs text-slate-400 mt-2">
              Hình thức giao:{" "}
              {selected.fulfillment_type === "auto"
                ? "giao tự động ngay sau khi thanh toán."
                : selected.fulfillment_type === "game_card"
                  ? "admin gửi mã thẻ qua email sau khi thanh toán."
                  : "làm tay — đơn chuyển sang Chờ xử lý, admin hoàn thành trong 5–30 phút."}
            </p>
          )}

          <div className="flex gap-3 mt-5">
            <button
              disabled={!selected || !inStock}
              onClick={() => {
                if (!selected) return;
                cart.add(selected.id, product.id);
                router.push("/thanh-toan");
              }}
              className="flex-1 rounded-xl bg-brand-500 hover:bg-brand-600 py-3 font-bold text-white disabled:opacity-40"
            >
              Mua ngay
            </button>
            <button
              disabled={!selected || !inStock}
              onClick={() => selected && cart.add(selected.id, product.id)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 hover:bg-navy-600 border border-navy-600 py-3 font-bold disabled:opacity-40"
            >
              <ShoppingCart size={18} /> Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex gap-1 border-b border-navy-700">
          {(
            [
              { key: "desc", label: "Mô tả sản phẩm" },
              { key: "guide", label: "Hướng dẫn sử dụng" },
              { key: "reviews", label: `Đánh giá (${product.review_count + myReviews.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t.key ? "border-brand-500 text-brand-400" : "border-transparent text-slate-400 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="py-5 max-w-3xl">
          {tab === "desc" && (
            <div className="space-y-3 text-slate-300 leading-relaxed">
              <p>{product.description}</p>
              <p>
                <b className="text-white">Vì sao nên chọn VDigital?</b> Giao hàng nhanh, bảo hành {product.warranty_days} ngày
                1 đổi 1 nếu lỗi do shop, thanh toán VietQR tự động qua PayOS (0% phí), hỗ trợ 24/7.
              </p>
              <p className="text-sm text-slate-400">
                Lưu ý: không chia sẻ tài khoản cho người khác khi shop chưa cho phép; đổi mật khẩu tài khoản giao ngay khi
                nhận được nếu sản phẩm cho phép.
              </p>
            </div>
          )}
          {tab === "guide" && <p className="whitespace-pre-line text-slate-300 leading-relaxed">{product.guide}</p>}
          {tab === "reviews" && (
            <div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black">{product.rating}/5</span>
                <div className="text-sm text-slate-400">
                  <div>5★ — {five} đánh giá</div>
                  <div>4★ — {four} đánh giá</div>
                  <div>3★ trở xuống — {Math.max(0, product.review_count - five - four)} đánh giá</div>
                </div>
              </div>
              <form onSubmit={submitReview} className="mt-5 space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewStars(n)} aria-label={`${n} sao`}>
                      <Star size={22} className={n <= reviewStars ? "text-amber-400" : "text-slate-600"} fill={n <= reviewStars ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={auth.user ? "Viết đánh giá của bạn…" : "Đăng nhập để viết đánh giá"}
                  rows={3}
                  className="w-full rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-sm"
                />
                <button className="rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                  Viết đánh giá
                </button>
              </form>
              <div className="mt-5 space-y-3">
                {myReviews.map((r, i) => (
                  <div key={i} className="rounded-xl bg-navy-800 border border-navy-700 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <b>{r.name}</b>
                      <span className="text-amber-400">{"★".repeat(r.stars)}</span>
                      <span className="text-slate-500">{r.date}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">{r.content}</p>
                  </div>
                ))}
                {myReviews.length === 0 && (
                  <p className="text-sm text-slate-500">Chưa có đánh giá nào của bạn cho sản phẩm này.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4">Sản phẩm tương tự</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
