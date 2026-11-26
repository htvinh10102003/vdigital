"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown, secondsLeft } from "@/lib/format";

export function Countdown({ endsAt, className = "" }: { endsAt: string | null; className?: string }) {
  const [left, setLeft] = useState(() => secondsLeft(endsAt));
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setLeft(secondsLeft(endsAt)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt || left <= 0) return null;
  // Đồng hồ đếm ngược tick theo giây: server render lúc T, client hydrate
  // lúc T+1s nên text khác nhau 1–2 giây. suppressHydrationWarning để React
  // không báo lỗi hydration (và không render lại toàn bộ cây) vì chênh này.
  return (
    <span suppressHydrationWarning className={`inline-flex items-center gap-1 font-mono text-xs font-bold text-brand-400 ${className}`}>
      <Timer size={13} aria-hidden="true" /> {formatCountdown(left)}
    </span>
  );
}
