"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Headset, ShieldCheck, Zap } from "lucide-react";
import { useCatalog } from "@/components/providers";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        <Link href={href} className="text-sm text-brand-400 font-semibold hover:underline">
          Xem tất cả →
        </Link>
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const { catalog, loading } = useCatalog();
  const [slide, setSlide] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const banners = catalog.banners.filter((b) => b.is_active);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const products = useMemo(() => catalog.products.filter((p) => p.is_active), [catalog]);
  const flashProducts = useMemo(
    () => products.filter((p) => p.variants.some((v) => v.is_flash && v.flash_ends_at)),
    [products],
  );
  const featured = useMemo(() => products.filter((p) => p.is_featured), [products]);
  const newest = useMemo(() => products.filter((p) => p.is_new), [products]);
  const best = useMemo(() => products.filter((p) => p.is_best_seller), [products]);

  const banner = banners[slide] ?? banners[0];

  return (
    <div>
      {/* Hero carousel + 2 ô quảng cáo */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 relative rounded-2xl overflow-hidden bg-gradient-to-br ${banner?.gradient ?? "from-navy-800 to-navy-900"} min-h-[280px] md:min-h-[320px] flex flex-col justify-center p-8`}>
          {banner && (
            <>
              <span className="text-xs font-bold tracking-widest text-brand-400">VDIGITAL — TÀI KHOẢN SỐ GIÁ TỐT</span>
              <h1 className="text-3xl md:text-4xl font-black mt-2 max-w-lg leading-tight">{banner.title}</h1>
              <p className="text-slate-300 mt-2 max-w-md">{banner.subtitle}</p>
              <div className="mt-5">
                <Link href={banner.cta_link} className="inline-block rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2.5">
                  {banner.cta_text}
                </Link>
              </div>
            </>
          )}
          {banners.length > 1 && (
            <>
              <button
                onClick={() => setSlide((slide - 1 + banners.length) % banners.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2"
                aria-label="Slide trước"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setSlide((slide + 1) % banners.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2"
                aria-label="Slide sau"
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setSlide(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-brand-500" : "w-2 bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-rows-2 gap-4">
          <Link href="/the-game" className="rounded-2xl bg-gradient-to-br from-orange-600 to-red-700 p-5 flex flex-col justify-end min-h-[130px]">
            <span className="font-bold text-lg">Thẻ game bản quyền</span>
            <span className="text-sm text-white/80">Garena, Zing — đủ mệnh giá</span>
          </Link>
          <Link href="/vpn-tien-ich" className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 flex flex-col justify-end min-h-[130px]">
            <span className="font-bold text-lg">Bảo mật & VPN</span>
            <span className="text-sm text-white/80">NordVPN — ẩn IP, an toàn</span>
          </Link>
        </div>
      </div>

      {/* Phím tắt tìm nhanh */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "CapCut Pro", href: "/tai-khoan-ban-quyen/capcut-pro" },
          { label: "Canva Pro", href: "/tai-khoan-ban-quyen/canva-pro" },
          { label: "Google AI (Gemini)", href: "/tai-khoan-ban-quyen/google-ai-pro" },
          { label: "Tất cả sản phẩm", href: "/san-pham" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl bg-navy-800 border border-navy-700 px-4 py-3 text-sm font-semibold text-center hover:border-brand-500">
            {s.label}
          </Link>
        ))}
      </div>

      {loading && <p className="max-w-7xl mx-auto px-4 mt-8 text-slate-400">Đang tải sản phẩm…</p>}

      {flashProducts.length > 0 && (
        <Section title="⚡ Flash Sale hôm nay" href="/khuyen-mai">
          <div className="mb-3 text-sm text-slate-400">
            <span className="font-bold text-brand-400">ƯU ĐÃI GIỚI HẠN</span> — giá được cập nhật trực tiếp từ sản phẩm.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {flashProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title="Sản phẩm nổi bật" href="/san-pham">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {newest.length > 0 && (
        <Section title="Sản phẩm mới" href="/san-pham?sort=newest">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {newest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {best.length > 0 && (
        <Section title="Sản phẩm bán chạy nhất" href="/ban-chay">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {best.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {/* 3 bước mua hàng */}
      <section className="max-w-7xl mx-auto px-4 mt-12">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Mua hàng số chỉ trong 3 bước</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: "01", t: "Chọn sản phẩm", d: "Kiểm tra giá, thời hạn và chính sách bảo hành trước khi mua." },
            { n: "02", t: "Xác nhận & thanh toán", d: "Quét VietQR qua PayOS — hệ thống tự xác nhận trong vài giây." },
            { n: "03", t: "Nhận tài khoản ngay", d: "Thông tin được gửi vào chi tiết đơn hàng và email của bạn." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl bg-navy-800 border border-navy-700 p-5">
              <div className="text-3xl font-black text-brand-500">{s.n}</div>
              <h3 className="font-bold mt-2">{s.t}</h3>
              <p className="text-sm text-slate-400 mt-1">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 cam kết */}
      <section className="max-w-7xl mx-auto px-4 mt-10">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Mua sản phẩm số an tâm cùng VDigital</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, t: "Sản phẩm chính hãng", d: "Tài khoản chuẩn, bảo hành đầy đủ." },
            { icon: Zap, t: "Giao hàng tức thì", d: "Nhận tài khoản trong vài phút." },
            { icon: CreditCard, t: "Thanh toán an toàn", d: "VietQR tự động, tiền về MB Bank." },
            { icon: Headset, t: "Hỗ trợ 24/7", d: "Luôn có người hỗ trợ khi cần." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl bg-navy-800 border border-navy-700 p-5">
              <c.icon className="text-brand-500" size={28} />
              <h3 className="font-bold mt-3">{c.t}</h3>
              <p className="text-sm text-slate-400 mt-1">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-7xl mx-auto px-4 mt-12">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Câu hỏi thường gặp</h2>
        <div className="space-y-2">
          {catalog.faqs.map((f, i) => (
            <div key={f.id} className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden">
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full text-left px-4 py-3 font-semibold flex justify-between gap-3">
                {f.question}
                <span className="text-brand-400">{faqOpen === i ? "−" : "+"}</span>
              </button>
              {faqOpen === i && <p className="px-4 pb-4 text-sm text-slate-300 leading-relaxed">{f.answer}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Phương thức thanh toán */}
      <section className="max-w-7xl mx-auto px-4 mt-12">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Thanh toán an toàn & tiện lợi</h2>
        <div className="flex flex-wrap gap-2">
          {["VietQR (PayOS)", "Chuyển khoản ngân hàng — MB Bank", "Thẻ ATM / Nội địa", "Thẻ quốc tế (Visa/Mastercard)", "Ví MoMo", "ZaloPay", "VNPay"].map((m) => (
            <span key={m} className="rounded-full bg-navy-800 border border-navy-700 px-4 py-2 text-sm">
              {m}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          VietQR qua PayOS là phương thức chính: miễn phí, 0% phí giao dịch, tiền về thẳng tài khoản MB Bank của shop và đơn được duyệt tự động.
        </p>
      </section>
    </div>
  );
}
