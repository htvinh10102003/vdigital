import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { SEED_CATALOG } from "@/lib/seed";

export default function ProductPage({ params }: { params: { category: string; slug: string } }) {
  const product = SEED_CATALOG.products.find((p) => p.slug === params.slug);
  if (!product) notFound();
  return <ProductDetail slug={product.slug} />;
}
