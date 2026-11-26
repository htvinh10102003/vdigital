"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Gift,
  Grid2x2,
  Headset,
  Home,
  Info,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useAuth, useCart, useCatalog, useTheme } from "./providers";
import { maxDiscount } from "@/lib/catalog-utils";
import { Logo } from "./Logo";
import { AuthModal } from "./AuthModal";
import { NotificationsBell } from "./NotificationsBell";
import { WalletChip } from "./WalletChip";

const NAV = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/san-pham", label: "Danh mục", icon: Grid2x2 },
  { href: "/tai-khoan?tab=orders", label: "Đơn hàng", icon: Package, exact: true },
  { href: "/tai-khoan/quan-ly", label: "Quản lý tài khoản", icon: User },
  { href: "/thanh-toan", label: "Nạp tiền", icon: Wallet },
  { href: "/huong-dan", label: "Hỗ trợ", icon: Headset },
  { href: "/dieu-khoan", label: "Về chúng tôi", icon: Info },
];

/** Menu thả xuống khi bấm avatar ở header: Quản lý tài khoản, Đơn hàng,
    Cài đặt, Đăng xuất (+ Quản trị VDigital nếu là admin). Đóng khi bấm ra
    ngoài, bấm Esc, hoặc chọn 1 mục. Trên mobile không tràn màn hình. */
function AvatarMenu() {
  const auth = useAuth();
  const { light, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  if (!auth.user) return null;
  const items = [
    { href: "/tai-khoan/quan-ly", label: "Quản lý tài khoản", icon: User },
    { href: "/tai-khoan?tab=orders", label: "Đơn hàng của tôi", icon: Package },
    { href: "/tai-khoan/quan-ly", label: "Cài đặt", icon: Settings },
    ...(auth.isAdmin ? [{ href: "/admin", label: "Quản trị VDigital", icon: ShieldCheck }] : []),
  ];
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu tài khoản"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-full border vd-border py-1.5 pl-1.5 pr-3 hover:border-brand-500"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
          {auth.user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden text-sm font-semibold md:block">{auth.user.name}</span>
      </button>
      {open && (
        <div role="menu" aria-label="Menu tài khoản" className="vd-card absolute right-0 top-full z-50 mt-2 w-[min(88vw,260px)] overflow-hidden py-1.5 shadow-lift">
          <div className="border-b vd-border px-4 py-2.5">
            <p className="truncate font-bold">{auth.user.name}</p>
            <p className="truncate text-xs vd-muted">{auth.user.email}</p>
          </div>
          {items.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
            >
              <n.icon size={17} aria-hidden="true" className="vd-muted" />
              {n.label}
            </Link>
          ))}
          <button
            onClick={() => {
              toggle();
              setOpen(false);
            }}
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-white/5"
          >
            {light ? <Moon size={17} aria-hidden="true" className="vd-muted" /> : <Sun size={17} aria-hidden="true" className="vd-muted" />}
            Chế độ {light ? "tối" : "sáng"}
          </button>
          <div className="mt-1 border-t vd-border pt-1">
            <button
              onClick={() => {
                setOpen(false);
                auth.signOut();
              }}
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-400 transition hover:bg-white/5"
            >
              <LogOut size={17} aria-hidden="true" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bottom nav mobile (≤5 mục, theo ui-ux-pro-max): sidebar trái trên desktop
    thu gọn thành thanh điều hướng dưới trên điện thoại, tôn trọng safe-area. */
function BottomNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const cart = useCart();
  const items = [
    { href: "/", label: "Trang chủ", icon: Home, active: pathname === "/" },
    { href: "/san-pham", label: "Danh mục", icon: Grid2x2, active: pathname.startsWith("/san-pham") || pathname.startsWith("/tai-khoan-ban-quyen") || pathname.startsWith("/the-game") },
    { href: "/gio-hang", label: "Giỏ hàng", icon: ShoppingCart, active: pathname.startsWith("/gio-hang") || pathname.startsWith("/thanh-toan"), badge: cart.count },
    { href: "/tai-khoan?tab=orders", label: "Đơn hàng", icon: Package, active: pathname.startsWith("/tai-khoan") && !pathname.startsWith("/tai-khoan/quan-ly") && search.get("tab") !== "account" },
    { href: "/tai-khoan/quan-ly", label: "Tài khoản", icon: User, active: pathname.startsWith("/tai-khoan/quan-ly") },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t vd-border lg:hidden"
      style={{ background: "var(--bg-soft)", paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Điều hướng chính"
    >
      <div className="grid grid-cols-5">
        {items.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            aria-label={n.label}
            aria-current={n.active ? "page" : undefined}
            className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition ${
              n.active ? "text-brand-400" : "vd-muted hover:text-white"
            }`}
          >
            <span className="relative">
              <n.icon size={22} aria-hidden="true" />
              {n.badge !== undefined && n.badge > 0 && (
                <span
                  key={n.badge}
                  className="cart-bump absolute -top-1.5 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                >
                  {n.badge}
                </span>
              )}
            </span>
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { catalog } = useCatalog();
  const topCats = catalog.categories.filter((c) => !c.parent_id);
  // Khuyến mãi thật lớn nhất trong catalog (tính từ giá gốc/giá bán thật).
  // Không có giảm giá thì hiện text chung — không bịa "Giảm 20%".
  const maxDisc = Math.round(
    Math.max(0, ...catalog.products.map((p) => maxDiscount(p))) * 100,
  );
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <Logo />
      <nav className="mt-8 space-y-1">
        {NAV.map((n) => {
          const base = n.href.split("?")[0];
          // exact (vd Đơn hàng): chỉ sáng khi đúng trang đó, không sáng ké ở
          // trang con như /tai-khoan/quan-ly.
          const active = "exact" in n && n.exact ? pathname === base : pathname === n.href || (n.href !== "/" && pathname.startsWith(base));
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                  : "vd-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <n.icon size={18} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider vd-muted2">Danh mục nhanh</p>
        <div className="mt-2 space-y-1">
          {topCats.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              onClick={onNavigate}
              className="block rounded-lg px-3.5 py-2 text-sm vd-muted hover:bg-white/5 hover:text-white transition"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-auto">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-violet-600 to-indigo-600 p-4 text-white">
          <Gift size={26} />
          <p className="mt-2 font-extrabold leading-snug">
            {maxDisc > 0 ? (
              <>
                Ưu đãi đặc biệt
                <br />
                <span className="text-amber-300">Giảm tới {maxDisc}%</span>
              </>
            ) : (
              <>Tài khoản số giá tốt</>
            )}
          </p>
          <p className="text-xs text-white/80 mt-1">
            {maxDisc > 0 ? "cho sản phẩm đang khuyến mãi!" : "Giao hàng nhanh, bảo hành rõ ràng."}
          </p>
          <Link
            href="/khuyen-mai"
            onClick={onNavigate}
            className="mt-3 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            Nhận ngay →
          </Link>
        </div>
        <p className="mt-4 px-1 text-[11px] vd-muted2">© {new Date().getFullYear()} VDigital</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const cart = useCart();
  const auth = useAuth();
  const { light, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Trang con (vd /tai-khoan/quan-ly) có thể mở modal đăng nhập bằng event.
  useEffect(() => {
    const open = () => setAuthOpen(true);
    window.addEventListener("vdigital:open-auth", open);
    return () => window.removeEventListener("vdigital:open-auth", open);
  }, []);

  // Ghi lượt xem trang (page view) — chỉ lưu đường dẫn, không lưu IP hay
  // thông tin cá nhân. Dùng cho thống kê trong /admin > Tổng quan / Báo cáo.
  // Lỗi mạng hay bảng chưa có thì bỏ qua, không ảnh hưởng trang.
  useEffect(() => {
    if (!pathname) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return (
    <div className="min-h-screen vd-bg">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r vd-border lg:block" style={{ background: "var(--bg-soft)" }}>
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r vd-border" style={{ background: "var(--bg-soft)" }}>
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 vd-muted hover:text-white"
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Header 1 tầng */}
        <header className="sticky top-0 z-30 border-b vd-border backdrop-blur" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}>
          <div className="flex items-center gap-3 px-4 md:px-6 py-3">
            <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 vd-muted hover:text-white lg:hidden" aria-label="Mở menu">
              <Menu size={20} />
            </button>
            <form
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/san-pham${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
              }}
            >
              <div className="relative mx-auto w-full max-w-2xl">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 vd-muted2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="field !rounded-full !py-3 !pl-11 !pr-4"
                  aria-label="Tìm kiếm sản phẩm"
                />
              </div>
            </form>
            <button
              onClick={toggle}
              className="hidden rounded-full p-2.5 vd-muted hover:text-white border vd-border md:flex items-center justify-center"
              aria-label={light ? "Chuyển sang nền tối" : "Chuyển sang nền sáng"}
              title={light ? "Nền tối" : "Nền sáng"}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <WalletChip />
            <NotificationsBell />
            {auth.user ? (
              <AvatarMenu />
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex items-center gap-2 rounded-full border vd-border py-1.5 pl-1.5 pr-3 hover:border-brand-500"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-white">
                  <User size={16} />
                </span>
                <span className="hidden text-sm font-semibold md:block">Đăng nhập</span>
              </button>
            )}
          </div>
        </header>

        <main className="min-h-[70vh] px-4 md:px-6 py-5 pb-24 lg:pb-5">{children}</main>

        <footer className="border-t vd-border px-4 md:px-6 pt-6 pb-24 lg:pb-6 text-sm vd-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <b className="text-white">VDigital</b> — Tài khoản số giá tốt · Thanh toán an toàn qua VietQR (PayOS).
            </span>
            <span className="flex gap-4">
              <Link href="/huong-dan" className="hover:text-white">Hướng dẫn</Link>
              <Link href="/bao-hanh" className="hover:text-white">Bảo hành</Link>
              <Link href="/dieu-khoan" className="hover:text-white">Điều khoản</Link>
              <Link href="/bao-mat" className="hover:text-white">Bảo mật</Link>
            </span>
          </div>
        </footer>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
