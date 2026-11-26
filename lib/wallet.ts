import { getSupabaseServer, isSupabaseConfigured } from "./supabase";

/**
 * Ví Xu (1 Xu = 1đ) — mọi thay đổi số dư đi qua RPC wallet_adjust
 * (migration 009): cộng/trừ + ghi sổ wallet_transactions trong 1
 * transaction, số dư không bao giờ âm. Server KHÔNG bao giờ tự tính
 * số dư bằng cách đọc rồi cộng tay — tránh race khi 2 giao dịch cùng lúc.
 */

export type WalletTxType = "topup" | "spend" | "checkin" | "admin_adjust" | "refund" | "review";

export interface WalletTransaction {
  id: string;
  user_id: string | null;
  customer_email: string;
  type: WalletTxType;
  amount: number;
  balance_after: number;
  ref_code: string | null;
  note: string | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Đọc 1 cài đặt shop (bảng shop_settings), sai/thiếu thì trả fallback. */
export async function getShopSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    if (!isSupabaseConfigured) return fallback;
    const sb = getSupabaseServer();
    if (!sb) return fallback;
    const { data } = await sb.from("shop_settings").select("value").eq("key", key).single();
    if (data?.value === undefined || data?.value === null) return fallback;
    return data.value as T;
  } catch {
    return fallback;
  }
}

export async function getCheckinAmounts(): Promise<{ daily: number; sunday: number }> {
  const daily = await getShopSetting<number>("checkin_daily_amount", 50);
  const sunday = await getShopSetting<number>("checkin_sunday_amount", 200);
  return { daily: Number(daily) || 50, sunday: Number(sunday) || 200 };
}

/**
 * Đảm bảo có dòng profiles cho user (signup không tự tạo profile).
 * Upsert theo id = auth uid. Trả về id profile hoặc null khi không có Supabase.
 */
export async function ensureProfile(
  userId: string | null,
  email: string,
  name?: string | null,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  if (!userId || !UUID_RE.test(userId)) return null;
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { error } = await sb.from("profiles").upsert(
    { id: userId, email: email.trim().toLowerCase(), name: name?.trim() || null },
    { onConflict: "id" },
  );
  if (error) {
    console.error("[wallet] ensureProfile failed:", error.message);
    return null;
  }
  return userId;
}

/** Số dư hiện tại (0 nếu chưa có profile). */
export async function getWalletBalance(
  userId: string | null,
  email: string,
): Promise<{ balance: number; profileId: string | null }> {
  if (!isSupabaseConfigured) return { balance: 0, profileId: null };
  const sb = getSupabaseServer();
  if (!sb) return { balance: 0, profileId: null };
  const mail = email.trim().toLowerCase();
  if (userId && UUID_RE.test(userId)) {
    const { data } = await sb.from("profiles").select("id, xu_balance").eq("id", userId).single();
    if (data) return { balance: Number(data.xu_balance ?? 0), profileId: data.id };
  }
  const { data } = await sb.from("profiles").select("id, xu_balance").eq("email", mail).single();
  if (data) return { balance: Number(data.xu_balance ?? 0), profileId: data.id };
  return { balance: 0, profileId: null };
}

/**
 * Cộng/trừ số dư qua RPC (nguyên tử + ghi sổ). Ném lỗi với message
 * 'PROFILE_NOT_FOUND' | 'INSUFFICIENT_BALANCE' để route trả lỗi rõ ràng.
 * Trả về số dư sau khi đổi.
 */
export async function adjustBalance(input: {
  userId: string | null;
  email: string;
  amount: number; // dương = cộng, âm = trừ
  type: WalletTxType;
  refCode?: string | null;
  note?: string | null;
}): Promise<number> {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) throw new Error("Supabase chưa cấu hình");
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("Số tiền phải là số nguyên khác 0");
  }
  const { data, error } = await sb.rpc("wallet_adjust", {
    p_user_id: input.userId && UUID_RE.test(input.userId) ? input.userId : null,
    p_email: input.email.trim().toLowerCase(),
    p_amount: input.amount,
    p_type: input.type,
    p_ref_code: input.refCode ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("PROFILE_NOT_FOUND")) throw new Error("PROFILE_NOT_FOUND");
    if (msg.includes("INSUFFICIENT_BALANCE")) throw new Error("INSUFFICIENT_BALANCE");
    throw new Error(`Lỗi cập nhật số dư: ${msg}`);
  }
  return Number(data);
}

/** Lịch sử ví của 1 khách (mới nhất trước). */
export async function listWalletTransactions(
  userId: string | null,
  email: string,
  limit = 50,
): Promise<WalletTransaction[]> {
  if (!isSupabaseConfigured) return [];
  const sb = getSupabaseServer();
  if (!sb) return [];
  const mail = email.trim().toLowerCase();
  const { data } = await sb
    .from("wallet_transactions")
    .select("*")
    .or(`user_id.eq.${userId ?? ""},customer_email.eq.${mail}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as WalletTransaction[];
}

/** Mã PayOS riêng cho nạp tiền: khác dãy mã đơn hàng, kiểm tra trùng trong DB. */
export async function newTopupCode(): Promise<number> {
  const sb = getSupabaseServer();
  for (let i = 0; i < 5; i++) {
    // 2.0–2.1 tỷ: không trùng mã đơn (mã đơn ~1.79 tỷ, epoch seconds).
    const code = 2000000000 + (Math.floor(Date.now() / 1000) % 100000000) + Math.floor(Math.random() * 100);
    if (!sb || !isSupabaseConfigured) return code;
    const { data } = await sb.from("wallet_topups").select("id").eq("payos_order_code", code).single();
    if (!data) return code;
  }
  return 2000000000 + Math.floor(Math.random() * 99999999);
}
