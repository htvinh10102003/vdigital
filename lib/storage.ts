import { getSupabaseServer, isSupabaseConfigured, requireServiceRoleForWrite } from "./supabase";

/** Bucket ảnh riêng của VDigital (xem migration 003). */
export const MEDIA_BUCKET = "vdigital-media";

/** URL công khai của 1 file trong bucket (đường dẫn tương đối vd "products/abc.webp"). */
export function publicMediaUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Upload buffer lên Storage bằng service_role (chỉ gọi phía server). */
export async function uploadMedia(
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const sb = getSupabaseServer();
  if (!sb || !isSupabaseConfigured) throw new Error("Chưa cấu hình Supabase — không up được ảnh.");
  // Ghi Storage cần service_role — không có thì báo rõ thay vì lỗi RLS/storage khó hiểu.
  requireServiceRoleForWrite();
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Up ảnh thất bại: ${error.message}`);
  return publicMediaUrl(path);
}
