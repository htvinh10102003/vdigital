import { ProductList } from "@/components/ProductList";

export default function SanPhamPage({
  searchParams,
}: {
  searchParams?: { q?: string; cat?: string; sort?: string };
}) {
  return (
    <ProductList
      title="Tất cả sản phẩm"
      description="Tài khoản bản quyền số, thẻ game và công cụ — giá tốt, giao nhanh, bảo hành uy tín."
      initialQuery={searchParams?.q ?? ""}
      initialCategory={searchParams?.cat ?? ""}
      initialSort={(searchParams?.sort as never) ?? "newest"}
    />
  );
}
