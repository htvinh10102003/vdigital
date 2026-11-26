"use client";

import { useEffect, useState } from "react";
import { formatCountdown, secondsLeft } from "@/lib/format";

export function Countdown({ endsAt, className = "" }: { endsAt: string | null; className?: string }) {
  const [left, setLeft] = useState(() => secondsLeft(endsAt));
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setLeft(secondsLeft(endsAt)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt || left <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-bold text-brand-400 ${className}`}>
      ⏱ {formatCountdown(left)}
    </span>
  );
}
