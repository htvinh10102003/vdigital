"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, useAuth, useCatalog, saveCatalogOverrides } from "@/components/providers";
import { getSupabase } from "@/lib/supabase";
import { formatDateTime, formatSold, formatVND, slugify } from "@/lib/format";
import type { Banner, Category, Faq, ManualField, Order, Product, Variant } from "@/lib/types";
import { ACCOUNT_TYPES, FULFILLMENT_TYPES, OPTION_TYPES, PRODUCT_TYPES } from "@/lib/types";
import { ImageUpload } from "@/components/ImageUpload";
import {
  DEFAULT_TEMPLATES,
  EMAIL_TEMPLATE_TYPES,
  EMAIL_VARIABLES,
  SAMPLE_EMAIL_VARS,
  renderEmailTemplate,
  type EmailTemplateType,
} from "@/lib/email-templates";

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } else {
    h["x-demo-admin"] = "1";
  }
  return h;
}

type Tab = "overview" | "orders" | "products" | "stock" | "reports" | "content" | "emails" | "settings";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  processing: "Đang xử lý",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const LOW_STOCK_AT = 3;

function newVariant(productId: string, sortOrder: number): Variant {
  return {
    id: `v-${Date.now()}`,
    product_id: productId,
    name: "Gói mới",
    label: "Gói mới",
    price: 0,
    original_price: 0,
    fulfillment_type: "auto",
    option_type: "duration",
    option_label: null,
    delivery_template: null,
    delivery_note: null,
    manual_fields: [],
    is_flash: false,
    flash_ends_at: null,
    stock_count: null,
    is_active: true,
    sort_order: sortOrder,
  };
}

function newProduct(): Product {
  const id = `p-${Date.now()}`;
  return {
    id,
    slug: `san-pham-${Date.now()}`,
    category_id: "cat-license",
    name: "Sản phẩm mới",
    tagline: "",
    description: "",
    guide: "",
    warranty_days: 30,
    rating: 0,
    review_count: 0,
    sold_count: 0,
    is_featured: false,
    is_new: true,
    is_best_seller: false,
    is_active: true,
    product_type: "account",
    account_type: "shared",
    image_url: null,
    images: [],
    gradient: "from-indigo-600 to-violet-600",
    initials: "VD",
    created_at: new Date().toISOString(),
    variants: [newVariant(id, 1)],
  };
}

interface StockRow {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  code: string;
  is_used: boolean;
  order_code: string | null;
  is_demo: boolean;
  created_at: string | null;
}

interface Insights {
  summary: { revenue: number; orders: number; avgOrder: number; paidOrders: number; cancelledOrders: number };
  byDay: { date: string; revenue: number; orders: number }[];
  topProducts: { product_name: string; qty: number; revenue: number }[];
  byCategory: { category: string; revenue: number }[];
  byPayment: { method: string; count: number; revenue: number }[];
  pageViews: { today: number; last7: number; last30: number; topPages: { path: string; views: number }[] };
}

interface SavedTemplate {
  type: EmailTemplateType;
  product_id: string | null;
  subject: string;
  body: string;
  is_default: boolean;
}

type Msg = { tone: "ok" | "err" | "info"; text: string } | null;

/** Nút thao tác có trạng thái loading: bấm thì disable + spinner, xong báo kết quả. */
function ActionButton({
  busy,
  onClick,
  className = "btn-primary !py-2.5 text-sm",
  children,
}: {
  busy: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={busy} className={`${className} disabled:opacity-50 disabled:cursor-wait`}>
      {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="vd-card p-5">
      <div className="text-sm vd-muted">{label}</div>
      <div className={`font-display text-2xl font-black mt-1 ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-xs vd-muted mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const { catalog, refresh } = useCatalog();
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [settings, setSettings] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** busyKey: khóa nút đang chạy (vd "deliver:<itemId>", "save-product"). */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [gameForm, setGameForm] = useState<Record<string, { serial: string; pin: string; denomination: string; note: string }>>({});
  const [manualNote, setManualNote] = useState<Record<string, string>>({});

  const [editId, setEditId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  // Popup sửa/thêm biến thể: mở từ bảng gói gọn, lưu mới áp vào sản phẩm.
  const [variantModal, setVariantModal] = useState<{ index: number | null } | null>(null);
  const [variantDraft, setVariantDraft] = useState<Variant | null>(null);
  const [stockVariant, setStockVariant] = useState("");
  const [stockCodes, setStockCodes] = useState("");

  // Nội dung: danh mục / banner / FAQ
  const [editCats, setEditCats] = useState<Category[] | null>(null);
  const [editBanners, setEditBanners] = useState<Banner[] | null>(null);
  const [editFaqs, setEditFaqs] = useState<Faq[] | null>(null);

  // Kho mã: bảng mã đầy đủ
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [stockFilterVariant, setStockFilterVariant] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockShowUsed, setStockShowUsed] = useState(true);

  // Đơn hàng: lọc + tìm kiếm
  const [orderStatus, setOrderStatus] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // Báo cáo
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Mẫu email
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [tplType, setTplType] = useState<EmailTemplateType>("auto");
  const [tplProductId, setTplProductId] = useState("");
  const [tplSubject, setTplSubject] = useState(DEFAULT_TEMPLATES.auto.subject);
  const [tplBody, setTplBody] = useState(DEFAULT_TEMPLATES.auto.body);
  const [tplShowPreview, setTplShowPreview] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders", { headers: await adminHeaders() });
      const data = await res.json();
      if (res.ok) setOrders(data.orders);
      else setMsg({ tone: "err", text: data.error || "Không tải được đơn" });
    } catch {
      setMsg({ tone: "err", text: "Lỗi tải đơn" });
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const res = await fetch("/api/admin/settings", { headers: await adminHeaders() });
    if (res.ok) setSettings(await res.json());
  }

  async function loadStock() {
    const res = await fetch("/api/admin/stock", { headers: await adminHeaders() });
    if (res.ok) setStockRows((await res.json()).rows ?? []);
  }

  async function loadInsights(from: string, to: string) {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/admin/insights?from=${from}&to=${to}`, { headers: await adminHeaders() });
      if (res.ok) setInsights(await res.json());
    } finally {
      setInsightsLoading(false);
    }
  }

  async function loadTemplates() {
    const res = await fetch("/api/admin/email-templates", { headers: await adminHeaders() });
    if (res.ok) setTemplates((await res.json()).templates ?? []);
  }

  useEffect(() => {
    if (auth.isAdmin) {
      loadOrders();
      loadSettings();
      loadStock();
      loadInsights(reportFrom, reportTo);
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin]);

  // Số liệu thật cho Tổng quan: doanh thu chỉ tính đơn đã trả tiền trở đi.
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status !== "pending" && o.status !== "cancelled");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const waiting = orders.flatMap((o) => o.items).filter((i) => i.status === "waiting_manual").length;
    const stockRemaining = stockRows.filter((r) => !r.is_used).length;
    const demoCodes = stockRows.filter((r) => r.is_demo && !r.is_used).length;
    const reviewsTotal = catalog.products.reduce((s, p) => s + p.review_count, 0);
    return { revenue, totalOrders: orders.length, waiting, stockRemaining, demoCodes, reviewsTotal };
  }, [orders, stockRows, catalog.products]);

  // Cảnh báo kho: gói sắp hết mã (còn <= 3) — tính thật từ stock_rows.
  const lowStock = useMemo(() => {
    const byVariant = new Map<string, { product: string; variant: string; variantId: string; remaining: number }>();
    for (const p of catalog.products) {
      for (const v of p.variants) {
        if (v.fulfillment_type === "auto" || v.fulfillment_type === "link") {
          byVariant.set(v.id, { product: p.name, variant: v.label, variantId: v.id, remaining: 0 });
        }
      }
    }
    for (const r of stockRows) {
      if (!r.is_used) {
        const cur = byVariant.get(r.variant_id);
        if (cur) cur.remaining += 1;
      }
    }
    return [...byVariant.values()].filter((v) => v.remaining <= LOW_STOCK_AT);
  }, [catalog.products, stockRows]);

  // Hộp "Cần chú ý" gọn: mặc định chỉ hiện tóm tắt theo sản phẩm,
  // bấm mới mở chi tiết từng gói + nút thêm mã nhanh.
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [lowStockProduct, setLowStockProduct] = useState<string | null>(null);

  // Tóm tắt kho theo gói: tổng / đã dùng / còn lại (tính thật từ stock_rows).
  // PHẢI đặt trước các early return bên dưới (auth.loading / !user /
  // !isAdmin): hook mà nằm sau early return thì số hook thay đổi giữa
  // các lần render và React ném lỗi #310 khi vào /admin.
  const autoVariants = catalog.products.flatMap((p) =>
    p.variants.filter((v) => v.fulfillment_type === "auto" || v.fulfillment_type === "link").map((v) => ({ product: p, variant: v })),
  );
  const stockSummary = useMemo(() => {
    const map = new Map<string, { product: string; variant: string; total: number; used: number; remaining: number; demo: number }>();
    for (const { product, variant } of autoVariants) {
      map.set(variant.id, { product: product.name, variant: variant.label, total: 0, used: 0, remaining: 0, demo: 0 });
    }
    for (const r of stockRows) {
      const cur = map.get(r.variant_id);
      if (!cur) continue;
      cur.total += 1;
      if (r.is_used) cur.used += 1;
      else {
        cur.remaining += 1;
        if (r.is_demo) cur.demo += 1;
      }
    }
    return [...map.values()];
  }, [autoVariants, stockRows]);

  async function adminAction(action: string, orderCode: string, itemId: string, extra: Record<string, string> = {}) {
    const key = `${action}:${itemId}`;
    setBusyKey(key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ action, orderCode, itemId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error || "Thao tác thất bại — bấm lại để thử." });
        return;
      }
      setMsg({ tone: "ok", text: "Đã cập nhật đơn." });
      await loadOrders();
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveProduct() {
    if (!editProduct) return;
    setBusyKey("save-product");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ products: [editProduct] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error || "Lưu thất bại — bấm lại để thử." });
        return;
      }
      if (data.mode === "demo") {
        saveCatalogOverrides({
          products: catalog.products.map((p) => (p.id === editProduct.id ? editProduct : p)).concat(
            catalog.products.some((p) => p.id === editProduct.id) ? [] : [editProduct],
          ),
        });
        await refresh();
      } else {
        await refresh();
      }
      setMsg({ tone: "ok", text: `Đã lưu ${editProduct.name} (${data.mode}).` });
      setEditId(null);
      setEditProduct(null);
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveContent() {
    setBusyKey("save-content");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({
          categories: editCats ?? catalog.categories,
          banners: editBanners ?? catalog.banners,
          faqs: editFaqs ?? catalog.faqs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error || "Lưu thất bại — bấm lại để thử." });
        return;
      }
      if (data.mode === "demo") {
        saveCatalogOverrides({
          categories: editCats ?? undefined,
          banners: editBanners ?? undefined,
          faqs: editFaqs ?? undefined,
        });
        await refresh();
      } else {
        await refresh();
      }
      setMsg({ tone: "ok", text: `Đã lưu nội dung (${data.mode}).` });
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  async function addStock() {
    const codes = stockCodes.split("\n").map((c) => c.trim()).filter(Boolean);
    if (!stockVariant || !codes.length) {
      setMsg({ tone: "err", text: "Chọn gói và nhập ít nhất 1 mã (mỗi dòng 1 mã)." });
      return;
    }
    setBusyKey("add-stock");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ variantId: stockVariant, codes }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ tone: "ok", text: `Đã thêm ${data.added} mã (${data.mode}). ${data.note ?? ""}` });
        setStockCodes("");
        await loadStock();
      } else {
        setMsg({ tone: "err", text: data.error || "Lỗi thêm mã — bấm lại để thử." });
      }
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteStockCode(id: string, codeLabel: string) {
    if (!confirm(`Xoá mã ${codeLabel} khỏi kho? Mã chưa dùng mới xoá được.`)) return;
    setBusyKey(`del-stock:${id}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stock?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await adminHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ tone: "ok", text: `Đã xoá mã ${codeLabel}.` });
        await loadStock();
      } else {
        setMsg({ tone: "err", text: data.error || "Không xoá được mã." });
      }
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  /** Chọn mẫu email đang sửa: mẫu đã lưu thắng mẫu mặc định. */
  function selectTemplate(type: EmailTemplateType, productId: string) {
    setTplType(type);
    setTplProductId(productId);
    setTplShowPreview(false);
    const saved = templates.find((t) => t.type === type && (t.product_id ?? "") === productId);
    setTplSubject(saved?.subject ?? DEFAULT_TEMPLATES[type].subject);
    setTplBody(saved?.body ?? DEFAULT_TEMPLATES[type].body);
  }

  async function saveTemplate() {
    setBusyKey("save-template");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ type: tplType, product_id: tplProductId || null, subject: tplSubject, body: tplBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error || "Lưu mẫu thất bại." });
        return;
      }
      setMsg({ tone: "ok", text: "Đã lưu mẫu email." });
      await loadTemplates();
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  async function resetTemplate() {
    if (!confirm("Khôi phục mẫu này về mặc định của hệ thống?")) return;
    setBusyKey("reset-template");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ action: "reset", type: tplType, product_id: tplProductId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error || "Khôi phục thất bại." });
        return;
      }
      selectTemplate(tplType, tplProductId);
      setMsg({ tone: "ok", text: "Đã khôi phục mẫu mặc định." });
      await loadTemplates();
    } catch {
      setMsg({ tone: "err", text: "Lỗi mạng — bấm lại để thử." });
    } finally {
      setBusyKey(null);
    }
  }

  function exportReportCsv() {
    if (!insights) return;
    const lines = ["Ngay,Doanh thu (VND),So don"];
    for (const d of insights.byDay) lines.push(`${d.date},${d.revenue},${d.orders}`);
    lines.push("");
    lines.push("San pham ban chay,So luong,Doanh thu (VND)");
    for (const p of insights.topProducts) lines.push(`"${p.product_name.replace(/"/g, '""')}",${p.qty},${p.revenue}`);
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-${reportFrom}-${reportTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (auth.loading) return <p className="mt-10 vd-muted">Đang kiểm tra quyền…</p>;
  if (!auth.user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="font-display text-2xl font-black">Quản trị VDigital</h1>
        <p className="vd-muted mt-2">Khu vực này chỉ dành cho admin. Đăng nhập bằng email admin để tiếp tục.</p>
        {!isSupabaseConfigured && (
          <button
            onClick={() => auth.demoSignIn("admin@vdigital.vn")}
            className="btn-primary mt-6"
          >
            Vào admin demo
          </button>
        )}
        <p className="text-xs vd-muted2 mt-3">
          Chế độ demo (chưa cấu hình Supabase). Khi có Supabase, admin đăng nhập bằng email trong ADMIN_EMAILS
          (mặc định contact.hotavinh@gmail.com).
        </p>
      </div>
    );
  }
  if (!auth.isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="font-display text-2xl font-black">Không có quyền</h1>
        <p className="vd-muted mt-2">
          Email {auth.user.email} không nằm trong danh sách admin. Thêm email này vào biến môi trường ADMIN_EMAILS.
        </p>
      </div>
    );
  }

  const cats = editCats ?? catalog.categories;
  const banners = editBanners ?? catalog.banners;
  const faqs = editFaqs ?? catalog.faqs;

  const filteredOrders = orders.filter((o) => {
    if (orderStatus && o.status !== orderStatus) return false;
    if (orderSearch.trim()) {
      const needle = orderSearch.trim().toLowerCase();
      const hay = `${o.code} ${o.customer_name} ${o.customer_email} ${o.customer_phone}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const filteredStockRows = stockRows.filter((r) => {
    if (stockFilterVariant && r.variant_id !== stockFilterVariant) return false;
    if (!stockShowUsed && r.is_used) return false;
    if (stockSearch.trim() && !r.code.toLowerCase().includes(stockSearch.trim().toLowerCase()) && !(r.order_code ?? "").toLowerCase().includes(stockSearch.trim().toLowerCase())) return false;
    return true;
  });

  const reportMaxRevenue = Math.max(1, ...(insights?.byDay.map((d) => d.revenue) ?? [1]));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-black tracking-tight">Quản trị VDigital</h1>
        <span className="text-xs rounded-full vd-card-flat px-3 py-1">
          {isSupabaseConfigured ? "Supabase: đã cấu hình" : "Chế độ demo — chưa cấu hình Supabase"}
        </span>
      </div>
      {msg && (
        <p
          role="status"
          className={`mt-3 text-sm rounded-lg px-3 py-2 ${
            msg.tone === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-300"
              : msg.tone === "err"
                ? "bg-red-500/10 border border-red-500/40 text-red-300"
                : "vd-card-flat"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex gap-1 border-b vd-border mt-4 overflow-x-auto">
        {(
          [
            { key: "overview", label: "Tổng quan" },
            { key: "orders", label: `Đơn hàng (${orders.length})` },
            { key: "products", label: "Sản phẩm" },
            { key: "stock", label: "Kho mã" },
            { key: "reports", label: "Báo cáo" },
            { key: "content", label: "Danh mục · Banner · FAQ" },
            { key: "emails", label: "Mẫu email" },
            { key: "settings", label: "Cài đặt" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-btn ${tab === t.key ? "!border-brand-500 text-brand-400" : "!border-transparent vd-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Doanh thu (đơn đã thanh toán)" value={formatVND(stats.revenue)} sub={`${insights?.summary.paidOrders ?? 0} đơn đã trả tiền · TB ${formatVND(insights?.summary.avgOrder ?? 0)}/đơn`} accent="text-brand-400" />
            <StatCard label="Tổng đơn" value={String(stats.totalOrders)} sub={`${orders.filter((o) => o.status === "pending").length} đơn chờ thanh toán`} />
            <StatCard label="Mục chờ xử lý tay" value={String(stats.waiting)} sub="Gói làm tay + thẻ game chưa giao — xử lý ở tab Đơn hàng" accent="text-amber-400" />
            <StatCard label="Mã còn trong kho" value={String(stats.stockRemaining)} sub={`${catalog.products.length} sản phẩm đang bán · ${stats.reviewsTotal} đánh giá`} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Lượt xem hôm nay" value={String(insights?.pageViews.today ?? 0)} sub="Từ bảng page_views (tự ghi khi khách mở trang)" />
            <StatCard label="Lượt xem 7 ngày" value={String(insights?.pageViews.last7 ?? 0)} />
            <StatCard label="Lượt xem 30 ngày" value={String(insights?.pageViews.last30 ?? 0)} />
          </div>
          {(lowStock.length > 0 || stats.demoCodes > 0) && (
            <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-amber-300">
                  Cần chú ý
                  {lowStock.length > 0 && (
                    <span className="font-normal text-amber-200/90"> — {lowStock.length} gói sắp hết mã (≤ {LOW_STOCK_AT} mã)</span>
                  )}
                </p>
                {lowStock.length > 0 && (
                  <button onClick={() => setLowStockOpen(!lowStockOpen)} className="btn-outline !py-1.5 !px-3 text-xs">
                    {lowStockOpen ? "Thu gọn" : "Xem chi tiết"}
                  </button>
                )}
              </div>
              {lowStockOpen &&
                (() => {
                  const groups = new Map<string, typeof lowStock>();
                  for (const v of lowStock) {
                    const g = groups.get(v.product) ?? [];
                    g.push(v);
                    groups.set(v.product, g);
                  }
                  return [...groups.entries()].map(([product, items]) => {
                    const minRemaining = Math.min(...items.map((i) => i.remaining));
                    const expanded = lowStockProduct === product;
                    return (
                      <div key={product} className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2">
                        <button
                          className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
                          onClick={() => setLowStockProduct(expanded ? null : product)}
                        >
                          <span>
                            <b>{product}</b>
                            <span className="vd-muted"> — {items.length} gói sắp hết, ít nhất còn {minRemaining} mã</span>
                          </span>
                          <span className="text-xs vd-muted">{expanded ? "Thu gọn" : "Chi tiết"}</span>
                        </button>
                        {expanded && (
                          <div className="mt-2 space-y-1.5 border-t border-amber-500/20 pt-2">
                            {items.map((v) => (
                              <div key={v.variantId} className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  {v.variant} — còn <b>{v.remaining} mã</b>
                                </span>
                                <button
                                  onClick={() => {
                                    setStockVariant(v.variantId);
                                    setTab("stock");
                                  }}
                                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-black"
                                >
                                  + Thêm mã
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              {stats.demoCodes > 0 && (
                <p className="mt-2">
                  Còn <b>{stats.demoCodes} mã demo (VD-DEMO-)</b> chưa dùng trong kho — thay bằng mã thật trước khi bán.
                </p>
              )}
            </div>
          )}
          <p className="text-sm vd-muted">
            Doanh thu chỉ tính đơn đã trả tiền trở đi (paid / processing / completed) — đơn chờ thanh toán và đơn hủy không tính.
            Lượt xem chỉ đếm đường dẫn trang, không lưu IP hay thông tin cá nhân.
          </p>
        </div>
      )}

      {tab === "orders" && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="field !w-auto" aria-label="Lọc theo trạng thái">
              <option value="">Tất cả trạng thái</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Tìm mã đơn / tên / email / SĐT…" className="field !w-64" />
            <ActionButton busy={loading} onClick={loadOrders} className="btn-outline !py-2 text-sm">
              {loading ? "Đang tải…" : "Tải lại đơn"}
            </ActionButton>
            <span className="text-sm vd-muted">{filteredOrders.length} đơn</span>
          </div>
          {filteredOrders.length === 0 && <p className="vd-muted">Không có đơn nào khớp bộ lọc.</p>}
          {filteredOrders.map((o) => (
            <div key={o.id} className="vd-card p-4">
              <button className="w-full flex flex-wrap justify-between gap-2 text-left" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <span className="font-mono font-bold">{o.code}</span>
                <span className="text-sm vd-muted">{o.customer_name} — {o.customer_email}</span>
                <span className="text-sm">{formatDateTime(o.created_at)}</span>
                <b className="text-brand-400">{formatVND(o.total)}</b>
                <span className="text-xs rounded-full vd-surface2 px-2 py-1">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
              </button>
              {expanded === o.id && (
                <div className="mt-3 space-y-3 border-t vd-border pt-3">
                  <p className="text-sm vd-muted">
                    Khách: {o.customer_name} · {o.customer_email} · {o.customer_phone || "—"} · Thanh toán: {o.payment_method === "manual-bank" ? "Chuyển khoản ngân hàng" : "VietQR (PayOS)"}
                  </p>
                  {o.items.map((item) => {
                    const gf = gameForm[item.id] ?? { serial: "", pin: "", denomination: item.variant_name, note: "" };
                    const variant = catalog.products.flatMap((p) => p.variants).find((v) => v.id === item.variant_id);
                    const fieldLabel = new Map((variant?.manual_fields ?? []).map((f) => [f.id, f.label]));
                    return (
                      <div key={item.id} className="vd-card-flat p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <b>{item.product_name} — {item.variant_name}</b>
                          <span>{formatVND(item.price)} × {item.quantity}</span>
                          <span className="vd-muted">{item.fulfillment_type} · {item.status}</span>
                        </div>
                        {item.delivered_code && <p className="mt-1">Mã đã giao: <code className="font-mono vd-surface2 px-2 py-0.5 rounded">{item.delivered_code}</code></p>}
                        {item.delivered_serial && <p className="mt-1">Serial: <code className="font-mono">{item.delivered_serial}</code> · Mã: <code className="font-mono">{item.delivered_pin}</code></p>}
                        {item.delivered_note && <p className="mt-1 vd-muted">{item.delivered_note}</p>}
                        {item.customer_info && Object.entries(item.customer_info).filter(([, v]) => String(v ?? "").trim()).length > 0 && (
                          <div className="mt-2 rounded-lg vd-surface2 p-3">
                            <p className="font-semibold text-xs uppercase tracking-wide vd-muted">Thông tin khách đã cung cấp (xử lý tay)</p>
                            {Object.entries(item.customer_info)
                              .filter(([, v]) => String(v ?? "").trim())
                              .map(([k, v]) => (
                                <p key={k} className="mt-1">
                                  {fieldLabel.get(k) ?? k}: <b>{String(v)}</b>
                                </p>
                              ))}
                          </div>
                        )}

                        {item.status === "waiting_manual" && item.fulfillment_type === "game_card" && (
                          <div className="mt-3 grid sm:grid-cols-2 gap-2">
                            <input value={gf.serial} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, serial: e.target.value } })} placeholder="Serial thẻ *" className="field" />
                            <input value={gf.pin} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, pin: e.target.value } })} placeholder="Mã nạp (code/pin) *" className="field" />
                            <input value={gf.denomination} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, denomination: e.target.value } })} placeholder="Mệnh giá (tự theo gói, sửa được)" className="field" />
                            <input value={gf.note} onChange={(e) => setGameForm({ ...gameForm, [item.id]: { ...gf, note: e.target.value } })} placeholder="Ghi chú cho khách (tuỳ chọn)" className="field" />
                            <ActionButton
                              busy={busyKey === `deliver-game-card:${item.id}`}
                              onClick={() => adminAction("deliver-game-card", o.code, item.id, gf)}
                              className="btn-primary sm:col-span-2 !py-2.5 text-sm"
                            >
                              {busyKey === `deliver-game-card:${item.id}` ? "Đang giao…" : "Giao + gửi mail cho khách"}
                            </ActionButton>
                            <p className="sm:col-span-2 text-xs vd-muted2">Mệnh giá tự điền theo gói đã mua — sửa lại nếu thẻ thực tế khác mệnh giá gói.</p>
                          </div>
                        )}

                        {item.status === "waiting_manual" && item.fulfillment_type === "manual" && (
                          <div className="mt-3 flex gap-2">
                            <input value={manualNote[item.id] ?? ""} onChange={(e) => setManualNote({ ...manualNote, [item.id]: e.target.value })} placeholder="Ghi chú hoàn thành (vd: đã thêm vào Family xong)" className="field flex-1" />
                            <ActionButton
                              busy={busyKey === `complete-manual:${item.id}`}
                              onClick={() => adminAction("complete-manual", o.code, item.id, { note: manualNote[item.id] ?? "" })}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold text-white disabled:opacity-50 disabled:cursor-wait"
                            >
                              {busyKey === `complete-manual:${item.id}` ? "Đang lưu…" : "Hoàn thành"}
                            </ActionButton>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div className="mt-5 grid lg:grid-cols-[300px_1fr] gap-5 items-start">
          <div className="space-y-2">
            <button
              onClick={() => {
                const p = newProduct();
                setEditId(p.id);
                setEditProduct(p);
              }}
              className="btn-primary w-full !py-2.5 text-sm"
            >
              + Thêm sản phẩm mới
            </button>
            {catalog.products.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setEditId(p.id);
                  setEditProduct(JSON.parse(JSON.stringify(p)));
                }}
                className={`block w-full text-left rounded-xl border px-3 py-2.5 text-sm ${editId === p.id ? "border-brand-500 bg-brand-500/10" : "vd-border vd-card-flat"}`}
              >
                <b>{p.name}</b>
                <span className="block text-xs vd-muted">
                  {p.variants.length} gói · đã bán {formatSold(p.sold_count)}
                  {p.review_count > 0 ? ` · ★ ${p.rating} (${p.review_count})` : " · chưa có đánh giá"} · {p.is_active ? "đang bán" : "đã ẩn"}
                </span>
              </button>
            ))}
          </div>
          <div>
            {!editProduct ? (
              <p className="vd-muted">Chọn sản phẩm bên trái để sửa — hoặc bấm “Thêm sản phẩm mới” để tạo sản phẩm không cần sửa code.</p>
            ) : (
              <div className="vd-card p-4 space-y-4">
                <h3 className="font-display font-bold text-lg">Sửa: {editProduct.name}</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="field-label">Tên sản phẩm *</span>
                    <input value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} className="field" />
                  </label>
                  <label className="block">
                    <span className="field-label">Slug (đường dẫn)</span>
                    <input value={editProduct.slug} onChange={(e) => setEditProduct({ ...editProduct, slug: slugify(e.target.value) })} className="field" />
                  </label>
                  <label className="block">
                    <span className="field-label">Danh mục</span>
                    <select value={editProduct.category_id} onChange={(e) => setEditProduct({ ...editProduct, category_id: e.target.value })} className="field">
                      {catalog.categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Loại sản phẩm</span>
                    <select value={editProduct.product_type} onChange={(e) => setEditProduct({ ...editProduct, product_type: e.target.value as never })} className="field">
                      {PRODUCT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Loại tài khoản</span>
                    <select value={editProduct.account_type} onChange={(e) => setEditProduct({ ...editProduct, account_type: e.target.value as never })} className="field">
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Bảo hành (ngày)</span>
                    <input type="number" value={editProduct.warranty_days} onChange={(e) => setEditProduct({ ...editProduct, warranty_days: Number(e.target.value) })} className="field" />
                  </label>
                </div>
                <label className="block">
                  <span className="field-label">Mô tả ngắn</span>
                  <input value={editProduct.tagline} onChange={(e) => setEditProduct({ ...editProduct, tagline: e.target.value })} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Mô tả chi tiết</span>
                  <textarea rows={3} value={editProduct.description} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Hướng dẫn sử dụng</span>
                  <textarea rows={3} value={editProduct.guide} onChange={(e) => setEditProduct({ ...editProduct, guide: e.target.value })} className="field" />
                </label>
                <ImageUpload
                  kind="products"
                  label="Ảnh bìa sản phẩm"
                  value={editProduct.image_url}
                  onChange={(url) => setEditProduct({ ...editProduct, image_url: url })}
                />
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_featured} onChange={(e) => setEditProduct({ ...editProduct, is_featured: e.target.checked })} className="accent-violet-600" /> Nổi bật</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_new} onChange={(e) => setEditProduct({ ...editProduct, is_new: e.target.checked })} className="accent-violet-600" /> Mới</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_best_seller} onChange={(e) => setEditProduct({ ...editProduct, is_best_seller: e.target.checked })} className="accent-violet-600" /> Bán chạy</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.is_active} onChange={(e) => setEditProduct({ ...editProduct, is_active: e.target.checked })} className="accent-violet-600" /> Đang bán</label>
                </div>

                <h4 className="font-bold pt-2">Các gói (biến thể) — mỗi gói có cách giao riêng</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b vd-border vd-muted">
                        <th className="py-2 pr-2 font-semibold">Gói</th>
                        <th className="py-2 pr-2 font-semibold">Giá bán</th>
                        <th className="py-2 pr-2 font-semibold">Cách giao</th>
                        <th className="py-2 pr-2 font-semibold">Trạng thái</th>
                        <th className="py-2 text-right font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editProduct.variants.map((v, i) => (
                        <tr key={v.id} className="border-b vd-border">
                          <td className="py-2 pr-2">
                            <b>{v.label}</b>
                            {(v.manual_fields ?? []).length > 0 && (
                              <span className="block text-xs vd-muted">+ {(v.manual_fields ?? []).length} ô thông tin khách</span>
                            )}
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {formatVND(v.price)}
                            {v.original_price > v.price && (
                              <span className="block text-xs vd-muted line-through">{formatVND(v.original_price)}</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">{FULFILLMENT_TYPES.find((t) => t.value === v.fulfillment_type)?.label ?? v.fulfillment_type}</td>
                          <td className="py-2 pr-2">
                            {v.is_flash && <span className="text-xs rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 mr-1">Flash</span>}
                            <span className="text-xs">{v.is_active ? "Đang bán" : "Đã ẩn"}</span>
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setVariantDraft(JSON.parse(JSON.stringify(v)));
                                setVariantModal({ index: i });
                              }}
                              className="text-sm font-semibold text-brand-400 hover:underline mr-3"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditProduct({ ...editProduct, variants: editProduct.variants.filter((x) => x.id !== v.id) })}
                              className="text-sm text-red-400 hover:underline"
                            >
                              Xoá
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editProduct.variants.length === 0 && (
                    <p className="vd-muted text-sm py-3">Chưa có gói nào — bấm “+ Thêm gói” để tạo gói đầu tiên.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVariantDraft(newVariant(editProduct.id, editProduct.variants.length + 1));
                    setVariantModal({ index: null });
                  }}
                  className="btn-outline !py-2 text-sm"
                >
                  + Thêm gói
                </button>
                <div className="flex gap-2 pt-1">
                  <ActionButton busy={busyKey === "save-product"} onClick={saveProduct}>
                    {busyKey === "save-product" ? "Đang lưu…" : "Lưu sản phẩm"}
                  </ActionButton>
                  <button onClick={() => { setEditId(null); setEditProduct(null); }} className="btn-outline !py-2.5 text-sm">Huỷ</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popup sửa/thêm biến thể — chỉ mở khi bấm Sửa / + Thêm gói ở bảng trên. */}
      {variantModal && variantDraft && editProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="vd-card w-full max-w-2xl p-5 my-8 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-lg">
                {variantModal.index === null ? "Thêm gói mới" : `Sửa gói: ${variantDraft.label || "chưa đặt tên"}`}
              </h3>
              <button
                type="button"
                onClick={() => { setVariantModal(null); setVariantDraft(null); }}
                className="rounded-lg vd-card-flat px-3 py-1.5 text-sm font-bold"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            {(() => {
              const v = variantDraft;
              const setV = (patch: Partial<Variant>) => setVariantDraft({ ...variantDraft, ...patch });
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="field-label">Nhãn gói *</span>
                      <input value={v.label} onChange={(e) => setV({ label: e.target.value, name: e.target.value })} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Giá bán (đ)</span>
                      <input type="number" value={v.price} onChange={(e) => setV({ price: Number(e.target.value) })} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Giá gốc (đ)</span>
                      <input type="number" value={v.original_price} onChange={(e) => setV({ original_price: Number(e.target.value) })} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Tồn kho (trống = không giới hạn)</span>
                      <input type="number" value={v.stock_count ?? ""} onChange={(e) => setV({ stock_count: e.target.value === "" ? null : Number(e.target.value) })} className="field" placeholder="Không giới hạn" />
                    </label>
                    <label className="block">
                      <span className="field-label">Loại lựa chọn</span>
                      <select value={v.option_type} onChange={(e) => setV({ option_type: e.target.value as never })} className="field">
                        {OPTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">Nhãn nhóm lựa chọn (tuỳ chọn)</span>
                      <input value={v.option_label ?? ""} onChange={(e) => setV({ option_label: e.target.value || null })} className="field" placeholder="vd: Chọn mệnh giá" />
                    </label>
                    <label className="block">
                      <span className="field-label">Cách giao hàng</span>
                      <select value={v.fulfillment_type} onChange={(e) => setV({ fulfillment_type: e.target.value as never })} className="field">
                        {FULFILLMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">Hết Flash lúc (để trống = không)</span>
                      <input
                        type="datetime-local"
                        value={v.flash_ends_at ? v.flash_ends_at.slice(0, 16) : ""}
                        onChange={(e) => setV({ is_flash: !!e.target.value, flash_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="field"
                      />
                    </label>
                  </div>
                  {(v.fulfillment_type === "link" || v.fulfillment_type === "auto") && (
                    <label className="block">
                      <span className="field-label">Mẫu giao hàng (chỉ cho loại “Link / key” — có thể chứa {"{code}"})</span>
                      <input value={v.delivery_template ?? ""} onChange={(e) => setV({ delivery_template: e.target.value || null })} className="field" placeholder="vd: https://example.com/activate?key={code}" />
                    </label>
                  )}
                  <label className="block">
                    <span className="field-label">Ghi chú giao hàng cho gói này</span>
                    <input value={v.delivery_note ?? ""} onChange={(e) => setV({ delivery_note: e.target.value || null })} className="field" placeholder="vd: Dùng email của bạn để nhận lời mời Family" />
                  </label>
                  {v.fulfillment_type === "manual" && (
                    <div className="rounded-xl border vd-border p-3 space-y-2">
                      <p className="font-semibold text-sm">Thông tin khách cần cung cấp <span className="vd-muted font-normal">(hiện ở trang thanh toán khi mua gói này)</span></p>
                      {(v.manual_fields ?? []).map((f: ManualField, fi: number) => {
                        const setF = (patch: Partial<ManualField>) => {
                          const fields = [...(v.manual_fields ?? [])];
                          fields[fi] = { ...f, ...patch };
                          setV({ manual_fields: fields });
                        };
                        return (
                          <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto_auto] gap-2 items-end">
                            <label className="block">
                              <span className="field-label">Nhãn ô *</span>
                              <input value={f.label} onChange={(e) => setF({ label: e.target.value })} className="field" placeholder="vd: Email cần add vào Family" />
                            </label>
                            <label className="block">
                              <span className="field-label">Loại</span>
                              <select value={f.type} onChange={(e) => setF({ type: e.target.value as ManualField["type"] })} className="field">
                                <option value="text">Chữ</option>
                                <option value="email">Email</option>
                                <option value="number">Số</option>
                                <option value="textarea">Đoạn dài</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2 text-sm pb-2.5">
                              <input type="checkbox" checked={f.required} onChange={(e) => setF({ required: e.target.checked })} className="accent-violet-600" /> Bắt buộc
                            </label>
                            <button type="button" onClick={() => setV({ manual_fields: (v.manual_fields ?? []).filter((x) => x.id !== f.id) })} className="text-sm text-red-400 hover:underline pb-2.5">
                              Xoá
                            </button>
                            <label className="block sm:col-span-4">
                              <span className="field-label">Gợi ý (placeholder)</span>
                              <input value={f.placeholder ?? ""} onChange={(e) => setF({ placeholder: e.target.value })} className="field" placeholder="vd: ban@gmail.com" />
                            </label>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setV({
                            manual_fields: [
                              ...(v.manual_fields ?? []),
                              { id: `mf-${Date.now()}`, label: "", type: "text", required: true, placeholder: "" },
                            ],
                          })
                        }
                        className="btn-outline !py-1.5 text-xs"
                      >
                        + Thêm ô thông tin
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={v.is_flash} onChange={(e) => setV({ is_flash: e.target.checked })} className="accent-violet-600" /> Flash Sale</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ is_active: e.target.checked })} className="accent-violet-600" /> Đang bán</label>
                  </div>
                </>
              );
            })()}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="btn-primary !py-2.5 text-sm"
                onClick={() => {
                  const vs = [...editProduct.variants];
                  if (variantModal.index === null) vs.push(variantDraft);
                  else vs[variantModal.index] = variantDraft;
                  setEditProduct({ ...editProduct, variants: vs });
                  setVariantModal(null);
                  setVariantDraft(null);
                }}
              >
                Lưu gói
              </button>
              <button
                type="button"
                onClick={() => { setVariantModal(null); setVariantDraft(null); }}
                className="btn-outline !py-2.5 text-sm"
              >
                Huỷ
              </button>
              {variantModal.index !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditProduct({ ...editProduct, variants: editProduct.variants.filter((x) => x.id !== variantDraft.id) });
                    setVariantModal(null);
                    setVariantDraft(null);
                  }}
                  className="ml-auto text-sm text-red-400 hover:underline self-center"
                >
                  Xoá gói
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="mt-5 space-y-5">
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Tóm tắt kho theo gói</h3>
            <p className="text-xs vd-muted mt-1">Tính thật từ bảng stock_codes (tổng / đã giao / còn lại). Gói còn ≤ {LOW_STOCK_AT} mã được tô vàng.</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b vd-border vd-muted">
                    <th className="py-2 pr-3 font-semibold">Gói</th>
                    <th className="py-2 pr-3 font-semibold text-right">Tổng</th>
                    <th className="py-2 pr-3 font-semibold text-right">Đã giao</th>
                    <th className="py-2 pr-3 font-semibold text-right">Còn lại</th>
                    <th className="py-2 font-semibold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.map((s) => (
                    <tr key={s.product + s.variant} className="border-b vd-border last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">{s.product} — {s.variant}</td>
                      <td className="py-2 pr-3 text-right">{s.total}</td>
                      <td className="py-2 pr-3 text-right">{s.used}</td>
                      <td className={`py-2 pr-3 text-right font-bold ${s.remaining <= LOW_STOCK_AT ? "text-amber-400" : "text-emerald-400"}`}>{s.remaining}</td>
                      <td className="py-2 text-xs vd-muted">
                        {s.remaining <= LOW_STOCK_AT ? "Sắp hết mã — bổ sung ngay" : ""}
                        {s.demo > 0 ? ` Còn ${s.demo} mã demo` : ""}
                      </td>
                    </tr>
                  ))}
                  {stockSummary.length === 0 && (
                    <tr><td colSpan={5} className="py-4 vd-muted">Chưa có gói giao tự động nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Thêm mã vào kho</h3>
            <p className="text-sm vd-muted mt-1">
              Kho mã dùng cho các gói giao tự động (auto). Khi khách thanh toán, hệ thống lấy mã cũ nhất chưa dùng để giao.
              Mã demo trong seed có tiền tố VD-DEMO — thay bằng mã thật trước khi bán.
            </p>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="field-label">Chọn gói giao tự động / link</span>
                <select value={stockVariant} onChange={(e) => setStockVariant(e.target.value)} className="field">
                  <option value="">— Chọn gói —</option>
                  {autoVariants.map(({ product, variant }) => (
                    <option key={variant.id} value={variant.id}>{product.name} — {variant.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Danh sách mã (mỗi dòng 1 mã)</span>
                <textarea rows={4} value={stockCodes} onChange={(e) => setStockCodes(e.target.value)} placeholder={"VD-XXXX-0001\nVD-XXXX-0002"} className="field font-mono" />
              </label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <ActionButton busy={busyKey === "add-stock"} onClick={addStock}>
                {busyKey === "add-stock" ? "Đang thêm…" : "Thêm vào kho"}
              </ActionButton>
              {stockCodes.trim() && (
                <span className="text-sm vd-muted">Sẽ thêm {stockCodes.split("\n").map((c) => c.trim()).filter(Boolean).length} mã.</span>
              )}
            </div>
          </div>

          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Danh sách mã</h3>
            <p className="text-xs vd-muted mt-1">Mã đã giao chỉ hiện dạng che + mã đơn — không hiện nguyên mã để tránh lộ.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <select value={stockFilterVariant} onChange={(e) => setStockFilterVariant(e.target.value)} className="field !w-auto" aria-label="Lọc theo gói">
                <option value="">Tất cả gói</option>
                {autoVariants.map(({ product, variant }) => (
                  <option key={variant.id} value={variant.id}>{product.name} — {variant.label}</option>
                ))}
              </select>
              <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Tìm mã / mã đơn…" className="field !w-56" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={stockShowUsed} onChange={(e) => setStockShowUsed(e.target.checked)} className="accent-violet-600" />
                Hiện mã đã giao
              </label>
              <span className="text-sm vd-muted ml-auto">{filteredStockRows.length} mã</span>
            </div>
            <div className="overflow-x-auto mt-3 max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
                  <tr className="border-b vd-border vd-muted">
                    <th className="py-2 pr-3 font-semibold">Mã</th>
                    <th className="py-2 pr-3 font-semibold">Gói</th>
                    <th className="py-2 pr-3 font-semibold">Trạng thái</th>
                    <th className="py-2 pr-3 font-semibold">Đơn</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {filteredStockRows.slice(0, 300).map((r) => (
                    <tr key={r.id} className="border-b vd-border last:border-b-0">
                      <td className="py-2 pr-3 font-mono text-xs break-all">
                        {r.code}
                        {r.is_demo && !r.is_used && <span className="ml-2 rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">DEMO</span>}
                      </td>
                      <td className="py-2 pr-3">{r.product_name} — {r.variant_name}</td>
                      <td className="py-2 pr-3">
                        {r.is_used ? <span className="text-slate-400">Đã giao</span> : <span className="text-emerald-400 font-semibold">Chưa dùng</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.order_code ?? "—"}</td>
                      <td className="py-2 text-right">
                        {!r.is_used && (
                          <button
                            onClick={() => deleteStockCode(r.id, r.code)}
                            disabled={busyKey === `del-stock:${r.id}`}
                            className="text-sm text-red-400 hover:underline disabled:opacity-50"
                          >
                            {busyKey === `del-stock:${r.id}` ? "Đang xoá…" : "Xoá"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredStockRows.length === 0 && (
                    <tr><td colSpan={5} className="py-4 vd-muted">Không có mã nào khớp bộ lọc.</td></tr>
                  )}
                </tbody>
              </table>
              {filteredStockRows.length > 300 && (
                <p className="text-xs vd-muted mt-2">Đang hiện 300/{filteredStockRows.length} mã — thu hẹp bộ lọc để xem hết.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="mt-5 space-y-5">
          <div className="vd-card p-4 flex flex-wrap gap-2 items-end">
            <div>
              <span className="field-label">Từ ngày</span>
              <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="field !w-auto" />
            </div>
            <div>
              <span className="field-label">Đến ngày</span>
              <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="field !w-auto" />
            </div>
            <ActionButton busy={insightsLoading} onClick={() => loadInsights(reportFrom, reportTo)} className="btn-outline !py-2.5 text-sm">
              {insightsLoading ? "Đang tải…" : "Xem báo cáo"}
            </ActionButton>
            {[
              { label: "7 ngày", days: 7 },
              { label: "30 ngày", days: 30 },
              { label: "90 ngày", days: 90 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  const to = new Date().toISOString().slice(0, 10);
                  const from = new Date(Date.now() - (p.days - 1) * 86400_000).toISOString().slice(0, 10);
                  setReportFrom(from);
                  setReportTo(to);
                  loadInsights(from, to);
                }}
                className="btn-outline !py-2.5 text-sm"
              >
                {p.label}
              </button>
            ))}
            <button onClick={exportReportCsv} disabled={!insights} className="btn-primary !py-2.5 text-sm disabled:opacity-40">
              Xuất Excel / CSV
            </button>
          </div>

          {!insights ? (
            <p className="vd-muted">Đang tải báo cáo…</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Doanh thu" value={formatVND(insights.summary.revenue)} sub={`${insights.summary.paidOrders} đơn đã trả tiền`} accent="text-brand-400" />
                <StatCard label="Tổng đơn" value={String(insights.summary.orders)} sub={`${insights.summary.cancelledOrders} đơn hủy`} />
                <StatCard label="Đơn trung bình" value={formatVND(insights.summary.avgOrder)} />
                <StatCard label="Lượt xem (30 ngày)" value={String(insights.pageViews.last30)} sub={`Hôm nay: ${insights.pageViews.today}`} />
              </div>

              <div className="vd-card p-4">
                <h3 className="font-display font-bold">Doanh thu theo ngày</h3>
                <div className="mt-4 flex items-end gap-1 h-40">
                  {insights.byDay.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${formatVND(d.revenue)} · ${d.orders} đơn`}>
                      <div
                        className="w-full max-w-6 rounded-t bg-brand-600"
                        style={{ height: `${Math.max(d.revenue > 0 ? 4 : 0, (d.revenue / reportMaxRevenue) * 140)}px` }}
                      />
                      <span className="text-[9px] vd-muted2 truncate">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs vd-muted mt-2">Rê chuột vào cột để xem doanh thu từng ngày. Ngày không có đơn thì cột bằng 0.</p>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="vd-card p-4">
                  <h3 className="font-display font-bold">Top sản phẩm bán chạy</h3>
                  {insights.topProducts.length === 0 ? (
                    <p className="text-sm vd-muted mt-2">Chưa có đơn đã thanh toán trong khoảng này.</p>
                  ) : (
                    <table className="w-full text-sm text-left mt-2">
                      <thead>
                        <tr className="border-b vd-border vd-muted">
                          <th className="py-2 pr-3 font-semibold">Sản phẩm</th>
                          <th className="py-2 pr-3 font-semibold text-right">SL</th>
                          <th className="py-2 font-semibold text-right">Doanh thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.topProducts.map((p) => (
                          <tr key={p.product_name} className="border-b vd-border last:border-b-0">
                            <td className="py-2 pr-3 font-semibold">{p.product_name}</td>
                            <td className="py-2 pr-3 text-right">{p.qty}</td>
                            <td className="py-2 text-right">{formatVND(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="vd-card p-4">
                    <h3 className="font-display font-bold">Doanh thu theo danh mục</h3>
                    {insights.byCategory.length === 0 ? (
                      <p className="text-sm vd-muted mt-2">Chưa có dữ liệu.</p>
                    ) : (
                      insights.byCategory.map((c) => (
                        <div key={c.category} className="flex justify-between text-sm mt-2">
                          <span>{c.category}</span>
                          <b>{formatVND(c.revenue)}</b>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="vd-card p-4">
                    <h3 className="font-display font-bold">Doanh thu theo phương thức thanh toán</h3>
                    {insights.byPayment.length === 0 ? (
                      <p className="text-sm vd-muted mt-2">Chưa có dữ liệu.</p>
                    ) : (
                      insights.byPayment.map((p) => (
                        <div key={p.method} className="flex justify-between text-sm mt-2">
                          <span>{p.method} ({p.count} đơn)</span>
                          <b>{formatVND(p.revenue)}</b>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="vd-card p-4">
                    <h3 className="font-display font-bold">Trang xem nhiều nhất (30 ngày)</h3>
                    {insights.pageViews.topPages.length === 0 ? (
                      <p className="text-sm vd-muted mt-2">Chưa ghi nhận lượt xem nào — cần chạy migration 006 để tạo bảng page_views.</p>
                    ) : (
                      insights.pageViews.topPages.map((p) => (
                        <div key={p.path} className="flex justify-between text-sm mt-2">
                          <span className="font-mono text-xs break-all">{p.path}</span>
                          <b>{p.views} lượt</b>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "content" && (
        <div className="mt-5 space-y-6">
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Danh mục</h3>
            <p className="text-xs vd-muted mt-1">Icon: nhập tên icon Lucide (vd: KeyRound, Gamepad2) hoặc để trống. Ảnh: up ảnh đại diện cho danh mục.</p>
            <div className="space-y-3 mt-3">
              {cats.map((c, i) => (
                <div key={c.id} className="vd-card-flat p-3 grid sm:grid-cols-4 gap-2">
                  <input value={c.name} onChange={(e) => { const n = [...cats]; n[i] = { ...c, name: e.target.value, slug: slugify(e.target.value) }; setEditCats(n); }} className="field" aria-label="Tên danh mục" />
                  <input value={c.slug} onChange={(e) => { const n = [...cats]; n[i] = { ...c, slug: slugify(e.target.value) }; setEditCats(n); }} className="field" aria-label="Slug" />
                  <input value={c.icon ?? ""} onChange={(e) => { const n = [...cats]; n[i] = { ...c, icon: e.target.value || null }; setEditCats(n); }} className="field" placeholder="Icon (vd: Gamepad2)" aria-label="Icon" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!c.parent_id} disabled className="accent-violet-600" />
                    {c.parent_id ? "Danh mục con" : "Danh mục chính"}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Banner trang chủ</h3>
            <div className="space-y-3 mt-3">
              {banners.map((b, i) => (
                <div key={b.id} className="vd-card-flat p-3 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input value={b.title} onChange={(e) => { const n = [...banners]; n[i] = { ...b, title: e.target.value }; setEditBanners(n); }} className="field" aria-label="Tiêu đề banner" />
                    <input value={b.cta_link} onChange={(e) => { const n = [...banners]; n[i] = { ...b, cta_link: e.target.value }; setEditBanners(n); }} className="field" aria-label="Link nút" />
                    <input value={b.subtitle} onChange={(e) => { const n = [...banners]; n[i] = { ...b, subtitle: e.target.value }; setEditBanners(n); }} className="field" aria-label="Phụ đề" />
                    <input value={b.cta_text} onChange={(e) => { const n = [...banners]; n[i] = { ...b, cta_text: e.target.value }; setEditBanners(n); }} className="field" aria-label="Chữ nút" />
                  </div>
                  <ImageUpload kind="banners" label="Ảnh banner" ratio="aspect-[2/1]" value={b.image_url ?? null} onChange={(url) => { const n = [...banners]; n[i] = { ...b, image_url: url }; setEditBanners(n); }} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.is_active} onChange={(e) => { const n = [...banners]; n[i] = { ...b, is_active: e.target.checked }; setEditBanners(n); }} className="accent-violet-600" /> Đang hiển thị</label>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Câu hỏi thường gặp (FAQ)</h3>
            <div className="space-y-3 mt-3">
              {faqs.map((f, i) => (
                <div key={f.id} className="vd-card-flat p-3 space-y-2">
                  <input value={f.question} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, question: e.target.value }; setEditFaqs(n); }} className="field" aria-label="Câu hỏi" />
                  <textarea rows={2} value={f.answer} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, answer: e.target.value }; setEditFaqs(n); }} className="field" aria-label="Câu trả lời" />
                </div>
              ))}
            </div>
          </div>
          <ActionButton busy={busyKey === "save-content"} onClick={saveContent}>
            {busyKey === "save-content" ? "Đang lưu…" : "Lưu danh mục / banner / FAQ"}
          </ActionButton>
        </div>
      )}

      {tab === "emails" && (
        <div className="mt-5 space-y-5">
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Mẫu email giao hàng</h3>
            <p className="text-sm vd-muted mt-1">
              Chỉnh tiêu đề + nội dung mail theo từng loại giao hàng. Mẫu riêng của sản phẩm thắng mẫu chung của loại.
              Bấm vào biến để chèn vào nội dung (con trỏ sẽ thêm vào cuối).
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="field-label">Loại giao hàng</span>
                <select value={tplType} onChange={(e) => selectTemplate(e.target.value as EmailTemplateType, tplProductId)} className="field">
                  {EMAIL_TEMPLATE_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Áp dụng cho</span>
                <select value={tplProductId} onChange={(e) => selectTemplate(tplType, e.target.value)} className="field">
                  <option value="">— Tất cả sản phẩm (mẫu chung) —</option>
                  {catalog.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {EMAIL_VARIABLES.map((v) => (
                <button key={v} onClick={() => setTplBody((b) => b + ` ${v}`)} className="chip !py-1 !px-2.5 text-xs font-mono" title={`Chèn biến ${v}`}>
                  {v}
                </button>
              ))}
            </div>
            <label className="block mt-3">
              <span className="field-label">Tiêu đề email</span>
              <input value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} className="field" />
            </label>
            <label className="block mt-3">
              <span className="field-label">Nội dung email</span>
              <textarea rows={12} value={tplBody} onChange={(e) => setTplBody(e.target.value)} className="field font-mono text-sm" />
            </label>
            <div className="flex flex-wrap gap-2 mt-3">
              <ActionButton busy={busyKey === "save-template"} onClick={saveTemplate}>
                {busyKey === "save-template" ? "Đang lưu…" : "Lưu mẫu"}
              </ActionButton>
              <button onClick={() => setTplShowPreview((v) => !v)} className="btn-outline !py-2.5 text-sm">
                {tplShowPreview ? "Ẩn xem trước" : "Xem trước với dữ liệu mẫu"}
              </button>
              <ActionButton busy={busyKey === "reset-template"} onClick={resetTemplate} className="btn-outline !py-2.5 text-sm">
                {busyKey === "reset-template" ? "Đang khôi phục…" : "Khôi phục mẫu mặc định"}
              </ActionButton>
            </div>
            {tplShowPreview && (
              <div className="mt-4 rounded-xl border vd-border p-4 text-sm">
                <p className="font-bold">Xem trước — dữ liệu mẫu</p>
                <p className="mt-2"><b>Tiêu đề:</b> {renderEmailTemplate(tplSubject, SAMPLE_EMAIL_VARS)}</p>
                <div className="mt-2 whitespace-pre-line leading-relaxed">
                  {renderEmailTemplate(tplBody, SAMPLE_EMAIL_VARS)}
                </div>
              </div>
            )}
          </div>
          <div className="vd-card p-4">
            <h3 className="font-display font-bold">Mẫu đã lưu</h3>
            {templates.filter((t) => !t.is_default).length === 0 ? (
              <p className="text-sm vd-muted mt-2">Chưa lưu mẫu riêng nào — đang dùng mẫu mặc định của hệ thống.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {templates.filter((t) => !t.is_default).map((t) => (
                  <li key={`${t.type}-${t.product_id ?? "all"}`}>
                    <button
                      className="text-brand-400 hover:underline"
                      onClick={() => selectTemplate(t.type, t.product_id ?? "")}
                    >
                      {EMAIL_TEMPLATE_TYPES.find((x) => x.type === t.type)?.label} — {t.product_id ? catalog.products.find((p) => p.id === t.product_id)?.name ?? t.product_id : "Tất cả sản phẩm"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-5 max-w-2xl space-y-4 text-sm">
          {!settings ? (
            <p className="vd-muted">Đang tải cài đặt…</p>
          ) : (
            <>
              {settings.supabase &&
                settings.env?.find((e: { name: string }) => e.name.includes("SERVICE_ROLE"))?.configured === false && (
                  <div role="alert" className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
                    <p className="font-bold text-red-400">Thiếu SUPABASE_SERVICE_ROLE_KEY — đơn hàng sẽ không lưu được</p>
                    <p className="mt-1 text-sm">
                      Server đang dùng anon key nên Supabase chặn ghi đơn (“permission denied for table orders”).
                      Lấy key service_role ở Supabase → Settings → API, thêm vào Vercel → Settings → Environment
                      Variables (dạng Secret) rồi Redeploy. Không thêm policy INSERT cho anon.
                    </p>
                  </div>
                )}
              <div className="vd-card p-5">
                <h3 className="font-display font-bold">Trạng thái cấu hình</h3>
                <p className="text-xs vd-muted mt-1">
                  {settings.supabase
                    ? `Supabase đã cấu hình (URL từ ${settings.supabaseSources?.urlFrom ?? "?"}, key từ ${settings.supabaseSources?.keyFrom ?? "?"}).`
                    : "Supabase chưa cấu hình — kiểm tra lại tên biến trong Vercel (xem README mục “Biến môi trường”)."}
                </p>
                <table className="mt-3 w-full text-left">
                  <tbody>
                    {settings.env.map((e: { name: string; configured: boolean; required: boolean }) => (
                      <tr key={e.name} className="border-t vd-border">
                        <td className="py-2 pr-2 font-mono text-xs">{e.name}{e.required ? " *" : ""}</td>
                        <td className={`py-2 text-right font-semibold ${e.configured ? "text-emerald-400" : e.required ? "text-red-400" : "text-amber-400"}`}>
                          {e.configured ? "Đã có" : e.required ? "Thiếu" : "Chưa có"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs vd-muted2 mt-2">* Bắt buộc. PayOS / Mail / MB Bank chưa có thì shop vẫn chạy ở chế độ demo tương ứng.</p>
              </div>
              <div className="vd-card p-5 space-y-2">
                <p><b>PayOS:</b> {settings.payos.configured ? `Đã cấu hình (client ${settings.payos.clientId})` : "Chưa cấu hình — đang dùng chế độ demo"}</p>
                <p><b>Mail (Gmail SMTP):</b> {settings.mail.configured ? `Đã cấu hình — ${settings.mail.smtpUser}` : "Chưa cấu hình — đơn vẫn hoàn tất, chỉ log mail chưa gửi"}</p>
                <p><b>Ngân hàng nhận tiền:</b> {settings.bank.name} — STK {settings.bank.account} ({settings.bank.accountName})</p>
                <p><b>Site URL:</b> {settings.siteUrl}</p>
                <p className="vd-muted pt-2">
                  Key và App Password chỉ sửa qua biến môi trường (file .env.local hoặc Vercel &gt; Settings &gt; Environment Variables),
                  không sửa trong trang này và không bao giờ gửi trong chat.
                </p>
              </div>
              <div className="vd-card p-5">
                <h3 className="font-display font-bold">Quản lý tài khoản admin</h3>
                <p className="text-xs vd-muted mt-1">
                  Đổi mật khẩu, sửa tên hiển thị, phương thức đăng nhập và đăng xuất — tất cả nằm ở trang Quản lý tài khoản riêng (không còn trong tab Cài đặt này).
                  Mật khẩu tạm lần đầu rất yếu — đổi ngay sang mật khẩu mạnh (ít nhất 8 ký tự, có chữ + số) sau khi đăng nhập.
                </p>
                <Link href="/tai-khoan/quan-ly" className="btn-primary mt-3 inline-flex !py-2.5 text-sm">
                  Mở Quản lý tài khoản
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
