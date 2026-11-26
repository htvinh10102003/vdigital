import { notFound } from "next/navigation";
import { ProductList } from "@/components/ProductList";
import { SEED_CATALOG } from "@/lib/seed";

export default function CategoryPage({ params }: { params: { category: string } }) {
  const cat = SEED_CATALOG.categories.find((c) => c.slug === params.category);
  if (!cat) notFound();
  const subs = SEED_CATALOG.categories.filter((c) => c.parent_id === cat.id);
  return (
    <ProductList
      title={cat.name}
      description={
        subs.length > 0
          ? `Gồm: ${subs.map((s) => s.name).join(" · ")}`
          : `Sản phẩm thuộc danh mục ${cat.name}.`
      }
      initialCategory={cat.slug}
    />
  );
}
