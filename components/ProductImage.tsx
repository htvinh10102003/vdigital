import Image from "next/image";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
  className?: string;
  textSize?: string;
  priority?: boolean;
}

/**
 * Ảnh sản phẩm: dùng next/image khi admin đã up ảnh (image_url),
 * chưa có ảnh thì fallback ô màu + chữ viết tắt — không dùng
 * logo/ảnh của hãng khác.
 */
export function ProductImage({ product, className = "", textSize = "text-2xl", priority }: Props) {
  const label = product.initials;
  if (product.image_url) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${product.gradient} ${className}`}>
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          className="object-cover"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${product.gradient} ${className}`}>
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.5) 0, transparent 30%), radial-gradient(circle at 80% 85%, rgba(255,255,255,0.35) 0, transparent 35%)",
        }}
      />
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-white">
        <span className={`font-black leading-none drop-shadow ${textSize}`}>{label}</span>
        <span className="text-[11px] font-semibold text-white/90 line-clamp-2 leading-tight">{product.name}</span>
      </div>
    </div>
  );
}
