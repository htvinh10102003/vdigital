"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
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

// Catalog rỗng lúc chưa tải xong (tránh hiện số liệu seed giả trong lúc
// chờ /api/catalog — xem Providers).
const EMPTY_CATALOG: Catalog = { categories: [], products: [], banners: [], faqs: [] };

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

// ---------------- Confirm (popup xác nhận chuyên nghiệp, thay cho
// confirm() của trình duyệt — hộp thoại trình duyệt trông rẻ tiền, không
// khớp giao diện shop, không tùy được nút/tone) ----------------

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmCtx>({ confirm: async () => false });

export function useConfirm() {
  return useContext(ConfirmContext);
}

function ConfirmHost({
  req,
  onDone,
}: {
  req: { opts: ConfirmOptions; resolve: (v: boolean) => void } | null;
  onDone: (v: boolean) => void;
}) {
  // Chỉ đóng bằng nút Hủy / X / phím Esc — không đóng khi bấm ra vùng tối
  // xung quanh (quy ước modal của shop: tránh bấm nhầm mất thao tác).
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, onDone]);
  if (!req) return null;
  const { opts } = req;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={opts.title ?? "Xác nhận"}
    >
      <div className="w-full max-w-md vd-card p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                opts.danger ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-300"
              }`}
            >
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold text-lg leading-snug">{opts.title ?? "Xác nhận"}</h3>
              <p className="mt-1 text-sm vd-muted whitespace-pre-line">{opts.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDone(false)}
            aria-label="Đóng"
            className="rounded-lg p-1.5 vd-muted hover:bg-white/10"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onDone(false)}
            className="rounded-lg border vd-border px-4 py-2 font-semibold hover:bg-white/5"
          >
            {opts.cancelLabel ?? "Hủy"}
          </button>
          <button
            type="button"
            onClick={() => onDone(true)}
            className={`rounded-lg px-4 py-2 font-semibold text-white ${
              opts.danger ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {opts.confirmLabel ?? "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- BootSplash (điều khiển màn hình chờ #vd-boot trong
// layout) ----------------

/**
 * Màn hình chờ mở đầu kiểu AWSAMELIE: div #vd-boot đã có sẵn trong HTML
 * đầu tiên nên vẽ ngay, không chờ JS. Component này chỉ đổi dòng chữ theo
 * giai đoạn (Kiểm tra đăng nhập → Đang tải sản phẩm) rồi làm mờ + gỡ đi
 * khi đăng nhập xong và catalog đã tải. Lưới an toàn 10s: kẹt mạng hay lỗi
 * gì thì vẫn gỡ, không bao giờ kẹt khách ở màn hình chờ.
 */
function BootSplash() {
  const { loading: authLoading } = useAuth();
  const { loading: catalogLoading } = useCatalog();
  useEffect(() => {
    const node = document.getElementById("vd-boot");
    if (!node) return;
    const text = document.getElementById("vd-boot-text");
    if (text) {
      text.textContent = authLoading
        ? "Kiểm tra đăng nhập…"
        : catalogLoading
          ? "Đang tải sản phẩm…"
          : "Mở shop…";
    }
    if (!authLoading && !catalogLoading) {
      node.style.transition = "opacity 350ms ease";
      node.style.opacity = "0";
      const t = setTimeout(() => node.remove(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [authLoading, catalogLoading]);
  useEffect(() => {
    const t = setTimeout(() => document.getElementById("vd-boot")?.remove(), 10_000);
    return () => clearTimeout(t);
  }, []);
  return null;
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
  // Catalog KHÔNG còn lấy ở server trong layout (đó là thứ làm byte đầu
  // tiên chậm 2-3s) — client tải sau khi mount. Lúc chưa có thì dùng catalog
  // rỗng + cờ loading để các trang hiện skeleton, không hiện số seed giả.
  const [catalog, setCatalog] = useState<Catalog>(() =>
    initialCatalog ? applyOverrides(initialCatalog) : EMPTY_CATALOG,
  );
  const [catalogLoading, setCatalogLoading] = useState(!initialCatalog);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [confirmReq, setConfirmReq] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmReq({ opts, resolve })),
    [],
  );
  const closeConfirm = useCallback(
    (v: boolean) => {
      if (confirmReq) confirmReq.resolve(v);
      setConfirmReq(null);
    },
    [confirmReq],
  );

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

  // Không có catalog từ server thì tải ngay sau khi mount (trang đã hiện
  // nhờ splash, data điền sau — song song với server render trang chủ).
  useEffect(() => {
    if (initialCatalog) return;
    setCatalogLoading(true);
    void refreshCatalog();
  }, [initialCatalog, refreshCatalog]);

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
          <ConfirmContext.Provider value={{ confirm }}>
            <ToastContext.Provider value={{ notify }}>{children}</ToastContext.Provider>
            <ToastHost toast={toast} />
            <ConfirmHost req={confirmReq} onDone={closeConfirm} />
            <BootSplash />
          </ConfirmContext.Provider>
        </CartContext.Provider>
      </AuthContext.Provider>
    </CatalogContext.Provider>
  );
}

export { isSupabaseConfigured };
