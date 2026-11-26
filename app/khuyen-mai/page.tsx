import { ProductList } from "@/components/ProductList";
import { getCatalog } from "@/lib/store";

export default async function KhuyenMaiPage() {
  const catalog = await getCatalog();
  return (
    <ProductList
      title="Khuyến mãi — Flash Sale"
      description="Ưu đãi có thời hạn, giá được cập nhật trực tiếp từ sản phẩm. Hết giờ là hết giá sale."
      initialSort="discount"
      onlyFlash
      catalog={catalog}
    />
  );
}
