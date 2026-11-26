"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShoppingCart, Star, Zap } from "lucide-react";
import { discountPct, formatVND } from "@/lib/format";
import { useAuth, useCart, useCatalog, useToast } from "@/components/providers";
import { Countdown } from "@/components/Countdown";
import { ProductCard } from "@/components/ProductCard";
import { activeVariants, categoryPath, optionGroupLabel } from "@/lib/catalog-utils";
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
  const toast = useToast();
  const auth = useAuth();
  const router = useRouter();
  const product = catalog.products.find((p) => p.slug === slug);
  const variants = useMemo(() => (product ? activeVariants(product) : []), [product]);
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
    return <p className="max-w-7xl mx-auto px-4 mt-10 vd-muted">Đang tải sản phẩm…</p>;
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
      <nav className="text-sm vd-muted">
        <Link href="/" className="hover:text-white">Trang chủ</Link>
        {" › "}
        <Link href="/san-pham" className="hover:text-white">{cat?.name ?? "Sản phẩm"}</Link>
        {" › "}
        <span className="">{product.name}</span>
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
              <div key={c.t} className="vd-card-flat p-3 text-center">
                <div className="text-sm font-semibold">{c.t}</div>
                <div className="text-xs vd-muted mt-0.5">{c.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải */}
        <div>
          <span className="text-xs font-bold tracking-widest text-brand-400 uppercase">{cat?.name}</span>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{product.name}</h1>
          <div className="flex items-center gap-2 text-sm vd-muted mt-2">
            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
              <Star size={15} fill="currentColor" /> {product.rating}
            </span>
            <span>{product.review_count + myReviews.length} đánh giá</span>
            <span>·</span>
            <span>Đã bán {product.sold_count >= 1000 ? `${(product.sold_count / 1000).toFixed(1)}k` : product.sold_count}</span>
          </div>

          {selected && (
            <div className="mt-4 vd-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm vd-muted">Giá bán · {selected.label}</span>
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
                    <span className="vd-muted2 line-through">{formatVND(selected.original_price)}</span>
                    <span className="rounded-md bg-red-600 text-white text-xs font-bold px-2 py-0.5">-{pct}%</span>
                  </>
                )}
              </div>
              <div className={`text-sm font-semibold mt-2 ${inStock ? "text-emerald-400" : "text-red-400"}`}>
                Tình trạng: {inStock ? "● Còn hàng" : "● Hết hàng"}
              </div>
            </div>
          )}

          {/* Chọn gói — pill selector: mệnh giá / thời hạn / gói token */}
          <h3 className="font-bold mt-5 mb-2">{optionGroupLabel(selected)}</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={optionGroupLabel(selected)}>
            {variants.map((v) => {
              const out = v.stock_count === 0;
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  disabled={out}
                  onClick={() => setVariantId(v.id)}
                  className={`pill inline-flex items-center gap-2 ${active ? "!border-brand-500 !bg-brand-600 text-white" : "vd-border vd-card-flat hover:!border-brand-500"}`}
                >
                  <span className="font-semibold">{v.label}</span>
                  <span className={active ? "text-white/90" : "text-brand-400"}>{formatVND(v.price)}</span>
                  {v.is_flash && <span className="text-[10px] font-bold bg-amber-400 text-slate-900 rounded-full px-1.5 py-0.5">FLASH</span>}
                  {out && <span className="text-xs text-red-400 font-semibold">Hết hàng</span>}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-xs vd-muted mt-2">
              Hình thức giao:{" "}
              {selected.fulfillment_type === "auto"
                ? "giao tự động ngay sau khi thanh toán."
                : selected.fulfillment_type === "game_card"
                  ? "admin gửi serial + mã thẻ qua email sau khi thanh toán."
                  : selected.fulfillment_type === "link"
                    ? "giao link/key ngay sau khi thanh toán (theo mẫu admin đặt)."
                    : "làm tay — đơn chuyển sang Chờ xử lý, admin hoàn thành trong 5–30 phút."}
              {selected.delivery_note ? ` ${selected.delivery_note}` : ""}
            </p>
          )}

          {/* Mua ngay + Thêm vào giỏ: xếp dọc trên màn rất nhỏ, cạnh nhau từ sm;
              thêm vào giỏ chỉ hiện toast + tăng số giỏ, không chuyển trang. */}
          <div className="flex flex-col gap-3 sm:flex-row mt-5">
            <button
              disabled={!selected || !inStock}
              onClick={() => {
                if (!selected) return;
                cart.add(selected.id, product.id);
                router.push("/thanh-toan");
              }}
              aria-label={`Mua ngay ${product.name} — ${selected?.label ?? ""}`}
              className="flex-1 btn-primary disabled:opacity-40"
            >
              Mua ngay
            </button>
            <button
              disabled={!selected || !inStock}
              onClick={() => {
                if (!selected) return;
                cart.add(selected.id, product.id);
                toast.notify(`Đã thêm ${product.name} — ${selected.label} vào giỏ hàng`);
              }}
              aria-label={`Thêm ${product.name} — ${selected?.label ?? ""} vào giỏ hàng`}
              className="flex-1 btn-outline disabled:opacity-40"
            >
              <ShoppingCart size={18} aria-hidden="true" /> Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex gap-1 border-b vd-border">
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
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t.key ? "border-brand-500 text-brand-400" : "border-transparent vd-muted hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="py-5 max-w-3xl">
          {tab === "desc" && (
            <div className="space-y-3  leading-relaxed">
              <p>{product.description}</p>
              <p>
                <b className="text-white">Vì sao nên chọn VDigital?</b> Giao hàng nhanh, bảo hành {product.warranty_days} ngày
                1 đổi 1 nếu lỗi do shop, thanh toán VietQR tự động qua PayOS (0% phí), hỗ trợ 24/7.
              </p>
              <p className="text-sm vd-muted">
                Lưu ý: không chia sẻ tài khoản cho người khác khi shop chưa cho phép; đổi mật khẩu tài khoản giao ngay khi
                nhận được nếu sản phẩm cho phép.
              </p>
            </div>
          )}
          {tab === "guide" && <p className="whitespace-pre-line  leading-relaxed">{product.guide}</p>}
          {tab === "reviews" && (
            <div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black">{product.rating}/5</span>
                <div className="text-sm vd-muted">
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
                  className="field"
                />
                <button className="btn-primary !px-4 !py-2 text-sm">
                  Viết đánh giá
                </button>
              </form>
              <div className="mt-5 space-y-3">
                {myReviews.map((r, i) => (
                  <div key={i} className="vd-card-flat p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <b>{r.name}</b>
                      <span className="text-amber-400">{"★".repeat(r.stars)}</span>
                      <span className="vd-muted2">{r.date}</span>
                    </div>
                    <p className="text-sm  mt-1">{r.content}</p>
                  </div>
                ))}
                {myReviews.length === 0 && (
                  <p className="text-sm vd-muted2">Chưa có đánh giá nào của bạn cho sản phẩm này.</p>
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
