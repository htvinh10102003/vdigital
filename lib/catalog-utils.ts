import type { Category, Product, Variant } from "./types";

/** Đường dẫn chi tiết: /{danh-mục-cha}/{slug} — vd /tai-khoan-ban-quyen/capcut-pro */
export function categoryPath(categories: Category[], product: Product): string {
  const cat = categories.find((c) => c.id === product.category_id);
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const top = parent?.slug ?? cat?.slug ?? "san-pham";
  return `/${top}/${product.slug}`;
}

export function activeVariants(p: Product): Variant[] {
  return [...p.variants].filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

export function minPrice(p: Product): number {
  const vs = activeVariants(p);
  return vs.length ? Math.min(...vs.map((v) => v.price)) : 0;
}

export function maxDiscount(p: Product): number {
  return Math.max(
    0,
    ...p.variants.map((v) => (v.original_price > v.price ? 1 - v.price / v.original_price : 0)),
  );
}

export function isGameCard(p: Product): boolean {
  return p.product_type === "game_card" || p.account_type === "game_card";
}

/** Nhãn nhóm lựa chọn ở trang chi tiết: ưu tiên option_label admin đặt, rồi suy ra từ option_type. */
export function optionGroupLabel(v: Variant | undefined): string {
  if (!v) return "Chọn gói";
  if (v.option_label?.trim()) return v.option_label.trim();
  switch (v.option_type) {
    case "denomination":
      return "Chọn mệnh giá";
    case "token_pack":
      return "Chọn gói token";
    case "seats":
      return "Chọn số ghế / thiết bị";
    case "custom":
      return "Chọn lựa chọn";
    default:
      return "Chọn gói";
  }
}

/**
 * Chia sản phẩm thành các nhóm KHÔNG trùng nhau cho trang chủ — một sản phẩm
 * chỉ xuất hiện ở đúng một section. Thẻ game có section riêng, không lẫn
 * vào Flash / Nổi bật / Bán chạy, nên mỗi thẻ game chỉ có đúng 1 card.
 */
export function partitionHome(products: Product[]) {
  const active = products.filter((p) => p.is_active);
  const games = active.filter(isGameCard);
  const rest = active.filter((p) => !isGameCard(p));
  const used = new Set<string>();
  const take = (list: Product[], n: number) => {
    const out = list.filter((p) => !used.has(p.id)).slice(0, n);
    out.forEach((p) => used.add(p.id));
    return out;
  };
  const flash = take(
    // Flash Sale chỉ hiện khi còn hạn thật (flash_ends_at trong tương lai).
    rest.filter((p) =>
      p.variants.some((v) => v.is_flash && v.flash_ends_at && new Date(v.flash_ends_at).getTime() > Date.now()),
    ),
    5,
  );
  const featured = take(
    rest.filter((p) => p.is_featured),
    5,
  );
  // "Bán chạy" = top lượt mua THẬT (đếm từ đơn đã thanh toán), không dùng
  // cờ is_best_seller do admin tự tick.
  const best = take(
    [...rest].sort((a, b) => b.sold_count - a.sold_count).filter((p) => p.sold_count > 0),
    5,
  );
  const newest = take(
    rest.filter((p) => p.is_new),
    5,
  );
  const more = rest.filter((p) => !used.has(p.id)).slice(0, 5);
  return { flash, featured, best, newest, games, more };
}

/** Đếm số lần một sản phẩm xuất hiện trong HTML — dùng cho test chống trùng card. */
export function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}
