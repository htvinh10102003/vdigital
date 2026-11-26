import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { envDiagnostics, getSupabaseServer, isSupabaseConfigured, supabaseEnvSources } from "@/lib/supabase";
import { isMailConfigured } from "@/lib/email";
import { isPayosConfigured } from "@/lib/payos";

/** Trạng thái cấu hình cho tab Cài đặt — chỉ hiện tên biến + có/không, không trả giá trị thật. */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}…${v.slice(-4)}` : "chưa cấu hình");
  return NextResponse.json({
    admin: email,
    supabase: isSupabaseConfigured,
    supabaseSources: supabaseEnvSources(),
    env: envDiagnostics(),
    payos: {
      configured: isPayosConfigured,
      clientId: mask(process.env.PAYOS_CLIENT_ID),
      apiKey: mask(process.env.PAYOS_API_KEY),
      checksumKey: mask(process.env.PAYOS_CHECKSUM_KEY),
    },
    mail: {
      configured: isMailConfigured,
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpUser: process.env.SMTP_USER || "chưa cấu hình",
      from: process.env.EMAIL_FROM || "chưa cấu hình",
      note: "Dùng Gmail riêng của shop + App Password (bật 2FA rồi tạo tại myaccount.google.com). Không dùng Gmail cá nhân.",
    },
    bank: {
      name: process.env.MB_BANK_NAME || "MB Bank",
      account: mask(process.env.MB_BANK_ACCOUNT),
      accountName: process.env.MB_BANK_ACCOUNT_NAME || "chưa cấu hình",
    },
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "chưa cấu hình",
  });
}

function variantRow(v: any, productId: string) {
  return {
    id: v.id,
    product_id: productId,
    name: v.name ?? v.label,
    label: v.label,
    price: v.price,
    original_price: v.original_price,
    fulfillment_type: v.fulfillment_type,
    option_type: v.option_type ?? "duration",
    option_label: v.option_label ?? null,
    delivery_template: v.delivery_template ?? "",
    delivery_note: v.delivery_note ?? "",
    // "Thông tin khách cần cung cấp" cho gói làm tay — lưu dạng jsonb.
    // DB chưa chạy migration 005 (chưa có cột) thì upsert sẽ lỗi; khi đó
    // route bắt lỗi và lưu lại không kèm manual_fields (xem POST bên dưới).
    manual_fields: v.manual_fields ?? [],
    is_flash: v.is_flash,
    flash_ends_at: v.flash_ends_at,
    stock_count: v.stock_count,
    is_active: v.is_active,
    sort_order: v.sort_order,
  };
}

/**
 * Lưu từ /admin. Body có thể gồm:
 * { products: Product[] } — upsert sản phẩm + gói (tạo mới khi id chưa có),
 * { categories: Category[] }, { banners: Banner[] }, { faqs: Faq[] }.
 * Khi có Supabase sẽ upsert vào DB; chưa có thì trả demo:true để client
 * lưu override vào localStorage.
 */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = await req.json();
    const products = (body as { products?: any[] }).products ?? [];
    const categories = (body as { categories?: any[] }).categories ?? [];
    const banners = (body as { banners?: any[] }).banners ?? [];
    const faqs = (body as { faqs?: any[] }).faqs ?? [];
    const sb = getSupabaseServer();
    if (sb && isSupabaseConfigured) {
      for (const c of categories) {
        await sb.from("categories").upsert({
          id: c.id,
          slug: c.slug,
          name: c.name,
          parent_id: c.parent_id ?? null,
          sort_order: c.sort_order ?? 0,
          icon: c.icon ?? null,
          image_url: c.image_url ?? null,
        });
      }
      for (const b of banners) {
        await sb.from("banners").upsert({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle ?? "",
          cta_text: b.cta_text ?? "",
          cta_link: b.cta_link ?? "/san-pham",
          gradient: b.gradient ?? "from-indigo-600 to-violet-600",
          image_url: b.image_url ?? null,
          is_active: b.is_active,
          sort_order: b.sort_order ?? 0,
        });
      }
      for (const f of faqs) {
        await sb.from("faqs").upsert({
          id: f.id,
          question: f.question,
          answer: f.answer,
          sort_order: f.sort_order ?? 0,
        });
      }
      for (const p of products as any[]) {
        const { error: pErr } = await sb.from("products").upsert({
          id: p.id,
          slug: p.slug,
          category_id: p.category_id,
          name: p.name,
          tagline: p.tagline ?? "",
          description: p.description ?? "",
          guide: p.guide ?? "",
          warranty_days: p.warranty_days ?? 30,
          rating: p.rating ?? 5,
          review_count: p.review_count ?? 0,
          sold_count: p.sold_count ?? 0,
          is_featured: p.is_featured,
          is_new: p.is_new,
          is_best_seller: p.is_best_seller,
          is_active: p.is_active,
          product_type: p.product_type ?? "account",
          account_type: p.account_type ?? "shared",
          image_url: p.image_url ?? null,
          images: p.images ?? [],
          gradient: p.gradient ?? "from-indigo-600 to-violet-600",
          initials: p.initials ?? "VD",
        });
        if (pErr) throw new Error(`Lưu sản phẩm ${p.name}: ${pErr.message}`);
        for (const v of p.variants ?? []) {
          const row = variantRow(v, p.id);
          let { error: vErr } = await sb.from("variants").upsert(row);
          // DB chưa chạy migration 005 (chưa có cột manual_fields) thì lưu
          // lại không kèm cột đó — sản phẩm vẫn lưu được, không hỏng.
          if (vErr && vErr.message.includes("manual_fields")) {
            const { manual_fields: _mf, ...rowNoMf } = row;
            ({ error: vErr } = await sb.from("variants").upsert(rowNoMf));
          }
          if (vErr) throw new Error(`Lưu gói ${v.label}: ${vErr.message}`);
        }
      }
      return NextResponse.json({ ok: true, mode: "supabase", saved: products.length });
    }
    return NextResponse.json({
      ok: true,
      mode: "demo",
      saved: products.length,
      note: "Chưa có Supabase — client sẽ lưu bản sửa vào trình duyệt (localStorage).",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi lưu sản phẩm" }, { status: 500 });
  }
}
