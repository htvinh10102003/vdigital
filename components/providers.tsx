"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SEED_CATALOG } from "@/lib/seed";
import { getSupabase, isSupabaseConfigured, resolveAdminEmails } from "@/lib/supabase";
import type { CartItem, Catalog, Product } from "@/lib/types";

// ---------------- Catalog ----------------

interface CatalogCtx {
  catalog: Catalog;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogCtx>({ catalog: SEED_CATALOG, loading: false, refresh: async () => {} });

const OVERRIDE_KEY = "vdigital-overrides-v2";

function applyOverrides(base: Catalog): Catalog {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return base;
    const o = JSON.parse(raw) as Partial<Catalog>;
    return {
      ...base,
      categories: o.categories?.length ? o.categories : base.categories,
      products: o.products?.length
        ? base.products.map((p) => o.products!.find((x) => x.id === p.id) ?? p).concat(
            o.products!.filter((x) => !base.products.some((p) => p.id === x.id)),
          )
        : base.products,
      banners: o.banners?.length ? o.banners : base.banners,
      faqs: o.faqs?.length ? o.faqs : base.faqs,
    };
  } catch {
    return base;
  }
}

export function saveCatalogOverrides(catalog: Partial<Catalog>) {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ ...prev, ...catalog }));
  } catch {
    /* ignore */
  }
}

export function useCatalog() {
  return useContext(CatalogContext);
}

// ---------------- Auth ----------------

export interface AuthUser {
  email: string;
  name: string;
  isDemo?: boolean;
  /** Các phương thức đăng nhập đã liên kết: "email", "google"... */
  providers?: string[];
  createdAt?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  signInGoogle: () => Promise<void>;
  demoSignIn: (email: string) => void;
  signOut: () => Promise<void>;
  /** Đổi mật khẩu: xác thực lại bằng mật khẩu hiện tại rồi mới đặt mật khẩu mới. */
  changePasswordWithCurrent: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  /** Đổi tên hiển thị. */
  updateName: (name: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  isAdmin: false,
  loading: false,
  signIn: async () => ({ error: "Chưa cấu hình" }),
  signUp: async () => ({ error: "Chưa cấu hình" }),
  signInGoogle: async () => {},
  demoSignIn: () => {},
  signOut: async () => {},
  changePasswordWithCurrent: async () => ({ error: "Chưa cấu hình" }),
  updateName: async () => ({ error: "Chưa cấu hình" }),
});

export function useAuth() {
  return useContext(AuthContext);
}

// Email admin mặc định của VDigital khi env chưa đặt.
// Client chỉ thấy NEXT_PUBLIC_ADMIN_EMAILS — email mặc định LUÔN có mặt
// (resolveAdminEmails), kể cả khi env đặt email khác (xem lib/supabase.ts).
const ADMIN_EMAILS = resolveAdminEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS);

// ---------------- Toast (thông báo nhanh: đã thêm vào giỏ...) ----------------

interface ToastCtx {
  notify: (message: string) => void;
}

const ToastContext = createContext<ToastCtx>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastHost({ toast }: { toast: { id: number; message: string } | null }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="toast-in fixed left-1/2 bottom-24 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-base leading-none">✓</span>
        <span className="min-w-0">{toast.message}</span>
      </div>
    </div>
  );
}

// ---------------- Cart ----------------

interface CartCtx {
  items: CartItem[];
  add: (variantId: string, productId: string, qty?: number) => void;
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
  count: number;
}

const CartContext = createContext<CartCtx>({
  items: [],
  add: () => {},
  remove: () => {},
  setQty: () => {},
  clear: () => {},
  count: 0,
});

export function useCart() {
  return useContext(CartContext);
}

const CART_KEY = "vdigital-cart-v1";
const USER_KEY = "vdigital-demo-user-v1";

// ---------------- Theme (sáng/tối) ----------------

export function useTheme(): { light: boolean; toggle: () => void } {
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      setLight(localStorage.getItem("vdigital-theme") === "light");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
    try {
      localStorage.setItem("vdigital-theme", light ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }, [light]);
  return { light, toggle: () => setLight((v) => !v) };
}

function toAuthUser(u: { email?: string; user_metadata?: Record<string, unknown>; identities?: { provider?: string }[]; created_at?: string } | null | undefined): AuthUser | null {
  if (!u?.email) return null;
  return {
    email: u.email,
    name: (u.user_metadata?.name as string) || u.email,
    providers: [...new Set((u.identities ?? []).map((i) => i.provider).filter(Boolean) as string[])],
    createdAt: u.created_at,
  };
}

// ---------------- Providers ----------------

export function Providers({ children, initialCatalog }: { children: ReactNode; initialCatalog?: Catalog }) {
  // Catalog đã render phía server (layout fetch getCatalog) nên trang mở ra
  // là thấy sản phẩm ngay, không còn "Đang tải sản phẩm…" 10–15s.
  const [catalog, setCatalog] = useState<Catalog>(() =>
    initialCatalog ? applyOverrides(initialCatalog) : SEED_CATALOG,
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  // Toast tự ẩn sau 2.5s; mỗi lần notify mới là 1 id mới (kể cả trùng nội dung).
  const notify = useCallback((message: string) => {
    setToast({ id: Date.now() + Math.random(), message });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Catalog;
        setCatalog(applyOverrides(data));
      }
    } catch {
      setCatalog((c) => applyOverrides(c));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCartItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const sb = getSupabase();
    if (sb) {
      sb.auth.getSession().then(({ data }) => {
        const u = data.session?.user;
        setUser(toAuthUser(u));
        setAuthLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUser(toAuthUser(u));
      });
      return () => sub.subscription.unsubscribe();
    }
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    } catch {
      /* ignore */
    }
  }, [cartItems]);

  const auth: AuthCtx = useMemo(() => {
    const isAdmin =
      !!user && (ADMIN_EMAILS.includes(user.email.toLowerCase()) || user.email === "admin@vdigital.vn");
    return {
      user,
      isAdmin,
      loading: authLoading,
      signIn: async (email, password) => {
        const sb = getSupabase();
        if (!sb) return { error: "Chưa cấu hình Supabase — hãy dùng đăng nhập demo." };
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },
      signUp: async (name, email, password) => {
        const sb = getSupabase();
        if (!sb) return { error: "Chưa cấu hình Supabase — hãy dùng đăng nhập demo." };
        const { error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
        return error ? { error: error.message } : {};
      },
      signInGoogle: async () => {
        const sb = getSupabase();
        if (!sb) return;
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/tai-khoan` },
        });
      },
      demoSignIn: (email) => {
        const u: AuthUser = { email, name: email.split("@")[0], isDemo: true };
        setUser(u);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        } catch {
          /* ignore */
        }
      },
      signOut: async () => {
        const sb = getSupabase();
        if (sb) await sb.auth.signOut();
        setUser(null);
        try {
          localStorage.removeItem(USER_KEY);
        } catch {
          /* ignore */
        }
      },
      changePasswordWithCurrent: async (currentPassword, newPassword) => {
        const sb = getSupabase();
        if (!sb) return { error: "Chưa cấu hình Supabase." };
        if (!user?.email) return { error: "Chưa đăng nhập." };
        if (user.isDemo) return { error: "Tài khoản demo không đổi được mật khẩu." };
        // Xác thực lại mật khẩu hiện tại trước khi cho đổi (Supabase không
        // có API đổi mật khẩu yêu cầu mật khẩu cũ — tự verify bằng sign-in).
        const { error: signInErr } = await sb.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signInErr) return { error: "Mật khẩu hiện tại không đúng." };
        const { error } = await sb.auth.updateUser({ password: newPassword });
        return error ? { error: error.message } : {};
      },
      updateName: async (name) => {
        const sb = getSupabase();
        if (!sb) return { error: "Chưa cấu hình Supabase." };
        if (!user?.email) return { error: "Chưa đăng nhập." };
        if (user.isDemo) {
          const u: AuthUser = { ...user, name };
          setUser(u);
          try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* ignore */ }
          return {};
        }
        const { error } = await sb.auth.updateUser({ data: { name } });
        if (error) return { error: error.message };
        setUser((prev) => (prev ? { ...prev, name } : prev));
        return {};
      },
    };
  }, [user, authLoading]);

  const cart: CartCtx = useMemo(() => {
    const count = cartItems.reduce((s, i) => s + i.qty, 0);
    return {
      items: cartItems,
      count,
      add: (variantId, productId, qty = 1) =>
        setCartItems((prev) => {
          const ex = prev.find((i) => i.variantId === variantId);
          if (ex) return prev.map((i) => (i.variantId === variantId ? { ...i, qty: i.qty + qty } : i));
          return [...prev, { variantId, productId, qty }];
        }),
      remove: (variantId) => setCartItems((prev) => prev.filter((i) => i.variantId !== variantId)),
      setQty: (variantId, qty) =>
        setCartItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.variantId !== variantId)
            : prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i)),
        ),
      clear: () => setCartItems([]),
    };
  }, [cartItems]);

  return (
    <CatalogContext.Provider value={{ catalog, loading: catalogLoading, refresh: refreshCatalog }}>
      <AuthContext.Provider value={auth}>
        <CartContext.Provider value={cart}>
          <ToastContext.Provider value={{ notify }}>{children}</ToastContext.Provider>
          <ToastHost toast={toast} />
        </CartContext.Provider>
      </AuthContext.Provider>
    </CatalogContext.Provider>
  );
}

export { isSupabaseConfigured };
