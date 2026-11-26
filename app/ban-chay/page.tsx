import { ProductList } from "@/components/ProductList";
import { getCatalog } from "@/lib/store";

export default async function BanChayPage() {
  const catalog = await getCatalog();
  return (
    <ProductList
      title="Bán chạy"
      description="Những sản phẩm được mua nhiều nhất tại VDigital."
      initialSort="best"
      catalog={catalog}
    />
  );
}
