import { getSupabase } from "@/lib/supabase";

/** Lấy Supabase access token của phiên hiện tại (null khi chưa đăng nhập /
    Supabase chưa cấu hình). Dùng cho các API ví / voucher / điểm danh. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface WalletTransaction {
  id: string;
  type: "topup" | "spend" | "checkin" | "admin_adjust" | "refund" | "review";
  amount: number;
  balance_after: number;
  ref_code: string | null;
  note: string | null;
  created_at: string;
}

export interface WalletBalanceResponse {
  balance: number;
  transactions: WalletTransaction[];
}

export const WALLET_TX_LABELS: Record<WalletTransaction["type"], string> = {
  topup: "Nạp tiền",
  spend: "Thanh toán đơn",
  checkin: "Điểm danh",
  admin_adjust: "Admin chỉnh",
  refund: "Hoàn tiền",
  review: "Thưởng đánh giá",
};

export interface PublicVoucher {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  expires_at: string | null;
}

export function voucherLabel(v: PublicVoucher): string {
  const off = v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${new Intl.NumberFormat("vi-VN").format(v.value)}đ`;
  return `${v.code} — ${off}${v.min_order > 0 ? ` · Đơn từ ${new Intl.NumberFormat("vi-VN").format(v.min_order)}đ` : ""}`;
}
