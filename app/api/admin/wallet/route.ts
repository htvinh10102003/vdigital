import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { adjustBalance, getCheckinAmounts, listWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Tra cứu ví khách theo email.
 * GET ?email=... — trả số dư + hồ sơ + lịch sử + mức điểm danh hiện tại.
 * Chưa có tài khoản thì báo found:false và cho biết email đó đã từng
 * đặt đơn chưa (để admin phân biệt "khách cũ chưa đăng ký" với "nhầm email").
 */
export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const q = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!q || !EMAIL_RE.test(q)) return err("Thiếu email khách cần tra cứu");
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return err("Supabase chưa cấu hình", 500);

  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, name, xu_balance")
    .ilike("email", q)
    .single();

  const amounts = await getCheckinAmounts();

  if (!profile) {
    const { data: order } = await sb
      .from("orders")
      .select("id")
      .ilike("customer_email", q)
      .limit(1)
      .single();
    return NextResponse.json({
      found: false,
      balance: 0,
      profile: null,
      transactions: [],
      orders_exist: Boolean(order),
      checkin: { daily_amount: amounts.daily, sunday_amount: amounts.sunday },
    });
  }

  const transactions = await listWalletTransactions(profile.id, profile.email, 50);
  return NextResponse.json({
    found: true,
    balance: Number(profile.xu_balance ?? 0),
    profile: { id: profile.id, email: profile.email, name: profile.name ?? null },
    transactions,
    checkin: { daily_amount: amounts.daily, sunday_amount: amounts.sunday },
  });
}

export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return err("Thiếu dữ liệu");
    const action = body.action;

    if (action === "adjust") {
      const targetEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!EMAIL_RE.test(targetEmail)) return err("Email khách không hợp lệ");
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount === 0) {
        return err("Số Xu chỉnh phải là số nguyên khác 0");
      }
      if (Math.abs(amount) > 50_000_000) {
        return err("Mỗi lần chỉnh tối đa 50.000.000 Xu");
      }
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : "Admin chỉnh tay";
      const sb = getSupabaseServer();
      if (!sb || !isSupabaseConfigured) return err("Supabase chưa cấu hình", 500);
      const { data: profile } = await sb
        .from("profiles")
        .select("id, email")
        .ilike("email", targetEmail)
        .single();
      if (!profile) {
        return err("Email này chưa có tài khoản — khách cần đăng nhập/đăng ký trước", 404);
      }
      const balance = await adjustBalance({
        userId: profile.id,
        email: profile.email,
        amount,
        type: "admin_adjust",
        refCode: `ADMIN-${Date.now()}`,
        note,
      });
      return NextResponse.json({ ok: true, balance });
    }

    if (action === "settings") {
      const daily = Number(body.daily);
      const sunday = Number(body.sunday);
      if (!Number.isInteger(daily) || daily < 0 || daily > 10_000) {
        return err("Số Xu điểm danh ngày thường phải là số nguyên từ 0 đến 10.000");
      }
      if (!Number.isInteger(sunday) || sunday < 0 || sunday > 10_000) {
        return err("Số Xu điểm danh chủ nhật phải là số nguyên từ 0 đến 10.000");
      }
      const sb = getSupabaseServer();
      if (!sb || !isSupabaseConfigured) return err("Supabase chưa cấu hình", 500);
      const { error } = await sb.from("shop_settings").upsert([
        { key: "checkin_daily_amount", value: daily },
        { key: "checkin_sunday_amount", value: sunday },
      ]);
      if (error) return err(`Không lưu được cài đặt: ${error.message}`, 500);
      return NextResponse.json({ ok: true });
    }

    return err("Action không hợp lệ (dùng 'adjust' hoặc 'settings')");
  } catch (e) {
    console.error("[admin/wallet POST]", e);
    if (e instanceof Error && e.message === "PROFILE_NOT_FOUND") {
      return err("Email này chưa có tài khoản — khách cần đăng nhập/đăng ký trước", 404);
    }
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      return err("Số dư không đủ để trừ", 400);
    }
    return err(e instanceof Error ? e.message : "Lỗi xử lý ví", 500);
  }
}
