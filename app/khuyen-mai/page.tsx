import { ProductList } from "@/components/ProductList";

export default function KhuyenMaiPage() {
  return (
    <ProductList
      title="Khuyến mãi — Flash Sale"
      description="Ưu đãi có thời hạn, giá được cập nhật trực tiếp từ sản phẩm. Hết giờ là hết giá sale."
      initialSort="discount"
      onlyFlash
    />
  );
}
