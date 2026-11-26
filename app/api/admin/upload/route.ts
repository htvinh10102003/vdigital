import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { uploadMedia } from "@/lib/storage";
import { slugify } from "@/lib/format";

/**
 * Upload ảnh sản phẩm / banner / danh mục lên Supabase Storage.
 * FormData: file (image/*), kind: "products" | "banners" | "categories".
 * Server nhận file đã được client nén/resize về WebP trước (xem
 * components/ImageUpload.tsx). Giới hạn 5MB/file, chỉ nhận ảnh.
 * Trả về { url } — URL public, lưu vào DB (image_url / images), không
 * lưu base64 vào DB và không commit ảnh vào repo.
 */
export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || "products");
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Chưa chọn file ảnh" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Chỉ nhận file ảnh" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Ảnh quá lớn (tối đa 5MB sau khi nén)" }, { status: 400 });
    }
    const safeKind = ["products", "banners", "categories"].includes(kind) ? kind : "products";
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "anh";
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    const path = `${safeKind}/${Date.now()}-${base}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await uploadMedia(path, bytes, file.type);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Up ảnh thất bại" },
      { status: 500 },
    );
  }
}
