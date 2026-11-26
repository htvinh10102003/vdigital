import Link from "next/link";
import { ArrowRight, Gamepad2, Grid2x2, KeyRound, Play, ShieldCheck, Sparkles, Wrench, Zap } from "lucide-react";
import { getCatalog } from "@/lib/store";
import { partitionHome } from "@/lib/catalog-utils";
import { categoryPath } from "@/lib/catalog-utils";
import { ProductCard } from "@/components/ProductCard";
import { CartPanel, FollowCard, TrustCards } from "@/components/RightRail";
import { FaqAccordion } from "@/components/FaqAccordion";

/**
 * Trang chủ — server component: sản phẩm đã có sẵn trong HTML đầu tiên.
 * Bố cục theo ảnh mẫu Vinh gửi: hero trái + giỏ hàng phải, danh mục icon
 * tròn, lưới sản phẩm nổi bật. Mỗi sản phẩm chỉ xuất hiện đúng 1 lần
 * trên trang (partitionHome chia không trùng).
 */

const CAT_ICONS: Record<string, typeof KeyRound> = {
  "tai-khoan-ban-quyen": KeyRound,
  "the-game": Gamepad2,
  ai: Sparkles,
  "giai-tri": Play,
  "vpn-tien-ich": ShieldCheck,
};

function Section({ title, href, icon, children }: { title: string; href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-black tracking-tight">
          {icon}
          {title}
        </h2>
        <Link href={href} className="text-sm text-brand-400 font-semibold hover:underline shrink-0">
          Xem tất cả →
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const catalog = await getCatalog();
  const banners = catalog.banners.filter((b) => b.is_active);
  const banner = banners[0];
  const { flash, featured, best, newest, games, more } = partitionHome(catalog.products);
  const topCats = catalog.categories.filter((c) => !c.parent_id);
  const heroTiles = catalog.products.filter((p) => p.is_active).slice(0, 4);

  return (
    <div>
      {/* Hero trái + giỏ hàng phải */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px] items-start">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 min-h-[300px] md:min-h-[340px] p-7 md:p-10 text-white">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.5) 0, transparent 35%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.35) 0, transparent 30%)",
            }}
          />
          <div className="relative">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-widest">
              VDigital — TÀI KHOẢN SỐ GIÁ TỐT
            </span>
            <h1 className="mt-4 text-3xl leading-[1.15] md:text-5xl md:leading-[1.1] font-black max-w-lg">
              Nhanh chóng
              <br />
              An toàn — Tiện lợi
            </h1>
            <p className="mt-3 max-w-md text-white/85">
              {banner?.subtitle ??
                "Tài khoản bản quyền, thẻ game và công cụ AI — thanh toán VietQR tự động, giao hàng tức thì, bảo hành uy tín."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/san-pham"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-900 hover:bg-amber-300"
              >
                Khám phá ngay <ArrowRight size={17} />
              </Link>
              <Link
                href="/the-game"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/30 px-6 py-3 font-bold hover:bg-white/25"
              >
                <Gamepad2 size={17} /> Thẻ game
              </Link>
            </div>
          </div>
          {/* Minh họa: các ô sản phẩm nổi — tự vẽ, không dùng ảnh/nhân vật của hãng khác.
              Mỗi ô link đúng trang chi tiết của sản phẩm đó. */}
          <div className="relative mt-8 flex gap-3">
            {heroTiles.map((p) => (
              <Link
                key={p.id}
                href={categoryPath(catalog.categories, p)}
                aria-label={p.name}
                className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white/15 border border-white/25 backdrop-blur text-center transition hover:bg-white/25"
              >
                <span className="px-1 text-[11px] md:text-xs font-black leading-tight">{p.initials}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <CartPanel />
          <TrustCards />
          <FollowCard />
        </div>
      </div>

      {/* Danh mục phổ biến — icon tròn, danh mục thật của VDigital */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Danh mục phổ biến</h2>
          <Link href="/san-pham" className="text-sm text-brand-400 font-semibold hover:underline">
            Xem tất cả →
          </Link>
        </div>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-2">
          {topCats.map((c) => {
            const Icon = CAT_ICONS[c.slug] ?? Grid2x2;
            return (
              <Link key={c.id} href={`/${c.slug}`} className="flex w-20 md:w-24 shrink-0 flex-col items-center gap-2 text-center group">
                <span className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full vd-card text-brand-400 transition group-hover:border-brand-500 group-hover:scale-105">
                  <Icon size={30} />
                </span>
                <span className="text-xs md:text-sm font-semibold leading-tight">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {flash.length > 0 && (
        <Section title="Flash Sale hôm nay" href="/khuyen-mai" icon={<Zap size={22} className="text-amber-400" aria-hidden="true" />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {flash.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title="Sản phẩm nổi bật" href="/san-pham">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {games.length > 0 && (
        <Section title="Thẻ game" href="/the-game">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {games.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <p className="text-sm vd-muted mt-3">Mỗi loại thẻ là 1 sản phẩm — chọn mệnh giá 20K / 50K / 100K / 200K / 500K ở trang chi tiết.</p>
        </Section>
      )}

      {best.length > 0 && (
        <Section title="Bán chạy nhất" href="/ban-chay">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {best.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {newest.length > 0 && (
        <Section title="Sản phẩm mới" href="/san-pham?sort=newest">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {newest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {more.length > 0 && (
        <Section title="Khám phá thêm" href="/san-pham">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {/* 3 bước mua hàng */}
      <section className="mt-12">
        <h2 className="text-xl md:text-2xl font-black tracking-tight mb-4">Mua hàng số chỉ trong 3 bước</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: "01", t: "Chọn sản phẩm", d: "Kiểm tra giá, thời hạn và chính sách bảo hành trước khi mua." },
            { n: "02", t: "Xác nhận & thanh toán", d: "Quét VietQR qua PayOS — hệ thống tự xác nhận trong vài giây." },
            { n: "03", t: "Nhận tài khoản ngay", d: "Thông tin được gửi vào chi tiết đơn hàng và email của bạn." },
          ].map((s) => (
            <div key={s.n} className="vd-card p-5">
              <div className="text-3xl font-black text-brand-400">{s.n}</div>
              <h3 className="font-bold mt-2">{s.t}</h3>
              <p className="text-sm vd-muted mt-1">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-xl md:text-2xl font-black tracking-tight mb-4">Câu hỏi thường gặp</h2>
        <FaqAccordion faqs={catalog.faqs} />
      </section>

      <section className="mt-12">
        <h2 className="text-xl md:text-2xl font-black tracking-tight mb-4">Thanh toán an toàn & tiện lợi</h2>
        <div className="flex flex-wrap gap-2">
          {["VietQR (PayOS)", "Chuyển khoản ngân hàng", "Thẻ ATM / Nội địa", "Thẻ quốc tế (Visa/Mastercard)", "Ví MoMo", "ZaloPay", "VNPay"].map((m) => (
            <span key={m} className="chip">
              {m}
            </span>
          ))}
        </div>
        <p className="text-xs vd-muted2 mt-3">
          VietQR qua PayOS là phương thức chính: miễn phí, 0% phí giao dịch, đơn được duyệt tự động sau khi thanh toán.
        </p>
        <p className="text-xs vd-muted2 mt-2 flex items-center gap-1">
          <Zap size={13} className="text-brand-400" /> Giao hàng tức thì · Thanh toán an toàn · Hỗ trợ 24/7 · Uy tín hàng đầu
        </p>
      </section>
    </div>
  );
}
