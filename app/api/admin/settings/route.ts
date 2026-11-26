import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { isMailConfigured } from "@/lib/email";
import { isPayosConfigured } from "@/lib/payos";

/** Trạng thái cấu hình cho tab Cài đặt — key chỉ hiện dạng đã che, không trả key thật. */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}…${v.slice(-4)}` : "chưa cấu hình");
  return NextResponse.json({
    admin: email,
    supabase: isSupabaseConfigured,
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

/**
 * Lưu sửa sản phẩm (tên, mô tả, giá gói...) từ /admin.
 * Body: { products: Product[] } — khi có Supabase sẽ upsert vào DB;
 * chưa có thì trả demo:true để client lưu override vào localStorage.
 */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = await req.json();
    const products = (body as { products?: unknown[] }).products ?? [];
    const sb = getSupabaseServer();
    if (sb && isSupabaseConfigured) {
      for (const p of products as any[]) {
        await sb.from("products").upsert({
          id: p.id,
          slug: p.slug,
          category_id: p.category_id,
          name: p.name,
          tagline: p.tagline,
          description: p.description,
          guide: p.guide,
          warranty_days: p.warranty_days,
          rating: p.rating,
          review_count: p.review_count,
          sold_count: p.sold_count,
          is_featured: p.is_featured,
          is_new: p.is_new,
          is_best_seller: p.is_best_seller,
          is_active: p.is_active,
          gradient: p.gradient,
          initials: p.initials,
        });
        for (const v of p.variants ?? []) {
          await sb.from("variants").upsert({
            id: v.id,
            product_id: p.id,
            name: v.name,
            label: v.label,
            price: v.price,
            original_price: v.original_price,
            fulfillment_type: v.fulfillment_type,
            is_flash: v.is_flash,
            flash_ends_at: v.flash_ends_at,
            stock_count: v.stock_count,
            is_active: v.is_active,
            sort_order: v.sort_order,
          });
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
