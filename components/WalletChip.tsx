"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { useAuth } from "./providers";
import { formatVND } from "@/lib/format";
import { getAccessToken } from "@/lib/wallet-client";

/**
 * Chip số dư Xu ở header, cạnh chuông thông báo — chỉ hiện khi đã đăng nhập
 * tài khoản thật (Supabase đã cấu hình). Chưa tải xong thì không hiện gì
 * để header không nhấp nháy.
 */
export function WalletChip() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const hasRealSession = Boolean(user && !user.isDemo);

  const fetchBalance = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setBalance(Number(json.balance ?? 0));
    } catch {
      /* mạng lỗi: giữ nguyên, chip không vỡ */
    }
  }, []);

  useEffect(() => {
    if (!hasRealSession) {
      setBalance(null);
      return;
    }
    fetchBalance();
  }, [hasRealSession, fetchBalance]);

  // Lắng nghe sự kiện cập nhật số dư (vd sau khi điểm danh / nạp tiền ở
  // trang tài khoản) để chip refresh mà không cần tải lại trang.
  useEffect(() => {
    const onUpdate = () => fetchBalance();
    window.addEventListener("vdigital:wallet-updated", onUpdate);
    return () => window.removeEventListener("vdigital:wallet-updated", onUpdate);
  }, [fetchBalance]);

  if (!hasRealSession || balance === null) return null;
  return (
    <Link
      href="/tai-khoan"
      title="Ví Xu — xem số dư và nạp tiền"
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border vd-border px-3 text-sm font-bold text-amber-300 hover:border-amber-400/60 hover:text-amber-200"
    >
      <Coins size={17} aria-hidden="true" />
      <span>{formatVND(balance)}</span>
      <span className="hidden sm:inline">Xu</span>
    </Link>
  );
}
