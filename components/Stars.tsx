import { Star } from "lucide-react";

/**
 * Hàng 5 sao với tô một phần theo điểm lẻ (vd 4.5 sao: 4 sao vàng đầy +
 * nửa sao thứ 5). Dùng cho điểm đánh giá TRUNG BÌNH THẬT từ bảng reviews.
 * Khi chưa có đánh giá thì component cha không render Stars mà hiện chữ
 * "Chưa có đánh giá" — không bao giờ hiện sao giả.
 */
export function Stars({
  value,
  size = 14,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (filled: boolean) => (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          className={filled ? "text-amber-400" : "text-slate-600"}
          fill="currentColor"
        />
      ))}
    </span>
  );
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      role="img"
      aria-label={`${value} trên 5 sao`}
    >
      {row(false)}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row(true)}
      </span>
    </span>
  );
}
