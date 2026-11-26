export function formatVND(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

/** Số lượng bán: hiện số thật chính xác, có phân tách hàng nghìn — KHÔNG làm tròn "3.5k". */
export function formatSold(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(n)));
}

/** Điểm sao trung bình: 1 chữ số thập phân, vd "4.5". Trả "" khi chưa có đánh giá. */
export function formatRating(rating: number, reviewCount: number): string {
  if (!reviewCount || !rating) return "";
  return String(Math.round(rating * 10) / 10);
}

export function discountPct(price: number, original: number): number {
  if (!original || original <= price) return 0;
  return Math.round((1 - price / original) * 100);
}

/** Số giây còn lại tới thời điểm ISO; <= 0 nếu đã hết. */
export function secondsLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Ngày dạng dd/mm/yyyy (vd hạn bảo hành). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Còn trong hạn bảo hành không (v4.8): có hạn và chưa quá ngày đó. */
export function isWithinWarranty(warrantyEndsAt: string | null | undefined): boolean {
  if (!warrantyEndsAt) return false;
  return new Date(warrantyEndsAt).getTime() >= Date.now();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
