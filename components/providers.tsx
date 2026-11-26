"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SEED_CATALOG } from "@/lib/seed";
import { DEFAULT_ADMIN_EMAIL, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
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
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
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
  changePassword: async () => ({ error: "Chưa cấu hình" }),
});

export function useAuth() {
  return useContext(AuthContext);
}

// Email admin mặc định của VDigital khi env chưa đặt.
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
if (ADMIN_EMAILS.length === 0) ADMIN_EMAILS.push(DEFAULT_ADMIN_EMAIL);

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
        if (u?.email) setUser({ email: u.email, name: (u.user_metadata?.name as string) || u.email });
        setAuthLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUser(u?.email ? { email: u.email, name: (u.user_metadata?.name as string) || u.email } : null);
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
      changePassword: async (newPassword) => {
        const sb = getSupabase();
        if (!sb) return { error: "Chưa cấu hình Supabase." };
        const { error } = await sb.auth.updateUser({ password: newPassword });
        return error ? { error: error.message } : {};
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
        <CartContext.Provider value={cart}>{children}</CartContext.Provider>
      </AuthContext.Provider>
    </CatalogContext.Provider>
  );
}

export { isSupabaseConfigured };
