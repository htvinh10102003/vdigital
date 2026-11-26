import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { createNotification } from "@/lib/notifications";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { adjustBalance, ensureProfile, getCheckinAmounts } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const TZ = "Asia/Ho_Chi_Minh";

/** Ngày hiện tại (YYYY-MM-DD) theo giờ Việt Nam. */
function todaySaigon(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Chủ nhật theo giờ Việt Nam? (0 = Chủ nhật). */
function isSundaySaigon(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

/** Trừ n ngày khỏi ngày YYYY-MM-DD, trả lại YYYY-MM-DD. */
function minusDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Chuỗi ngày điểm danh liên tiếp kết thúc hôm nay (hoặc hôm qua nếu hôm
 * nay chưa điểm danh). Đếm ngược từng ngày trong lịch VN từ danh sách
 * ngày đã điểm danh.
 */
function calcStreak(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : minusDays(today, 1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = minusDays(cursor, 1);
  }
  return streak;
}

async function loadCheckinDates(userId: string): Promise<Set<string>> {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) return new Set();
  const { data } = await sb
    .from("checkins")
    .select("checkin_date")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .limit(400);
  return new Set((data ?? []).map((r: { checkin_date: string }) => String(r.checkin_date).slice(0, 10)));
}

/** Trạng thái điểm danh hôm nay + chuỗi ngày + mức thưởng. */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const today = todaySaigon();
  const dates = await loadCheckinDates(user.id);
  const amounts = await getCheckinAmounts();
  return NextResponse.json({
    checked_in_today: dates.has(today),
    streak: calcStreak(dates, today),
    daily_amount: amounts.daily,
    sunday_amount: amounts.sunday,
  });
}

/** Điểm danh hôm nay — nhận Xu (Chủ nhật thưởng gấp mức ngày thường). */
export async function POST(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  try {
    const sb = getSupabaseServer();
    if (!sb || !isSupabaseConfigured) return unauthorized();
    const today = todaySaigon();
    const dates = await loadCheckinDates(user.id);
    if (dates.has(today)) {
      return NextResponse.json({ already: true, streak: calcStreak(dates, today) });
    }

    const amounts = await getCheckinAmounts();
    const amount = isSundaySaigon() ? amounts.sunday : amounts.daily;
    const name =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      undefined;
    const profileId = await ensureProfile(user.id, user.email, name);
    if (!profileId) {
      return NextResponse.json({ error: "Không tạo được hồ sơ khách hàng" }, { status: 500 });
    }

    const { error: insErr } = await sb.from("checkins").insert({
      user_id: user.id,
      customer_email: user.email.trim().toLowerCase(),
      checkin_date: today,
      amount,
    });
    if (insErr) {
      // UNIQUE(user_id, checkin_date) — 2 lần bấm cùng lúc thì lần sau
      // coi như đã điểm danh, không cộng Xu 2 lần.
      if (insErr.code === "23505" || /duplicate|unique/i.test(insErr.message)) {
        const fresh = await loadCheckinDates(user.id);
        return NextResponse.json({ already: true, streak: calcStreak(fresh, today) });
      }
      console.error("[checkin] insert failed:", insErr.message);
      return NextResponse.json({ error: "Điểm danh thất bại, vui lòng thử lại" }, { status: 500 });
    }

    const balance = await adjustBalance({
      userId: user.id,
      email: user.email,
      amount,
      type: "checkin",
      refCode: `CHECKIN-${today}`,
      note: "Điểm danh",
    });
    await createNotification({
      userId: user.id,
      email: user.email,
      type: "info",
      title: "Điểm danh thành công",
      body: `Bạn nhận được ${amount} Xu điểm danh ngày ${today}.`,
    });
    const fresh = await loadCheckinDates(user.id);
    return NextResponse.json({ ok: true, amount, streak: calcStreak(fresh, today), balance });
  } catch (err) {
    console.error("[checkin]", err);
    if (err instanceof Error && err.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "Chưa có hồ sơ khách hàng — vui lòng đăng nhập lại" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Điểm danh thất bại" },
      { status: 500 },
    );
  }
}
