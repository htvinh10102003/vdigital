import type { Product } from "@/lib/types";

/** Ảnh placeholder: gradient + chữ cái đầu — không dùng logo/ảnh của hãng. */
export function ProductImage({
  product,
  className = "",
  textSize = "text-4xl",
}: {
  product: Product;
  className?: string;
  textSize?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${product.gradient} flex items-center justify-center ${className}`}
      aria-label={product.name}
    >
      <span className={`font-black text-white/90 drop-shadow ${textSize}`}>{product.initials}</span>
    </div>
  );
}
