import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/**
 * Xác thực khách hàng cho API routes (chuông thông báo...).
 * Giống lib/admin-auth.ts nhưng không kiểm tra quyền admin: client gửi
 * Authorization: Bearer <access_token>, server kiểm tra user qua
 * Supabase Auth và chỉ trả user khi token hợp lệ. Không bao giờ tin
 * email do client tự gửi lên.
 */
export async function getCustomerUser(req: Request): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Chưa đăng nhập" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
