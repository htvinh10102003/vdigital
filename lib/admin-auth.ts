import { getSupabaseServer, isAdminEmail, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Xác thực admin cho API routes.
 * - Đã cấu hình Supabase: client gửi Authorization: Bearer <access_token>,
 *   server kiểm tra user qua Supabase Auth rồi đối chiếu ADMIN_EMAILS.
 * - Chưa cấu hình (demo): client gửi header x-demo-admin: 1.
 */
export async function getAdminEmail(req: Request): Promise<string | null> {
  if (isSupabaseConfigured) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const sb = getSupabaseServer();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return isAdminEmail(data.user.email) ? data.user.email : null;
  }
  if (req.headers.get("x-demo-admin") === "1") return "admin@vdigital.vn";
  return null;
}

export function forbidden() {
  return new Response(JSON.stringify({ error: "Không có quyền admin" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
