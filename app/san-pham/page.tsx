import { ProductList } from "@/components/ProductList";
import { getCatalog } from "@/lib/store";

export default async function SanPhamPage({
  searchParams,
}: {
  searchParams?: { q?: string; cat?: string; sort?: string };
}) {
  const catalog = await getCatalog();
  return (
    <ProductList
      title="Tất cả sản phẩm"
      description="Tài khoản bản quyền số, thẻ game và công cụ — giá tốt, giao nhanh, bảo hành uy tín."
      initialQuery={searchParams?.q ?? ""}
      initialCategory={searchParams?.cat ?? ""}
      initialSort={(searchParams?.sort as never) ?? "newest"}
      catalog={catalog}
    />
  );
}
