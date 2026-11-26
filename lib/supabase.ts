import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Keys công khai (anon) — service_role KHÔNG bao giờ xuất hiện ở client.
// Module này không throw khi chưa cấu hình env: các trang kiểm tra
// isSupabaseConfigured và chạy ở chế độ demo với dữ liệu seed.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!browserClient) browserClient = createClient(url, anonKey);
  return browserClient;
}

/** Client phía server (API routes). Dùng service_role khi có, để đọc/ghi kho + đơn. */
export function getSupabaseServer(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return createClient(url, serviceKey);
  return getSupabase();
}

export function adminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
