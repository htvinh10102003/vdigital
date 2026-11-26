import { ProductList } from "@/components/ProductList";

export default function BanChayPage() {
  return (
    <ProductList
      title="Bán chạy"
      description="Những sản phẩm được mua nhiều nhất tại VDigital."
      initialSort="best"
    />
  );
}
