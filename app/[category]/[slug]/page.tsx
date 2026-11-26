import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { getCatalog } from "@/lib/store";

export default async function ProductPage({ params }: { params: { category: string; slug: string } }) {
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.slug === params.slug);
  if (!product) notFound();
  return <ProductDetail slug={product.slug} catalog={catalog} />;
}
