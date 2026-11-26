"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell,
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
  ShoppingCart,
  Sun,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useAuth, useCart, useCatalog, useTheme } from "./providers";
import { Logo } from "./Logo";
import { AuthModal } from "./AuthModal";

const NAV = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/san-pham", label: "Danh mục", icon: Grid2x2 },
  { href: "/tai-khoan?tab=orders", label: "Đơn hàng", icon: Package },
  { href: "/thanh-toan", label: "Nạp tiền", icon: Wallet },
  { href: "/huong-dan", label: "Hỗ trợ", icon: Headset },
  { href: "/dieu-khoan", label: "Về chúng tôi", icon: Info },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { catalog } = useCatalog();
  const topCats = catalog.categories.filter((c) => !c.parent_id);
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <Logo />
      <nav className="mt-8 space-y-1">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href.split("?")[0]));
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
          <p className="mt-2 font-black leading-snug">
            Ưu đãi đặc biệt
            <br />
            <span className="text-amber-300">Giảm ngay 20%</span>
          </p>
          <p className="text-xs text-white/80 mt-1">cho đơn hàng đầu tiên!</p>
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
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
                  placeholder="Tìm kiếm sản phẩm... (VD: CapCut, Garena, ChatGPT)"
                  className="field !rounded-full !py-3 !pl-11 !pr-4"
                  aria-label="Tìm kiếm sản phẩm"
                />
              </div>
            </form>
            <button
              onClick={toggle}
              className="rounded-full p-2.5 vd-muted hover:text-white border vd-border"
              aria-label={light ? "Chuyển sang nền tối" : "Chuyển sang nền sáng"}
              title={light ? "Nền tối" : "Nền sáng"}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link href="/tai-khoan?tab=orders" className="relative rounded-full p-2.5 vd-muted hover:text-white border vd-border" aria-label="Thông báo / đơn hàng">
              <Bell size={18} />
              {cart.count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {cart.count}
                </span>
              )}
            </Link>
            {auth.user ? (
              <div className="flex items-center gap-2">
                <Link href="/tai-khoan" className="flex items-center gap-2 rounded-full border vd-border py-1.5 pl-1.5 pr-3 hover:border-brand-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-black text-white">
                    {auth.user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden text-sm font-semibold md:block">{auth.user.name}</span>
                </Link>
                <button onClick={() => auth.signOut()} className="rounded-full p-2 vd-muted hover:text-red-400" title="Đăng xuất" aria-label="Đăng xuất">
                  <LogOut size={17} />
                </button>
              </div>
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

        <main className="min-h-[70vh] px-4 md:px-6 py-5">{children}</main>

        <footer className="border-t vd-border px-4 md:px-6 py-6 text-sm vd-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <b className="text-white">VDigital</b> — Tài khoản số giá tốt · Thanh toán VietQR tự động, tiền về MB Bank.
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
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
