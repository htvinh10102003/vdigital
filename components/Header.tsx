"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Search, ShoppingCart, User } from "lucide-react";
import { useAuth, useCart, useCatalog } from "./providers";
import { Logo } from "./Logo";
import { AuthModal } from "./AuthModal";

export function Header() {
  const { catalog } = useCatalog();
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const topCats = catalog.categories.filter((c) => !c.parent_id);
  const tkbq = catalog.categories.find((c) => c.slug === "tai-khoan-ban-quyen");
  const tkbqSubs = tkbq ? catalog.categories.filter((c) => c.parent_id === tkbq.id) : [];

  return (
    <>
      <header className="sticky top-0 z-40 bg-navy-900/95 backdrop-blur border-b border-navy-700">
        {/* Thanh phụ */}
        <div className="hidden md:block border-b border-navy-800">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex gap-4">
              <Link href="/huong-dan" className="hover:text-white">Hướng dẫn mua hàng</Link>
              <Link href="/khuyen-mai" className="hover:text-white">Ưu đãi khách hàng</Link>
            </div>
            <div className="flex gap-4">
              <span>Hotline: <b className="text-slate-200">MB Bank — VietQR tự động</b></span>
              <span>Hỗ trợ 24/7</span>
            </div>
          </div>
        </div>
        {/* Hàng chính */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 md:gap-6">
          <Logo />
          <form
            className="flex-1 hidden sm:flex items-center"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/san-pham${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
            }}
          >
            <div className="relative w-full max-w-xl mx-auto flex">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm sản phẩm… (vd CapCut, Garena, ChatGPT)"
                className="w-full rounded-l-lg bg-navy-800 border border-navy-600 px-4 py-2.5 text-sm placeholder:text-slate-500"
              />
              <button className="rounded-r-lg bg-brand-500 hover:bg-brand-600 px-4 text-white" aria-label="Tìm kiếm">
                <Search size={18} />
              </button>
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2">
            {auth.user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/tai-khoan?tab=orders"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm hover:border-brand-500"
                >
                  <User size={16} /> {auth.user.name}
                </Link>
                <button
                  onClick={() => auth.signOut()}
                  title="Đăng xuất"
                  className="rounded-lg border border-navy-600 bg-navy-800 p-2 hover:border-red-500"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm hover:border-brand-500"
              >
                <User size={16} /> Tài khoản
              </button>
            )}
            <Link href="/gio-hang" className="relative inline-flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
              <ShoppingCart size={16} /> <span className="hidden sm:inline">Giỏ hàng</span>
              {cart.count > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                  {cart.count}
                </span>
              )}
            </Link>
          </div>
        </div>
        {/* Menu điều hướng */}
        <nav className="border-t border-navy-800 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 text-sm whitespace-nowrap">
            <div className="relative group">
              <Link href="/tai-khoan-ban-quyen" className="flex items-center gap-1 px-3 py-2.5 font-semibold hover:text-brand-400">
                Tài Khoản Bản Quyền <ChevronDown size={14} />
              </Link>
              <div className="hidden group-hover:block absolute left-0 top-full z-50 w-64 rounded-xl bg-navy-800 border border-navy-600 shadow-card p-2">
                {tkbqSubs.map((s) => (
                  <Link key={s.id} href={`/san-pham?cat=${s.slug}`} className="block px-3 py-2 rounded-lg hover:bg-navy-700">
                    {s.name}
                  </Link>
                ))}
                <Link href="/tai-khoan-ban-quyen" className="block px-3 py-2 rounded-lg text-brand-400 font-semibold hover:bg-navy-700">
                  Xem tất cả Tài Khoản Bản Quyền →
                </Link>
              </div>
            </div>
            {topCats
              .filter((c) => c.slug !== "tai-khoan-ban-quyen")
              .map((c) => (
                <Link key={c.id} href={`/${c.slug}`} className="px-3 py-2.5 font-semibold hover:text-brand-400">
                  {c.name}
                </Link>
              ))}
            <Link href="/san-pham" className="px-3 py-2.5 font-semibold hover:text-brand-400">Tất cả sản phẩm</Link>
            <Link href="/ban-chay" className="px-3 py-2.5 font-semibold hover:text-brand-400">Bán chạy</Link>
            <Link href="/khuyen-mai" className="px-3 py-2.5 font-semibold text-brand-400">Khuyến mãi</Link>
          </div>
        </nav>
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
