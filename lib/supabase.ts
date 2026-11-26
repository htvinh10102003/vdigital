import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Email admin mặc định của VDigital (chỉ VDigital — không đổi của Our Days / AWSAMELIE).
export const DEFAULT_ADMIN_EMAIL = "contact.hotavinh@gmail.com";

// Keys công khai (anon) — service_role KHÔNG bao giờ xuất hiện ở client.
// Module này không throw khi chưa cấu hình env: các trang kiểm tra
// isSupabaseConfigured và chạy ở chế độ demo với dữ liệu seed.
//
// CHẨN ĐOÁN DEMO-MODE (đã sửa 26/11): code cũ chỉ đọc đúng 2 tên biến
// NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY. Vercel
// Supabase integration có thể tạo biến với tên KHÔNG có tiền tố
// NEXT_PUBLIC_ (SUPABASE_URL / SUPABASE_ANON_KEY), hoặc dùng key
// publishable mới (sb_publishable_...) thay cho anon JWT cũ — khi đó code
// cũ vẫn coi như "chưa cấu hình" và rơi về demo dù Vinh đã link Supabase
// trong Vercel. Bản này chấp nhận CẢ hai kiểu tên, theo thứ tự ưu tiên
// dưới đây. Tab Cài đặt trong /admin hiện rõ từng biến nào đã có.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

export const isSupabaseConfigured = Boolean(url && anonKey);

export function supabaseEnvSources(): { urlFrom: string | null; keyFrom: string | null } {
  return {
    urlFrom: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : process.env.SUPABASE_URL
        ? "SUPABASE_URL"
        : null,
    keyFrom: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      : process.env.SUPABASE_ANON_KEY
        ? "SUPABASE_ANON_KEY"
        : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
          : process.env.SUPABASE_PUBLISHABLE_KEY
            ? "SUPABASE_PUBLISHABLE_KEY"
            : null,
  };
}

/** Chẩn đoán từng biến môi trường — chỉ trả tên + có/không, KHÔNG trả giá trị. */
export function envDiagnostics(): { name: string; configured: boolean; required: boolean }[] {
  const has = (name: string) => Boolean(process.env[name]);
  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL (hoặc SUPABASE_URL)", configured: Boolean(url), required: true },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY (hoặc SUPABASE_ANON_KEY / key publishable)", configured: Boolean(anonKey), required: true },
    { name: "SUPABASE_SERVICE_ROLE_KEY (hoặc SUPABASE_SECRET_KEY)", configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY), required: true },
    { name: "PAYOS_CLIENT_ID", configured: has("PAYOS_CLIENT_ID"), required: false },
    { name: "PAYOS_API_KEY", configured: has("PAYOS_API_KEY"), required: false },
    { name: "PAYOS_CHECKSUM_KEY", configured: has("PAYOS_CHECKSUM_KEY"), required: false },
    { name: "SMTP_USER", configured: has("SMTP_USER"), required: false },
    { name: "SMTP_PASS", configured: has("SMTP_PASS"), required: false },
    { name: "ADMIN_EMAILS", configured: has("ADMIN_EMAILS") || has("NEXT_PUBLIC_ADMIN_EMAILS"), required: false },
    { name: "MB_BANK_ACCOUNT", configured: has("MB_BANK_ACCOUNT"), required: false },
    { name: "NEXT_PUBLIC_SITE_URL", configured: has("NEXT_PUBLIC_SITE_URL"), required: false },
  ];
}

let browserClient: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!browserClient) browserClient = createClient(url, anonKey);
  return browserClient;
}

/** Client phía server (API routes). Dùng service_role khi có, để đọc/ghi kho + đơn. */
export function getSupabaseServer(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url && serviceKey) return createClient(url, serviceKey);
  return getSupabase();
}

/** Key service_role đã cấu hình chưa (server-only). */
export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

/**
 * Lỗi rõ ràng khi Supabase đã cấu hình nhưng thiếu service_role.
 * Không có service_role, server rơi về dùng anon key — mà bảng orders chỉ có
 * policy SELECT cho chủ đơn, KHÔNG có policy INSERT cho anon, nên PostgREST
 * trả 42501 "permission denied for table orders". Không được "sửa" bằng cách
 * thêm policy INSERT cho anon (ai cũng ghi được đơn giả). Cách sửa đúng duy
 * nhất: thêm SUPABASE_SERVICE_ROLE_KEY vào Vercel rồi Redeploy.
 */
export const SERVICE_ROLE_MISSING_MESSAGE =
  "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên Vercel — đơn chưa được lưu, hãy thêm key service_role trong Vercel → Settings → Environment Variables rồi Redeploy";

/** Ném lỗi rõ ràng trên thay vì để RLS trả "permission denied for table orders". */
export function requireServiceRoleForWrite(): void {
  if (isSupabaseConfigured && !hasServiceRole()) throw new Error(SERVICE_ROLE_MISSING_MESSAGE);
}

/**
 * Gộp danh sách email admin từ các nguồn env + email mặc định.
 * Quy tắc (sửa 26/11 sau lỗi "Không có quyền"): DEFAULT_ADMIN_EMAIL
 * (contact.hotavinh@gmail.com) LUÔN nằm trong danh sách — trước đây nó chỉ
 * được thêm khi env rỗng, nên nếu trên Vercel đặt ADMIN_EMAILS /
 * NEXT_PUBLIC_ADMIN_EMAILS là email khác thì tài khoản mặc định bị loại
 * khỏi admin. Chỉ áp dụng cho VDigital, không đổi admin Our Days/AWSAMELIE.
 */
export function resolveAdminEmails(...rawLists: (string | undefined | null)[]): string[] {
  const list = rawLists
    .flatMap((raw) => (raw || "").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const merged = [...new Set(list)];
  if (!merged.includes(DEFAULT_ADMIN_EMAIL)) merged.push(DEFAULT_ADMIN_EMAIL);
  return merged;
}

export function adminEmails(): string[] {
  return resolveAdminEmails(process.env.ADMIN_EMAILS, process.env.NEXT_PUBLIC_ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
